"""Standalone Pinterest Trends entitlement probe required by SPEC-001.

This file deliberately does not import the rest of Product Opportunity Hub.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

import requests
from dotenv import load_dotenv


API_BASE_URL = "https://api.pinterest.com/v5"


def probe_access(
    *,
    access_token: str | None = None,
    region: str | None = None,
    session: Any | None = None,
    show_body: bool = False,
) -> int:
    load_dotenv()
    token = (access_token or os.getenv("PINTEREST_ACCESS_TOKEN", "")).strip()
    market = (region or os.getenv("PINTEREST_REGION", "US")).strip().upper()
    if not token:
        print("ACCESS_ERROR_CONFIG")
        print("PINTEREST_ACCESS_TOKEN is missing; add it to the ignored .env file.")
        return 2

    endpoint = f"{API_BASE_URL}/trends/keywords/{market}/top/growing"
    http = session or requests.Session()
    try:
        response = http.get(
            endpoint,
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            params={"limit": 1},
            timeout=30,
        )
    except requests.RequestException as exc:
        print("ACCESS_ERROR_NETWORK")
        print(f"Request failed: {exc}")
        return 1

    print(f"HTTP_STATUS={response.status_code}")
    if response.status_code == 200:
        print("ACCESS_OK")
        if show_body:
            print(_pretty_body(response))
        return 0

    print(_body(response))
    if response.status_code == 403:
        print("ACCESS_DENIED_403")
        return 0

    print(f"ACCESS_ERROR_{response.status_code}")
    return 1


def probe_user_account(
    *,
    access_token: str | None = None,
    session: Any | None = None,
) -> int:
    """Validate the basic OAuth prerequisite separately from Trends access."""

    load_dotenv()
    token = (access_token or os.getenv("PINTEREST_ACCESS_TOKEN", "")).strip()
    if not token:
        print("USER_ACCOUNT_ERROR_CONFIG")
        print("PINTEREST_ACCESS_TOKEN is missing; add it to the ignored .env file.")
        return 2
    http = session or requests.Session()
    try:
        response = http.get(
            f"{API_BASE_URL}/user_account",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            timeout=30,
        )
    except requests.RequestException as exc:
        print("USER_ACCOUNT_ERROR_NETWORK")
        print(f"Request failed: {exc}")
        return 1
    print(f"HTTP_STATUS={response.status_code}")
    if response.status_code == 200:
        print("USER_ACCOUNT_OK")
        return 0
    print(_body(response))
    print(f"USER_ACCOUNT_ERROR_{response.status_code}")
    return 1


def _body(response: Any) -> str:
    return response.text if getattr(response, "text", "") else "<empty response body>"


def _pretty_body(response: Any) -> str:
    try:
        return json.dumps(response.json(), ensure_ascii=False, indent=2)
    except ValueError:
        return _body(response)


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe Pinterest Trends API entitlement")
    parser.add_argument("--region", help="Pinterest market code (default: PINTEREST_REGION or US)")
    parser.add_argument(
        "--show-body",
        action="store_true",
        help="Print the one-record success body to validate time_series shape",
    )
    parser.add_argument(
        "--user-account",
        action="store_true",
        help="Check GET /v5/user_account instead of the Trends entitlement",
    )
    args = parser.parse_args()
    if args.user_account:
        return probe_user_account()
    return probe_access(region=args.region, show_body=args.show_body)


if __name__ == "__main__":
    sys.exit(main())
