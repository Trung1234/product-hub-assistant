"""Compatibility provider backed only by Pinterest's official v5 Trends API."""

from __future__ import annotations

import os
from collections.abc import Callable
from typing import Any

from src.pinterest_ingestion.keyword_mapper import KeywordMapper
from src.pinterest_ingestion.pipeline import load_manual_signals, trend_to_signal
from src.pinterest_ingestion.pinterest_client import PinterestAPIError, PinterestClient


class PinterestTrendProvider:
    """Lazy facade used by the existing LangChain market tool.

    Construction performs no network call and does not require credentials, so
    importing the agent graph remains safe. The first fetch requires the
    environment-configured token. A 403 consults only the human-entered Plan B
    CSV; it never falls back to scraping.
    """

    def __init__(
        self,
        *,
        client: PinterestClient | None = None,
        client_factory: Callable[[], PinterestClient] = PinterestClient,
        mapper: KeywordMapper | None = None,
        region: str | None = None,
        seasonality_fit: float | None = None,
        manual_path: str = "data/manual_pins_snapshot.csv",
    ) -> None:
        self._client = client
        self._client_factory = client_factory
        self._mapper = mapper or KeywordMapper()
        self._region = region
        self._seasonality_fit = seasonality_fit
        self._manual_path = manual_path

    def fetch_pinterest_signals(self, keyword: str) -> dict[str, Any]:
        clean_keyword = keyword.strip()
        if not clean_keyword:
            raise ValueError("keyword cannot be empty")
        mapping_hint = self._mapper.map_keyword(clean_keyword)
        client = self._get_client()
        region = (self._region or os.getenv("PINTEREST_REGION", "US")).strip().upper()
        try:
            records = client.fetch_trends(
                region,
                "growing",
                include_keywords=[clean_keyword],
                limit=50,
            )
        except PinterestAPIError as exc:
            if exc.status_code != 403:
                raise
            manual = [
                signal
                for signal in load_manual_signals(self._manual_path)
                if signal["keyword"].casefold() == clean_keyword.casefold()
                and signal["market"] == region
            ]
            if manual:
                return manual[0]
            return {
                "source": "pinterest_manual_snapshot",
                "keyword": clean_keyword,
                "canonical_product_type": mapping_hint.canonical_product_type,
                "pinterest_demand_score": None,
                "current_interest_index": None,
                "growth_mom": None,
                "growth_yoy": None,
                "confidence": 0.0,
                "status": "ACCESS_DENIED_403_NO_MANUAL_MATCH",
            }

        signals = []
        for record in records:
            mapping = (
                self._mapper.mapping_for_seed(
                    mapping_hint.canonical_product_type,
                    record.keyword,
                )
                if mapping_hint.method == "seed"
                else self._mapper.map_keyword(record.keyword)
            )
            signals.append(
                trend_to_signal(
                    record,
                    mapping,
                    seasonality_fit=self._seasonality_fit,
                )
            )
        if not signals:
            return {
                "source": "pinterest_trends",
                "keyword": clean_keyword,
                "canonical_product_type": mapping_hint.canonical_product_type,
                "pinterest_demand_score": None,
                "current_interest_index": None,
                "growth_mom": None,
                "growth_yoy": None,
                "confidence": 0.0,
                "status": "NO_TRENDS_RETURNED",
            }
        return max(
            signals,
            key=lambda signal: (
                signal["pinterest_demand_score"] is not None,
                signal["pinterest_demand_score"] or 0.0,
                signal["current_interest_index"] or 0,
            ),
        )

    def _get_client(self) -> PinterestClient:
        if self._client is None:
            self._client = self._client_factory()
        return self._client
