from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


REQUIRED_COLUMNS = {
    "keyword",
    "canonical_product_type",
    "region",
    "top_pin_theme",
    "observed_saves",
    "observed_at",
    "notes",
}


@dataclass(frozen=True)
class ManualPinSnapshot:
    keyword: str
    canonical_product_type: str
    region: str
    top_pin_theme: str
    observed_saves: int | None
    observed_at: str
    notes: str


def load_manual_pins(path: str | Path = "data/manual_pins_snapshot.csv") -> list[ManualPinSnapshot]:
    """Load the optional human-entered Plan B snapshot.

    An absent file is intentionally equivalent to no optional evidence. A file
    that exists but violates the contract fails loudly.
    """

    csv_path = Path(path)
    if not csv_path.exists():
        return []

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = set(reader.fieldnames or [])
        missing = sorted(REQUIRED_COLUMNS - headers)
        if missing:
            raise ValueError(
                f"Manual Pinterest snapshot {csv_path} is missing required columns: "
                + ", ".join(missing)
            )

        snapshots: list[ManualPinSnapshot] = []
        for row_number, row in enumerate(reader, start=2):
            keyword = (row.get("keyword") or "").strip()
            product_type = (row.get("canonical_product_type") or "").strip().upper()
            region = (row.get("region") or "").strip().upper()
            observed_at = (row.get("observed_at") or "").strip()
            if not keyword:
                raise ValueError(f"Row {row_number}: keyword is required")
            if not product_type:
                raise ValueError(f"Row {row_number}: canonical_product_type is required")
            if not region:
                raise ValueError(f"Row {row_number}: region is required")
            _validate_observed_at(observed_at, row_number)
            observed_saves = _optional_nonnegative_int(
                row.get("observed_saves"), row_number, "observed_saves"
            )
            snapshots.append(
                ManualPinSnapshot(
                    keyword=keyword,
                    canonical_product_type=product_type,
                    region=region,
                    top_pin_theme=(row.get("top_pin_theme") or "").strip(),
                    observed_saves=observed_saves,
                    observed_at=observed_at,
                    notes=(row.get("notes") or "").strip(),
                )
            )
    return snapshots


def _validate_observed_at(value: str, row_number: int) -> None:
    if not value:
        raise ValueError(f"Row {row_number}: observed_at is required")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(
            f"Row {row_number}: observed_at must be ISO 8601 (for example 2026-08-21)"
        ) from exc


def _optional_nonnegative_int(value: str | None, row_number: int, field: str) -> int | None:
    if value is None or not value.strip():
        return None
    try:
        parsed = int(value)
    except ValueError as exc:
        raise ValueError(f"Row {row_number}: {field} must be an integer or blank") from exc
    if parsed < 0:
        raise ValueError(f"Row {row_number}: {field} cannot be negative")
    return parsed
