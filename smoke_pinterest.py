"""Opt-in live smoke test for all four Pinterest trend types."""

from __future__ import annotations

import argparse
import os
import sys

from dotenv import load_dotenv

from src.pinterest_ingestion.pinterest_client import PinterestError, PinterestClient


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Run four small live Pinterest Trends calls")
    parser.add_argument("--region", default=os.getenv("PINTEREST_REGION", "US"))
    parser.add_argument("--keyword", help="Optional seed keyword filter")
    args = parser.parse_args()

    try:
        client = PinterestClient()
        for trend_type in ("growing", "monthly", "yearly", "seasonal"):
            records = client.fetch_trends(
                args.region,
                trend_type,
                include_keywords=[args.keyword] if args.keyword else None,
                limit=1,
            )
            has_time_series = bool(records and records[0].time_series)
            print(
                f"SMOKE_OK type={trend_type} records={len(records)} "
                f"time_series_present={str(has_time_series).lower()}"
            )
    except PinterestError as exc:
        print(f"SMOKE_ERROR: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
