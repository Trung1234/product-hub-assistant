from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .demand_score import calculate_demand_score
from .keyword_mapper import KeywordMapper, PRODUCT_TYPE_METADATA
from .manual_snapshot import ManualPinSnapshot, load_manual_pins
from .models import MappingResult, TrendRecord
from .pinterest_client import PinterestClient


RAW_TTL = timedelta(hours=6)
FORBIDDEN_FIELDS = {"revenue", "sales", "units_sold", "quantity", "gmv"}
REQUIRED_SIGNAL_FIELDS = {
    "source",
    "source_type",
    "keyword",
    "canonical_product_type",
    "category",
    "market",
    "trend_type",
    "growth_wow",
    "growth_mom",
    "growth_yoy",
    "current_interest_index",
    "pinterest_demand_score",
    "score_breakdown",
    "mapping_method",
    "confidence",
    "collected_at",
    "expires_at",
}


def ingest_seed_trends(
    client: PinterestClient,
    mapper: KeywordMapper,
    *,
    region: str,
    trend_type: str = "growing",
    limit: int = 50,
    seasonality_fit: float | None = None,
) -> list[dict[str, Any]]:
    """Fetch each product family's seeds in its own normalization group."""

    signals: list[dict[str, Any]] = []
    for product_type, seeds in mapper.seeds_by_product_type.items():
        records = client.fetch_trends(
            region,
            trend_type,  # type: ignore[arg-type]
            include_keywords=seeds,
            limit=limit,
        )
        for record in records:
            mapping = mapper.mapping_for_seed(product_type, record.keyword)
            signals.append(
                trend_to_signal(
                    record,
                    mapping,
                    seasonality_fit=seasonality_fit,
                )
            )
    return signals


def ingest_discovery_trends(
    client: PinterestClient,
    mapper: KeywordMapper,
    *,
    region: str,
    trend_type: str = "growing",
    limit: int = 50,
    seasonality_fit: float | None = None,
) -> list[dict[str, Any]]:
    """Fetch unfiltered trends and retain high-confidence or UNMAPPED results."""

    records = client.fetch_trends(
        region,
        trend_type,  # type: ignore[arg-type]
        include_keywords=None,
        limit=limit,
    )
    return [
        trend_to_signal(
            record,
            mapper.map_keyword(record.keyword),
            seasonality_fit=seasonality_fit,
        )
        for record in records
    ]


def trend_to_signal(
    trend: TrendRecord,
    mapping: MappingResult,
    *,
    seasonality_fit: float | None,
) -> dict[str, Any]:
    current_interest = _latest_interest(trend.time_series)
    score_result = calculate_demand_score(
        current_interest=current_interest,
        pct_growth_yoy=trend.pct_growth_yoy,
        pct_growth_mom=trend.pct_growth_mom,
        seasonality_fit=seasonality_fit,
    )
    collected_at = _parse_utc(trend.retrieved_at)
    signal: dict[str, Any] = {
        "source": "pinterest_trends",
        "source_type": "demand_interest_signal",
        "keyword": trend.keyword,
        "canonical_product_type": mapping.canonical_product_type or "UNMAPPED",
        "category": mapping.category,
        "market": trend.region,
        "trend_type": trend.trend_type,
        "growth_wow": trend.pct_growth_wow,
        "growth_mom": trend.pct_growth_mom,
        "growth_yoy": trend.pct_growth_yoy,
        "current_interest_index": current_interest,
        "pinterest_demand_score": score_result.score if score_result else None,
        "score_breakdown": score_result.breakdown if score_result else {},
        "missing_components": (
            score_result.missing_components
            if score_result
            else ["yoy_growth", "mom_growth"]
        ),
        "mapping_method": mapping.method,
        "confidence": (
            round(mapping.confidence * score_result.confidence, 2) if score_result else 0.0
        ),
        "collected_at": _iso(collected_at),
        "expires_at": _iso(collected_at + RAW_TTL),
    }
    validate_signal(signal)
    return signal


def manual_snapshots_to_signals(
    snapshots: list[ManualPinSnapshot],
) -> list[dict[str, Any]]:
    """Expose Plan B evidence without fabricating unavailable growth metrics."""

    signals: list[dict[str, Any]] = []
    for snapshot in snapshots:
        collected_at = _parse_manual_time(snapshot.observed_at)
        metadata = PRODUCT_TYPE_METADATA.get(snapshot.canonical_product_type, {})
        signal: dict[str, Any] = {
            "source": "pinterest_manual_snapshot",
            "source_type": "demand_interest_signal",
            "keyword": snapshot.keyword,
            "canonical_product_type": snapshot.canonical_product_type or "UNMAPPED",
            "category": metadata.get("category"),
            "market": snapshot.region,
            "trend_type": "manual_snapshot",
            "growth_wow": None,
            "growth_mom": None,
            "growth_yoy": None,
            "current_interest_index": None,
            "pinterest_demand_score": None,
            "score_breakdown": {},
            "missing_components": [
                "current_interest",
                "yoy_growth",
                "mom_growth",
                "seasonality_fit",
            ],
            "mapping_method": "seed",
            "confidence": 0.0,
            "collected_at": _iso(collected_at),
            "expires_at": _iso(collected_at + RAW_TTL),
            "manual_evidence": {
                "top_pin_theme": snapshot.top_pin_theme,
                "observed_saves": snapshot.observed_saves,
                "notes": snapshot.notes,
                "observed_at": snapshot.observed_at,
            },
        }
        validate_signal(signal)
        signals.append(signal)
    return signals


def load_manual_signals(
    path: str | Path = "data/manual_pins_snapshot.csv",
) -> list[dict[str, Any]]:
    return manual_snapshots_to_signals(load_manual_pins(path))


def write_signals(
    signals: list[dict[str, Any]],
    path: str | Path = "data/pinterest_signals.json",
) -> Path:
    for signal in signals:
        validate_signal(signal)
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_suffix(output_path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(signals, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(output_path)
    return output_path


def validate_signal(signal: dict[str, Any]) -> None:
    missing = sorted(REQUIRED_SIGNAL_FIELDS - set(signal))
    if missing:
        raise ValueError(f"Pinterest signal is missing required fields: {', '.join(missing)}")
    forbidden = sorted(_find_forbidden_fields(signal))
    if forbidden:
        raise ValueError(f"Pinterest signal contains forbidden fields: {', '.join(forbidden)}")
    if not signal["canonical_product_type"]:
        raise ValueError("canonical_product_type cannot be null or empty")
    score = signal["pinterest_demand_score"]
    if score is not None and not 0.0 <= float(score) <= 100.0:
        raise ValueError("pinterest_demand_score must be null or between 0 and 100")
    confidence = float(signal["confidence"])
    if not 0.0 <= confidence <= 1.0:
        raise ValueError("confidence must be between 0 and 1")
    collected = _parse_utc(signal["collected_at"])
    expires = _parse_utc(signal["expires_at"])
    if expires < collected or expires - collected > RAW_TTL:
        raise ValueError("expires_at must be no more than six hours after collected_at")


def _latest_interest(time_series: dict[str, int]) -> int | None:
    if not time_series:
        return None
    # Official responses use ISO-8601 week-ending keys; lexical order is then
    # chronological. The week_XX fallback parser follows the same property.
    latest_key = max(time_series)
    return time_series[latest_key]


def _find_forbidden_fields(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            normalized_key = str(key).casefold()
            if normalized_key in FORBIDDEN_FIELDS:
                found.add(str(key))
            found.update(_find_forbidden_fields(child))
    elif isinstance(value, list):
        for child in value:
            found.update(_find_forbidden_fields(child))
    return found


def _parse_manual_time(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _parse_utc(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        raise ValueError("Timestamp must include a timezone")
    return parsed.astimezone(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
