from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


LOGGER = logging.getLogger(__name__)
MAX_TTL_HOURS = 6.0


class RawResponseCache:
    """File-backed ephemeral cache exclusively for raw Pinterest API payloads."""

    def __init__(
        self,
        directory: str | Path = "data/pinterest_cache/raw",
        *,
        ttl_hours: float = MAX_TTL_HOURS,
    ) -> None:
        if not 0 < ttl_hours <= MAX_TTL_HOURS:
            raise ValueError(f"Raw Pinterest TTL must be > 0 and <= {MAX_TTL_HOURS} hours")
        self.directory = Path(directory)
        self.ttl = timedelta(hours=ttl_hours)

    def put(self, payload: Any, *, now: datetime | None = None) -> Path:
        current = _as_utc(now or datetime.now(timezone.utc))
        self.directory.mkdir(parents=True, exist_ok=True)
        self.purge_expired(now=current)
        cache_id = uuid.uuid4().hex
        path = self.directory / f"{cache_id}.json"
        envelope = {
            "cached_at": _iso(current),
            "expires_at": _iso(current + self.ttl),
            "payload": payload,
        }
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(envelope, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        temporary.replace(path)
        return path

    def purge_expired(self, *, now: datetime | None = None) -> int:
        if not self.directory.exists():
            return 0
        current = _as_utc(now or datetime.now(timezone.utc))
        purged = 0
        for path in self.directory.glob("*.json"):
            try:
                envelope = json.loads(path.read_text(encoding="utf-8"))
                expires_at = _parse_utc(envelope["expires_at"])
            except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
                LOGGER.warning("PURGE_INVALID_PINTEREST_CACHE path=%s error=%s", path, exc)
                path.unlink(missing_ok=True)
                purged += 1
                continue
            if expires_at <= current:
                path.unlink(missing_ok=True)
                purged += 1
        return purged


def purge_expired(
    directory: str | Path = "data/pinterest_cache/raw", *, now: datetime | None = None
) -> int:
    return RawResponseCache(directory).purge_expired(now=now)


def _parse_utc(value: str) -> datetime:
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    return _as_utc(datetime.fromisoformat(normalized))


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("Cache timestamps must be timezone-aware")
    return value.astimezone(timezone.utc)


def _iso(value: datetime) -> str:
    return _as_utc(value).isoformat().replace("+00:00", "Z")
