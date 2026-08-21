"""
BROWSER POOL & BROWSERLESS CLOUD INTEGRATION MODULE
Connects to Browserless.io Cloud via Chrome DevTools Protocol (CDP)
with automatic fallback to local Playwright Chromium.
"""

import os
import random
import logging
from typing import Optional, Dict, Any, Tuple
from playwright.async_api import Playwright, Browser
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("BrowserPool")

def get_browserless_cdp_url() -> Optional[str]:
    """Retrieves or constructs Browserless CDP WebSocket endpoint from environment variables."""
    api_key = os.getenv("BROWSERLESS_API_KEY", "").strip()
    if api_key:
        return f"wss://chrome.browserless.io?token={api_key}&stealth=true&blockAds=true"

    endpoint = os.getenv("BROWSERLESS_WS_ENDPOINT") or os.getenv("BROWSERLESS_URL")
    if endpoint:
        endpoint = endpoint.strip()
        if endpoint.startswith("http://"):
            endpoint = endpoint.replace("http://", "ws://", 1)
        elif endpoint.startswith("https://"):
            endpoint = endpoint.replace("https://", "wss://", 1)
        return endpoint
    return None

def get_proxy_config() -> Optional[Dict[str, str]]:
    """Retrieves random residential proxy from CRAWLEE_PROXIES if available."""
    raw = os.getenv("CRAWLEE_PROXIES", "").strip()
    if raw:
        proxies = [p.strip() for p in raw.split(",") if p.strip()]
        if proxies:
            chosen = random.choice(proxies)
            return {"server": chosen}
    return None

async def create_browser_session(
    p: Playwright,
    headless: bool = True
) -> Tuple[Browser, str]:
    """
    Connects to Browserless remote cluster over CDP if configured,
    otherwise launches high-performance local Chromium.
    Returns (browser_instance, mode_str).
    """
    browserless_cdp = get_browserless_cdp_url()
    
    # 1. Try Browserless Remote Cloud Cluster via CDP
    if browserless_cdp:
        try:
            browser = await p.chromium.connect_over_cdp(browserless_cdp, timeout=15000)
            return browser, "REMOTE_BROWSERLESS_CLOUD"
        except Exception as e:
            print(f"[BrowserPool Warning] Failed to connect to Browserless Cloud: {e}. Falling back to local Chromium.")

    # 2. Local High-Performance Chromium Fallback
    launch_args = [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--no-first-run"
    ]
    browser = await p.chromium.launch(
        headless=headless,
        args=launch_args
    )
    return browser, "LOCAL_CHROMIUM"
