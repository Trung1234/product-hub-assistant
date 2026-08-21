from __future__ import annotations

import argparse
import logging
import os
import sys

from dotenv import load_dotenv

from src.pinterest_ingestion.cache import RawResponseCache
from src.pinterest_ingestion.keyword_mapper import KeywordMapper, canonical_types_from_catalog
from src.pinterest_ingestion.pipeline import (
    ingest_discovery_trends,
    ingest_seed_trends,
    load_manual_signals,
    write_signals,
)
from src.pinterest_ingestion.pinterest_client import (
    PinterestAPIError,
    PinterestClient,
    PinterestConfigurationError,
)


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Ingest official Pinterest demand signals")
    parser.add_argument("--region", default=os.getenv("PINTEREST_REGION", "US"))
    parser.add_argument(
        "--trend-type",
        choices=("growing", "monthly", "yearly", "seasonal"),
        default="growing",
    )
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument(
        "--discovery",
        action="store_true",
        help="Fetch unfiltered trends; unknown keywords are retained as UNMAPPED",
    )
    parser.add_argument(
        "--seasonality-fit",
        type=float,
        help="Precomputed 0-100 fit; omitted until the launch window is defined",
    )
    parser.add_argument("--manual", action="store_true", help="Use the manual CSV Plan B")
    parser.add_argument("--manual-path", default="data/manual_pins_snapshot.csv")
    parser.add_argument("--output", default="data/pinterest_signals.json")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    mapper = KeywordMapper()
    mapper.warn_for_missing_seeds(canonical_types_from_catalog("data/printway_catalog.json"))

    if args.manual:
        signals = load_manual_signals(args.manual_path)
        output = write_signals(signals, args.output)
        print(f"PLAN_B_OK records={len(signals)} output={output}")
        return 0

    try:
        cache = RawResponseCache()
        client = PinterestClient(raw_cache=cache)
        ingest = ingest_discovery_trends if args.discovery else ingest_seed_trends
        signals = ingest(
            client,
            mapper,
            region=args.region,
            trend_type=args.trend_type,
            limit=args.limit,
            seasonality_fit=args.seasonality_fit,
        )
    except PinterestConfigurationError as exc:
        print(f"CONFIG_ERROR: {exc}")
        return 2
    except PinterestAPIError as exc:
        if exc.status_code != 403:
            print(str(exc))
            return 1
        print("ACCESS_DENIED_403: switching to manual CSV Plan B")
        print(exc.response_body)
        signals = load_manual_signals(args.manual_path)

    output = write_signals(signals, args.output)
    print(f"INGEST_OK records={len(signals)} output={output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
