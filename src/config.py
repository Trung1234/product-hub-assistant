import os
from dotenv import load_dotenv

load_dotenv()

# API Credentials & Configs
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.vilao.ai/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "cd/gpt-5.5")

# Marketplace API Keys (Optional - Automatic Live Scraper Fallback Enabled)
ETSY_API_KEY = os.getenv("ETSY_API_KEY", "").strip()
HELIUM10_API_KEY = os.getenv("HELIUM10_API_KEY", "").strip()
GOOGLE_TRENDS_API_KEY = os.getenv("GOOGLE_TRENDS_API_KEY", "").strip()

# Paths
PRINTWAY_CATALOG_PATH = os.getenv("PRINTWAY_CATALOG_PATH", "data/printway_catalog.json")
SAMPLE_LISTINGS_PATH = os.getenv("SAMPLE_LISTINGS_PATH", "data/sample_listings.json")
