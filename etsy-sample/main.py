#!/usr/bin/env python3
"""Collect filtered Etsy search cards through the Undetectable Local API.

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
from collections import Counter
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Sequence, Tuple


SCHEMA_VERSION = "1.1"
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
SORT_CHOICES = ("most_relevant", "price_asc", "price_desc", "highest_reviews", "date_desc")
ITEM_FORMAT_CHOICES = ("all", "physical", "digital")
ITEM_TYPE_CHOICES = ("all", "handmade", "vintage")
STATIC_FILTER_CATALOG = {
    "Special offers": {
        "type": "multi",
        "options": {
            "Free shipping": ("free_shipping", "true"),
            "On sale": ("is_discounted", "true"),
        },
    },
    "Item format": {
        "type": "single",
        "options": {
            "All items": ("instant_download", None),
            "Exclude digital downloads": ("instant_download", "false"),
            "Digital downloads only": ("instant_download", "true"),
        },
    },
    "Etsy's best": {
        "type": "multi",
        "options": {
            "Etsy's Picks": ("is_merch_library", "true"),
            "Star Seller": ("is_star_seller", "true"),
        },
    },
    "Ready to ship in": {
        "type": "single",
        "options": {
            "1 day": ("max_processing_days", "1"),
            "3 days": ("max_processing_days", "3"),
        },
    },
    "Item type": {
        "type": "single",
        "options": {
            "All items": ("item_type", None),
            "Handmade": ("item_type", "handmade"),
            "Vintage": ("item_type", "vintage"),
        },
    },
    "Ordering options": {
        "type": "multi",
        "options": {
            "Accepts Etsy gift cards": ("gift_card", "true"),
            "Gift wrap": ("gift_wrap", "true"),
            "Customizable": ("customizable", "true"),
        },
    },
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


def match_key(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", normalize_text(value)).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "", ascii_value.casefold())


def parse_assignment(value: str, option_name: str) -> Tuple[str, str]:
    if "=" not in value:
        raise ValueError(f"{option_name} must use KEY=VALUE syntax: {value!r}")
    key, assigned = value.split("=", 1)
    key = normalize_text(key)
    assigned = normalize_text(assigned)
    if not key or not assigned:
        raise ValueError(f"{option_name} requires a non-empty key and value: {value!r}")
    return key, assigned


def accordion_heading(accordion: Element) -> str:
    button = accordion.find(lambda node: node.tag == "button" and has_class(node, "collapsible-filter-trigger"))
    if button is None:
        return ""
    span = button.find(lambda node: node.tag == "span")
    return span.text() if span is not None else button.text()


def filter_control_label(control: Element) -> str:
    """Return the visible label without Etsy component accessibility echoes."""
    label = normalize_text(control.get("label") or control.text())
    label = re.sub(r"^Opens a new tab\s+", "", label, flags=re.IGNORECASE)
    echoed = re.match(r"^(.+?)\s+Required\s+\(optional\)\s+(.+)$", label, re.IGNORECASE)
    if echoed and match_key(echoed.group(1)) == match_key(echoed.group(2)):
        return normalize_text(echoed.group(1))
    return re.sub(r"\s+Required\s+\(optional\)(?:\s+|$)", " ", label, flags=re.IGNORECASE).strip()


def parse_filter_catalog(html: str) -> Dict[str, Any]:
    document = parse_document(html)
    rail = document.find(lambda node: node.get("id") == "collapsible-filter-rail-preact-root")
    groups: List[Dict[str, Any]] = []

    groups.append(
        {
            "label": "Sort by",
            "key": "order",
            "type": "single",
            "dynamic": False,
            "options": [{"label": value, "value": value} for value in SORT_CHOICES],
        }
    )
    for label, spec in STATIC_FILTER_CATALOG.items():
        groups.append(
            {
                "label": label,
                "key": None,
                "type": spec["type"],
                "dynamic": False,
                "options": [
                    {"label": option_label, "key": pair[0], "value": pair[1]}
                    for option_label, pair in spec["options"].items()
                ],
            }
        )

    if rail is None:
        return {"groups": groups, "warnings": [{"code": "filter_rail_missing"}]}

    for accordion in rail.find_all(lambda node: node.get("data-clg-id") == "WtAccordion"):
        heading = accordion_heading(accordion)
        if not heading:
            continue
        if heading == "Category":
            options = []
            for node in accordion.find_all(lambda item: item.has_attr("data-url-path")):
                options.append({"label": filter_control_label(node), "value": node.get("data-url-path")})
            groups.append(
                {
                    "label": "Category",
                    "key": "category",
                    "type": "single",
                    "dynamic": True,
                    "options": options,
                }
            )
            continue

        dynamic = accordion.find(lambda node: node.has_attr("data-dynamic-filter"))
        if dynamic is not None:
            key = dynamic.get("data-dynamic-filter") or ""
            options = []
            for control in dynamic.find_all(lambda node: node.tag == "clg-checkbox" and node.get("name") == key):
                control_id = control.get("id") or ""
                prefix = key + "-"
                value = control.get("value") or (control_id[len(prefix):] if control_id.startswith(prefix) else "")
                label = filter_control_label(control)
                if value and label:
                    options.append({"label": label, "value": value, "control_id": control_id})
            groups.append(
                {
                    "label": heading,
                    "key": key,
                    "type": "multi",
                    "dynamic": True,
                    "options": options,
                }
            )
            continue

        if heading == "Ships from":
            options = []
            seen_values = set()
            for control in accordion.find_all(lambda node: node.tag == "clg-radio" and node.get("name") == "locationQuery"):
                value = control.get("value")
                label = control.get("label")
                if value and label and not value.startswith("__"):
                    options.append({"label": label, "value": value, "control_id": control.get("id")})
                    seen_values.add(value)
            country_select = accordion.find(lambda node: node.tag == "clg-select" and node.get("id") == "ships_from_select")
            if country_select is not None:
                for option in country_select.find_all(lambda node: node.tag == "clg-select-option"):
                    value = option.get("value")
                    label = filter_control_label(option)
                    if value and label and value not in seen_values:
                        seen_values.add(value)
                        options.append({"label": label, "value": value})
            groups.append(
                {
                    "label": heading,
                    "key": "locationQuery",
                    "type": "single",
                    "dynamic": True,
                    "options": options,
                }
            )
            continue

        if heading == "Ship to":
            select = accordion.find(lambda node: node.tag == "clg-select" and node.get("name") == "ship_to")
            options = []
            if select is not None:
                seen = set()
                for option in select.find_all(lambda node: node.tag == "clg-select-option"):
                    value = option.get("value")
                    label = filter_control_label(option)
                    if value and label and value not in seen:
                        seen.add(value)
                        options.append({"label": label, "value": value})
            groups.append(
                {
                    "label": heading,
                    "key": "ship_to",
                    "type": "single",
                    "dynamic": True,
                    "options": options,
                }
            )

    unique: Dict[str, Dict[str, Any]] = {}
    for group in groups:
        unique.setdefault(match_key(group["label"]), group)
    return {"groups": list(unique.values()), "warnings": []}


def find_catalog_group(catalog: Dict[str, Any], label: str) -> Optional[Dict[str, Any]]:
    wanted = match_key(label)
    aliases = {
        "material": "material",
        "color": "color",
        "colour": "color",
        "holiday": "holiday",
        "season": "season",
        "sustainable": "sustainablefeatures",
        "sustainablefeatures": "sustainablefeatures",
        "shipsfrom": "shipsfrom",
        "shipto": "shipto",
    }
    wanted = aliases.get(wanted, wanted)
    return next((group for group in catalog.get("groups", []) if match_key(group.get("label", "")) == wanted), None)


def resolve_catalog_filters(assignments: Sequence[str], catalog: Dict[str, Any]) -> Tuple[List[Tuple[str, str]], List[Dict[str, Any]]]:
    pairs: List[Tuple[str, str]] = []
    resolved: List[Dict[str, Any]] = []
    for assignment in assignments:
        group_label, option_label = parse_assignment(assignment, "--filter")
        group = find_catalog_group(catalog, group_label)
        if group is None:
            available = ", ".join(group.get("label", "") for group in catalog.get("groups", []))
            raise ValueError(f"Unknown Etsy filter group {group_label!r}. Available groups: {available}")
        if group.get("key") == "category":
            raise ValueError("Category uses an Etsy URL path; pass the path shown by --list-filters to --category")
        wanted = match_key(option_label)
        option = next(
            (
                candidate
                for candidate in group.get("options", [])
                if match_key(str(candidate.get("label", ""))) == wanted or str(candidate.get("value", "")) == option_label
            ),
            None,
        )
        if option is None:
            available = ", ".join(str(candidate.get("label", "")) for candidate in group.get("options", []))
            raise ValueError(
                f"Unknown value {option_label!r} for Etsy filter {group.get('label')!r}. Available values: {available}"
            )
        key = option.get("key") or group.get("key")
        value = option.get("value")
        if not key or value is None:
            raise ValueError(f"Etsy filter {group.get('label')}={option.get('label')} does not map to a URL parameter")
        pairs.append((str(key), str(value)))
        resolved.append(
            {
                "group": group.get("label"),
                "label": option.get("label"),
                "key": str(key),
                "value": str(value),
                "dynamic": bool(group.get("dynamic")),
            }
        )
    return pairs, resolved


def build_search_url(keyword: str, page: int, category: Optional[str], filter_pairs: Sequence[Tuple[str, str]]) -> str:
    if category:
        safe_path = "/".join(urllib.parse.quote(segment, safe="-") for segment in category.strip("/").split("/"))
        base_url = "https://www.etsy.com/c/" + safe_path
    else:
        base_url = "https://www.etsy.com/search"
    query: List[Tuple[str, str]] = [("q", keyword), ("explicit", "1"), ("page", str(page))]
    query.extend((key, value) for key, value in filter_pairs if value is not None)
    return base_url + "?" + urllib.parse.urlencode(query, doseq=True)


def print_filter_catalog(catalog: Dict[str, Any]) -> None:
    for group in catalog.get("groups", []):
        print(f"{group.get('label')} [{group.get('type')}]")
        for option in group.get("options", []):
            label = option.get("label")
            value = option.get("value")
            print(f"  - {label}" + (f" ({value})" if value not in {None, label} else ""))
        print()


def resolve_ships_from(value: str, catalog: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    normalized = normalize_text(value)
    if normalized.isdigit():
        return normalized, {"group": "Ships from", "label": normalized, "key": "locationQuery", "value": normalized}
    ships_from = find_catalog_group(catalog, "Ships from")
    if ships_from is None:
        raise ValueError("The current Etsy page does not expose a Ships from filter")
    wanted_label = normalized
    if re.fullmatch(r"[A-Za-z]{2}", normalized):
        ship_to = find_catalog_group(catalog, "Ship to")
        country = next(
            (option for option in (ship_to or {}).get("options", []) if str(option.get("value", "")).upper() == normalized.upper()),
            None,
        )
        if country is not None:
            wanted_label = str(country.get("label"))
    option = next(
        (candidate for candidate in ships_from.get("options", []) if match_key(str(candidate.get("label", ""))) == match_key(wanted_label)),
        None,
    )
    if option is None:
        available = ", ".join(str(candidate.get("label", "")) for candidate in ships_from.get("options", []))
        raise ValueError(
            f"Ships from {value!r} is not exposed by this Etsy page. Available: {available}. "
            "Use --ships-from-id with an Etsy/GeoNames numeric locationQuery when needed."
        )
    return str(option["value"]), {
        "group": "Ships from",
        "label": option.get("label"),
        "key": "locationQuery",
        "value": str(option["value"]),
    }


def build_filter_pairs(args: argparse.Namespace, catalog: Dict[str, Any]) -> Tuple[List[Tuple[str, str]], Dict[str, Any]]:
    pairs: List[Tuple[str, str]] = []
    resolved: List[Dict[str, Any]] = []

    def add(key: str, value: Optional[Any], group: str, label: Any) -> None:
        if value is None:
            return
        text_value = str(value)
        pairs.append((key, text_value))
        resolved.append({"group": group, "label": str(label), "key": key, "value": text_value, "dynamic": False})

    if args.sort != "most_relevant":
        add("order", args.sort, "Sort by", args.sort)
    if args.free_shipping:
        add("free_shipping", "true", "Special offers", "Free shipping")
    if args.on_sale:
        add("is_discounted", "true", "Special offers", "On sale")
    if args.item_format == "physical":
        add("instant_download", "false", "Item format", "Exclude digital downloads")
    elif args.item_format == "digital":
        add("instant_download", "true", "Item format", "Digital downloads only")
    if args.etsy_picks:
        add("is_merch_library", "true", "Etsy's best", "Etsy's Picks")
    if args.star_seller:
        add("is_star_seller", "true", "Etsy's best", "Star Seller")
    if args.ready_to_ship_days is not None:
        add("max_processing_days", args.ready_to_ship_days, "Ready to ship in", f"{args.ready_to_ship_days} days")
    if args.min_price is not None:
        add("min", args.min_price, "Price", f"Minimum {args.min_price}")
    if args.max_price is not None:
        add("max", args.max_price, "Price", f"Maximum {args.max_price}")
    if args.item_type != "all":
        add("item_type", args.item_type, "Item type", args.item_type.title())
    if args.gift_card:
        add("gift_card", "true", "Ordering options", "Accepts Etsy gift cards")
    if args.gift_wrap:
        add("gift_wrap", "true", "Ordering options", "Gift wrap")
    if args.personalizable:
        add("customizable", "true", "Ordering options", "Customizable")
    if args.ship_to:
        add("ship_to", args.ship_to.upper(), "Ship to", args.ship_to.upper())
    if args.ships_from_id:
        add("locationQuery", args.ships_from_id, "Ships from", args.ships_from_id)
    elif args.ships_from_country:
        location_id, metadata = resolve_ships_from(args.ships_from_country, catalog)
        pairs.append(("locationQuery", location_id))
        resolved.append({**metadata, "dynamic": True})

    catalog_pairs, catalog_resolved = resolve_catalog_filters(args.filters, catalog)
    pairs.extend(catalog_pairs)
    resolved.extend(catalog_resolved)
    for raw in args.raw_filters:
        key, value = parse_assignment(raw, "--raw-filter")
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", key):
            raise ValueError(f"Invalid raw Etsy filter key: {key!r}")
        pairs.append((key, value))
        resolved.append({"group": "Raw", "label": raw, "key": key, "value": value, "dynamic": True})

    requested = {
        "sort": args.sort,
        "category": args.category,
        "free_shipping": args.free_shipping,
        "on_sale": args.on_sale,
        "item_format": args.item_format,
        "etsy_picks": args.etsy_picks,
        "star_seller": args.star_seller,
        "ships_from_country": args.ships_from_country,
        "ships_from_id": args.ships_from_id,
        "ready_to_ship_days": args.ready_to_ship_days,
        "min_price": args.min_price,
        "max_price": args.max_price,
        "item_type": args.item_type,
        "gift_card": args.gift_card,
        "gift_wrap": args.gift_wrap,
        "personalizable": args.personalizable,
        "ship_to": args.ship_to.upper() if args.ship_to else None,
        "dynamic": list(args.filters),
        "raw": list(args.raw_filters),
    }
    return pairs, {"requested": requested, "resolved": resolved}


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


def extract_current_url(html: str) -> Optional[str]:
    match = re.search(r'data-crawler-current-url="([^"]+)"', html)
    return html_module_unescape(match.group(1)) if match else None


def html_module_unescape(value: str) -> str:
    # The html package is imported as html.parser above; its public unescape
    # helper remains available on the package object.
    import html as html_module

    return html_module.unescape(value)


def verify_applied_filters(current_url: Optional[str], filter_pairs: Sequence[Tuple[str, str]], category: Optional[str]) -> List[Dict[str, Any]]:
    if not current_url:
        return [{"code": "current_url_unavailable"}]
    parsed = urllib.parse.urlsplit(current_url)
    actual = Counter(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))
    expected = Counter((key, value) for key, value in filter_pairs)
    problems: List[Dict[str, Any]] = []
    for pair, expected_count in expected.items():
        if actual[pair] < expected_count:
            problems.append({"code": "filter_not_applied", "key": pair[0], "value": pair[1]})
    if category:
        expected_path = "/c/" + category.strip("/")
        if not urllib.parse.unquote(parsed.path).rstrip("/").endswith(expected_path.rstrip("/")):
            problems.append({"code": "category_not_applied", "category": category, "actual_path": parsed.path})
    return problems


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
    api.evaluate(
        lease.profile_id,
        "document.documentElement.setAttribute('data-crawler-current-url', window.location.href)",
    )
    html = api.get_page(lease.profile_id)
    return html, "results", warnings


def load_filter_discovery_page(
    api: UndetectableApi,
    lease: ProfileLease,
    search_url: str,
    page_timeout: float,
    verbose: bool,
) -> Tuple[str, str]:
    api.open_url(lease.profile_id, search_url)
    deadline = time.monotonic() + page_timeout
    html = ""
    state = "loading"
    while time.monotonic() < deadline:
        time.sleep(1.5)
        html = api.get_page(lease.profile_id)
        state = page_state(html)
        if verbose:
            print(f"Discovering filters: state={state}, organic={html.count(ORGANIC_MARKER)}", file=sys.stderr)
        if state in {"results", "empty", "blocked"}:
            break
    if state != "results":
        return html, state if state != "loading" else "failed"
    api.evaluate(
        lease.profile_id,
        "document.querySelectorAll('[data-filter-group-toggle-show-more=\"false\"]').forEach((element) => element.click());"
        "document.querySelector('#shop-location-custom')?.click()",
    )
    time.sleep(2)
    api.evaluate(
        lease.profile_id,
        "document.documentElement.setAttribute('data-crawler-current-url', window.location.href)",
    )
    return api.get_page(lease.profile_id), "results"


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
    collection: Dict[str, Any],
    filters: Dict[str, Any],
    final_url: Optional[str],
) -> Dict[str, Any]:
    completed_at = now_iso()
    run_counts = {
        key: counts.get(key)
        for key in (
            "organic_cards_found",
            "unique_listings",
            "etsy_records_complete",
            "heyetsy_records_complete",
        )
    }
    return prune_empty(
        {
            "run": {
                "source": "etsy_search_page",
                "keyword": keyword,
                "completed_at": completed_at,
                "status": status,
                "counts": run_counts,
            },
            "listings": [strip_listing_for_agent(listing) for listing in listings],
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


def strip_listing_for_agent(listing: Dict[str, Any]) -> Dict[str, Any]:
    etsy = listing.get("etsy", {})
    price = etsy.get("price", {})
    heyetsy = listing.get("heyetsy", {})
    metrics = heyetsy.get("metrics", {})
    estimated_revenue = metrics.get("estimated_revenue") or {}
    created = heyetsy.get("created") or {}
    return prune_empty(
        {
            "rank": listing.get("rank"),
            "listing_id": listing.get("listing_id"),
            "etsy": {
                "title": etsy.get("title"),
                "canonical_url": etsy.get("canonical_url"),
                "shop_name": etsy.get("shop_name"),
                "rating": etsy.get("rating"),
                "review_count": etsy.get("review_count"),
                "badges": etsy.get("badges"),
                "shipping_text": etsy.get("shipping_text"),
                "price": {
                    "sale": {"value": (price.get("sale") or {}).get("value")},
                    "original": {"value": (price.get("original") or {}).get("value")},
                    "currency": price.get("currency"),
                    "discount_percent": price.get("discount_percent"),
                },
            },
            "heyetsy": {
                "metrics": {
                    "total_views": metrics.get("total_views"),
                    "average_daily_views": metrics.get("average_daily_views"),
                    "views_24h": metrics.get("views_24h"),
                    "total_sold": metrics.get("total_sold"),
                    "estimated_revenue": {
                        "value": estimated_revenue.get("value"),
                        "currency": estimated_revenue.get("currency"),
                        "estimated": estimated_revenue.get("estimated"),
                    },
                    "sold_24h": metrics.get("sold_24h"),
                    "favorites": metrics.get("favorites"),
                    "favorite_rate_percent": metrics.get("favorite_rate_percent"),
                    "conversion_rate_percent": metrics.get("conversion_rate_percent"),
                },
                "created": {"date": created.get("date")},
                "tags": heyetsy.get("tags"),
                "categories": heyetsy.get("categories"),
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
    parser = argparse.ArgumentParser(
        description="Collect filtered Etsy search cards through Undetectable.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""examples:
  python3 main.py --keyword "ornament christmas" --limit 100
  python3 main.py --keyword "ornament christmas" --list-filters
  python3 main.py --keyword "ornament christmas" --limit 50 --on-sale --free-shipping
  python3 main.py --keyword "ornament christmas" --limit 50 --filter "Material=Acrylic" --filter "Color=Red"
""",
    )
    parser.add_argument("--keyword", required=True, help="Etsy search phrase, for example: ornament christmas")
    parser.add_argument("--profile", default="auto", choices=("auto",) + PROFILE_NAMES, help="Crawler profile to use")
    parser.add_argument("--output", default="data.json", help="JSON output path (default: data.json)")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Undetectable Local API base URL")
    parser.add_argument("--page-timeout", type=float, default=45.0, help="Seconds to wait for Etsy results")
    parser.add_argument("--metrics-timeout", type=float, default=120.0, help="Seconds to wait for HeyEtsy metrics")
    parser.add_argument("--limit", type=int, help="Maximum number of unique products (default: one search page)")
    parser.add_argument("--max-pages", type=int, default=50, help="Safety cap for pagination (default: 50)")
    parser.add_argument("--page-delay", type=float, default=1.5, help="Seconds between search pages (default: 1.5)")
    parser.add_argument("--sort", choices=SORT_CHOICES, default="most_relevant", help="Etsy result ordering")
    parser.add_argument("--category", help="Etsy category URL path, for example home-and-living/home-decor")
    parser.add_argument("--free-shipping", action="store_true", help="Only listings with free shipping")
    parser.add_argument("--on-sale", action="store_true", help="Only discounted listings")
    parser.add_argument("--item-format", choices=ITEM_FORMAT_CHOICES, default="all", help="All, physical, or digital items")
    parser.add_argument("--etsy-picks", action="store_true", help="Only Etsy's Picks")
    parser.add_argument("--star-seller", action="store_true", help="Only Star Seller listings")
    parser.add_argument("--ships-from-country", help="Ships-from country label/code exposed by the current page")
    parser.add_argument("--ships-from-id", help="Raw numeric Etsy/GeoNames locationQuery")
    parser.add_argument("--ready-to-ship-days", type=int, choices=(1, 3), help="Maximum processing days")
    parser.add_argument("--min-price", help="Minimum price in the profile's displayed currency")
    parser.add_argument("--max-price", help="Maximum price in the profile's displayed currency")
    parser.add_argument("--item-type", choices=ITEM_TYPE_CHOICES, default="all", help="All, handmade, or vintage")
    parser.add_argument("--gift-card", action="store_true", help="Only shops accepting Etsy gift cards")
    parser.add_argument("--gift-wrap", action="store_true", help="Only listings offering gift wrap")
    parser.add_argument("--personalizable", action="store_true", help="Only customizable listings")
    parser.add_argument("--ship-to", help="ISO-2 destination country, for example VN or US")
    parser.add_argument("--filter", dest="filters", action="append", default=[], help="Dynamic filter LABEL=VALUE; repeatable")
    parser.add_argument("--raw-filter", dest="raw_filters", action="append", default=[], help="Expert Etsy query KEY=VALUE; repeatable")
    parser.add_argument("--list-filters", action="store_true", help="Discover filters for the keyword/category and exit")
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


def validate_args(args: argparse.Namespace) -> None:
    if args.page_timeout <= 0 or args.metrics_timeout < 0:
        raise ValueError("timeouts must be positive")
    if args.limit is not None and args.limit <= 0:
        raise ValueError("--limit must be greater than zero")
    if args.max_pages <= 0:
        raise ValueError("--max-pages must be greater than zero")
    if args.page_delay < 0:
        raise ValueError("--page-delay cannot be negative")
    if args.ship_to and not re.fullmatch(r"[A-Za-z]{2}", args.ship_to):
        raise ValueError("--ship-to must be an ISO-2 country code such as VN or US")
    if args.ships_from_id and not args.ships_from_id.isdigit():
        raise ValueError("--ships-from-id must be numeric")
    if args.category and not re.fullmatch(r"[A-Za-z0-9-]+(?:/[A-Za-z0-9-]+)*", args.category.strip("/")):
        raise ValueError("--category must be an Etsy URL path made of letters, numbers, dashes, and slashes")
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


def empty_counts() -> Dict[str, int]:
    return {
        "organic_cards_found": 0,
        "unique_listings": 0,
        "etsy_records_complete": 0,
        "heyetsy_records_complete": 0,
        "heyetsy_records_partial": 0,
        "heyetsy_records_missing": 0,
        "duplicate_organic_ids": 0,
    }


def summarize_listings(listings: Sequence[Dict[str, Any]], organic_cards: int, duplicate_ids: int) -> Dict[str, int]:
    etsy_complete = 0
    hey_complete = 0
    hey_partial = 0
    hey_missing = 0
    for listing in listings:
        etsy = listing.get("etsy", {})
        if listing.get("listing_id") and etsy.get("title") and etsy.get("canonical_url"):
            etsy_complete += 1
        heyetsy = listing.get("heyetsy", {})
        if not heyetsy.get("available"):
            hey_missing += 1
        elif any(warning.get("code") == "heyetsy_metrics_partial" for warning in listing.get("parse_warnings", [])):
            hey_partial += 1
        else:
            hey_complete += 1
    return {
        "organic_cards_found": organic_cards,
        "unique_listings": len(listings),
        "etsy_records_complete": etsy_complete,
        "heyetsy_records_complete": hey_complete,
        "heyetsy_records_partial": hey_partial,
        "heyetsy_records_missing": hey_missing,
        "duplicate_organic_ids": duplicate_ids,
    }


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

    output_path = Path(args.output)
    started_at = now_iso()
    started_monotonic = time.monotonic()
    lease: Optional[ProfileLease] = None
    api: Optional[UndetectableApi] = None
    page_status = "failed"
    listings: List[Dict[str, Any]] = []
    counts: Dict[str, Any] = empty_counts()
    warnings: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    mode = "offline_html" if args.html_file else "live"
    catalog = parse_filter_catalog("")
    filter_metadata: Dict[str, Any] = {"requested": {}, "resolved": [], "verification": []}
    filter_pairs: List[Tuple[str, str]] = []
    pages_visited: List[int] = []
    stop_reason = "not_started"
    final_url: Optional[str] = None
    first_search_url = build_search_url(keyword, 1, args.category, [])
    organic_cards_total = 0
    duplicate_ids: set = set()
    seen_listing_ids: set = set()
    seen_page_signatures: set = set()
    consecutive_no_new = 0
    interrupted = False
    list_filters_complete = False

    try:
        if args.html_file:
            html_path = Path(args.html_file).expanduser().resolve()
            discovery_html = html_path.read_text(encoding="utf-8")
            page_status = page_state(discovery_html)
            catalog = parse_filter_catalog(discovery_html)
            if args.list_filters:
                print_filter_catalog(catalog)
                list_filters_complete = True
            filter_pairs, filter_metadata = build_filter_pairs(args, catalog)
            first_search_url = build_search_url(keyword, 1, args.category, filter_pairs)
            if not list_filters_complete and page_status == "results":
                page_listings, page_counts, page_warnings = parse_search_page(discovery_html)
                warnings.extend(page_warnings)
                organic_cards_total += page_counts["organic_cards_found"]
                pages_visited.append(1)
                for listing in page_listings:
                    listing_id = listing.get("listing_id")
                    if not listing_id or listing_id in seen_listing_ids:
                        if listing_id:
                            duplicate_ids.add(listing_id)
                        continue
                    listing["page"] = 1
                    listing["rank_on_page"] = listing.get("rank")
                    listing["global_rank"] = len(listings) + 1
                    listing["rank"] = listing["global_rank"]
                    seen_listing_ids.add(listing_id)
                    listings.append(listing)
                    if args.limit is not None and len(listings) >= args.limit:
                        break
                stop_reason = "limit_reached" if args.limit is not None and len(listings) >= args.limit else "offline_fixture_exhausted"
        else:
            api = UndetectableApi(args.api_url)
            api.status()
            lease = acquire_profile(api, args.profile)
            print(f"Using {lease.profile_name}", file=sys.stderr)
            needs_discovery = bool(args.list_filters or args.filters or args.ships_from_country)
            if needs_discovery:
                discovery_url = build_search_url(keyword, 1, args.category, [])
                discovery_html, discovery_state = load_filter_discovery_page(
                    api, lease, discovery_url, args.page_timeout, args.verbose
                )
                if discovery_state != "results":
                    page_status = discovery_state
                    raise ApiError(f"Could not discover Etsy filters: page state is {discovery_state}")
                catalog = parse_filter_catalog(discovery_html)
                if args.list_filters:
                    print_filter_catalog(catalog)
                    list_filters_complete = True
                if not list_filters_complete:
                    filter_pairs, filter_metadata = build_filter_pairs(args, catalog)
            else:
                filter_pairs, filter_metadata = build_filter_pairs(args, catalog)

            first_search_url = build_search_url(keyword, 1, args.category, filter_pairs)
            if not list_filters_complete:
                page_cap = 1 if args.limit is None else args.max_pages
                for page_number in range(1, page_cap + 1):
                    page_url = build_search_url(keyword, page_number, args.category, filter_pairs)
                    if page_number > 1 and args.page_delay:
                        time.sleep(args.page_delay)
                    html, current_state, live_warnings = load_live_page(
                        api,
                        lease,
                        page_url,
                        args.page_timeout,
                        args.metrics_timeout,
                        args.verbose,
                    )
                    warnings.extend({**warning, "page": page_number} for warning in live_warnings)
                    final_url = extract_current_url(html) or page_url
                    if page_number == 1:
                        verification = verify_applied_filters(final_url, filter_pairs, args.category)
                        filter_metadata["verification"] = verification
                        blocking_verification = [
                            problem for problem in verification if problem.get("code") in {"filter_not_applied", "category_not_applied"}
                        ]
                        if blocking_verification:
                            errors.extend(blocking_verification)
                            page_status = "failed"
                            stop_reason = "filter_verification_failed"
                            break
                    if current_state == "empty":
                        page_status = "results" if listings else "empty"
                        stop_reason = "search_exhausted"
                        break
                    if current_state in {"blocked", "failed"}:
                        if listings:
                            interrupted = True
                            page_status = "results"
                            stop_reason = f"interrupted_{current_state}"
                            errors.append(
                                {
                                    "code": f"etsy_{current_state}",
                                    "page": page_number,
                                    "message": f"Collection stopped on page {page_number}: {current_state}.",
                                }
                            )
                        else:
                            page_status = current_state
                            stop_reason = current_state
                        break

                    page_status = "results"
                    page_listings, page_counts, page_warnings = parse_search_page(html)
                    warnings.extend({**warning, "page": page_number} for warning in page_warnings)
                    pages_visited.append(page_number)
                    organic_cards_total += page_counts["organic_cards_found"]
                    signature = tuple(listing.get("listing_id") for listing in page_listings if listing.get("listing_id"))
                    if signature and signature in seen_page_signatures:
                        stop_reason = "repeated_page"
                        warnings.append({"code": "repeated_page_signature", "page": page_number})
                        break
                    if signature:
                        seen_page_signatures.add(signature)

                    added = 0
                    for listing in page_listings:
                        listing_id = listing.get("listing_id")
                        if not listing_id:
                            continue
                        if listing_id in seen_listing_ids:
                            duplicate_ids.add(listing_id)
                            continue
                        listing["page"] = page_number
                        listing["rank_on_page"] = listing.get("rank")
                        listing["global_rank"] = len(listings) + 1
                        listing["rank"] = listing["global_rank"]
                        seen_listing_ids.add(listing_id)
                        listings.append(listing)
                        added += 1
                        if args.limit is not None and len(listings) >= args.limit:
                            break

                    if args.limit is not None and len(listings) >= args.limit:
                        stop_reason = "limit_reached"
                        break
                    consecutive_no_new = consecutive_no_new + 1 if added == 0 else 0
                    if consecutive_no_new >= 2:
                        stop_reason = "no_new_unique_listings"
                        break
                    if args.limit is None:
                        stop_reason = "first_page_complete"
                        break
                    if not page_listings:
                        stop_reason = "search_exhausted"
                        break
                else:
                    stop_reason = "max_pages_reached"

        if not list_filters_complete:
            if page_status == "blocked":
                errors.append({"code": "etsy_blocked", "message": "Etsy returned a verification or access-denied page."})
            elif page_status == "failed" and not errors:
                errors.append({"code": "etsy_results_not_found", "message": "No organic Etsy results were found before timeout."})
    except (ApiError, OSError, UnicodeError, ValueError) as exc:
        page_status = "failed"
        stop_reason = "crawler_error"
        errors.append({"code": "crawler_error", "message": str(exc)})
    finally:
        if lease is not None and api is not None:
            if lease.started_by_script:
                try:
                    api.stop_profile(lease.profile_id)
                except ApiError as exc:
                    warnings.append({"code": "profile_stop_failed", "message": str(exc)})
            release_lock(lease.lock_path)

    if list_filters_complete:
        return 0

    counts = summarize_listings(listings, organic_cards_total, len(duplicate_ids))
    status = derive_status(page_status, counts)
    if interrupted and listings:
        status = "partial"
    collection = {
        "requested_limit": args.limit,
        "collected_count": len(listings),
        "limit_reached": (len(listings) >= args.limit) if args.limit is not None else None,
        "pages_visited": pages_visited,
        "stop_reason": stop_reason,
        "max_pages": args.max_pages,
    }
    payload = build_output(
        keyword=keyword,
        search_url=first_search_url,
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
        collection=collection,
        filters=filter_metadata,
        final_url=final_url,
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
