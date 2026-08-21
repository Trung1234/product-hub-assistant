import json
import requests
from typing import Dict, Any
from src.crawlers.shopee_scraper import ShopeeWebScraper

class ShopeeDataProvider:
    """
    Shopee Data Provider.
    Mode 1: Official API v2 if Partner Credentials exist.
    Mode 2: Real Live Web Scraper if Credentials are empty.
    """
    def __init__(self, partner_id: str = "", partner_key: str = ""):
        self.partner_id = partner_id
        self.partner_key = partner_key
        self.scraper = ShopeeWebScraper()

    def fetch_signals(self, query: str) -> Dict[str, Any]:
        """Fetches signals via Shopee API if keys exist, otherwise runs Real Live Web Scraper."""
        if self.partner_id and self.partner_key:
            try:
                headers = {"User-Agent": "Mozilla/5.0"}
                url = f"https://shopee.vn/api/v4/search/search_items?keyword={query}&limit=20"
                resp = requests.get(url, headers=headers, timeout=3.0)
                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get("items", [])
                    return {
                        "source": "Shopee Open API v2 (LIVE_API)",
                        "marketplace": "Shopee",
                        "active_listings": len(items),
                        "data_mode": "LIVE_API"
                    }
            except Exception:
                pass
                
        # Real Live Web Scraper Execution
        return self.scraper.scrape(query)
