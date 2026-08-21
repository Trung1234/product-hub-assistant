#!/usr/bin/env python3
"""Collect filtered Amazon search cards through the Undetectable Local API.

The script uses only Python's standard library. It can also parse saved Amazon
HTML with --html-file for deterministic fixture tests. It reads the extension
data already present in the page, but never clicks extension controls.
"""

from __future__ import annotations

import argparse
import datetime as dt
import difflib
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
from typing import Any, Callable, Dict, Iterator, List, Optional, Sequence, Tuple


SCHEMA_VERSION = "1.1"
PROFILE_NAMES = tuple(f"etsy-crawler-{index}" for index in range(1, 6))
DEFAULT_API_URL = os.environ.get("UNDETECTABLE_API_URL", "http://127.0.0.1:25325")
AMAZON_BASE_URL = "https://www.amazon.com"
RESULT_MARKER = 'data-component-type="s-search-result"'
CARD_MARKER = 'data-cy="asin-faceout-container"'
ASIN_PATTERN = re.compile(r"^[A-Z0-9]{10}$")
BLOCK_PATTERNS = (
    "/errors/validatecaptcha",
    'id="captchacharacters"',
    "amazon captcha",
    "robot check",
    "automated access to amazon data",
)
EMPTY_PATTERNS = (
    "did not match any products",
    "no results for",
    "we couldn't find any results",
    "we couldn’t find any results",
)
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
CURRENCY_BY_SYMBOL = {
    "US$": "USD",
    "CA$": "CAD",
    "A$": "AUD",
    "₫": "VND",
    "$": "USD",
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
    return re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()[:60] or "amazon-search"


def coerce_int(value: str) -> Optional[int]:
    match = re.search(r"[+-]?\d[\d,]*", normalize_text(value))
    if not match:
        return None
    try:
        return int(match.group(0).replace(",", ""))
    except ValueError:
        return None


def coerce_scaled_number(value: str) -> Optional[Any]:
    cleaned = normalize_text(value).replace(",", "")
    match = re.search(r"([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([KMB])?", cleaned, re.IGNORECASE)
    if not match:
        return None
    multipliers = {"": Decimal(1), "K": Decimal(1000), "M": Decimal(1_000_000), "B": Decimal(1_000_000_000)}
    try:
        number = Decimal(match.group(1)) * multipliers[(match.group(2) or "").upper()]
    except (InvalidOperation, KeyError):
        return None
    return int(number) if number == number.to_integral_value() else float(number)


def parse_currency(raw: str) -> Tuple[Optional[str], Optional[str]]:
    normalized = normalize_text(raw)
    code_match = re.search(r"\b([A-Z]{3})\b", normalized)
    if code_match:
        return code_match.group(1), code_match.group(1)
    for symbol in sorted(CURRENCY_BY_SYMBOL, key=len, reverse=True):
        if symbol in normalized:
            return CURRENCY_BY_SYMBOL[symbol], symbol
    return None, None


def parse_money_value(raw: str) -> Optional[Any]:
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
        number = Decimal(numeric)
    except InvalidOperation:
        return None
    return int(number) if number == number.to_integral_value() else float(number)


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
        stack: List[Element] = [self] if include_self else [
            child for child in reversed(self.children) if isinstance(child, Element)
        ]
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


def parse_document(html_text: str) -> Element:
    parser = DocumentParser()
    parser.feed(html_text)
    parser.close()
    return parser.root


def has_class(node: Element, class_name: str) -> bool:
    return class_name in node.classes


def first_text(node: Optional[Element], predicate: Callable[[Element], bool]) -> Optional[str]:
    candidate = node.find(predicate) if node is not None else None
    return candidate.text() if candidate is not None and candidate.text() else None


def direct_text(node: Element) -> str:
    return normalize_text(" ".join(child for child in node.children if isinstance(child, str)))


def match_key(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", normalize_text(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "", ascii_value.casefold())


def parse_assignment(value: str, option_name: str) -> Tuple[str, str]:
    if "=" not in value:
        raise ValueError(f"{option_name} must use GROUP=OPTION syntax: {value!r}")
    key, assigned = value.split("=", 1)
    key = normalize_text(key)
    assigned = normalize_text(assigned)
    if not key or not assigned:
        raise ValueError(f"{option_name} requires a non-empty key and value: {value!r}")
    return key, assigned


def filter_option_label(anchor: Element) -> str:
    label = anchor.text() or normalize_text(anchor.get("title"))
    if label:
        return label
    aria = normalize_text(anchor.get("aria-label"))
    match = re.match(r"(?:Apply|Remove)\s+(.+?)\s+filter(?:\s+to narrow results)?$", aria, re.IGNORECASE)
    return normalize_text(match.group(1) if match else aria)


def extract_rh_value(target_url: str, group_key: str) -> Optional[str]:
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(target_url).query)
    for raw_rh in query.get("rh", []):
        for token in raw_rh.split(","):
            key, separator, value = token.partition(":")
            if separator and key == group_key:
                return value
    return None


def filter_option_value(anchor: Element, group_key: str, target_url: str) -> Optional[str]:
    if not group_key:
        return None
    cursor = anchor.parent
    prefix = group_key + "/"
    while cursor is not None:
        for attribute in ("id", "data-csa-c-content-id"):
            candidate = cursor.get(attribute) or ""
            if candidate.startswith(prefix):
                return candidate[len(prefix):]
        cursor = cursor.parent
    combined = extract_rh_value(target_url, group_key)
    if combined and "|" not in combined:
        return combined
    return None


def parse_filter_catalog(html_text: str) -> Dict[str, Any]:
    document = parse_document(html_text)
    rail = document.find(lambda node: node.get("id") == "s-refinements")
    groups: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []
    if rail is None:
        warnings.append({"code": "filter_rail_missing"})
    else:
        seen_groups = set()
        for options_root in rail.find_all(lambda node: node.tag == "ul" and (node.get("id") or "").startswith("filter-")):
            group_key = (options_root.get("id") or "")[len("filter-"):]
            if group_key in seen_groups:
                continue
            seen_groups.add(group_key)
            title_id = options_root.get("aria-labelledby") or (group_key + "-title" if group_key else "-title")
            title = rail.find(lambda node: node.get("id") == title_id)
            label = title.text() if title is not None else ("Popular Shopping Ideas" if not group_key else group_key)
            options: List[Dict[str, Any]] = []
            seen_options = set()
            for anchor in options_root.find_all(lambda node: node.tag == "a" and bool(node.get("href"))):
                option_label = filter_option_label(anchor)
                target_url = urllib.parse.urljoin(AMAZON_BASE_URL, anchor.get("href") or "")
                identity = (match_key(option_label), target_url)
                if not option_label or identity in seen_options:
                    continue
                seen_options.add(identity)
                option_value = filter_option_value(anchor, group_key, target_url)
                options.append(
                    {
                        "label": option_label,
                        "value": option_value,
                        "target_url": target_url,
                        "selected": (anchor.get("aria-current") or "").lower() == "true",
                    }
                )
            if options:
                multi = options_root.find(lambda node: has_class(node, "s-navigation-checkbox")) is not None
                groups.append(
                    {
                        "label": label,
                        "key": group_key,
                        "type": "query_rewrite" if not group_key else ("multi" if multi else "single"),
                        "options": options,
                    }
                )

    sort_options: List[Dict[str, Any]] = []
    sort_select = document.find(lambda node: node.get("id") == "s-result-sort-select")
    if sort_select is not None:
        for option in sort_select.find_all(lambda node: node.tag == "option"):
            value = option.get("value") or option.get("data-value") or option.get("data-url")
            label = option.text()
            if label and value:
                sort_options.append(
                    {
                        "label": label,
                        "value": value,
                        "selected": option.has_attr("selected"),
                    }
                )

    custom_price_supported = False
    if rail is not None:
        custom_price_supported = rail.find(
            lambda node: node.tag == "input" and node.get("name") in {"low-price", "high-price"}
        ) is not None
    return {
        "groups": groups,
        "sort": sort_options,
        "custom_price_supported": custom_price_supported,
        "warnings": warnings,
    }


def print_filter_catalog(catalog: Dict[str, Any]) -> None:
    for group in catalog.get("groups", []):
        print(f"{group.get('label')} [{group.get('key') or 'query-rewrite'}; {group.get('type')}]")
        for option in group.get("options", []):
            value = option.get("value")
            suffix = f" ({value})" if value else ""
            print(f"  - {option.get('label')}{suffix}")
        print()
    if catalog.get("sort"):
        print("Sort by [s; single]")
        for option in catalog["sort"]:
            print(f"  - {option.get('label')} ({option.get('value')})")
        print()
    print("Custom price: " + ("available" if catalog.get("custom_price_supported") else "not exposed on this page"))


def find_filter_group(catalog: Dict[str, Any], requested: str) -> Dict[str, Any]:
    wanted = match_key(requested)
    groups = catalog.get("groups", [])
    exact = [group for group in groups if wanted in {match_key(str(group.get("label", ""))), match_key(str(group.get("key", "")))}]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        labels = ", ".join(str(group.get("label")) for group in exact)
        raise ValueError(f"Ambiguous filter group {requested!r}: {labels}")
    labels = [str(group.get("label")) for group in groups]
    suggestions = difflib.get_close_matches(requested, labels, n=5, cutoff=0.45)
    suffix = f" Close matches: {', '.join(suggestions)}." if suggestions else ""
    raise ValueError(f"Unknown Amazon filter group {requested!r}.{suffix}")


def find_filter_option(group: Dict[str, Any], requested: str) -> Dict[str, Any]:
    wanted = match_key(requested)
    options = group.get("options", [])
    exact = [
        option for option in options
        if wanted in {match_key(str(option.get("label", ""))), match_key(str(option.get("value", "")))}
    ]
    if len(exact) == 1:
        return exact[0]
    if len(exact) > 1:
        raise ValueError(f"Ambiguous option {requested!r} in filter {group.get('label')!r}")
    labels = [str(option.get("label")) for option in options]
    suggestions = difflib.get_close_matches(requested, labels, n=5, cutoff=0.45)
    suffix = f" Close matches: {', '.join(suggestions)}." if suggestions else ""
    raise ValueError(f"Unknown option {requested!r} for Amazon filter {group.get('label')!r}.{suffix}")


def resolve_filter(catalog: Dict[str, Any], group_name: str, option_name: str) -> Dict[str, Any]:
    group = find_filter_group(catalog, group_name)
    option = find_filter_option(group, option_name)
    return {
        "group": group.get("label"),
        "key": group.get("key"),
        "type": group.get("type"),
        "option": option.get("label"),
        "value": option.get("value"),
        "target_url": option.get("target_url"),
    }


def resolve_category(catalog: Dict[str, Any], category_name: str) -> Dict[str, Any]:
    candidates = [
        group for group in catalog.get("groups", [])
        if match_key(str(group.get("label", ""))) in {"department", "departments", "category", "categories"}
        or str(group.get("key", "")) in {"n", "node"}
    ]
    for group in candidates:
        try:
            option = find_filter_option(group, category_name)
            return {
                "group": group.get("label"),
                "key": group.get("key"),
                "type": group.get("type"),
                "option": option.get("label"),
                "value": option.get("value"),
                "target_url": option.get("target_url"),
            }
        except ValueError:
            continue
    available = ", ".join(str(group.get("label")) for group in candidates) or "none"
    raise ValueError(f"Category {category_name!r} is not exposed by this Amazon page. Category groups: {available}.")


def resolve_sort(catalog: Dict[str, Any], requested: str) -> Dict[str, Any]:
    wanted = match_key(requested)
    options = catalog.get("sort", [])
    exact = [
        option for option in options
        if wanted in {match_key(str(option.get("label", ""))), match_key(str(option.get("value", "")))}
    ]
    if len(exact) == 1:
        return exact[0]
    labels = [str(option.get("label")) for option in options]
    suggestions = difflib.get_close_matches(requested, labels, n=5, cutoff=0.45)
    suffix = f" Close matches: {', '.join(suggestions)}." if suggestions else ""
    raise ValueError(f"Unknown Amazon sort {requested!r}.{suffix}")


def infer_asin(card: Element) -> Optional[str]:
    candidate = normalize_text(card.get("data-asin") or "").upper()
    if ASIN_PATTERN.fullmatch(candidate):
        return candidate
    h10 = card.find(lambda node: bool(re.match(r"^bsr-([A-Z0-9]{10})-", node.get("id") or "")), include_self=True)
    if h10:
        match = re.match(r"^bsr-([A-Z0-9]{10})-", h10.get("id") or "")
        if match:
            return match.group(1)
    for node in card.iter_elements(include_self=True):
        for name in ("data-csa-c-item-id", "data-csa-c-asin", "data-csa-c-item-id"):
            value = node.get(name) or ""
            match = re.search(r"(?:asin\.|^)([A-Z0-9]{10})(?:$|\b)", value)
            if match:
                return match.group(1)
        href = node.get("href") or ""
        match = re.search(r"/dp/([A-Z0-9]{10})(?:[/?]|$)", urllib.parse.unquote(href))
        if match:
            return match.group(1)
    return None


def money_payload(raw: Optional[str]) -> Optional[Dict[str, Any]]:
    if not raw:
        return None
    currency, symbol = parse_currency(raw)
    return {"raw": normalize_text(raw), "value": parse_money_value(raw), "currency": currency, "symbol": symbol}


def parse_price(card: Element) -> Dict[str, Any]:
    price_box = card.find(lambda node: node.get("data-cy") == "price-recipe")
    if price_box is None:
        return {"current": None, "list": None, "discount_percent": None}
    price_nodes = price_box.find_all(lambda node: has_class(node, "a-price"))
    current_node = next(
        (node for node in price_nodes if node.get("data-a-strike") != "true" and not has_class(node, "a-text-price")),
        None,
    )
    list_node = next((node for node in price_nodes if node.get("data-a-strike") == "true"), None)

    def raw_price(node: Optional[Element]) -> Optional[str]:
        if node is None:
            return None
        offscreen = node.find(lambda child: has_class(child, "a-offscreen"))
        return offscreen.text() if offscreen is not None else node.text()

    current = money_payload(raw_price(current_node))
    list_price = money_payload(raw_price(list_node))
    discount = None
    if current and list_price and current.get("value") is not None and list_price.get("value"):
        discount = round((1 - float(current["value"]) / float(list_price["value"])) * 100, 2)
    return {"current": current, "list": list_price, "discount_percent": discount}


def parse_rating(card: Element) -> Tuple[Optional[Dict[str, Any]], Optional[int]]:
    rating_node = card.find(lambda node: node.get("data-cy") == "reviews-ratings-slot")
    raw_rating = None
    if rating_node is not None:
        alt = rating_node.find(lambda node: has_class(node, "a-icon-alt"))
        raw_rating = alt.text() if alt is not None else rating_node.get("aria-label") or rating_node.text()
    rating_value = None
    if raw_rating:
        match = re.search(r"(\d+(?:\.\d+)?)\s+out of\s+5", raw_rating, re.IGNORECASE)
        rating_value = float(match.group(1)) if match else None

    review_box = card.find(lambda node: node.get("data-csa-c-content-id") == "alf-customer-ratings-count-component")
    review_count = None
    if review_box is not None:
        labelled = review_box.find(lambda node: bool(re.search(r"[\d,]+\s+(?:ratings?|reviews?)", node.get("aria-label") or "", re.I)))
        if labelled is not None:
            review_count = coerce_int(labelled.get("aria-label") or "")
        if review_count is None:
            review_count = coerce_int(review_box.text())
    return (
        {"raw": normalize_text(raw_rating), "value": rating_value, "maximum": 5} if raw_rating else None,
        review_count,
    )


def parse_bought_past_month(card: Element) -> Optional[Dict[str, Any]]:
    reviews = card.find(lambda node: node.get("data-cy") == "reviews-block")
    text = reviews.text() if reviews is not None else card.text()
    match = re.search(r"([\d,.]+)\s*([KMB])?\s*(\+)?\s+bought in past month", text, re.IGNORECASE)
    if not match:
        return None
    raw = normalize_text(match.group(0))
    value = coerce_scaled_number(match.group(1) + (match.group(2) or ""))
    return {
        "raw": raw,
        "lower_bound": value,
        "has_plus": bool(match.group(3)),
        "window": "past_month",
        "rounded": True,
    }


def parse_badges(card: Element) -> List[str]:
    badges: List[str] = []
    for node in card.iter_elements():
        candidates = [node.get("aria-label") or ""]
        text = node.text()
        if len(text) <= 80:
            candidates.append(text)
        for candidate in candidates:
            lowered = normalize_text(candidate).lower()
            label = None
            if "amazon's choice" in lowered or "amazons choice" in lowered:
                label = "Amazon's Choice"
            elif "best seller" in lowered:
                label = "Best Seller"
            elif "limited time deal" in lowered:
                label = "Limited time deal"
            elif "overall pick" in lowered:
                label = "Overall Pick"
            if label and label not in badges:
                badges.append(label)
    return badges


def parse_coupon(card: Element) -> Optional[Dict[str, Any]]:
    coupon = card.find(lambda node: node.get("data-component-type") == "s-coupon-component")
    if coupon is None:
        return None
    values: List[str] = []
    for node in coupon.find_all(lambda item: has_class(item, "s-highlighted-text-padding")):
        value = node.text()
        if value and value not in values:
            values.append(value)
    return {"raw": values or [coupon.text()]}


def parse_delivery(card: Element) -> Optional[Dict[str, Any]]:
    delivery = card.find(lambda node: node.get("data-cy") == "delivery-block")
    ship_to_node = card.find(
        lambda node: node.tag in {"span", "div"}
        and len(node.text()) < 100
        and node.text().lower().startswith("ships to ")
    )
    if delivery is None and ship_to_node is None:
        return None
    raw = delivery.text() if delivery is not None else None
    cost = None
    free = False
    delivery_date = None
    if raw:
        free = "free delivery" in raw.lower()
        money_match = re.search(r"((?:[A-Z]{3}|US\$|CA\$|A\$|[$£€¥₫])\s*[\d,.]+)\s+delivery", raw, re.I)
        cost = money_payload(money_match.group(1)) if money_match else None
        bold = delivery.find(lambda node: has_class(node, "a-text-bold"))
        delivery_date = bold.text() if bold is not None else None
    return {
        "raw": raw,
        "cost": cost,
        "free": free,
        "date": delivery_date,
        "ship_to": ship_to_node.text() if ship_to_node is not None else None,
    }


def parse_image(card: Element) -> Optional[Dict[str, Any]]:
    image = card.find(lambda node: node.tag == "img" and has_class(node, "s-image"))
    if image is None:
        return None
    return {
        "url": image.get("src"),
        "srcset": normalize_text(image.get("srcset")),
        "alt": normalize_text(image.get("alt")),
    }


def parse_h10_metric(root: Element, test_id: str, label: str) -> Optional[Dict[str, Any]]:
    node = root.find(lambda item: item.get("data-testid") == test_id)
    if node is None:
        return None
    text = normalize_text(node.text())
    value_raw = re.sub(r"^" + re.escape(label) + r"\s*", "", text, flags=re.I).strip()
    return {"raw": value_raw, "value": coerce_int(value_raw)}


def parse_h10(card: Element, asin: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    warnings: List[Dict[str, Any]] = []
    prefix = f"bsr-{asin}-"
    root = card.find(lambda node: (node.get("id") or "").startswith(prefix), include_self=True)
    if root is None:
        return {"available": False, "status": "missing"}, [{"code": "h10_overlay_missing"}]

    product_type_node = root.find(
        lambda node: node.tag in {"div", "span"} and direct_text(node) in {"SP", "OR", "SB", "SD"}
    )
    bsr: List[Dict[str, Any]] = []
    for anchor in root.find_all(lambda node: node.tag == "a" and "/gp/bestsellers/" in (node.get("href") or "")):
        parent = anchor.parent
        rank_node = parent.find(lambda node: bool(re.fullmatch(r"#[\d,]+", node.text()))) if parent else None
        raw_rank = rank_node.text() if rank_node is not None else None
        bsr.append(
            {
                "category": anchor.text(),
                "rank": coerce_int(raw_rank or ""),
                "raw_rank": raw_rank,
                "url": urllib.parse.urljoin(AMAZON_BASE_URL, anchor.get("href") or ""),
            }
        )

    variations = parse_h10_metric(root, "bsr-variations", "Variations")
    sellers = parse_h10_metric(root, "bsr-sellers", "Sellers")
    fulfillment_node = root.find(lambda node: node.get("data-testid") == "bsr-fulfillment")
    fulfillment = None
    if fulfillment_node is not None:
        fulfillment = re.sub(r"^Fulfillment\s*", "", fulfillment_node.text(), flags=re.I).strip() or None

    missing: List[str] = []
    if not bsr:
        missing.append("bsr")
    if variations is None:
        missing.append("variations")
    if sellers is None:
        missing.append("sellers")
    if fulfillment is None:
        missing.append("fulfillment")
    if missing:
        warnings.append({"code": "h10_overlay_partial", "missing": missing})
    return {
        "available": True,
        "status": "partial" if missing else "complete",
        "asin": asin,
        "product_type": direct_text(product_type_node) if product_type_node is not None else None,
        "bsr": bsr,
        "variations": variations,
        "sellers": sellers,
        "fulfillment": fulfillment,
    }, warnings


def parse_amazon_card(card: Element, page_position: int) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
    warnings: List[Dict[str, Any]] = []
    asin = infer_asin(card)
    if not asin:
        return None, [{"code": "asin_missing", "page_position": page_position}]

    title_box = card.find(lambda node: node.get("data-cy") == "title-recipe")
    title_node = title_box.find(lambda node: node.tag == "h2") if title_box is not None else None
    title = title_node.text() if title_node is not None else None
    title_link = title_box.find(lambda node: node.tag == "a" and bool(node.get("href"))) if title_box is not None else None
    source_href = urllib.parse.urljoin(AMAZON_BASE_URL, title_link.get("href") or "") if title_link else None
    image = parse_image(card)
    rating, review_count = parse_rating(card)
    price = parse_price(card)
    bought = parse_bought_past_month(card)
    delivery = parse_delivery(card)
    title_text = title_box.text().lower() if title_box is not None else ""
    title_aria = (title_node.get("aria-label") or "").lower() if title_node is not None else ""
    is_sponsored = has_class(card, "AdHolder") or "sponsored" in title_text or title_aria.startswith("sponsored ad")
    prime = card.find(lambda node: has_class(node, "a-icon-prime")) is not None or card.find(
        lambda node: node.tag in {"span", "i"} and direct_text(node).lower() in {"prime", "exclusive prime"}
    ) is not None
    climate_pledge = card.find(
        lambda node: "climate pledge friendly" in normalize_text(node.get("alt") or node.get("aria-label") or "").lower()
    ) is not None
    add_to_cart = card.find(lambda node: node.get("data-cy") == "add-to-cart") is not None

    if not title:
        warnings.append({"code": "title_missing"})
    if image is None:
        warnings.append({"code": "image_missing"})
    if rating is None:
        warnings.append({"code": "rating_missing"})
    if price.get("current") is None:
        warnings.append({"code": "current_price_missing"})

    h10, h10_warnings = parse_h10(card, asin)
    warnings.extend(h10_warnings)
    product = {
        "asin": asin,
        "page_position": page_position,
        "unique_rank": None,
        "duplicate_positions": [],
        "is_sponsored": is_sponsored,
        "amazon": {
            "title": title,
            "canonical_url": f"{AMAZON_BASE_URL}/dp/{asin}",
            "source_href": source_href,
            "image": image,
            "rating": rating,
            "review_count": review_count,
            "bought_past_month": bought,
            "price": price,
            "badges": parse_badges(card),
            "coupon": parse_coupon(card),
            "prime": prime,
            "climate_pledge_friendly": climate_pledge,
            "delivery": delivery,
            "add_to_cart_available": add_to_cart,
        },
        "h10_overlay": h10,
        "parse_warnings": warnings,
    }
    return product, warnings


def find_product_cards(document: Element) -> List[Element]:
    result_root = document.find(lambda node: node.get("data-component-type") == "s-search-results")
    scope = result_root or document
    cards = scope.find_all(
        lambda node: node.get("data-component-type") == "s-search-result" and bool(node.get("data-asin"))
    )
    if cards:
        return cards
    return document.find_all(lambda node: node.get("data-cy") == "asin-faceout-container")


def parse_result_summary(document: Element) -> Optional[str]:
    info = document.find(lambda node: node.get("data-component-type") == "s-result-info-bar")
    if info is None:
        return None
    candidate = info.find(lambda node: node.tag == "h2")
    return candidate.text() if candidate is not None else info.text()


def parse_next_page_url(document: Element) -> Optional[str]:
    link = document.find(
        lambda node: node.tag == "a"
        and has_class(node, "s-pagination-next")
        and (node.get("aria-disabled") or "").lower() != "true"
        and bool(node.get("href"))
    )
    return urllib.parse.urljoin(AMAZON_BASE_URL, link.get("href") or "") if link is not None else None


def parse_search_page(html_text: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]], Dict[str, Any]]:
    document = parse_document(html_text)
    cards = find_product_cards(document)
    products: List[Dict[str, Any]] = []
    warnings: List[Dict[str, Any]] = []
    by_asin: Dict[str, Dict[str, Any]] = {}
    sponsored_cards = 0

    for position, card in enumerate(cards, start=1):
        product, card_warnings = parse_amazon_card(card, position)
        if product is None:
            warnings.extend(card_warnings)
            continue
        if product["is_sponsored"]:
            sponsored_cards += 1
        asin = product["asin"]
        existing = by_asin.get(asin)
        if existing is not None:
            existing["duplicate_positions"].append(position)
            warnings.append({"code": "duplicate_asin", "asin": asin, "positions": [existing["page_position"], position]})
            continue
        product["unique_rank"] = len(products) + 1
        by_asin[asin] = product
        products.append(product)

    native_complete = sum(
        1 for product in products
        if product.get("asin") and product.get("amazon", {}).get("title") and product.get("amazon", {}).get("canonical_url")
    )
    h10_complete = sum(product.get("h10_overlay", {}).get("status") == "complete" for product in products)
    h10_partial = sum(product.get("h10_overlay", {}).get("status") == "partial" for product in products)
    h10_missing = sum(product.get("h10_overlay", {}).get("status") == "missing" for product in products)
    counts = {
        "search_cards_found": len(cards),
        "unique_asins": len(products),
        "organic_cards": len(cards) - sponsored_cards,
        "sponsored_cards": sponsored_cards,
        "duplicate_asins": sum(1 for product in products if product.get("duplicate_positions")),
        "native_records_complete": native_complete,
        "h10_records_complete": h10_complete,
        "h10_records_partial": h10_partial,
        "h10_records_missing": h10_missing,
        "prices_available": sum(product.get("amazon", {}).get("price", {}).get("current") is not None for product in products),
        "bought_past_month_available": sum(product.get("amazon", {}).get("bought_past_month") is not None for product in products),
        "delivery_available": sum(product.get("amazon", {}).get("delivery") is not None for product in products),
    }
    collection = {
        "result_summary": parse_result_summary(document),
        "next_page_url": parse_next_page_url(document),
    }
    return products, counts, warnings, collection


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


def build_search_url(keyword: str) -> str:
    return AMAZON_BASE_URL + "/s?" + urllib.parse.urlencode({"k": keyword})


def replace_query_params(url: str, updates: Dict[str, Optional[str]]) -> str:
    parsed = urllib.parse.urlsplit(url)
    pairs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    updated_keys = set(updates)
    pairs = [(key, value) for key, value in pairs if key not in updated_keys and key != "page"]
    pairs.extend((key, value) for key, value in updates.items() if value is not None)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urllib.parse.urlencode(pairs, doseq=True), ""))


def merge_raw_filter(url: str, key: str, value: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    tokens: List[str] = []
    for raw in query.get("rh", []):
        tokens.extend(token for token in raw.split(",") if token)
    merged = False
    for index, token in enumerate(tokens):
        token_key, separator, token_value = token.partition(":")
        if separator and token_key == key:
            values = token_value.split("|")
            if value not in values:
                values.append(value)
            tokens[index] = f"{key}:{'|'.join(values)}"
            merged = True
            break
    if not merged:
        tokens.append(f"{key}:{value}")
    return replace_query_params(url, {"rh": ",".join(tokens)})


def rh_contains(url: Optional[str], key: str, value: str) -> bool:
    if not url:
        return False
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)
    for raw in query.get("rh", []):
        for token in raw.split(","):
            token_key, separator, token_value = token.partition(":")
            if separator and token_key == key and value in token_value.split("|"):
                return True
    return False


def page_state(html_text: str) -> str:
    lowered = html_text.lower()
    # Result DOM is stronger evidence than challenge words in dormant markup.
    if RESULT_MARKER in html_text and re.search(r'data-asin="[A-Z0-9]{10}"', html_text):
        return "results"
    if CARD_MARKER in html_text and re.search(r'id="bsr-[A-Z0-9]{10}-', html_text):
        return "results"
    if any(pattern in lowered for pattern in BLOCK_PATTERNS):
        return "blocked"
    if any(pattern in lowered for pattern in EMPTY_PATTERNS):
        return "empty"
    return "loading"


def page_counts(html_text: str) -> Tuple[int, int, int]:
    card_asins = re.findall(
        r'<[^>]*data-component-type="s-search-result"[^>]*data-asin="([A-Z0-9]{10})"[^>]*>',
        html_text,
        re.I,
    )
    if not card_asins:
        card_asins = re.findall(
            r'<[^>]*data-asin="([A-Z0-9]{10})"[^>]*data-component-type="s-search-result"[^>]*>',
            html_text,
            re.I,
        )
    h10_asins = re.findall(r'id="bsr-([A-Z0-9]{10})-[^"]*"', html_text, re.I)
    return len(card_asins), len(set(card_asins)), len(set(h10_asins))


def extract_current_url(html_text: str) -> Optional[str]:
    match = re.search(r'data-crawler-current-url="([^"]+)"', html_text)
    if not match:
        return None
    import html as html_module

    return html_module.unescape(match.group(1))


def load_discovery_page(
    api: UndetectableApi,
    lease: ProfileLease,
    url: str,
    page_timeout: float,
    verbose: bool,
) -> Tuple[str, str]:
    api.open_url(lease.profile_id, url)
    deadline = time.monotonic() + page_timeout
    html_text = ""
    state = "loading"
    while time.monotonic() < deadline:
        time.sleep(1.5)
        html_text = api.get_page(lease.profile_id)
        state = page_state(html_text)
        if verbose:
            counts = page_counts(html_text)
            print(f"Discovering Amazon filters: state={state}, cards={counts[0]}", file=sys.stderr)
        if state in {"results", "empty", "blocked"}:
            break
    if state != "results":
        return html_text, state if state != "loading" else "failed"
    api.evaluate(lease.profile_id, "document.documentElement.setAttribute('data-crawler-current-url', window.location.href)")
    return api.get_page(lease.profile_id), "results"


def apply_live_filters(
    api: UndetectableApi,
    lease: ProfileLease,
    base_url: str,
    args: argparse.Namespace,
) -> Tuple[str, Dict[str, Any], Dict[str, Any], bool]:
    html_text, state = load_discovery_page(api, lease, base_url, args.page_timeout, args.verbose)
    if state != "results":
        raise ApiError(f"Could not discover Amazon filters: page state is {state}")
    catalog = parse_filter_catalog(html_text)
    if args.list_filters:
        print_filter_catalog(catalog)
        return base_url, {"requested": [], "resolved": [], "verification": []}, catalog, True

    requested: List[Dict[str, Any]] = []
    resolved: List[Dict[str, Any]] = []
    current_url = extract_current_url(html_text) or base_url
    selections: List[Tuple[str, str, str]] = []
    if args.category:
        selections.append(("category", "Category", args.category))
    for assignment in args.filters:
        group_name, option_name = parse_assignment(assignment, "--filter")
        selections.append(("filter", group_name, option_name))

    for selection_type, group_name, option_name in selections:
        catalog = parse_filter_catalog(html_text)
        choice = resolve_category(catalog, option_name) if selection_type == "category" else resolve_filter(
            catalog, group_name, option_name
        )
        requested.append({"type": selection_type, "group": group_name, "option": option_name})
        target_url = str(choice.get("target_url") or "")
        if not target_url:
            raise ValueError(f"Amazon filter {choice.get('group')}={choice.get('option')} has no target URL")
        html_text, state = load_discovery_page(api, lease, target_url, args.page_timeout, args.verbose)
        if state != "results":
            raise ApiError(f"Amazon filter {choice.get('group')}={choice.get('option')} returned {state}")
        current_url = extract_current_url(html_text) or target_url
        resolved.append({**choice, "selection_type": selection_type, "applied_url": current_url})

    for assignment in args.raw_filters:
        key, value = parse_assignment(assignment, "--raw-filter")
        requested.append({"type": "raw_filter", "group": key, "option": value})
        current_url = merge_raw_filter(current_url, key, value)
        resolved.append(
            {
                "group": key,
                "key": key,
                "type": "raw",
                "option": value,
                "value": value,
                "target_url": current_url,
                "applied_url": current_url,
            }
        )

    catalog = parse_filter_catalog(html_text)
    if args.sort:
        sort_choice = resolve_sort(catalog, args.sort)
        requested.append({"type": "sort", "group": "Sort by", "option": args.sort})
        current_url = replace_query_params(current_url, {"s": str(sort_choice.get("value"))})
        resolved.append(
            {
                "group": "Sort by",
                "key": "s",
                "type": "single",
                "option": sort_choice.get("label"),
                "value": sort_choice.get("value"),
                "target_url": current_url,
                "applied_url": current_url,
            }
        )
    price_updates: Dict[str, Optional[str]] = {}
    if args.min_price is not None:
        requested.append({"type": "price", "group": "Price", "option": "minimum", "value": args.min_price})
        price_updates["low-price"] = args.min_price
        resolved.append({"group": "Price", "key": "low-price", "type": "range", "option": "minimum", "value": args.min_price})
    if args.max_price is not None:
        requested.append({"type": "price", "group": "Price", "option": "maximum", "value": args.max_price})
        price_updates["high-price"] = args.max_price
        resolved.append({"group": "Price", "key": "high-price", "type": "range", "option": "maximum", "value": args.max_price})
    if price_updates:
        current_url = replace_query_params(current_url, price_updates)

    return current_url, {"requested": requested, "resolved": resolved, "verification": []}, catalog, False


def verify_applied_filters(final_url: Optional[str], metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
    if not final_url:
        return [{"code": "final_url_unavailable"}]
    query = urllib.parse.parse_qs(urllib.parse.urlsplit(final_url).query)
    problems: List[Dict[str, Any]] = []
    for item in metadata.get("resolved", []):
        key = str(item.get("key") or "")
        value = str(item.get("value") or "")
        item_type = item.get("type")
        if not key or not value or item_type == "query_rewrite":
            continue
        if item.get("selection_type") == "category" and key in query:
            applied = value in query.get(key, [])
        elif key == "s":
            applied = value in query.get("s", [])
        elif key in {"low-price", "high-price"}:
            applied = value in query.get(key, [])
        else:
            applied = rh_contains(final_url, key, value)
        if not applied:
            problems.append(
                {
                    "code": "filter_not_applied",
                    "group": item.get("group"),
                    "key": key,
                    "value": value,
                }
            )
    return problems


def load_live_page(
    api: UndetectableApi,
    lease: ProfileLease,
    search_url: str,
    page_timeout: float,
    extension_timeout: float,
    verbose: bool,
) -> Tuple[str, str, List[Dict[str, Any]]]:
    warnings: List[Dict[str, Any]] = []
    api.open_url(lease.profile_id, search_url)
    deadline = time.monotonic() + page_timeout
    html_text = ""
    state = "loading"
    while time.monotonic() < deadline:
        time.sleep(1.5)
        html_text = api.get_page(lease.profile_id)
        state = page_state(html_text)
        if verbose:
            counts = page_counts(html_text)
            print(f"Waiting for Amazon: state={state}, cards={counts[0]}, unique_asins={counts[1]}", file=sys.stderr)
        if state in {"results", "empty", "blocked"}:
            break
    if state != "results":
        return html_text, state if state != "loading" else "failed", warnings

    for step in range(1, 21):
        fraction = step / 20
        api.evaluate(
            lease.profile_id,
            f"window.scrollTo({{top: Math.max(0, (document.body.scrollHeight - window.innerHeight) * {fraction:.2f}), behavior: 'auto'}})",
        )
        time.sleep(0.5)

    deadline = time.monotonic() + extension_timeout
    last_counts: Optional[Tuple[int, int, int]] = None
    stable_checks = 0
    while time.monotonic() < deadline:
        time.sleep(2)
        html_text = api.get_page(lease.profile_id)
        counts = page_counts(html_text)
        if verbose:
            print(f"Waiting for overlays: cards={counts[0]}, unique_asins={counts[1]}, h10={counts[2]}", file=sys.stderr)
        stable_checks = stable_checks + 1 if counts == last_counts else 0
        last_counts = counts
        if counts[1] > 0 and counts[2] >= counts[1] and stable_checks >= 1:
            break
        if stable_checks >= 4:
            warnings.append({"code": "h10_overlay_stabilized_partial", "counts": counts})
            break
    else:
        warnings.append({"code": "h10_overlay_timeout", "timeout_seconds": extension_timeout})

    api.evaluate(lease.profile_id, "document.documentElement.setAttribute('data-crawler-current-url', window.location.href)")
    return api.get_page(lease.profile_id), "results", warnings


def empty_counts(requested_limit: Optional[int] = None) -> Dict[str, Any]:
    return {
        "requested_limit": requested_limit,
        "collected_unique": 0,
        "pages_visited": 0,
        "search_cards_found": 0,
        "search_cards_seen": 0,
        "unique_asins": 0,
        "organic_cards": 0,
        "organic_cards_seen": 0,
        "sponsored_cards": 0,
        "sponsored_cards_seen": 0,
        "duplicate_asins": 0,
        "filtered_out_sponsored": 0,
        "native_records_complete": 0,
        "h10_records_complete": 0,
        "h10_records_partial": 0,
        "h10_records_missing": 0,
        "prices_available": 0,
        "bought_past_month_available": 0,
        "delivery_available": 0,
    }


def summarize_products(
    products: Sequence[Dict[str, Any]],
    *,
    requested_limit: Optional[int],
    pages_visited: int,
    cards_seen: int,
    organic_seen: int,
    sponsored_seen: int,
    duplicate_asins: int,
    filtered_out_sponsored: int,
) -> Dict[str, Any]:
    native_complete = sum(
        1 for product in products
        if product.get("asin") and product.get("amazon", {}).get("title") and product.get("amazon", {}).get("canonical_url")
    )
    return {
        "requested_limit": requested_limit,
        "collected_unique": len(products),
        "pages_visited": pages_visited,
        "search_cards_found": cards_seen,
        "search_cards_seen": cards_seen,
        "unique_asins": len(products),
        "organic_cards": organic_seen,
        "organic_cards_seen": organic_seen,
        "sponsored_cards": sponsored_seen,
        "sponsored_cards_seen": sponsored_seen,
        "duplicate_asins": duplicate_asins,
        "filtered_out_sponsored": filtered_out_sponsored,
        "native_records_complete": native_complete,
        "h10_records_complete": sum(product.get("h10_overlay", {}).get("status") == "complete" for product in products),
        "h10_records_partial": sum(product.get("h10_overlay", {}).get("status") == "partial" for product in products),
        "h10_records_missing": sum(product.get("h10_overlay", {}).get("status") == "missing" for product in products),
        "prices_available": sum(product.get("amazon", {}).get("price", {}).get("current") is not None for product in products),
        "bought_past_month_available": sum(product.get("amazon", {}).get("bought_past_month") is not None for product in products),
        "delivery_available": sum(product.get("amazon", {}).get("delivery") is not None for product in products),
    }


def derive_status(page_status: str, counts: Dict[str, Any], errors: Sequence[Dict[str, Any]]) -> str:
    if page_status in {"blocked", "empty", "failed"}:
        return page_status
    if not counts.get("unique_asins"):
        return "failed"
    if errors:
        return "partial"
    if counts.get("native_records_complete") != counts.get("unique_asins"):
        return "partial"
    if counts.get("h10_records_complete") != counts.get("unique_asins"):
        return "partial"
    return "success"


def build_output(
    *,
    keyword: str,
    search_url: str,
    final_url: Optional[str],
    started_at: str,
    started_monotonic: float,
    status: str,
    mode: str,
    profile_name: Optional[str],
    profile_id: Optional[str],
    counts: Dict[str, Any],
    collection: Dict[str, Any],
    filters: Dict[str, Any],
    warnings: List[Dict[str, Any]],
    products: List[Dict[str, Any]],
    errors: List[Dict[str, Any]],
) -> Dict[str, Any]:
    run_counts = {
        key: counts.get(key)
        for key in (
            "unique_asins",
            "organic_cards",
            "sponsored_cards",
            "prices_available",
            "bought_past_month_available",
        )
    }
    return prune_empty(
        {
            "run": {
                "source": "amazon_search_page",
                "marketplace": "amazon.com",
                "keyword": keyword,
                "completed_at": now_iso(),
                "status": status,
                "counts": run_counts,
                "collection": {"result_summary": collection.get("result_summary")},
            },
            "products": [strip_product_for_agent(product) for product in products],
        }
    )


def prune_empty(value: Any) -> Any:
    """Remove null and empty containers while preserving meaningful false/zero values."""
    if isinstance(value, dict):
        compact = {key: prune_empty(item) for key, item in value.items()}
        return {
            key: item
            for key, item in compact.items()
            if item is not None and item != "" and item != [] and item != {}
        }
    if isinstance(value, list):
        compact = [prune_empty(item) for item in value]
        return [item for item in compact if item is not None and item != "" and item != [] and item != {}]
    return value


def strip_product_for_agent(product: Dict[str, Any]) -> Dict[str, Any]:
    amazon = product.get("amazon", {})
    rating = amazon.get("rating") or {}
    bought = amazon.get("bought_past_month") or {}
    price = amazon.get("price", {})
    current_price = price.get("current") or {}
    list_price = price.get("list") or {}
    delivery = amazon.get("delivery") or {}
    h10 = product.get("h10_overlay", {})
    return prune_empty(
        {
            "asin": product.get("asin"),
            "unique_rank": product.get("unique_rank"),
            "is_sponsored": product.get("is_sponsored"),
            "amazon": {
                "title": amazon.get("title"),
                "canonical_url": amazon.get("canonical_url"),
                "rating": {"value": rating.get("value")},
                "review_count": amazon.get("review_count"),
                "bought_past_month": {
                    "lower_bound": bought.get("lower_bound"),
                    "window": bought.get("window"),
                    "rounded": bought.get("rounded"),
                },
                "price": {
                    "current": {
                        "value": current_price.get("value"),
                        "currency": current_price.get("currency"),
                    },
                    "list": {"value": list_price.get("value")},
                    "discount_percent": price.get("discount_percent"),
                },
                "badges": amazon.get("badges"),
                "delivery": {"free": delivery.get("free")},
            },
            "h10_overlay": {
                "bsr": [
                    {"category": item.get("category"), "rank": item.get("rank")}
                    for item in h10.get("bsr", [])
                ],
                "sellers": {"value": (h10.get("sellers") or {}).get("value")},
                "variations": {"value": (h10.get("variations") or {}).get("value")},
                "fulfillment": h10.get("fulfillment"),
            },
        }
    )


def write_json_atomic(path: Path, payload: Dict[str, Any]) -> None:
    path = path.expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    with temporary.open("r", encoding="utf-8") as handle:
        json.load(handle)
    os.replace(str(temporary), str(path))


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect filtered Amazon search cards through Undetectable.")
    parser.add_argument("--keyword", required=True, help="Amazon search phrase, for example: ornament christmas")
    parser.add_argument("--profile", default="auto", choices=("auto",) + PROFILE_NAMES, help="Crawler profile to use")
    parser.add_argument("--output", default="data-amazon.json", help="JSON output path (default: data-amazon.json)")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Undetectable Local API base URL")
    parser.add_argument("--page-timeout", type=float, default=45.0, help="Seconds to wait for Amazon results")
    parser.add_argument("--extension-timeout", type=float, default=60.0, help="Seconds to wait for visible H10 overlays")
    parser.add_argument("--limit", type=int, help="Maximum number of unique products (default: one search page)")
    parser.add_argument("--max-pages", type=int, default=20, help="Safety cap for pagination (default: 20)")
    parser.add_argument("--page-delay", type=float, default=1.5, help="Seconds between search pages (default: 1.5)")
    parser.add_argument("--filter", dest="filters", action="append", default=[], help="Dynamic Amazon filter GROUP=OPTION; repeatable")
    parser.add_argument("--raw-filter", dest="raw_filters", action="append", default=[], help="Expert Amazon refinement KEY=VALUE; repeatable")
    parser.add_argument("--list-filters", action="store_true", help="Discover filters for the keyword and exit")
    parser.add_argument("--sort", help="Amazon sort label or value discovered by --list-filters")
    parser.add_argument("--category", help="Amazon department/category label exposed by the current page")
    parser.add_argument("--min-price", help="Minimum price in the profile's displayed currency")
    parser.add_argument("--max-price", help="Maximum price in the profile's displayed currency")
    parser.add_argument("--organic-only", action="store_true", help="Exclude sponsored products before applying --limit")
    parser.add_argument("--html-file", help="Parse saved Amazon HTML instead of opening Undetectable")
    parser.add_argument("--verbose", action="store_true", help="Print progress details to stderr")
    return parser.parse_args(argv)


def validate_args(args: argparse.Namespace) -> None:
    if args.page_timeout <= 0:
        raise ValueError("--page-timeout must be greater than zero")
    if args.extension_timeout < 0:
        raise ValueError("--extension-timeout cannot be negative")
    if args.limit is not None and args.limit <= 0:
        raise ValueError("--limit must be greater than zero")
    if args.max_pages <= 0:
        raise ValueError("--max-pages must be greater than zero")
    if args.page_delay < 0:
        raise ValueError("--page-delay cannot be negative")
    for assignment in args.filters:
        parse_assignment(assignment, "--filter")
    for assignment in args.raw_filters:
        parse_assignment(assignment, "--raw-filter")
    prices: Dict[str, Decimal] = {}
    for name in ("min_price", "max_price"):
        raw = getattr(args, name)
        if raw is None:
            continue
        try:
            value = Decimal(raw)
        except InvalidOperation as exc:
            raise ValueError(f"--{name.replace('_', '-')} must be numeric") from exc
        if value < 0:
            raise ValueError(f"--{name.replace('_', '-')} cannot be negative")
        prices[name] = value
    if prices.get("min_price") is not None and prices.get("max_price") is not None:
        if prices["min_price"] > prices["max_price"]:
            raise ValueError("--min-price cannot be greater than --max-price")


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    keyword = normalize_text(args.keyword)
    if not keyword:
        print("error: --keyword cannot be empty", file=sys.stderr)
        return 1
    try:
        validate_args(args)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    started_at = now_iso()
    started_monotonic = time.monotonic()
    output_path = Path(args.output)
    search_url = build_search_url(keyword)
    crawl_url = search_url
    final_url: Optional[str] = None
    mode = "offline_html" if args.html_file else "live"
    page_status = "failed"
    products: List[Dict[str, Any]] = []
    counts: Dict[str, Any] = empty_counts(args.limit)
    collection: Dict[str, Any] = {
        "scope": "first_search_page" if args.limit is None else "search_pages_until_limit",
        "stop_reason": "not_started",
        "page_numbers": [],
        "pages": [],
        "result_summary": None,
    }
    filter_metadata: Dict[str, Any] = {"requested": [], "resolved": [], "verification": []}
    warnings: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    api: Optional[UndetectableApi] = None
    lease: Optional[ProfileLease] = None
    list_filters_complete = False
    seen_asins: Dict[str, Dict[str, Any]] = {}
    duplicate_asins = set()
    seen_page_signatures = set()
    cards_seen = 0
    organic_seen = 0
    sponsored_seen = 0
    filtered_out_sponsored = 0
    consecutive_no_new = 0

    try:
        if args.html_file:
            html_path = Path(args.html_file).expanduser().resolve()
            html_text = html_path.read_text(encoding="utf-8")
            page_status = page_state(html_text)
            final_url = extract_current_url(html_text) or search_url
            catalog = parse_filter_catalog(html_text)
            warnings.extend(catalog.get("warnings", []))
            if args.list_filters:
                print_filter_catalog(catalog)
                list_filters_complete = True
            elif args.filters or args.raw_filters or args.sort or args.category or args.min_price is not None or args.max_price is not None:
                raise ValueError("Filter navigation is unavailable with --html-file; use --list-filters or a live run")
            elif page_status == "results":
                page_products, page_counts, page_warnings, page_collection = parse_search_page(html_text)
                warnings.extend({**warning, "page": 1} for warning in page_warnings)
                cards_seen += page_counts["search_cards_found"]
                organic_seen += page_counts["organic_cards"]
                sponsored_seen += page_counts["sponsored_cards"]
                collection["result_summary"] = page_collection.get("result_summary")
                collection["page_numbers"].append(1)
                added = 0
                for product in page_products:
                    if args.organic_only and product.get("is_sponsored"):
                        filtered_out_sponsored += 1
                        continue
                    asin = product.get("asin")
                    if not asin or asin in seen_asins:
                        if asin:
                            duplicate_asins.add(asin)
                        continue
                    if product.get("duplicate_positions"):
                        duplicate_asins.add(asin)
                    product["page"] = 1
                    product["rank_on_page"] = product.get("page_position")
                    product["global_rank"] = len(products) + 1
                    product["unique_rank"] = product["global_rank"]
                    product["duplicate_occurrences"] = []
                    seen_asins[asin] = product
                    products.append(product)
                    added += 1
                    if args.limit is not None and len(products) >= args.limit:
                        break
                collection["pages"].append(
                    {
                        "page": 1,
                        "url": final_url,
                        "state": page_status,
                        "cards_found": page_counts["search_cards_found"],
                        "unique_on_page": page_counts["unique_asins"],
                        "added": added,
                    }
                )
                collection["stop_reason"] = (
                    "limit_reached" if args.limit is not None and len(products) >= args.limit
                    else "offline_fixture_exhausted" if args.limit is not None
                    else "first_page_complete"
                )
        else:
            api = UndetectableApi(args.api_url)
            api.status()
            lease = acquire_profile(api, args.profile)
            print(f"Using {lease.profile_name}", file=sys.stderr)
            needs_discovery = bool(
                args.list_filters or args.filters or args.raw_filters or args.sort or args.category
                or args.min_price is not None or args.max_price is not None
            )
            if needs_discovery:
                crawl_url, filter_metadata, catalog, list_filters_complete = apply_live_filters(
                    api, lease, search_url, args
                )
                warnings.extend(catalog.get("warnings", []))

            if not list_filters_complete:
                current_page_url = crawl_url
                page_cap = 1 if args.limit is None else args.max_pages
                stop_reason = "not_started"
                for page_number in range(1, page_cap + 1):
                    if page_number > 1 and args.page_delay:
                        time.sleep(args.page_delay)
                    html_text, current_state, live_warnings = load_live_page(
                        api,
                        lease,
                        current_page_url,
                        args.page_timeout,
                        args.extension_timeout,
                        args.verbose,
                    )
                    warnings.extend({**warning, "page": page_number} for warning in live_warnings)
                    final_url = extract_current_url(html_text) or current_page_url
                    if page_number == 1 and filter_metadata.get("resolved"):
                        verification = verify_applied_filters(final_url, filter_metadata)
                        filter_metadata["verification"] = verification
                        blocking = [problem for problem in verification if problem.get("code") == "filter_not_applied"]
                        if blocking:
                            errors.extend(blocking)
                            page_status = "failed"
                            stop_reason = "filter_verification_failed"
                            break

                    if current_state == "empty":
                        page_status = "results" if products else "empty"
                        stop_reason = "search_exhausted"
                        break
                    if current_state in {"blocked", "failed"}:
                        if products:
                            page_status = "results"
                            stop_reason = f"interrupted_{current_state}"
                            errors.append(
                                {
                                    "code": f"amazon_{current_state}",
                                    "page": page_number,
                                    "message": f"Collection stopped on page {page_number}: {current_state}.",
                                }
                            )
                        else:
                            page_status = current_state
                            stop_reason = current_state
                        break

                    page_status = "results"
                    page_products, page_counts, page_warnings, page_collection = parse_search_page(html_text)
                    warnings.extend({**warning, "page": page_number} for warning in page_warnings)
                    collection["page_numbers"].append(page_number)
                    cards_seen += page_counts["search_cards_found"]
                    organic_seen += page_counts["organic_cards"]
                    sponsored_seen += page_counts["sponsored_cards"]
                    if collection.get("result_summary") is None:
                        collection["result_summary"] = page_collection.get("result_summary")

                    signature = tuple(product.get("asin") for product in page_products if product.get("asin"))
                    if signature and signature in seen_page_signatures:
                        stop_reason = "repeated_page"
                        warnings.append({"code": "repeated_page_signature", "page": page_number})
                        collection["pages"].append(
                            {
                                "page": page_number,
                                "url": final_url,
                                "state": current_state,
                                "cards_found": page_counts["search_cards_found"],
                                "unique_on_page": page_counts["unique_asins"],
                                "added": 0,
                            }
                        )
                        break
                    if signature:
                        seen_page_signatures.add(signature)

                    added = 0
                    for product in page_products:
                        if args.organic_only and product.get("is_sponsored"):
                            filtered_out_sponsored += 1
                            continue
                        asin = product.get("asin")
                        if not asin:
                            continue
                        if asin in seen_asins:
                            duplicate_asins.add(asin)
                            seen_asins[asin].setdefault("duplicate_occurrences", []).append(
                                {"page": page_number, "page_position": product.get("page_position")}
                            )
                            continue
                        if product.get("duplicate_positions"):
                            duplicate_asins.add(asin)
                        product["page"] = page_number
                        product["rank_on_page"] = product.get("page_position")
                        product["global_rank"] = len(products) + 1
                        product["unique_rank"] = product["global_rank"]
                        product["duplicate_occurrences"] = []
                        seen_asins[asin] = product
                        products.append(product)
                        added += 1
                        if args.limit is not None and len(products) >= args.limit:
                            break

                    collection["pages"].append(
                        {
                            "page": page_number,
                            "url": final_url,
                            "state": current_state,
                            "cards_found": page_counts["search_cards_found"],
                            "unique_on_page": page_counts["unique_asins"],
                            "added": added,
                        }
                    )
                    if args.limit is not None and len(products) >= args.limit:
                        stop_reason = "limit_reached"
                        break
                    if args.limit is None:
                        stop_reason = "first_page_complete"
                        break
                    consecutive_no_new = consecutive_no_new + 1 if added == 0 else 0
                    if consecutive_no_new >= 2:
                        stop_reason = "no_new_unique_products"
                        break
                    next_page_url = page_collection.get("next_page_url")
                    if not next_page_url:
                        stop_reason = "search_exhausted"
                        break
                    current_page_url = str(next_page_url)
                if stop_reason == "not_started":
                    stop_reason = "max_pages_reached"
                collection["stop_reason"] = stop_reason
                if args.limit is not None and len(products) < args.limit and stop_reason in {
                    "max_pages_reached",
                    "repeated_page",
                    "no_new_unique_products",
                }:
                    errors.append(
                        {
                            "code": "limit_not_reached",
                            "requested": args.limit,
                            "collected": len(products),
                            "stop_reason": stop_reason,
                        }
                    )
    except (ApiError, OSError, UnicodeError, ValueError) as exc:
        page_status = "failed"
        collection["stop_reason"] = "collection_failed"
        errors.append({"code": "collection_failed", "message": str(exc), "type": type(exc).__name__})
    except Exception as exc:  # Keep an error artifact for unexpected parser/API failures.
        page_status = "failed"
        collection["stop_reason"] = "unexpected_error"
        errors.append({"code": "unexpected_error", "message": str(exc), "type": type(exc).__name__})
    finally:
        if lease is not None and api is not None:
            if lease.started_by_script:
                try:
                    api.stop_profile(lease.profile_id)
                except ApiError as exc:
                    warnings.append({"code": "profile_stop_failed", "message": str(exc), "profile_name": lease.profile_name})
            release_lock(lease.lock_path)

    if list_filters_complete:
        return 0

    counts = summarize_products(
        products,
        requested_limit=args.limit,
        pages_visited=len(collection.get("page_numbers", [])),
        cards_seen=cards_seen,
        organic_seen=organic_seen,
        sponsored_seen=sponsored_seen,
        duplicate_asins=len(duplicate_asins),
        filtered_out_sponsored=filtered_out_sponsored,
    )
    collection["filtered_search_url"] = crawl_url
    status = derive_status(page_status, counts, errors)
    payload = build_output(
        keyword=keyword,
        search_url=search_url,
        final_url=final_url,
        started_at=started_at,
        started_monotonic=started_monotonic,
        status=status,
        mode=mode,
        profile_name=lease.profile_name if lease else None,
        profile_id=lease.profile_id if lease else None,
        counts=counts,
        collection=collection,
        filters=filter_metadata,
        warnings=warnings,
        products=products,
        errors=errors,
    )
    try:
        write_json_atomic(output_path, payload)
    except OSError as exc:
        print(f"error: could not write {output_path}: {exc}", file=sys.stderr)
        return 1

    print(f"{status}: wrote {len(products)} products to {output_path.expanduser().resolve()}", file=sys.stderr)
    return {"success": 0, "empty": 0, "partial": 2, "blocked": 4, "failed": 1}.get(status, 1)


if __name__ == "__main__":
    raise SystemExit(main())
