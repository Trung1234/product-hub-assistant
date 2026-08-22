"""
BROWSER POOL & BROWSERLESS CLOUD INTEGRATION MODULE
Connects to Browserless.io Cloud via Chrome DevTools Protocol (CDP)
with built-in US Residential Proxies, AI Captcha Solving, and automatic fallback to local Chromium.
"""

import os
import random
import logging
from typing import Optional, Dict, Tuple
from playwright.async_api import Playwright, Browser

from src.config import (
    browserless_config,
    BROWSERLESS_API_KEY,
    BROWSERLESS_USE_RESIDENTIAL,
    BROWSERLESS_WS_ENDPOINT
)

logger = logging.getLogger("BrowserPool")


def get_browserless_cdp_url() -> Optional[str]:
    """
    Constructs Browserless CDP WebSocket URL with built-in:
    - US Residential Proxy (&proxy=residential&proxyCountry=us)
    - Stealth Anti-Detection (&stealth=true)
    - Ad & Asset Blocking (&blockAds=true)
    - Automatic AI Captcha Solving
    """
    if BROWSERLESS_API_KEY:
        proxy_param = "&proxy=residential&proxyCountry=us" if BROWSERLESS_USE_RESIDENTIAL else ""
        return f"wss://chrome.browserless.io?token={BROWSERLESS_API_KEY}{proxy_param}&stealth=true&blockAds=true"

    if BROWSERLESS_WS_ENDPOINT:
        endpoint = BROWSERLESS_WS_ENDPOINT.strip()
        if endpoint.startswith("http://"):
            endpoint = endpoint.replace("http://", "ws://", 1)
        elif endpoint.startswith("https://"):
            endpoint = endpoint.replace("https://", "wss://", 1)
        return endpoint
    return None


get_browserless_endpoint = get_browserless_cdp_url


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
    headless: Optional[bool] = None
) -> Tuple[Browser, str]:
    """
    Connects to Browserless remote cluster over CDP if configured,
    otherwise launches high-performance local Chromium.
    Returns (browser_instance, mode_str).
    """
    if headless is None:
        headless = browserless_config.headless

    browserless_cdp = get_browserless_cdp_url()

    # 1. Try Browserless Remote Cloud Cluster via CDP with Built-in Residential Proxy
    if browserless_cdp:
        try:
            browser = await p.chromium.connect_over_cdp(browserless_cdp, timeout=2500)
            return browser, "REMOTE_BROWSERLESS_RESIDENTIAL_CLOUD"
        except Exception as e:
            logger.warning(f"[BrowserPool] Failed to connect to Browserless Cloud: {e}. Falling back to local Chromium.")

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
