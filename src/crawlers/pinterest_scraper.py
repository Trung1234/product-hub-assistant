"""
Pinterest crawler cho Product Opportunity Hub.

Cach tiep can theo bai huong dan Thunderbit ("Scrape Pinterest with Python"):
Pinterest la SPA React, `requests` + BeautifulSoup khong bao gio thay noi dung that,
nen phai dung trinh duyet that (Playwright) de render roi doc DOM.

Module nay lam dung nhu vay, va bo sung them mot lop nua ma bai viet khong co:
vua cuon trang vua **bat cac response JSON `/resource/*/get/`** ma chinh app Pinterest goi.
DOM chi cho title + link + anh; JSON cho repin_count (saves), ngay tao pin, gia san pham,
ten board - tuc la nhung con so R&D thuc su can. Hai nguon duoc gop lai theo pin_id.

Ba che do chay (engine):
  * headless    - Chromium headless, khong dang nhap. Nhanh nhat, dung khi IP sach.
  * persistent  - Chromium co giao dien + thu muc profile rieng. Nguoi dung tu dang nhap
                  MOT LAN vao profile do; nhung lan sau session duoc tai lai.
  * cdp         - Gan vao trinh duyet anti-detect da mo san (AdsPower / GoLogin / Chrome
                  chay voi --remote-debugging-port). Dung lai ha tang san co cua du an.

Luu y van hanh: Pinterest tra feed RONG cho khach chua dang nhap den tu dai IP bi gan co
`is_unauth_botspam_asn`. Crawler phat hien tinh huong nay va tra ve status "blocked"
kem ly do, thay vi im lang tra ve 0 pin.
"""

import asyncio
import json
import os
import re
import time
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

RAW_DIR = os.getenv("PINTEREST_RAW_DIR", "data/pinterest_raw")

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

EDGE_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"
)

# Selector DOM cua luoi pin. Pinterest doi markup theo dot A/B nen thu lan luot.
PIN_WRAPPER_SELECTORS = [
    "div[data-test-id='pinWrapper']",
    "div[data-test-id='pin']",
    "div[data-grid-item='true']",
]

# Pinterest bao "khong tim thay pin" bang nhung cau nay khi bi chan / khong co ket qua.
EMPTY_FEED_MARKERS = [
    "we couldn't find any pins",
    "we couldn't find any results",
    "sorry, we couldn't find",
]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def upgrade_image_url(url: str, size: str = "736x") -> str:
    """
    Nang do phan giai anh pin. Pinterest nhung kich thuoc vao duong dan:
    /236x/ la thumbnail luoi, /736x/ la ban dung duoc cho moodboard R&D.
    Khong dung /originals/ vi Pinterest tra 403 cho phan lon pin tu 2025.
    """
    if not url:
        return url
    return re.sub(r"/\d+x\d*/", f"/{size}/", url)


def _first(d: Dict[str, Any], *paths, default=None):
    """Lay gia tri dau tien tim duoc theo cac duong dan dang 'a.b.c'."""
    for path in paths:
        cur: Any = d
        ok = True
        for part in path.split("."):
            if isinstance(cur, list):
                cur = cur[0] if cur else None
            if not isinstance(cur, dict) or part not in cur:
                ok = False
                break
            cur = cur[part]
        if ok and cur not in (None, "", []):
            return cur
    return default


def _parse_pin_datetime(value: Optional[str]) -> Optional[str]:
    """Pinterest tra created_at dang 'Tue, 01 Oct 2024 12:00:00 +0000'."""
    if not value:
        return None
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S"):
        try:
            dt = datetime.strptime(value, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat(timespec="seconds")
        except ValueError:
            continue
    return None


def _extract_price(pin: Dict[str, Any]) -> Dict[str, Any]:
    """Doc gia tu product pin (rich_metadata / rich_summary), neu khong co thi doc tu text."""
    value = _first(
        pin,
        "rich_metadata.products.offer.price_value",
        "rich_summary.products.offer.price_value",
        "rich_metadata.offer.price_value",
        "shopping_flags.price_value",
    )
    currency = _first(
        pin,
        "rich_metadata.products.offer.currency_code",
        "rich_summary.products.offer.currency_code",
        "rich_metadata.offer.currency_code",
        default="USD",
    )
    if value is not None:
        try:
            return {"price_value": float(value), "price_currency": currency,
                    "price_source": "product_pin"}
        except (TypeError, ValueError):
            pass

    text = " ".join(filter(None, [pin.get("title"), pin.get("grid_title"), pin.get("description")]))
    m = re.search(r"(?:USD\s*)?\$\s*(\d{1,4}(?:[.,]\d{2})?)", text or "")
    if m:
        try:
            return {"price_value": float(m.group(1).replace(",", ".")),
                    "price_currency": "USD", "price_source": "text_parsed"}
        except ValueError:
            pass
    return {"price_value": None, "price_currency": None, "price_source": None}


def normalize_api_pin(pin: Dict[str, Any], query_seed: str) -> Optional[Dict[str, Any]]:
    """Chuyen mot pin tu JSON `/resource/*/get/` sang ban ghi thong nhat."""
    pin_id = str(pin.get("id") or "").strip()
    if not pin_id:
        return None

    saves = pin.get("repin_count")
    if saves is None:
        saves = _first(pin, "aggregated_pin_data.aggregated_stats.saves", default=0)
    done = _first(pin, "aggregated_pin_data.aggregated_stats.done", default=0)

    images = pin.get("images") or {}
    image_url = _first({"i": images}, "i.736x.url", "i.orig.url", "i.474x.url", "i.236x.url")

    price = _extract_price(pin)
    created = _parse_pin_datetime(pin.get("created_at"))

    return {
        "pin_id": pin_id,
        "query_seed": query_seed,
        "title": (pin.get("title") or pin.get("grid_title") or "").strip(),
        "description": (pin.get("description") or "").strip(),
        "alt_text": (pin.get("alt_text") or pin.get("auto_alt_text") or "").strip(),
        "pin_url": f"https://www.pinterest.com/pin/{pin_id}/",
        "image_url": upgrade_image_url(image_url or ""),
        "outbound_link": pin.get("link") or "",
        "domain": pin.get("domain") or "",
        "board_name": _first(pin, "board.name", default="") or "",
        "creator": _first(pin, "pinner.username", "native_creator.username", default="") or "",
        "saves": int(saves or 0),
        "comments": int(pin.get("comment_count") or 0),
        "reactions": int(done or 0),
        "is_product_pin": 1 if price["price_source"] == "product_pin" else 0,
        "price_value": price["price_value"],
        "price_currency": price["price_currency"],
        "dominant_color": pin.get("dominant_color") or "",
        "created_at": created,
        "collected_at": _utc_now(),
        "data_quality": "rich_json",
        "raw_json": json.dumps(pin, ensure_ascii=False)[:20000],
    }


def normalize_dom_pin(dom: Dict[str, Any], query_seed: str) -> Optional[Dict[str, Any]]:
    """Chuyen mot pin doc tu DOM (title + href + anh) sang cung ban ghi thong nhat."""
    href = dom.get("href") or ""
    m = re.search(r"/pin/(\d+)", href)
    if not m:
        return None
    pin_id = m.group(1)
    title = (dom.get("title") or "").strip()
    return {
        "pin_id": pin_id,
        "query_seed": query_seed,
        "title": title,
        "description": "",
        "alt_text": (dom.get("alt") or "").strip(),
        "pin_url": urllib.parse.urljoin("https://www.pinterest.com", href),
        "image_url": upgrade_image_url(dom.get("img") or ""),
        "outbound_link": "",
        "domain": "",
        "board_name": "",
        "creator": "",
        "saves": 0,
        "comments": 0,
        "reactions": 0,
        "is_product_pin": 0,
        "price_value": None,
        "price_currency": None,
        "dominant_color": "",
        "created_at": None,
        "collected_at": _utc_now(),
        "data_quality": "dom_only",
        "raw_json": json.dumps(dom, ensure_ascii=False)[:4000],
    }


def merge_pin_records(dom_pins: List[Dict[str, Any]],
                      api_pins: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Gop hai nguon theo pin_id. Ban API thang ve chi so; ban DOM bu lai title/anh
    cho nhung pin ma app khong tra kem JSON.
    """
    merged: Dict[str, Dict[str, Any]] = {}
    for p in dom_pins:
        merged[p["pin_id"]] = p
    for p in api_pins:
        existing = merged.get(p["pin_id"])
        if not existing:
            merged[p["pin_id"]] = p
            continue
        for k, v in p.items():
            if v not in (None, "", 0) or existing.get(k) in (None, ""):
                existing[k] = v
        existing["data_quality"] = "rich_json"
    return list(merged.values())


class PinterestScraper:
    """
    Crawler Pinterest chay bang trinh duyet that.

    scrape_queries() tra ve dict gom pin da chuan hoa + metadata cua lan chay
    (engine, so lan cuon, co bi chan hay khong, duong dan file raw da luu).
    """

    def __init__(self,
                 engine: str = "headless",
                 cdp_url: str = "",
                 channel: str = "",
                 profile_dir: str = "data/browser_profile",
                 max_scrolls: int = 12,
                 scroll_pause_ms: int = 2200,
                 idle_scroll_limit: int = 3,
                 page_timeout_ms: int = 60000,
                 save_raw: bool = True):
        self.engine = engine
        self.cdp_url = cdp_url or os.getenv("PINTEREST_CDP_URL", "http://127.0.0.1:9222")
        # channel: "" = Chromium ban di kem Playwright | "msedge" = Microsoft Edge
        # | "chrome" = Google Chrome da cai tren may.
        self.channel = channel or os.getenv("PINTEREST_BROWSER_CHANNEL", "")
        self.profile_dir = profile_dir
        self.max_scrolls = max_scrolls
        self.scroll_pause_ms = scroll_pause_ms
        self.idle_scroll_limit = idle_scroll_limit
        self.page_timeout_ms = page_timeout_ms
        self.save_raw = save_raw
        os.makedirs(RAW_DIR, exist_ok=True)

    # ------------------------------------------------------------ browser

    async def _open_browser(self, pw):
        """Mo trinh duyet theo engine da chon. Tra ve (context, closer)."""
        if self.engine == "cdp":
            browser = await pw.chromium.connect_over_cdp(self.cdp_url)
            ctx = browser.contexts[0] if browser.contexts else await browser.new_context()
            return ctx, browser.close

        if self.engine == "persistent":
            os.makedirs(self.profile_dir, exist_ok=True)
            ctx = await pw.chromium.launch_persistent_context(
                self.profile_dir,
                headless=False,
                viewport={"width": 1440, "height": 900},
                locale="en-US",
                user_agent=self._user_agent(headless=False),
                args=["--disable-blink-features=AutomationControlled"],
                **self._channel_kwargs(),
            )
            return ctx, ctx.close

        browser = await pw.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
            **self._channel_kwargs(),
        )
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            locale="en-US",
            user_agent=self._user_agent(),
        )
        return ctx, browser.close

    def _channel_kwargs(self) -> Dict[str, Any]:
        return {"channel": self.channel} if self.channel else {}

    def _user_agent(self, headless: bool = True) -> Optional[str]:
        """
        Chon User-Agent.

        Che do co giao dien: de trinh duyet tu khai bao UA that cua no (khop hoan toan
        voi fingerprint con lai). Che do headless: BUOC phai ep UA, vi Chromium headless
        tu ghi "HeadlessChrome/..." vao UA - do la co bao bot ro rang nhat.
        """
        if not headless:
            return None if self.channel else DEFAULT_UA
        return EDGE_UA if self.channel == "msedge" else DEFAULT_UA

    # -------------------------------------------------------------- login

    async def _open_login(self, timeout_minutes: int) -> Dict[str, Any]:
        from playwright.async_api import async_playwright

        os.makedirs(self.profile_dir, exist_ok=True)
        async with async_playwright() as pw:
            ctx = await pw.chromium.launch_persistent_context(
                self.profile_dir,
                headless=False,
                viewport={"width": 1440, "height": 900},
                locale="en-US",
                user_agent=self._user_agent(headless=False),
                args=["--disable-blink-features=AutomationControlled"],
                **self._channel_kwargs(),
            )
            page = ctx.pages[0] if ctx.pages else await ctx.new_page()
            await page.goto("https://www.pinterest.com/login/", wait_until="domcontentloaded",
                            timeout=self.page_timeout_ms)

            # flush=True: khi stdout bi pipe (chay nen, ghi ra file log), Python buffer lai
            # va nguoi dung khong thay huong dan nao - dung luc ho dang can doc nhat.
            print("\n" + "=" * 78, flush=True)
            print("Trinh duyet da mo. Hay dang nhap Pinterest bang tai khoan cua ban.", flush=True)
            print(f"Session se duoc luu vao: {os.path.abspath(self.profile_dir)}", flush=True)
            print("Khong ai khac doc duoc thong tin dang nhap - no nam tren may ban.", flush=True)
            print(f"Script tu dong dong khi phat hien da dang nhap "
                  f"(toi da {timeout_minutes} phut).", flush=True)
            print("=" * 78 + "\n", flush=True)

            deadline = time.time() + timeout_minutes * 60
            logged_in = False
            last_notice = 0.0
            while time.time() < deadline:
                cookies = await ctx.cookies("https://www.pinterest.com")
                auth = next((c for c in cookies if c["name"] == "_auth"), None)
                if auth and str(auth.get("value")) == "1":
                    logged_in = True
                    print("Da phat hien dang nhap thanh cong.", flush=True)
                    break
                if time.time() - last_notice >= 30:
                    print(f"  ... dang cho dang nhap (con {int(deadline - time.time())}s)",
                          flush=True)
                    last_notice = time.time()
                await page.wait_for_timeout(2000)

            cookies = await ctx.cookies("https://www.pinterest.com")
            auth = next((c for c in cookies if c["name"] == "_auth"), None)
            auth_value = str(auth["value"]) if auth else None

            if logged_in:
                # Cho session on dinh roi moi dong, tranh mat cookie chua kip ghi xuong dia.
                await page.wait_for_timeout(3000)
            else:
                print(f"  Trang thai cuoi: cookie _auth={auth_value!r} "
                      f"(can '1' moi la da dang nhap), {len(cookies)} cookie pinterest.",
                      flush=True)
            await ctx.close()

        return {
            "logged_in": logged_in,
            "auth_cookie": auth_value,
            "profile_dir": os.path.abspath(self.profile_dir),
            "engine_to_use": "persistent",
        }

    async def _check_session(self) -> Dict[str, Any]:
        from playwright.async_api import async_playwright

        async with async_playwright() as pw:
            ctx, closer = await self._open_browser(pw)
            page = await ctx.new_page()
            flags: Dict[str, Any] = {}

            async def on_resp(resp):
                if "/resource/" in resp.url and "/get/" in resp.url:
                    try:
                        payload = await resp.json()
                    except Exception:
                        return
                    cc = payload.get("client_context") or {}
                    flags.setdefault("is_authenticated", cc.get("is_authenticated"))
                    flags.setdefault("botspam_asn", cc.get("is_unauth_botspam_asn"))

            page.on("response", on_resp)
            await page.goto("https://www.pinterest.com/", wait_until="domcontentloaded",
                            timeout=self.page_timeout_ms)
            await page.wait_for_timeout(6000)
            cookies = await ctx.cookies("https://www.pinterest.com")
            body = ""
            try:
                body = (await page.inner_text("body"))[:400]
            except Exception:
                pass
            await closer()

        auth = next((c for c in cookies if c["name"] == "_auth"), None)
        auth_value = str(auth["value"]) if auth else None
        return {
            "logged_in": auth_value == "1",
            "auth_cookie": auth_value,
            "cookie_count": len(cookies),
            "is_authenticated": flags.get("is_authenticated"),
            "botspam_asn": flags.get("botspam_asn"),
            "shows_login_button": "log in" in body.lower(),
            "profile_dir": os.path.abspath(self.profile_dir),
        }

    def check_session(self) -> Dict[str, Any]:
        """
        Bao trang thai dang nhap that su cua profile.

        Kiem tra GIA TRI cookie `_auth`, khong phai su ton tai cua no: Pinterest dat
        `_auth=0` cho khach chua dang nhap, nen "co cookie _auth" khong he co nghia la
        da dang nhap. Doi chieu them voi co `is_authenticated` trong response cua Pinterest.
        """
        return asyncio.run(self._check_session())

    def open_login_session(self, timeout_minutes: int = 5) -> Dict[str, Any]:
        """
        Mo trinh duyet co giao dien de nguoi dung tu dang nhap Pinterest MOT LAN.

        Script khong bao gio nhin thay mat khau: nguoi dung go truc tiep vao trinh duyet,
        Pinterest tra cookie ve, cookie nam trong thu muc profile tren may nguoi dung.
        Nhung lan crawl sau dung `--engine persistent` se tai lai dung session nay.
        """
        return asyncio.run(self._open_login(timeout_minutes))

    # ------------------------------------------------------------- scrape

    async def _scrape_one(self, page, query: str) -> Dict[str, Any]:
        api_pins: List[Dict[str, Any]] = []
        raw_payloads: List[Dict[str, Any]] = []
        blocked_flag = {"botspam_asn": False}

        async def on_response(resp):
            url = resp.url
            if "/resource/" not in url or "/get/" not in url:
                return
            try:
                payload = await resp.json()
            except Exception:
                return
            ctx_flags = payload.get("client_context") or {}
            if ctx_flags.get("is_unauth_botspam_asn"):
                blocked_flag["botspam_asn"] = True
            data = (payload.get("resource_response") or {}).get("data")
            results = data.get("results") if isinstance(data, dict) else None
            if not results:
                return
            raw_payloads.append({"url": url, "count": len(results)})
            for item in results:
                if not isinstance(item, dict) or item.get("type") not in (None, "pin"):
                    continue
                rec = normalize_api_pin(item, query)
                if rec:
                    api_pins.append(rec)

        page.on("response", on_response)

        search_url = "https://www.pinterest.com/search/pins/?q=" + urllib.parse.quote(query)
        await page.goto(search_url, wait_until="domcontentloaded", timeout=self.page_timeout_ms)
        await page.wait_for_timeout(5000)

        # Cuon vo han: dung khi `idle_scroll_limit` lan cuon lien tiep khong ra pin moi.
        seen_hrefs: set = set()
        idle_rounds = 0
        scrolls = 0
        for _ in range(self.max_scrolls):
            hrefs = await page.eval_on_selector_all(
                "a[href*='/pin/']", "els => els.map(e => e.getAttribute('href'))"
            )
            before = len(seen_hrefs)
            seen_hrefs.update(h for h in hrefs if h)
            if len(seen_hrefs) == before:
                idle_rounds += 1
                if idle_rounds >= self.idle_scroll_limit:
                    break
            else:
                idle_rounds = 0
            await page.mouse.wheel(0, 3200)
            await page.wait_for_timeout(self.scroll_pause_ms)
            scrolls += 1

        dom_raw = await page.evaluate(
            """
            (selectors) => {
              let nodes = [];
              for (const sel of selectors) {
                nodes = Array.from(document.querySelectorAll(sel));
                if (nodes.length) break;
              }
              if (!nodes.length) {
                nodes = Array.from(document.querySelectorAll("a[href*='/pin/']"))
                             .map(a => a.closest('div') || a);
              }
              const out = [];
              for (const node of nodes) {
                const a = node.matches("a[href*='/pin/']") ? node : node.querySelector("a[href*='/pin/']");
                if (!a) continue;
                const img = node.querySelector('img');
                out.push({
                  href: a.getAttribute('href'),
                  title: a.getAttribute('aria-label') || (img && img.getAttribute('alt')) || '',
                  alt: img ? (img.getAttribute('alt') || '') : '',
                  img: img ? (img.getAttribute('src') || '') : ''
                });
              }
              return out;
            }
            """,
            PIN_WRAPPER_SELECTORS,
        )

        body_text = ""
        try:
            body_text = (await page.inner_text("body"))[:2000]
        except Exception:
            pass
        empty_feed = any(marker in body_text.lower() for marker in EMPTY_FEED_MARKERS)

        dom_pins = [r for r in (normalize_dom_pin(d, query) for d in dom_raw) if r]
        pins = merge_pin_records(dom_pins, api_pins)

        page.remove_listener("response", on_response)

        return {
            "query": query,
            "pins": pins,
            "dom_count": len(dom_pins),
            "api_count": len(api_pins),
            "scrolls": scrolls,
            "empty_feed": empty_feed,
            "botspam_asn": blocked_flag["botspam_asn"],
            "resource_payloads": raw_payloads,
            "body_sample": body_text[:400],
        }

    async def _scrape_all(self, queries: List[str], per_query_limit: int) -> Dict[str, Any]:
        from playwright.async_api import async_playwright

        started = time.time()
        per_query: List[Dict[str, Any]] = []
        all_pins: Dict[str, Dict[str, Any]] = {}

        async with async_playwright() as pw:
            ctx, closer = await self._open_browser(pw)
            page = await ctx.new_page()
            try:
                for q in queries:
                    try:
                        result = await self._scrape_one(page, q)
                    except Exception as exc:  # mot query hong khong duoc lam chet ca lan chay
                        result = {"query": q, "pins": [], "dom_count": 0, "api_count": 0,
                                  "scrolls": 0, "empty_feed": False, "botspam_asn": False,
                                  "resource_payloads": [], "error": f"{type(exc).__name__}: {exc}"}
                    for pin in result["pins"][:per_query_limit]:
                        prev = all_pins.get(pin["pin_id"])
                        if prev is None or pin["saves"] > prev["saves"]:
                            all_pins[pin["pin_id"]] = pin
                    result["pins"] = len(result["pins"])
                    per_query.append(result)
            finally:
                await closer()

        pins = list(all_pins.values())
        blocked = (not pins) and any(r.get("empty_feed") or r.get("botspam_asn") for r in per_query)

        return {
            "engine": self.engine,
            "queries": queries,
            "pins": pins,
            "per_query": per_query,
            "elapsed_sec": round(time.time() - started, 2),
            "blocked": blocked,
            "collected_at": _utc_now(),
        }

    def scrape_queries(self, queries: List[str], per_query_limit: int = 60) -> Dict[str, Any]:
        """Chay crawl dong bo (bao ngoai vong lap asyncio) cho nhieu tu khoa."""
        result = asyncio.run(self._scrape_all(queries, per_query_limit))

        if result["blocked"]:
            result["status"] = "blocked"
            result["block_reason"] = (
                "Pinterest tra feed rong cho khach chua dang nhap tu dai IP nay "
                "(co is_unauth_botspam_asn). Doi sang engine 'persistent' de dang nhap mot lan, "
                "engine 'cdp' de gan vao trinh duyet anti-detect, hoac chay qua proxy dan cu."
            )
        elif result["pins"]:
            result["status"] = "success"
        else:
            result["status"] = "failed"

        if self.save_raw:
            result["raw_artifact_path"] = self._save_raw(result)
        return result

    def _save_raw(self, result: Dict[str, Any]) -> str:
        """Luu artifact tho de AI agent / nguoi kiem tra doc lai duoc nguon goc."""
        ts = int(time.time())
        slug = "".join(c if c.isalnum() else "_" for c in "_".join(result["queries"]).lower())[:40]
        path = os.path.join(RAW_DIR, f"{ts}_pinterest_{slug}_raw.json")
        artifact = {
            "source": "pinterest",
            "engine": result["engine"],
            "queries": result["queries"],
            "status": result.get("status"),
            "collected_at": result["collected_at"],
            "elapsed_sec": result["elapsed_sec"],
            "pin_count": len(result["pins"]),
            "per_query": result["per_query"],
            "pins": result["pins"],
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(artifact, f, indent=2, ensure_ascii=False)
        return os.path.abspath(path)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Crawl Pinterest search pins")
    ap.add_argument("queries", nargs="+", help="Tu khoa can crawl")
    ap.add_argument("--engine", default="headless", choices=["headless", "persistent", "cdp"])
    ap.add_argument("--limit", type=int, default=60)
    args = ap.parse_args()

    out = PinterestScraper(engine=args.engine).scrape_queries(args.queries, args.limit)
    print(json.dumps({k: v for k, v in out.items() if k != "pins"}, indent=2, ensure_ascii=False))
    print(f"pins collected: {len(out['pins'])}")
    for pin in out["pins"][:5]:
        print(f"  - [{pin['saves']:>6} saves] {pin['title'][:70]}")
