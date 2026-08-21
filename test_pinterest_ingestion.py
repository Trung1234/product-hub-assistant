from __future__ import annotations

import ast
import io
import json
import logging
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

from probe_access import probe_access
from src.pinterest_ingestion.cache import RawResponseCache
from src.pinterest_ingestion.demand_score import calculate_demand_score, normalize_growth
from src.pinterest_ingestion.keyword_mapper import KeywordMapper
from src.pinterest_ingestion.manual_snapshot import load_manual_pins
from src.pinterest_ingestion.models import MappingResult, TrendRecord
from src.pinterest_ingestion.pipeline import trend_to_signal, validate_signal, write_signals
from src.pinterest_ingestion.pinterest_client import (
    NoOpRateLimiter,
    PerMinuteRateLimiter,
    PinterestAPIError,
    PinterestClient,
    PinterestNetworkError,
)
from src.providers.pinterest_provider import PinterestTrendProvider


class FakeResponse:
    def __init__(self, status_code, payload=None, text=None, headers=None):
        self.status_code = status_code
        self._payload = payload
        self.text = text if text is not None else json.dumps(payload or {})
        self.headers = headers or {}

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if not self.responses:
            raise AssertionError("FakeSession has no response left")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def trend_payload(**overrides):
    trend = {
        "keyword": "personalized christmas ornament",
        "pct_growth_wow": 35,
        "pct_growth_mom": 120,
        "pct_growth_yoy": 48,
        "time_series": {"2026-08-14": 41, "2026-08-21": 46},
    }
    trend.update(overrides)
    return {"trends": [trend]}


class ProbeTests(unittest.TestCase):
    def test_access_ok(self):
        session = FakeSession([FakeResponse(200, trend_payload())])
        output = io.StringIO()
        with redirect_stdout(output):
            exit_code = probe_access(access_token="secret", region="US", session=session)
        self.assertEqual(exit_code, 0)
        self.assertIn("ACCESS_OK", output.getvalue())
        self.assertNotIn("secret", output.getvalue())
        url, kwargs = session.calls[0]
        self.assertEqual(url, "https://api.pinterest.com/v5/trends/keywords/US/top/growing")
        self.assertEqual(kwargs["params"], {"limit": 1})
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer secret")

    def test_access_denied_403_is_controlled(self):
        session = FakeSession([FakeResponse(403, {"message": "not entitled"})])
        output = io.StringIO()
        with redirect_stdout(output):
            exit_code = probe_access(access_token="secret", session=session)
        self.assertEqual(exit_code, 0)
        self.assertIn("HTTP_STATUS=403", output.getvalue())
        self.assertIn("not entitled", output.getvalue())
        self.assertIn("ACCESS_DENIED_403", output.getvalue())
        self.assertEqual(len(session.calls), 1)

    def test_other_error_prints_status_and_body(self):
        session = FakeSession([FakeResponse(401, text="token expired")])
        output = io.StringIO()
        with redirect_stdout(output):
            exit_code = probe_access(access_token="secret", session=session)
        self.assertEqual(exit_code, 1)
        self.assertIn("ACCESS_ERROR_401", output.getvalue())
        self.assertIn("token expired", output.getvalue())
        self.assertNotIn("secret", output.getvalue())


class PinterestClientTests(unittest.TestCase):
    def make_client(self, responses, **kwargs):
        session = FakeSession(responses)
        client = PinterestClient(
            "token-value",
            session=session,
            rate_limiter=NoOpRateLimiter(),
            sleep=kwargs.pop("sleep", lambda _: None),
            **kwargs,
        )
        return client, session

    def test_happy_path_and_query_serialization(self):
        client, session = self.make_client([FakeResponse(200, trend_payload())])
        records = client.fetch_trends(
            "us", "growing", ["custom mug", "pet ornament"], limit=2
        )
        self.assertEqual(len(records), 1)
        record = records[0]
        self.assertEqual(record.keyword, "personalized christmas ornament")
        self.assertEqual(record.time_series["2026-08-21"], 46)
        self.assertEqual(record.region, "US")
        url, kwargs = session.calls[0]
        self.assertTrue(url.endswith("/trends/keywords/US/top/growing"))
        self.assertIn(("normalize_against_group", "true"), kwargs["params"])
        self.assertEqual(
            [item for item in kwargs["params"] if item[0] == "include_keywords"],
            [
                ("include_keywords", "custom mug"),
                ("include_keywords", "pet ornament"),
            ],
        )

    def test_all_four_trend_types(self):
        responses = [FakeResponse(200, trend_payload()) for _ in range(4)]
        client, session = self.make_client(responses)
        for trend_type in ("growing", "monthly", "yearly", "seasonal"):
            record = client.fetch_trends("US", trend_type, limit=1)[0]
            self.assertEqual(record.trend_type, trend_type)
        self.assertEqual(len(session.calls), 4)

    def test_missing_growth_stays_none_and_zero_stays_zero(self):
        payload = trend_payload(pct_growth_mom=0)
        del payload["trends"][0]["pct_growth_yoy"]
        client, _ = self.make_client([FakeResponse(200, payload)])
        record = client.fetch_trends("US", "growing")[0]
        self.assertIsNone(record.pct_growth_yoy)
        self.assertEqual(record.pct_growth_mom, 0.0)

    def test_retries_429_then_succeeds(self):
        sleeps = []
        client, session = self.make_client(
            [
                FakeResponse(429, text="slow down"),
                FakeResponse(429, text="slow down"),
                FakeResponse(200, trend_payload()),
            ],
            sleep=sleeps.append,
        )
        records = client.fetch_trends("US", "growing")
        self.assertEqual(len(records), 1)
        self.assertEqual(len(session.calls), 3)
        self.assertEqual(sleeps, [1.0, 2.0])

    def test_does_not_retry_403(self):
        client, session = self.make_client([FakeResponse(403, text="denied")])
        with self.assertRaises(PinterestAPIError) as raised:
            client.fetch_trends("US", "growing")
        self.assertEqual(raised.exception.status_code, 403)
        self.assertEqual(len(session.calls), 1)

    def test_stops_after_three_retries(self):
        sleeps = []
        client, session = self.make_client(
            [FakeResponse(503, text="down") for _ in range(4)],
            sleep=sleeps.append,
        )
        with self.assertRaises(PinterestAPIError):
            client.fetch_trends("US", "growing")
        self.assertEqual(len(session.calls), 4)
        self.assertEqual(sleeps, [1.0, 2.0, 4.0])

    def test_network_error_is_explicit_and_not_retried(self):
        client, session = self.make_client([requests.ConnectionError("offline")])
        with self.assertRaisesRegex(PinterestNetworkError, "offline"):
            client.fetch_trends("US", "growing")
        self.assertEqual(len(session.calls), 1)

    def test_token_never_appears_in_logs(self):
        client, _ = self.make_client([FakeResponse(200, trend_payload())])
        with self.assertLogs("src.pinterest_ingestion.pinterest_client", logging.INFO) as logs:
            client.fetch_trends("US", "growing", ["custom mug"])
        combined = "\n".join(logs.output)
        self.assertNotIn("token-value", combined)
        self.assertIn("records=1", combined)

    def test_rate_limiter_spaces_twenty_calls(self):
        class Clock:
            value = 0.0

            def monotonic(self):
                return self.value

            def sleep(self, seconds):
                self.value += seconds

        clock = Clock()
        limiter = PerMinuteRateLimiter(
            60, sleep=clock.sleep, monotonic=clock.monotonic
        )
        for _ in range(20):
            limiter.acquire()
        self.assertAlmostEqual(clock.value, 19.0)


class MappingAndManualTests(unittest.TestCase):
    def test_every_seed_maps_exactly(self):
        mapper = KeywordMapper()
        for product_type, seeds in mapper.seeds_by_product_type.items():
            for seed in seeds:
                result = mapper.map_keyword(f"  {seed.upper()}  ")
                self.assertEqual(result.canonical_product_type, product_type)
                self.assertEqual(result.method, "seed")
                self.assertEqual(result.confidence, 1.0)

    def test_irrelevant_keyword_is_unmapped(self):
        result = KeywordMapper().map_keyword("nail art ideas")
        self.assertEqual(result.canonical_product_type, "UNMAPPED")
        self.assertEqual(result.method, "unmapped")

    def test_missing_seed_warning(self):
        mapper = KeywordMapper()
        with self.assertLogs("src.pinterest_ingestion.keyword_mapper", logging.WARNING) as logs:
            missing = mapper.warn_for_missing_seeds(["ORNAMENT", "NEW_PRODUCT"])
        self.assertEqual(missing, ["NEW_PRODUCT"])
        self.assertIn("MISSING_SEED: NEW_PRODUCT", "\n".join(logs.output))

    def test_manual_file_is_optional(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(load_manual_pins(Path(directory) / "absent.csv"), [])

    def test_manual_loader_validates_and_parses(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pins.csv"
            path.write_text(
                "keyword,canonical_product_type,region,top_pin_theme,observed_saves,observed_at,notes\n"
                'custom mug,DRINKWARE,US,retro floral,123,2026-08-21,"human note, verified"\n',
                encoding="utf-8",
            )
            rows = load_manual_pins(path)
            self.assertEqual(rows[0].observed_saves, 123)
            self.assertEqual(rows[0].notes, "human note, verified")

    def test_manual_loader_rejects_missing_column_and_date(self):
        with tempfile.TemporaryDirectory() as directory:
            missing = Path(directory) / "missing.csv"
            missing.write_text("keyword,observed_at\ncustom mug,2026-08-21\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "missing required columns"):
                load_manual_pins(missing)

            blank_date = Path(directory) / "blank.csv"
            blank_date.write_text(
                "keyword,canonical_product_type,region,top_pin_theme,observed_saves,observed_at,notes\n"
                "custom mug,DRINKWARE,US,retro,1,,note\n",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "observed_at is required"):
                load_manual_pins(blank_date)


class ScoringCacheAndOutputTests(unittest.TestCase):
    def test_full_score_and_breakdown(self):
        result = calculate_demand_score(
            current_interest=80,
            pct_growth_yoy=50,
            pct_growth_mom=20,
            seasonality_fit=90,
        )
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.score, 66.5)
        weighted_sum = sum(float(item["weighted"] or 0) for item in result.breakdown.values())
        self.assertAlmostEqual(weighted_sum, result.score, places=2)
        self.assertEqual(result.confidence, 1.0)

    def test_missing_component_reweights_and_reduces_confidence(self):
        result = calculate_demand_score(
            current_interest=80,
            pct_growth_yoy=50,
            pct_growth_mom=None,
            seasonality_fit=90,
        )
        assert result is not None
        self.assertIn("mom_growth", result.missing_components)
        self.assertLess(result.confidence, 1.0)
        self.assertAlmostEqual(
            sum(float(item["weighted"] or 0) for item in result.breakdown.values()),
            result.score,
            places=2,
        )

    def test_all_growth_missing_returns_none_and_zero_is_data(self):
        self.assertIsNone(
            calculate_demand_score(
                current_interest=80,
                pct_growth_yoy=None,
                pct_growth_mom=None,
                seasonality_fit=90,
            )
        )
        self.assertIsNotNone(
            calculate_demand_score(
                current_interest=80,
                pct_growth_yoy=0,
                pct_growth_mom=0,
                seasonality_fit=90,
            )
        )

    def test_growth_normalization_is_bounded(self):
        self.assertEqual(normalize_growth(-1000), 0)
        self.assertEqual(normalize_growth(10001), 100)
        self.assertLess(normalize_growth(0), normalize_growth(100))

    def test_cache_purges_expired_only(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = RawResponseCache(directory)
            now = datetime(2026, 8, 21, tzinfo=timezone.utc)
            expired = cache.put({"old": True}, now=now - timedelta(hours=7))
            fresh = cache.put({"fresh": True}, now=now)
            # put() already purges relative to its own timestamp, so recreate an
            # expired fixture after the fresh entry exists.
            expired.write_text(
                json.dumps(
                    {
                        "cached_at": "2026-08-20T17:00:00Z",
                        "expires_at": "2026-08-20T23:00:00Z",
                        "payload": {"old": True},
                    }
                ),
                encoding="utf-8",
            )
            purged = cache.purge_expired(now=now)
            self.assertEqual(purged, 1)
            self.assertFalse(expired.exists())
            self.assertTrue(fresh.exists())

    def test_signal_contract_ttl_and_forbidden_fields(self):
        record = TrendRecord(
            keyword="custom mug",
            pct_growth_wow=None,
            pct_growth_mom=20,
            pct_growth_yoy=50,
            time_series={"2026-08-21": 80},
            region="US",
            trend_type="growing",
            retrieved_at="2026-08-21T00:00:00Z",
        )
        mapping = MappingResult("DRINKWARE", "Drinkware", "Ceramic", 1.0, "seed")
        signal = trend_to_signal(record, mapping, seasonality_fit=90)
        validate_signal(signal)
        self.assertEqual(signal["expires_at"], "2026-08-21T06:00:00Z")
        self.assertNotEqual(signal["canonical_product_type"], None)
        invalid = dict(signal)
        invalid["evidence"] = {"sales": 10}
        with self.assertRaisesRegex(ValueError, "forbidden fields"):
            validate_signal(invalid)

    def test_output_is_standard_json(self):
        record = TrendRecord(
            "custom mug", None, 20, 50, {"2026-08-21": 80}, "US", "growing",
            "2026-08-21T00:00:00Z",
        )
        signal = trend_to_signal(
            record,
            MappingResult("DRINKWARE", "Drinkware", None, 1.0, "seed"),
            seasonality_fit=None,
        )
        with tempfile.TemporaryDirectory() as directory:
            path = write_signals([signal], Path(directory) / "signals.json")
            loaded = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(loaded[0]["source"], "pinterest_trends")


class ProviderIntegrationTests(unittest.TestCase):
    def test_existing_provider_facade_uses_real_signal_contract(self):
        class StubClient:
            def fetch_trends(self, region, trend_type, include_keywords=None, limit=50):
                return [
                    TrendRecord(
                        "custom mug ideas",
                        12,
                        20,
                        50,
                        {"2026-08-21": 80},
                        region,
                        trend_type,
                        "2026-08-21T00:00:00Z",
                    )
                ]

        provider = PinterestTrendProvider(
            client=StubClient(),  # type: ignore[arg-type]
            region="US",
            seasonality_fit=90,
        )
        signal = provider.fetch_pinterest_signals("custom mug")
        self.assertEqual(signal["source"], "pinterest_trends")
        self.assertEqual(signal["canonical_product_type"], "DRINKWARE")
        self.assertIsNotNone(signal["pinterest_demand_score"])

    def test_provider_403_uses_manual_csv_without_inventing_score(self):
        class DeniedClient:
            def fetch_trends(self, *args, **kwargs):
                raise PinterestAPIError(403, "not entitled")

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pins.csv"
            path.write_text(
                "keyword,canonical_product_type,region,top_pin_theme,observed_saves,observed_at,notes\n"
                "custom mug,DRINKWARE,US,retro,123,2026-08-21,manual\n",
                encoding="utf-8",
            )
            provider = PinterestTrendProvider(
                client=DeniedClient(),  # type: ignore[arg-type]
                region="US",
                manual_path=str(path),
            )
            signal = provider.fetch_pinterest_signals("custom mug")
        self.assertEqual(signal["source"], "pinterest_manual_snapshot")
        self.assertIsNone(signal["pinterest_demand_score"])
        self.assertEqual(signal["manual_evidence"]["observed_saves"], 123)


class ComplianceTests(unittest.TestCase):
    def test_active_pinterest_modules_do_not_import_scrapers(self):
        paths = list(Path("src/pinterest_ingestion").glob("*.py")) + [
            Path("src/providers/pinterest_provider.py"),
            Path("probe_access.py"),
        ]
        banned_roots = {"bs4", "selenium", "playwright", "apify"}
        for path in paths:
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            imports = set()
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    imports.update(alias.name.split(".")[0] for alias in node.names)
                elif isinstance(node, ast.ImportFrom) and node.module:
                    imports.add(node.module.split(".")[0])
            self.assertFalse(imports & banned_roots, f"{path} imports a scraping library")


if __name__ == "__main__":
    unittest.main(verbosity=2)
