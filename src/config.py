"""
PRINTWAY NEXUS CENTRALIZED CONFIGURATION LAYER
Consolidates all environment settings, credentials, and paths with strict fallbacks.
"""

import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class LLMConfig:
    api_key: str = os.getenv("OPENAI_API_KEY", "")
    api_base: str = os.getenv("OPENAI_API_BASE", "https://9router.printway.io/v1")
    model_name: str = os.getenv("MODEL_NAME", "cx/gpt-5.5")
    temperature: float = 0.0


@dataclass(frozen=True)
class SupabaseConfig:
    url: str = os.getenv("SUPABASE_URL", "https://cvhjqjttdupchyjwfgyq.supabase.co")
    key: str = os.getenv("SUPABASE_KEY", "")
    secret_key: str = os.getenv("SUPABASE_SECRET_KEY", os.getenv("SUPABASE_KEY", ""))
    service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))
    publishable_key: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")


@dataclass(frozen=True)
class BrowserlessConfig:
    api_key: str = os.getenv("BROWSERLESS_API_KEY", "2V79nSeq6bAJaW734125a67e5967f2e18acc38f01bc8c00b4")
    use_residential: bool = os.getenv("BROWSERLESS_USE_RESIDENTIAL", "true").lower() in ("true", "1", "yes")
    ws_endpoint: str = os.getenv(
        "BROWSERLESS_WS_ENDPOINT",
        "wss://chrome.browserless.io?token=2V79nSeq6bAJaW734125a67e5967f2e18acc38f01bc8c00b4&proxy=residential&proxyCountry=us&stealth=true&blockAds=true"
    )
    headless: bool = os.getenv("CRAWLEE_HEADLESS", "true").lower() in ("true", "1", "yes")


@dataclass(frozen=True)
class MarketConfig:
    etsy_api_key: str = os.getenv("ETSY_API_KEY", "").strip()
    helium10_api_key: str = os.getenv("HELIUM10_API_KEY", "").strip()
    google_trends_api_key: str = os.getenv("GOOGLE_TRENDS_API_KEY", "").strip()


@dataclass(frozen=True)
class PathsConfig:
    printway_catalog_path: str = os.getenv("PRINTWAY_CATALOG_PATH", "data/printway_catalog.json")
    sample_listings_path: str = os.getenv("SAMPLE_LISTINGS_PATH", "data/sample_listings.json")
    reports_output_dir: str = os.getenv("REPORTS_OUTPUT_DIR", "data/reports")


# Instantiate Singletons
llm_config = LLMConfig()
supabase_config = SupabaseConfig()
browserless_config = BrowserlessConfig()
market_config = MarketConfig()
paths_config = PathsConfig()

# Backward-Compatible Top-Level Constants
OPENAI_API_KEY = llm_config.api_key
OPENAI_API_BASE = llm_config.api_base
MODEL_NAME = llm_config.model_name

SUPABASE_URL = supabase_config.url
SUPABASE_KEY = supabase_config.key
SUPABASE_SECRET_KEY = supabase_config.secret_key
SUPABASE_SERVICE_ROLE_KEY = supabase_config.service_role_key
SUPABASE_PUBLISHABLE_KEY = supabase_config.publishable_key

BROWSERLESS_API_KEY = browserless_config.api_key
BROWSERLESS_USE_RESIDENTIAL = browserless_config.use_residential
BROWSERLESS_WS_ENDPOINT = browserless_config.ws_endpoint

ETSY_API_KEY = market_config.etsy_api_key
HELIUM10_API_KEY = market_config.helium10_api_key
GOOGLE_TRENDS_API_KEY = market_config.google_trends_api_key

PRINTWAY_CATALOG_PATH = paths_config.printway_catalog_path
SAMPLE_LISTINGS_PATH = paths_config.sample_listings_path
