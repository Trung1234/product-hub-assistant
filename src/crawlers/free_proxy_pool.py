"""
OPEN-SOURCE AUTOMATED FREE PROXY HARVESTER & HEALTH CHECKER
Fetches raw public proxy lists, performs concurrent health checks,
and filters out the fastest, most reliable proxies with latency < 2.5s.
"""

import asyncio
import time
import urllib.request
import aiohttp
from typing import List, Dict, Any

RAW_PROXY_SOURCES = [
    "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt",
    "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt",
    "https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt"
]

TEST_URL = "http://httpbin.org/ip"

class FreeProxyHarvester:
    """
    Automated Open-Source Free Proxy Harvester and Health Checker.
    """

    def __init__(self, max_test_candidates: int = 40):
        self.max_test_candidates = max_test_candidates

    def harvest_raw_proxies(self) -> List[str]:
        """Fetches raw proxy lists from open-source GitHub repositories."""
        proxies = set()
        for url in RAW_PROXY_SOURCES:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    lines = resp.read().decode("utf-8", errors="ignore").splitlines()
                    for l in lines:
                        l = l.strip()
                        if ":" in l and not l.startswith("#"):
                            proxies.add(l)
                if len(proxies) >= self.max_test_candidates * 3:
                    break
            except Exception:
                continue
        return list(proxies)

    async def _test_single_proxy(self, session: aiohttp.ClientSession, proxy_addr: str) -> Dict[str, Any]:
        """Tests latency and connectivity of a single proxy."""
        proxy_url = f"http://{proxy_addr}"
        t0 = time.time()
        try:
            async with session.get(TEST_URL, proxy=proxy_url, timeout=aiohttp.ClientTimeout(total=2.5)) as resp:
                if resp.status == 200:
                    latency = round(time.time() - t0, 3)
                    data = await resp.json()
                    return {
                        "proxy": proxy_url,
                        "ip": proxy_addr.split(":")[0],
                        "port": proxy_addr.split(":")[1],
                        "latency_s": latency,
                        "status": "HEALTHY",
                        "origin_ip": data.get("origin", "")
                    }
        except Exception:
            pass
        return {"proxy": proxy_url, "status": "DEAD"}

    async def get_healthy_proxy_pool(self, max_healthy: int = 5) -> List[Dict[str, Any]]:
        """Harvests and concurrently tests proxies, returning only healthy ones."""
        raw_list = self.harvest_raw_proxies()[:self.max_test_candidates]
        if not raw_list:
            return []

        async with aiohttp.ClientSession() as session:
            tasks = [self._test_single_proxy(session, p) for p in raw_list]
            results = await asyncio.gather(*tasks)

        healthy = [r for r in results if r.get("status") == "HEALTHY"]
        healthy.sort(key=lambda x: x["latency_s"])
        return healthy[:max_healthy]

if __name__ == "__main__":
    harvester = FreeProxyHarvester(max_test_candidates=30)
    print("Harvester initialized.")
