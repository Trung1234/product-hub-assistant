from __future__ import annotations

import logging
import os
import threading
import time
from collections.abc import Callable, Mapping, Sequence
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import requests
from dotenv import load_dotenv

from .models import TrendRecord, TrendType


LOGGER = logging.getLogger(__name__)
API_BASE_URL = "https://api.pinterest.com/v5"
VALID_TREND_TYPES = {"growing", "monthly", "yearly", "seasonal"}


class PinterestError(RuntimeError):
    """Base exception for Pinterest ingestion failures."""


class PinterestConfigurationError(PinterestError):
    """Raised when required credentials or options are absent."""


class PinterestAPIError(PinterestError):
    def __init__(self, status_code: int, response_body: str):
        self.status_code = status_code
        self.response_body = response_body
        super().__init__(f"Pinterest API returned HTTP {status_code}: {response_body}")


class PinterestResponseShapeError(PinterestError):
    """Raised when the live API response no longer matches a supported shape."""


class PinterestNetworkError(PinterestError):
    """Raised for transport failures; these are not retried by SPEC-001."""


class PerMinuteRateLimiter:
    """Thread-safe, evenly-spaced limiter (60 calls/minute => one/second)."""

    def __init__(
        self,
        calls_per_minute: int = 60,
        *,
        sleep: Callable[[float], None] = time.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        if calls_per_minute <= 0:
            raise ValueError("calls_per_minute must be positive")
        self._interval = 60.0 / calls_per_minute
        self._sleep = sleep
        self._monotonic = monotonic
        self._next_allowed = 0.0
        self._lock = threading.Lock()

    def acquire(self) -> None:
        with self._lock:
            now = self._monotonic()
            wait_seconds = max(0.0, self._next_allowed - now)
            if wait_seconds:
                self._sleep(wait_seconds)
                now = self._monotonic()
            self._next_allowed = max(now, self._next_allowed) + self._interval


class NoOpRateLimiter:
    """Useful for dependency-injected unit tests; never use for live loops."""

    def acquire(self) -> None:
        return None


DEFAULT_PROCESS_RATE_LIMITER = PerMinuteRateLimiter(60)


class PinterestClient:
    def __init__(
        self,
        access_token: str | None = None,
        *,
        session: requests.Session | None = None,
        api_base_url: str = API_BASE_URL,
        rate_limiter: PerMinuteRateLimiter | NoOpRateLimiter | None = None,
        sleep: Callable[[float], None] = time.sleep,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
        raw_cache: Any | None = None,
    ) -> None:
        load_dotenv()
        token = (access_token or os.getenv("PINTEREST_ACCESS_TOKEN", "")).strip()
        if not token:
            raise PinterestConfigurationError(
                "PINTEREST_ACCESS_TOKEN is missing. Put it in .env or pass access_token explicitly."
            )
        if max_retries < 0:
            raise ValueError("max_retries cannot be negative")

        self._session = session or requests.Session()
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }
        self._api_base_url = api_base_url.rstrip("/")
        # Shared across default clients so parallel adapters in this process do
        # not each assume they own the complete 60/minute allowance.
        self._rate_limiter = rate_limiter or DEFAULT_PROCESS_RATE_LIMITER
        self._sleep = sleep
        self._timeout_seconds = timeout_seconds
        self._max_retries = max_retries
        self._raw_cache = raw_cache

    def fetch_trends(
        self,
        region: str,
        trend_type: TrendType,
        include_keywords: list[str] | None = None,
        limit: int = 50,
    ) -> list[TrendRecord]:
        normalized_region = region.strip().upper()
        normalized_type = str(trend_type).strip().lower()
        if not normalized_region or not normalized_region.replace("-", "").isalpha():
            raise ValueError("region must be a country/market code such as US, CA, or GB-IE")
        if normalized_type not in VALID_TREND_TYPES:
            raise ValueError(
                f"trend_type must be one of {sorted(VALID_TREND_TYPES)}, got {trend_type!r}"
            )
        if not 1 <= limit <= 50:
            raise ValueError("limit must be between 1 and 50")

        keywords = [keyword.strip() for keyword in include_keywords or [] if keyword.strip()]
        if len(keywords) > 50:
            raise ValueError("include_keywords cannot contain more than 50 values")
        if any(len(keyword) > 100 for keyword in keywords):
            raise ValueError("each include_keywords value must be 100 characters or fewer")
        endpoint = (
            f"{self._api_base_url}/trends/keywords/{quote(normalized_region)}/top/"
            f"{quote(normalized_type)}"
        )
        params: list[tuple[str, str | int]] = [
            ("limit", limit),
            ("normalize_against_group", "true"),
        ]
        # Pinterest's OpenAPI query parameter is an array. Repeating the key lets
        # requests encode it without inventing a delimiter inside a keyword.
        params.extend(("include_keywords", keyword) for keyword in keywords)

        payload, status_code = self._get_json(endpoint, params)
        raw_records = _extract_records(payload)
        retrieved_at = _utc_now_iso()
        records = [
            _parse_trend_record(
                item,
                region=normalized_region,
                trend_type=normalized_type,
                retrieved_at=retrieved_at,
            )
            for item in raw_records
        ]
        LOGGER.info(
            "Pinterest call endpoint=%s params=%s status=%s records=%s",
            endpoint,
            _safe_params(params),
            status_code,
            len(records),
        )
        return records

    def _get_json(
        self,
        endpoint: str,
        params: list[tuple[str, str | int]],
    ) -> tuple[Any, int]:
        for retry_count in range(self._max_retries + 1):
            self._rate_limiter.acquire()
            try:
                response = self._session.get(
                    endpoint,
                    headers=self._headers,
                    params=params,
                    timeout=self._timeout_seconds,
                )
            except requests.RequestException as exc:
                LOGGER.error(
                    "Pinterest call endpoint=%s params=%s status=NETWORK_ERROR records=0",
                    endpoint,
                    _safe_params(params),
                )
                raise PinterestNetworkError(f"Pinterest request failed: {exc}") from exc
            status_code = response.status_code

            retryable = status_code == 429 or 500 <= status_code < 600
            if retryable and retry_count < self._max_retries:
                delay = _retry_delay_seconds(response, retry_count + 1)
                LOGGER.warning(
                    "Pinterest retry endpoint=%s params=%s status=%s retry=%s/%s delay=%ss",
                    endpoint,
                    _safe_params(params),
                    status_code,
                    retry_count + 1,
                    self._max_retries,
                    delay,
                )
                self._sleep(delay)
                continue

            if not 200 <= status_code < 300:
                body = _response_text(response)
                LOGGER.error(
                    "Pinterest call endpoint=%s params=%s status=%s records=0",
                    endpoint,
                    _safe_params(params),
                    status_code,
                )
                raise PinterestAPIError(status_code, body)

            try:
                payload = response.json()
            except ValueError as exc:
                raise PinterestResponseShapeError(
                    f"Pinterest returned non-JSON content with HTTP {status_code}"
                ) from exc

            if self._raw_cache is not None:
                self._raw_cache.put(
                    {
                        "endpoint": endpoint,
                        "params": _safe_params(params),
                        "status": status_code,
                        "response": payload,
                    }
                )
            return payload, status_code

        raise AssertionError("retry loop ended unexpectedly")


def fetch_trends(
    region: str,
    trend_type: TrendType,
    include_keywords: list[str] | None = None,
    limit: int = 50,
) -> list[TrendRecord]:
    """Environment-configured convenience interface required by SPEC-001."""

    return PinterestClient().fetch_trends(region, trend_type, include_keywords, limit)


def _extract_records(payload: Any) -> list[Mapping[str, Any]]:
    candidates: Any = payload
    if isinstance(payload, Mapping):
        for key in ("trends", "items", "data"):
            if key in payload:
                candidates = payload[key]
                break
    if not isinstance(candidates, Sequence) or isinstance(candidates, (str, bytes)):
        keys = sorted(payload.keys()) if isinstance(payload, Mapping) else []
        raise PinterestResponseShapeError(
            "Expected a list of trends under 'trends', 'items', or 'data'; "
            f"top-level keys were {keys}. Run probe_access.py --show-body and update the parser."
        )
    if not all(isinstance(item, Mapping) for item in candidates):
        raise PinterestResponseShapeError("Every trend record must be a JSON object")
    return list(candidates)


def _parse_trend_record(
    item: Mapping[str, Any],
    *,
    region: str,
    trend_type: str,
    retrieved_at: str,
) -> TrendRecord:
    keyword = str(item.get("keyword") or "").strip()
    if not keyword:
        raise PinterestResponseShapeError("Trend record is missing a non-empty 'keyword'")
    return TrendRecord(
        keyword=keyword,
        pct_growth_wow=_optional_float(item.get("pct_growth_wow")),
        pct_growth_mom=_optional_float(item.get("pct_growth_mom")),
        pct_growth_yoy=_optional_float(item.get("pct_growth_yoy")),
        time_series=_parse_time_series(item.get("time_series")),
        region=region,
        trend_type=trend_type,
        retrieved_at=retrieved_at,
    )


def _parse_time_series(raw: Any) -> dict[str, int]:
    if raw is None:
        return {}
    if isinstance(raw, Mapping):
        parsed: dict[str, int] = {}
        for key, value in raw.items():
            if isinstance(value, Mapping):
                value = value.get("value", value.get("interest"))
            parsed[str(key)] = _interest_index(value)
        return parsed
    if isinstance(raw, Sequence) and not isinstance(raw, (str, bytes)):
        parsed = {}
        for index, point in enumerate(raw, start=1):
            if isinstance(point, Mapping):
                date = point.get("date") or point.get("week") or point.get("timestamp")
                value = point.get("value", point.get("interest"))
                if date is None or value is None:
                    raise PinterestResponseShapeError(
                        "time_series list objects require date/week/timestamp and value/interest"
                    )
                parsed[str(date)] = _interest_index(value)
            else:
                parsed[f"week_{index:02d}"] = _interest_index(point)
        return parsed
    raise PinterestResponseShapeError(
        f"Unsupported time_series type {type(raw).__name__}; inspect the first live response"
    )


def _interest_index(value: Any) -> int:
    if isinstance(value, bool):
        raise PinterestResponseShapeError("time_series interest cannot be boolean")
    try:
        number = int(round(float(value)))
    except (TypeError, ValueError) as exc:
        raise PinterestResponseShapeError(f"Invalid time_series interest value: {value!r}") from exc
    if not 0 <= number <= 100:
        raise PinterestResponseShapeError(
            f"time_series interest must be in the 0-100 range, got {number}"
        )
    return number


def _optional_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise PinterestResponseShapeError("Growth value cannot be boolean")
    if isinstance(value, str):
        value = value.strip().removesuffix("%")
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise PinterestResponseShapeError(f"Invalid growth value: {value!r}") from exc


def _retry_delay_seconds(response: Any, attempt: int) -> float:
    exponential = float(2 ** (attempt - 1))
    retry_after = getattr(response, "headers", {}).get("Retry-After")
    if retry_after:
        try:
            return max(exponential, min(float(retry_after), 60.0))
        except ValueError:
            pass
    return exponential


def _response_text(response: Any) -> str:
    text = getattr(response, "text", "")
    return text if text else "<empty response body>"


def _safe_params(params: list[tuple[str, str | int]]) -> dict[str, Any]:
    safe: dict[str, Any] = {}
    for key, value in params:
        if key == "include_keywords":
            safe.setdefault(key, []).append(value)
        else:
            safe[key] = value
    return safe


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
