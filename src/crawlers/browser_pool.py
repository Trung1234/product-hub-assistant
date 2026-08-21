"""
BROWSER POOL & BROWSERLESS CLOUD INTEGRATION MODULE
Provides unified connection to remote Browserless.io / Docker Chromium cluster
with automatic fallback to local Playwright Chromium.
"""

import os
import random
import logging
from typing import Optional, List, Dict, Any, Tuple
from playwright.async_api import Playwright, Browser

logger = logging.getLogger("BrowserPool")

def get_browserless_endpoint() -> Optional[str]:
    """Retrieves Browserless WebSocket endpoint from environment variables."""
    endpoint = os.getenv("BROWSERLESS_WS_ENDPOINT") or os.getenv("BROWSERLESS_URL")
    if endpoint:
        endpoint = endpoint.strip()
        # Convert http/https to ws/wss if needed
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
    Connects to Browserless remote cluster if configured,
    otherwise launches high-performance local Chromium.
    Returns (browser_instance, mode_str).
    """
    browserless_url = get_browserless_endpoint()
    
    # 1. Try Browserless Remote Cluster
    if browserless_url:
        try:
            browser = await p.chromium.connect(browserless_url, timeout=8000)
            return browser, "REMOTE_BROWSERLESS"
        except Exception as e:
            logger.warning(f"[BrowserPool] Failed to connect to Browserless at '{browserless_url}': {e}. Falling back to local Chromium.")

    # 2. Local High-Performance Chromium Fallback
    launch_args = [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu"
    ]
    browser = await p.chromium.launch(
        headless=headless,
        args=launch_args
    )
    return browser, "LOCAL_CHROMIUM"
