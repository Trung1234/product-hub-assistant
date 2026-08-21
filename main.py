#!/usr/bin/env python3
"""Collect Etsy page-one search cards through the Undetectable Local API.

The script intentionally uses only Python's standard library.  It can also parse
an already-saved Etsy HTML page with --html-file, which keeps fixture tests
deterministic and avoids opening a browser.
"""

from __future__ import annotations

import argparse
import datetime as dt
import errno
import html.parser
import json
import os
import re
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Sequence, Tuple


SCHEMA_VERSION = "1.0"
PROFILE_NAMES = tuple(f"etsy-crawler-{index}" for index in range(1, 6))
ORGANIC_COMPONENT = "search2_organic_listings_group"
ORGANIC_MARKER = f'data-appears-component-name="{ORGANIC_COMPONENT}"'
DEFAULT_API_URL = os.environ.get("UNDETECTABLE_API_URL", "http://127.0.0.1:25325")
VOID_ELEMENTS = {
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
}
BLOCK_PATTERNS = (
    "verify you are human",
    "captcha",
    "robot check",
    "access denied",
    "unusual traffic",
    "too many requests",
)
EMPTY_PATTERNS = (
    "we couldn't find any results",
    "we couldn’t find any results",
    "no items found",
    "no results found",
)
CURRENCY_BY_SYMBOL = {
    "₫": "VND",
    "$": "USD",
    "US$": "USD",
    "CA$": "CAD",
    "A$": "AUD",
    "£": "GBP",
    "€": "EUR",
    "¥": "JPY",
}


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).astimezone().isoformat(timespec="seconds")


def normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(value.replace("\xa0", " ").split())


def slugify(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return slug[:60] or "etsy-search"


def coerce_int(value: str) -> Optional[int]:
    cleaned = normalize_text(value).replace(",", "").replace(" ", "")
    match = re.search(r"[+-]?\d+", cleaned)
    if not match:
        return None
    try:
        return int(match.group(0))
    except ValueError:
        return None


def coerce_percent(value: str) -> Optional[float]:
    match = re.search(r"[+-]?(?:\d+(?:\.\d+)?|\.\d+)", normalize_text(value).replace(",", ""))
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def coerce_scaled_number(value: str) -> Optional[Any]:
    cleaned = normalize_text(value).replace(",", "")
    match = re.search(r"([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([KMB])?", cleaned, re.IGNORECASE)
    if not match:
        return None
    multiplier = {"": Decimal(1), "K": Decimal(1000), "M": Decimal(1_000_000), "B": Decimal(1_000_000_000)}
    try:
        number = Decimal(match.group(1)) * multiplier[(match.group(2) or "").upper()]
    except (InvalidOperation, KeyError):
        return None
    if number == number.to_integral_value():
        return int(number)
    return float(number)


def parse_currency(raw: str) -> Tuple[Optional[str], Optional[str]]:
    normalized = normalize_text(raw)
    code_match = re.search(r"\b([A-Z]{3})\b", normalized)
    if code_match:
        return code_match.group(1), code_match.group(1)
    for symbol in sorted(CURRENCY_BY_SYMBOL, key=len, reverse=True):
        if symbol in normalized:
            return CURRENCY_BY_SYMBOL[symbol], symbol
    return None, None


def parse_money_value(raw: str) -> Optional[str]:
    normalized = normalize_text(raw)
    match = re.search(r"(?:\d[\d,.\s]*\d|\d)", normalized)
    if not match:
        return None
    numeric = match.group(0).replace(" ", "")
    if "," in numeric and "." not in numeric:
        parts = numeric.split(",")
        numeric = "".join(parts) if all(len(part) == 3 for part in parts[1:]) else ".".join(parts)
    elif "," in numeric and "." in numeric:
        numeric = numeric.replace(",", "")
    try:
        decimal_value = Decimal(numeric)
    except InvalidOperation:
        return None
    return format(decimal_value, "f")


@dataclass
class Element:
    tag: str
    attrs: Dict[str, str] = field(default_factory=dict)
    parent: Optional["Element"] = None
    children: List[Any] = field(default_factory=list)

    def has_attr(self, name: str) -> bool:
        return name in self.attrs

    def get(self, name: str, default: Optional[str] = None) -> Optional[str]:
        return self.attrs.get(name, default)

    @property
    def classes(self) -> set:
        return set((self.attrs.get("class") or "").split())

    def iter_elements(self, include_self: bool = False) -> Iterator["Element"]:
        stack: List[Element] = [self] if include_self else [child for child in reversed(self.children) if isinstance(child, Element)]
        while stack:
            node = stack.pop()
            yield node
            stack.extend(child for child in reversed(node.children) if isinstance(child, Element))

    def find(self, predicate: Callable[["Element"], bool], include_self: bool = False) -> Optional["Element"]:
        return next((node for node in self.iter_elements(include_self=include_self) if predicate(node)), None)

    def find_all(self, predicate: Callable[["Element"], bool], include_self: bool = False) -> List["Element"]:
        return [node for node in self.iter_elements(include_self=include_self) if predicate(node)]

    def text(self) -> str:
        pieces: List[str] = []
        stack: List[Any] = list(reversed(self.children))
        while stack:
            item = stack.pop()
            if isinstance(item, str):
                pieces.append(item)
            elif isinstance(item, Element):
                stack.extend(reversed(item.children))
        return normalize_text(" ".join(pieces))


class DocumentParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Element("document")
        self.stack = [self.root]
        self.ignored_text_depth = 0

    def handle_starttag(self, tag: str, attrs: Sequence[Tuple[str, Optional[str]]]) -> None:
        tag = tag.lower()
        node = Element(tag=tag, attrs={name: value or "" for name, value in attrs}, parent=self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID_ELEMENTS:
            self.stack.append(node)
            if tag in {"script", "style"}:
                self.ignored_text_depth += 1

    def handle_startendtag(self, tag: str, attrs: Sequence[Tuple[str, Optional[str]]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag.lower() not in VOID_ELEMENTS:
            self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        match_index = None
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                match_index = index
                break
        if match_index is None:
            return
        closing = self.stack[match_index:]
        self.stack = self.stack[:match_index]
        self.ignored_text_depth -= sum(1 for node in closing if node.tag in {"script", "style"})
        self.ignored_text_depth = max(self.ignored_text_depth, 0)

    def handle_data(self, data: str) -> None:
        if self.ignored_text_depth == 0 and data:
            self.stack[-1].children.append(data)


def parse_document(html: str) -> Element:
    parser = DocumentParser()
    parser.feed(html)
    parser.close()
    return parser.root


def has_class(node: Element, name: str) -> bool:
    return name in node.classes


def find_text_element(root: Element, label: str, preferred_tags: Sequence[str] = ()) -> Optional[Element]:
    exact: List[Element] = []
    for node in root.iter_elements(include_self=True):
        if node.text() == label:
            if preferred_tags and node.tag in preferred_tags:
                return node
            exact.append(node)
    return exact[0] if exact else None


def nearest_ancestor(node: Optional[Element], predicate: Callable[[Element], bool]) -> Optional[Element]:
    current = node
    while current is not None:
        if predicate(current):
            return current
        current = current.parent
    return None


def next_element_sibling(node: Element) -> Optional[Element]:
    if node.parent is None:
        return None
    seen = False
    for child in node.parent.children:
        if child is node:
            seen = True
        elif seen and isinstance(child, Element):
            return child
    return None


def metric_text(root: Element, label: str) -> Optional[str]:
    label_node = find_text_element(root, label, preferred_tags=("span",))
    if label_node is None:
        return None
    sibling = next_element_sibling(label_node)
    if sibling is not None and sibling.text():
        return sibling.text()
    container = label_node.parent
    if container is not None:
        spans = container.find_all(lambda node: node.tag == "span")
        for span in spans:
            value = span.text()
            if value and value != label:
                return value
    return None


def definition_text(root: Element, label: str) -> Optional[str]:
    label_node = find_text_element(root, label, preferred_tags=("dt", "span"))
    row = nearest_ancestor(label_node, lambda node: node.tag == "div" and node.find(lambda child: child.tag == "dd") is not None)
    if row is None:
        return None
    dd = row.find(lambda node: node.tag == "dd")
    return dd.text() if dd is not None else None


def section_row(root: Element, label: str) -> Optional[Element]:
    label_node = find_text_element(root, label, preferred_tags=("span", "dt"))
    return nearest_ancestor(label_node, lambda node: node.tag == "div" and node.find(lambda child: child.tag == "dd") is not None)


def clean_listing_url(url: str) -> str:
    if not url:
        return ""
    parsed = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def find_screen_reader_price(price_root: Optional[Element], prefix: str) -> str:
    if price_root is None:
        return ""
    for node in price_root.find_all(lambda item: has_class(item, "wt-screen-reader-only")):
        value = node.text()
        if value.lower().startswith(prefix.lower()):
            return normalize_text(value[len(prefix):])
    return ""


def parse_price(card: Element) -> Dict[str, Any]:
    price_root = card.find(lambda node: has_class(node, "n-listing-card__price"))
    sale_raw = find_screen_reader_price(price_root, "Sale Price")
    original_raw = find_screen_reader_price(price_root, "Original Price")
    regular_raw = find_screen_reader_price(price_root, "Price")
    if not sale_raw:
        sale_raw = regular_raw
    if not sale_raw and price_root is not None:
        values = price_root.find_all(lambda node: has_class(node, "currency-value"))
        symbols = price_root.find_all(lambda node: has_class(node, "currency-symbol"))
        if values:
            sale_raw = values[0].text() + (symbols[0].text() if symbols else "")
        if len(values) > 1:
            original_raw = values[1].text() + (symbols[1].text() if len(symbols) > 1 else "")
    combined = " ".join(value for value in (sale_raw, original_raw) if value)
    currency, symbol = parse_currency(combined)
    discount = None
    if price_root is not None:
        match = re.search(r"(\d+(?:\.\d+)?)%\s*off", price_root.text(), re.IGNORECASE)
        discount = float(match.group(1)) if match and "." in match.group(1) else int(match.group(1)) if match else None
    return {
        "sale": {"raw": sale_raw or None, "value": parse_money_value(sale_raw)} if sale_raw else None,
        "original": {"raw": original_raw or None, "value": parse_money_value(original_raw)} if original_raw else None,
        "currency": currency,
        "currency_symbol": symbol,
        "discount_percent": discount,
    }


def parse_created(raw: Optional[str]) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    normalized = normalize_text(raw)
    date_value = None
    date_match = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", normalized)
    if date_match:
        day, month, year = map(int, date_match.groups())
        try:
            date_value = dt.date(year, month, day).isoformat()
        except ValueError:
            date_value = None
    age_match = re.search(r"\(([^)]+)\)", normalized)
    return {"raw": normalized, "date": date_value, "age_text": age_match.group(1) if age_match else None}


def parse_etsy_card(card: Element, rank: int) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    warnings: List[Dict[str, Any]] = []
    listing_id = card.get("data-listing-id") or ""
    shop_id = card.get("data-shop-id") or None
    title_node = card.find(lambda node: node.tag == "h3" and (node.get("id") or "").startswith("listing-title-"))
    title = (title_node.get("title") if title_node else None) or (title_node.text() if title_node else "")
    canonical_input = card.find(lambda node: node.tag == "input" and node.get("name") == "listing_url")
    link = card.find(lambda node: node.tag == "a" and node.has_attr("data-listing-link") and "/listing/" in (node.get("href") or ""))
    canonical_url = clean_listing_url((canonical_input.get("value") if canonical_input else None) or (link.get("href") if link else ""))
    image = card.find(lambda node: node.tag == "img" and node.has_attr("data-listing-card-listing-image"))
    video_source = card.find(lambda node: node.tag == "source" and (node.get("type") or "").startswith("video/"))
    rating_node = card.find(lambda node: node.tag == "clg-static-review-stars" and node.has_attr("rating"))
    shop_node = card.find(lambda node: node.has_attr("data-seller-name-link"))
    badges = [node.text() for node in card.find_all(lambda node: node.tag == "clg-signal") if node.text()]
    shipping = next((text for text in (node.text() for node in card.find_all(lambda node: node.tag in {"span", "p"})) if "shipping" in text.lower() and len(text) < 100), None)
    rating = None
    if rating_node is not None:
        try:
            rating = float(rating_node.get("rating") or "")
        except ValueError:
            warnings.append({"code": "invalid_rating", "raw": rating_node.get("rating")})
    review_count = coerce_int(rating_node.get("review-count-text") or "") if rating_node else None
    tracking_url = link.get("href") if link else ""
    promoted_param = urllib.parse.parse_qs(urllib.parse.urlsplit(tracking_url).query).get("pro", [None])[0]
    visible_card_text = card.text().lower()
    is_sponsored = True if re.search(r"\b(ad by|sponsored)\b", visible_card_text) else None
    if not listing_id:
        warnings.append({"code": "missing_listing_id"})
    if not title:
        warnings.append({"code": "missing_title"})
    if not canonical_url:
        warnings.append({"code": "missing_canonical_url"})
    return {
        "rank": rank,
        "listing_id": listing_id,
        "shop_id": shop_id,
        "etsy": {
            "title": normalize_text(title) or None,
            "canonical_url": canonical_url or None,
            "image_url": image.get("src") if image else None,
            "high_res_image_url": image.get("data-preload-lp-src") if image else None,
            "video_url": video_source.get("src") if video_source else None,
            "shop_name": shop_node.text() if shop_node else None,
            "shop_url": shop_node.get("data-shop-url") if shop_node else None,
            "rating": rating,
            "review_count": review_count,
            "badges": badges,
            "price": parse_price(card),
            "shipping_text": shipping,
            "is_sponsored": is_sponsored,
            "tracking": {"promoted_param": promoted_param},
        },
    }, warnings


def parse_heyetsy(root: Element, listing_id: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    warnings: List[Dict[str, Any]] = []
    hey = root.find(lambda node: node.get("data-heyetsy-listing-id") == listing_id)
    if hey is None:
        return {"available": False}, [{"code": "heyetsy_missing"}]

    country_name = None
    country_code = None
    for node in hey.find_all(lambda item: has_class(item, "heyetsy-tooltip")):
        text = node.text()
        match = re.search(r"Seller's country:\s*(.+)", text, re.IGNORECASE)
        if match:
            country_name = normalize_text(match.group(1))
            icon = nearest_ancestor(node, lambda item: has_class(item, "heyetsy-icon"))
            flag = icon.find(lambda item: item.tag == "img" and "flagcdn.com/" in (item.get("src") or "")) if icon else None
            if flag:
                code_match = re.search(r"flagcdn\.com/([a-z]{2})\.svg", flag.get("src") or "", re.IGNORECASE)
                country_code = code_match.group(1).lower() if code_match else None
            break

    daily_sales = None
    for node in hey.find_all(lambda item: has_class(item, "heyetsy-tooltip")):
        if "recent daily sales" in node.text().lower():
            icon = nearest_ancestor(node, lambda item: has_class(item, "heyetsy-icon"))
            candidate = icon.find(lambda item: item.tag in {"p", "span"} and re.fullmatch(r"\+?\d[\d,]*", item.text())) if icon else None
            daily_sales = coerce_int(candidate.text()) if candidate else None
            break

    raw_metrics = {
        "total_views": metric_text(hey, "Total Views"),
        "average_daily_views": metric_text(hey, "AVG View"),
        "views_24h": metric_text(hey, "Views 24H"),
        "total_sold": metric_text(hey, "Total Sold"),
        "estimated_revenue": metric_text(hey, "Revenue"),
        "sold_24h": metric_text(hey, "Sold 24H"),
        "favorites": metric_text(hey, "Favorites"),
        "favorite_rate_percent": metric_text(hey, "Favor. Rate"),
    }
    conversion_raw = definition_text(hey, "Conversion Rate")
    revenue_raw = raw_metrics["estimated_revenue"]
    revenue_currency, _ = parse_currency(revenue_raw or "")
    revenue = None
    if revenue_raw:
        revenue = {
            "raw": revenue_raw,
            "value": coerce_scaled_number(revenue_raw),
            "currency": revenue_currency,
            "estimated": True,
        }

    tags: List[str] = []
    tags_row = section_row(hey, "Tags")
    if tags_row is not None:
        dd = tags_row.find(lambda node: node.tag == "dd")
        if dd is not None:
            for anchor in dd.find_all(lambda node: node.tag == "a" and "/search?" in (node.get("href") or "")):
                tag = anchor.text()
                if tag and tag not in tags:
                    tags.append(tag)

    categories: List[str] = []
    categories_row = section_row(hey, "Categories")
    if categories_row is not None:
        dd = categories_row.find(lambda node: node.tag == "dd")
        if dd is not None:
            categories = [part.strip() for part in dd.text().split(",") if part.strip()]

    similar = hey.find(lambda node: node.tag == "a" and re.search(r"/listing/\d+/similar", node.get("href") or "") is not None)
    missing_labels = [label for label, raw in raw_metrics.items() if raw is None]
    if conversion_raw is None:
        missing_labels.append("conversion_rate_percent")
    if missing_labels:
        warnings.append({"code": "heyetsy_metrics_partial", "missing": missing_labels})

    return {
        "available": True,
        "seller_country": {"name": country_name, "country_code": country_code} if country_name or country_code else None,
        "shop_recent_daily_sales": daily_sales,
        "metrics": {
            "total_views": coerce_int(raw_metrics["total_views"] or ""),
            "average_daily_views": coerce_int(raw_metrics["average_daily_views"] or ""),
            "views_24h": coerce_int(raw_metrics["views_24h"] or ""),
            "total_sold": coerce_int(raw_metrics["total_sold"] or ""),
            "estimated_revenue": revenue,
            "sold_24h": coerce_int(raw_metrics["sold_24h"] or ""),
            "favorites": coerce_int(raw_metrics["favorites"] or ""),
            "favorite_rate_percent": coerce_percent(raw_metrics["favorite_rate_percent"] or ""),
            "conversion_rate_percent": coerce_percent(conversion_raw or ""),
        },
        "raw_metrics": {**raw_metrics, "conversion_rate_percent": conversion_raw},
        "created": parse_created(definition_text(hey, "Created")),
        "updated": {"raw": definition_text(hey, "Updated")} if definition_text(hey, "Updated") else None,
        "tags": tags,
        "categories": categories,
        "similar_market_url": similar.get("href") if similar else None,
    }, warnings


def parse_search_page(html: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
    document = parse_document(html)
    roots = document.find_all(lambda node: node.get("data-appears-component-name") == ORGANIC_COMPONENT)
    listings: List[Dict[str, Any]] = []
    run_warnings: List[Dict[str, Any]] = []
    first_positions: Dict[str, int] = {}
    duplicate_positions: Dict[str, List[int]] = {}
    missing_heyetsy = 0
    partial_heyetsy = 0

    for position, root in enumerate(roots, start=1):
        card = root.find(lambda node: node.has_attr("data-listing-card-v2") and node.has_attr("data-listing-id"))
        if card is None:
            run_warnings.append({"code": "organic_wrapper_missing_card", "position": position})
            continue
        listing, card_warnings = parse_etsy_card(card, position)
        listing_id = listing["listing_id"]
        if listing_id in first_positions:
            duplicate_positions.setdefault(listing_id, [first_positions[listing_id]]).append(position)
            continue
        first_positions[listing_id] = position
        heyetsy, hey_warnings = parse_heyetsy(root, listing_id)
        listing["heyetsy"] = heyetsy
        listing["parse_warnings"] = card_warnings + hey_warnings
        if not heyetsy.get("available"):
            missing_heyetsy += 1
        elif hey_warnings:
            partial_heyetsy += 1
        listings.append(listing)

    for listing_id, positions in duplicate_positions.items():
        run_warnings.append({"code": "duplicate_organic_listing", "listing_id": listing_id, "positions": positions})

    required_complete = sum(
        1
        for listing in listings
        if listing.get("listing_id") and listing.get("etsy", {}).get("title") and listing.get("etsy", {}).get("canonical_url")
    )
    counts = {
        "organic_cards_found": len(roots),
        "unique_listings": len(listings),
        "etsy_records_complete": required_complete,
        "heyetsy_records_complete": len(listings) - missing_heyetsy - partial_heyetsy,
        "heyetsy_records_partial": partial_heyetsy,
        "heyetsy_records_missing": missing_heyetsy,
        "duplicate_organic_ids": len(duplicate_positions),
    }
    return listings, counts, run_warnings


class ApiError(RuntimeError):
    pass


class UndetectableApi:
    def __init__(self, base_url: str, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def request(self, method: str, path: str, payload: Optional[Dict[str, Any]] = None, timeout: Optional[float] = None) -> Any:
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Accept": "application/json"}
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(self.base_url + path, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=timeout or self.timeout) as response:
                result = json.load(response)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise ApiError(f"{method} {path} failed: {exc}") from exc
        if not isinstance(result, dict) or result.get("code") != 0 or result.get("status") != "success":
            error = result.get("data", {}).get("error") if isinstance(result, dict) and isinstance(result.get("data"), dict) else result
            raise ApiError(f"{method} {path} returned an error: {error}")
        return result.get("data")

    def get(self, path: str, timeout: Optional[float] = None) -> Any:
        return self.request("GET", path, timeout=timeout)

    def post(self, path: str, payload: Dict[str, Any], timeout: Optional[float] = None) -> Any:
        return self.request("POST", path, payload=payload, timeout=timeout)

    def status(self) -> None:
        self.get("/status")

    def profiles(self) -> List[Dict[str, Any]]:
        data = self.get("/list")
        if isinstance(data, dict):
            return [{**value, "id": str(profile_id)} for profile_id, value in data.items() if isinstance(value, dict)]
        if isinstance(data, list):
            return [{**value, "id": str(value.get("id", ""))} for value in data if isinstance(value, dict)]
        raise ApiError("GET /list returned an unsupported profile collection")

    def start_profile(self, profile_id: str) -> Any:
        return self.get(f"/profile/start/{urllib.parse.quote(profile_id, safe='')}", timeout=30)

    def stop_profile(self, profile_id: str) -> Any:
        return self.get(f"/profile/stop/{urllib.parse.quote(profile_id, safe='')}", timeout=30)

    def open_url(self, profile_id: str, url: str) -> Any:
        return self.post(f"/browser/openurl/{urllib.parse.quote(profile_id, safe='')}", {"url": url}, timeout=30)

    def evaluate(self, profile_id: str, script: str) -> Any:
        return self.post(f"/browser/evaluate/{urllib.parse.quote(profile_id, safe='')}", {"script": script})

    def get_page(self, profile_id: str) -> str:
        data = self.get(f"/browser/getpage/{urllib.parse.quote(profile_id, safe='')}", timeout=30)
        if not isinstance(data, dict) or not isinstance(data.get("page"), str):
            raise ApiError("GET /browser/getpage returned no HTML page")
        return data["page"]


@dataclass
class ProfileLease:
    profile_id: str
    profile_name: str
    lock_path: Path
    started_by_script: bool = False


def pid_is_running(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except OSError as exc:
        return exc.errno == errno.EPERM
    return True


def try_acquire_lock(profile_name: str) -> Optional[Path]:
    lock_path = Path(tempfile.gettempdir()) / f"product-hub-{profile_name}.lock"
    for _ in range(2):
        try:
            fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump({"pid": os.getpid(), "created_at": now_iso()}, handle)
            return lock_path
        except FileExistsError:
            stale = False
            try:
                payload = json.loads(lock_path.read_text(encoding="utf-8"))
                stale = not pid_is_running(int(payload.get("pid", 0)))
            except (OSError, ValueError, json.JSONDecodeError):
                stale = True
            if stale:
                try:
                    lock_path.unlink()
                except FileNotFoundError:
                    pass
                continue
            return None
    return None


def release_lock(lock_path: Optional[Path]) -> None:
    if lock_path is None:
        return
    try:
        payload = json.loads(lock_path.read_text(encoding="utf-8"))
        if int(payload.get("pid", 0)) != os.getpid():
            return
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    try:
        lock_path.unlink()
    except FileNotFoundError:
        pass


def acquire_profile(api: UndetectableApi, requested: str) -> ProfileLease:
    profiles = api.profiles()
    by_name = {profile.get("name"): profile for profile in profiles if profile.get("name") in PROFILE_NAMES}
    candidates = PROFILE_NAMES if requested == "auto" else (requested,)
    errors: List[str] = []
    for name in candidates:
        profile = by_name.get(name)
        if profile is None:
            errors.append(f"{name}: missing")
            continue
        if profile.get("status") != "Available":
            errors.append(f"{name}: {profile.get('status', 'unknown')}")
            continue
        lock_path = try_acquire_lock(name)
        if lock_path is None:
            errors.append(f"{name}: locked by another process")
            continue
        profile_id = str(profile.get("id") or "")
        if not profile_id:
            release_lock(lock_path)
            errors.append(f"{name}: missing profile id")
            continue
        lease = ProfileLease(profile_id=profile_id, profile_name=name, lock_path=lock_path)
        try:
            api.start_profile(profile_id)
            lease.started_by_script = True
            return lease
        except ApiError as exc:
            release_lock(lock_path)
            errors.append(f"{name}: {exc}")
    raise ApiError("No crawler profile is available (" + "; ".join(errors) + ")")


def page_state(html: str) -> str:
    lowered = html.lower()
    # Normal Etsy result pages can contain dormant CAPTCHA references in
    # scripts or hidden markup.  A rendered organic grid is stronger evidence
    # than those text fragments and must take precedence.  Real challenge
    # pages observed in practice contain no organic-result wrappers.
    if ORGANIC_MARKER in html:
        return "results"
    if any(pattern in lowered for pattern in BLOCK_PATTERNS):
        return "blocked"
    if any(pattern in lowered for pattern in EMPTY_PATTERNS):
        return "empty"
    return "loading"


def count_enrichment(html: str) -> Tuple[int, int, int]:
    organic_count = html.count(ORGANIC_MARKER)
    heyetsy_ids = set(re.findall(r'data-heyetsy-listing-id="(\d+)"', html))
    complete_metrics = html.count("Conversion Rate")
    return organic_count, len(heyetsy_ids), complete_metrics


def load_live_page(
    api: UndetectableApi,
    lease: ProfileLease,
    search_url: str,
    page_timeout: float,
    metrics_timeout: float,
    verbose: bool,
) -> Tuple[str, str, List[Dict[str, Any]]]:
    warnings: List[Dict[str, Any]] = []
    api.open_url(lease.profile_id, search_url)
    deadline = time.monotonic() + page_timeout
    html = ""
    state = "loading"
    while time.monotonic() < deadline:
        time.sleep(1.5)
        html = api.get_page(lease.profile_id)
        state = page_state(html)
        if verbose:
            print(f"Waiting for Etsy: state={state}, organic={html.count(ORGANIC_MARKER)}", file=sys.stderr)
        if state in {"results", "empty", "blocked"}:
            break
    if state != "results":
        return html, state if state != "loading" else "failed", warnings

    # Scroll through the page in deterministic fractions so lazy cards and the
    # HeyEtsy extension receive viewport time.  No challenge-solving logic is
    # attempted here or elsewhere in the script.
    for step in range(1, 21):
        fraction = step / 20
        api.evaluate(
            lease.profile_id,
            f"window.scrollTo({{top: Math.max(0, (document.body.scrollHeight - window.innerHeight) * {fraction:.2f}), behavior: 'auto'}})",
        )
        time.sleep(0.6)
    api.evaluate(
        lease.profile_id,
        "document.querySelector('[data-appears-component-name=\"search_pagination\"]')?.scrollIntoView({block:'center'})",
    )

    metrics_deadline = time.monotonic() + metrics_timeout
    last_counts: Optional[Tuple[int, int, int]] = None
    stable_checks = 0
    while time.monotonic() < metrics_deadline:
        time.sleep(2)
        html = api.get_page(lease.profile_id)
        counts = count_enrichment(html)
        if verbose:
            print(
                f"Waiting for metrics: organic={counts[0]}, heyetsy_unique={counts[1]}, complete_labels={counts[2]}",
                file=sys.stderr,
            )
        stable_checks = stable_checks + 1 if counts == last_counts else 0
        last_counts = counts
        organic_count, _heyetsy_count, complete_count = counts
        if organic_count > 0 and complete_count >= organic_count and stable_checks >= 1:
            break
        if stable_checks >= 4 and complete_count > 0:
            warnings.append({"code": "heyetsy_enrichment_stabilized_partial", "counts": counts})
            break
    else:
        warnings.append({"code": "heyetsy_metrics_timeout", "timeout_seconds": metrics_timeout})
    return html, "results", warnings


def build_output(
    *,
    keyword: str,
    search_url: str,
    started_at: str,
    started_monotonic: float,
    status: str,
    listings: List[Dict[str, Any]],
    counts: Dict[str, Any],
    warnings: List[Dict[str, Any]],
    errors: List[Dict[str, Any]],
    profile_name: Optional[str],
    profile_id: Optional[str],
    mode: str,
) -> Dict[str, Any]:
    completed_at = now_iso()
    return {
        "schema_version": SCHEMA_VERSION,
        "run": {
            "run_id": dt.datetime.now().astimezone().strftime("%Y%m%dT%H%M%S") + "-" + slugify(keyword),
            "source": "etsy_search_page",
            "mode": mode,
            "keyword": keyword,
            "page": 1,
            "search_url": search_url,
            "started_at": started_at,
            "completed_at": completed_at,
            "duration_ms": int((time.monotonic() - started_monotonic) * 1000),
            "status": status,
            "workers": [
                {
                    "profile_name": profile_name,
                    "profile_id": profile_id,
                    "status": status,
                }
            ]
            if profile_name or profile_id
            else [],
            "counts": counts,
            "warnings": warnings,
        },
        "listings": listings,
        "errors": errors,
    }


def write_json_atomic(path: Path, payload: Dict[str, Any]) -> None:
    path = path.expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    with temporary.open("r", encoding="utf-8") as handle:
        json.load(handle)
    os.replace(str(temporary), str(path))


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect page-one Etsy search cards through Undetectable.")
    parser.add_argument("--keyword", required=True, help="Etsy search phrase, for example: ornament christmas")
    parser.add_argument("--profile", default="auto", choices=("auto",) + PROFILE_NAMES, help="Crawler profile to use")
    parser.add_argument("--output", default="data.json", help="JSON output path (default: data.json)")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Undetectable Local API base URL")
    parser.add_argument("--page-timeout", type=float, default=45.0, help="Seconds to wait for Etsy results")
    parser.add_argument("--metrics-timeout", type=float, default=120.0, help="Seconds to wait for HeyEtsy metrics")
    parser.add_argument("--html-file", help="Parse a saved page instead of opening Undetectable (fixture/debug mode)")
    parser.add_argument("--verbose", action="store_true", help="Print progress details to stderr")
    return parser.parse_args(argv)


def derive_status(page_status: str, counts: Dict[str, Any]) -> str:
    if page_status in {"blocked", "empty", "failed"}:
        return page_status
    if not counts.get("unique_listings"):
        return "failed"
    if counts.get("etsy_records_complete") != counts.get("unique_listings"):
        return "partial"
    if counts.get("heyetsy_records_complete") != counts.get("unique_listings"):
        return "partial"
    return "success"


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    keyword = normalize_text(args.keyword)
    if not keyword:
        print("error: --keyword cannot be empty", file=sys.stderr)
        return 1
    if args.page_timeout <= 0 or args.metrics_timeout < 0:
        print("error: timeouts must be positive", file=sys.stderr)
        return 1

    output_path = Path(args.output)
    search_url = "https://www.etsy.com/search?" + urllib.parse.urlencode({"q": keyword, "page": 1})
    started_at = now_iso()
    started_monotonic = time.monotonic()
    lease: Optional[ProfileLease] = None
    api: Optional[UndetectableApi] = None
    html = ""
    page_status = "failed"
    listings: List[Dict[str, Any]] = []
    counts: Dict[str, Any] = {
        "organic_cards_found": 0,
        "unique_listings": 0,
        "etsy_records_complete": 0,
        "heyetsy_records_complete": 0,
        "heyetsy_records_partial": 0,
        "heyetsy_records_missing": 0,
        "duplicate_organic_ids": 0,
    }
    warnings: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    mode = "offline_html" if args.html_file else "live"

    try:
        if args.html_file:
            html_path = Path(args.html_file).expanduser().resolve()
            html = html_path.read_text(encoding="utf-8")
            page_status = page_state(html)
            if page_status == "loading" and ORGANIC_MARKER in html:
                page_status = "results"
        else:
            api = UndetectableApi(args.api_url)
            api.status()
            lease = acquire_profile(api, args.profile)
            print(f"Using {lease.profile_name}", file=sys.stderr)
            html, page_status, live_warnings = load_live_page(
                api,
                lease,
                search_url,
                args.page_timeout,
                args.metrics_timeout,
                args.verbose,
            )
            warnings.extend(live_warnings)

        if page_status == "results":
            listings, counts, parse_warnings = parse_search_page(html)
            warnings.extend(parse_warnings)
        elif page_status == "blocked":
            errors.append({"code": "etsy_blocked", "message": "Etsy returned a verification or access-denied page."})
        elif page_status == "empty":
            counts["organic_cards_found"] = 0
        else:
            errors.append({"code": "etsy_results_not_found", "message": "No organic Etsy results were found before timeout."})
    except (ApiError, OSError, UnicodeError, ValueError) as exc:
        page_status = "failed"
        errors.append({"code": "crawler_error", "message": str(exc)})
    finally:
        if lease is not None and api is not None:
            if lease.started_by_script:
                try:
                    api.stop_profile(lease.profile_id)
                except ApiError as exc:
                    warnings.append({"code": "profile_stop_failed", "message": str(exc)})
            release_lock(lease.lock_path)

    status = derive_status(page_status, counts)
    payload = build_output(
        keyword=keyword,
        search_url=search_url,
        started_at=started_at,
        started_monotonic=started_monotonic,
        status=status,
        listings=listings,
        counts=counts,
        warnings=warnings,
        errors=errors,
        profile_name=lease.profile_name if lease else None,
        profile_id=lease.profile_id if lease else None,
        mode=mode,
    )
    try:
        write_json_atomic(output_path, payload)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: could not write {output_path}: {exc}", file=sys.stderr)
        return 1

    print(
        f"{status}: wrote {counts.get('unique_listings', 0)} listings to {output_path.resolve()}",
        file=sys.stderr,
    )
    if status in {"success", "empty"}:
        return 0
    if status == "partial":
        return 2
    if status == "blocked":
        return 4
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
