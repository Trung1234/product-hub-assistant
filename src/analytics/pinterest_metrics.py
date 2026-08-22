"""
Engine tinh chi so Pinterest cho R&D POD.

Nguyen tac: **moi con so trong bao cao deu sinh ra o day, khong phai o LLM.**
LLM chi duoc viet phan dien giai. Voi cung mot corpus va cung mot moc thoi gian
(`now`), engine luon tra ve ket qua giong het nhau - khong random, khong goi mang -
nen doi chieu va debug duoc.

Pinterest la san kham pha, khong phai san ban hang: no cong bo saves / comments,
khong cong bo doanh thu hay so luong ban. Vi vay Revenue va Quantity o day la
**gia tri UOC LUONG** theo mo hinh ESTIMATION_MODEL ben duoi, moi dong deu kem
`method` va `confidence`. Khong duoc trinh bay chung nhu so lieu ban hang that.
"""

import json
import math
import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from src.analytics.text_utils import (
    POD_LEXICON,
    clean_text,
    extract_ngrams,
    lexicon_hits,
    lexicon_weight,
)

CATALOG_PATH = os.getenv("PRINTWAY_CATALOG_PATH", "data/printway_catalog.json")


# --------------------------------------------------------------------------
# Cua so thoi gian theo tung san
# --------------------------------------------------------------------------
# Doi low-tech chi can chon "30 days" hay "last year"; phan chon cua so nao hop ly
# voi tung san da duoc quyet o day, kem ly do, de nguoi dung khong phai tu suy nghi.
MARKETPLACE_WINDOWS: Dict[str, Dict[str, Any]] = {
    "pinterest": {
        "default": 30,
        "options": [30, 90, 365],
        "labels": {30: "30 ngay", 90: "90 ngay (mua vu)", 365: "12 thang"},
        "rationale": (
            "Pinterest la kenh len y tuong truoc khi mua 30-60 ngay, va co chu ky mua vu rat manh. "
            "30 ngay bat song moi; 90 ngay bat duoc ca doan da tang cua mua vu; "
            "365 ngay dung de so sanh cung ky nam truoc."
        ),
    },
    "etsy": {
        "default": 30,
        "options": [30, 365],
        "labels": {30: "30 ngay", 365: "12 thang"},
        "rationale": (
            "Etsy chi lo review va ngay listing, khong lo doanh so theo ngay. "
            "30 ngay va 12 thang la hai moc doi chieu duy nhat co du du lieu."
        ),
    },
    "amazon": {
        "default": 30,
        "options": [30, 90],
        "labels": {30: "30 ngay", 90: "90 ngay"},
        "rationale": (
            "BSR cua Amazon xoay rat nhanh; qua 90 ngay thi tin hieu khong con phan anh hien tai."
        ),
    },
}


# --------------------------------------------------------------------------
# Mo hinh uoc luong thuong mai
# --------------------------------------------------------------------------
ESTIMATION_MODEL: Dict[str, Any] = {
    "name": "pinterest_commerce_estimator_v1",
    "chain": "saves -> outbound clicks -> orders -> revenue",
    "click_per_save": 0.28,
    "click_per_save_note": (
        "Trung binh mot pin san pham tao ra khoang 0.25-0.30 luot click ra ngoai tren moi luot save. "
        "Day la HE SO GIA DINH, doi duoc trong ESTIMATION_MODEL neu doi co so lieu GA4 that."
    ),
    "cvr_by_category": {
        "Home Decor": 0.018,
        "Drinkware": 0.016,
        "Apparel": 0.012,
        "Accessories": 0.015,
        "Jewelry & Keepsakes": 0.014,
        "default": 0.015,
    },
    "cvr_note": "Ty le chuyen doi tham chieu cho traffic POD den tu social discovery.",
    "default_age_days": 180.0,
    "default_age_note": (
        "Pin khong lay duoc ngay tao thi gia dinh 180 ngay tuoi - do tuoi trung vi cua "
        "pin xuat hien trong ket qua tim kiem. Dong do bi ha confidence."
    ),
    "window_attribution": (
        "Gia dinh save tich luy tuyen tinh theo doi pin: pin tre hon cua so thi tinh tron, "
        "pin gia hon thi chi tinh phan window_days / age_days."
    ),
}

# He so mua vu POD theo thang (1 = trung binh nam). Q4 la mua qua tang.
SEASONALITY_BY_MONTH: Dict[int, float] = {
    1: 0.82, 2: 0.88, 3: 0.85, 4: 0.90, 5: 1.05, 6: 0.92,
    7: 0.88, 8: 0.95, 9: 1.10, 10: 1.35, 11: 1.55, 12: 1.20,
}

# Tu xuat hien o hau het moi dong catalog nen khong phan biet duoc san pham nao voi san pham nao.
GENERIC_MATCH_TOKENS = {
    "custom", "customized", "personalized", "gift", "photo", "name", "names",
    "engraved", "engraving", "print", "printed", "art", "decor", "cut", "shape",
}

# Mot tu khoa chi vao bang Top Keywords khi no noi len duoc "lam cai gi, cho dip nao".
# Tu thuan phong cach ("boho", "watercolor") di sang bang Design Attributes rieng.
COMMERCIAL_GROUPS = ("product", "material", "occasion", "personalization")

# Trong so Opportunity Score. Tong phai bang 1.0 - chot cung o module level.
WEIGHTS: Dict[str, float] = {
    "demand": 0.35,
    "growth": 0.30,
    "collection": 0.15,
    "low_competition": 0.20,
}
assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9, "Trong so Opportunity Score phai cong lai bang 1.0"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _log_norm(value: float, max_value: float) -> float:
    """Chuan hoa ve thang 0-100 theo log - tranh de mot pin viral nuot het thang do."""
    if max_value <= 0 or value <= 0:
        return 0.0
    return round(100.0 * math.log1p(value) / math.log1p(max_value), 2)


def _median(values: List[float]) -> Optional[float]:
    vals = sorted(v for v in values if v is not None)
    if not vals:
        return None
    mid = len(vals) // 2
    return vals[mid] if len(vals) % 2 else (vals[mid - 1] + vals[mid]) / 2.0


def window_factor(age_days: Optional[float], window_days: int) -> float:
    """Phan engagement cua mot pin duoc quy cho cua so dang xet."""
    age = age_days if age_days and age_days > 0 else ESTIMATION_MODEL["default_age_days"]
    if age <= window_days:
        return 1.0
    return round(window_days / age, 4)


class PinterestMetricsEngine:
    """
    Nhan danh sach pin da lam sach (doc tu bang `pins`), tra ve:
      * keyword_metrics  - Demand / Growth / Collection / De xuat san pham
      * product_metrics  - Revenue / Quantity uoc luong theo cua so thoi gian
      * forecast         - du bao 30 ngay
      * market_summary   - so lieu nen de doi chieu va de kiem tra LLM khong bia so
    """

    def __init__(self, pins: List[Dict[str, Any]], snapshot_date: Optional[str] = None,
                 catalog_path: str = CATALOG_PATH, now: Optional[datetime] = None):
        # `now` truyen vao duoc de test khoa cung moc thoi gian: tuoi pin phu thuoc vao
        # thoi diem chay, nen ket qua chi lap lai y het khi moc thoi gian giong nhau.
        self.pins = [dict(p) for p in pins]
        self.now = now or _utc_now()
        self.snapshot_date = snapshot_date or self.now.date().isoformat()
        self.catalog = self._load_catalog(catalog_path)
        self._ensure_age()
        self._index_terms()

    # ------------------------------------------------------------- chuan bi

    @staticmethod
    def _load_catalog(path: str) -> List[Dict[str, Any]]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            return []

    def _ensure_age(self):
        """Tinh tuoi pin (ngay). Pin khong co ngay tao duoc danh dau de ha confidence."""
        for p in self.pins:
            created = _parse_iso(p.get("created_at"))
            if created:
                p["age_days"] = max((self.now - created).total_seconds() / 86400.0, 0.0)
                p["_dated"] = True
            else:
                p["age_days"] = p.get("age_days") or ESTIMATION_MODEL["default_age_days"]
                p["_dated"] = False
            p["_save_rate"] = (p.get("saves") or 0) / max(p["age_days"], 1.0)
            if not p.get("clean_text"):
                p["clean_text"] = clean_text(
                    p.get("title") or "", p.get("description") or "", p.get("alt_text") or ""
                )

    def _index_terms(self):
        """Dung chi muc term -> danh sach pin. Moi pin chi dong gop mot lan cho moi term."""
        self.term_pins: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.term_ngram: Dict[str, int] = {}
        for p in self.pins:
            seen = set()
            for term, n in extract_ngrams(p["clean_text"]):
                if term in seen:
                    continue
                seen.add(term)
                self.term_pins[term].append(p)
                self.term_ngram[term] = n

    # ----------------------------------------------------------- tu khoa

    def _growth(self, pins: List[Dict[str, Any]], window_days: int) -> Tuple[Optional[float], str]:
        """
        Growth = chenh lech toc do tich luy save/ngay giua lop pin moi va lop pin truoc do.

        Dung save-rate (saves / so ngay tuoi) chu khong dung tong saves, vi pin moi
        chua kip tich save - so sanh tong saves se luon ket luan sai la "dang giam".
        """
        dated = [p for p in pins if p["_dated"]]
        recent = [p for p in dated if p["age_days"] <= window_days]
        prev = [p for p in dated if window_days < p["age_days"] <= 2 * window_days]

        if len(recent) >= 2 and len(prev) >= 2:
            r = sum(p["_save_rate"] for p in recent) / len(recent)
            q = sum(p["_save_rate"] for p in prev) / len(prev)
            if q > 0:
                pct = (r - q) / q * 100.0
                return round(max(min(pct, 500.0), -100.0), 2), "cohort_save_rate"

        if len(dated) >= 4:
            # Khong du hai lop -> so lop tre nhat voi lop gia nhat trong so pin co ngay.
            ordered = sorted(dated, key=lambda p: p["age_days"])
            half = max(len(ordered) // 2, 1)
            young = ordered[:half]
            old = ordered[-half:]
            r = sum(p["_save_rate"] for p in young) / len(young)
            q = sum(p["_save_rate"] for p in old) / len(old)
            if q > 0:
                pct = (r - q) / q * 100.0
                return round(max(min(pct, 500.0), -100.0), 2), "median_split_save_rate"

        return None, "insufficient_dated_pins"

    def _suggest_product(self, term: str, pins: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        De xuat san pham Printway cho mot tu khoa: cham diem tung dong catalog theo
        so tu trung giua tu khoa (+ text cua pin) va keyword/material cua catalog.
        """
        term_tokens = set(term.split())
        pin_tokens: Dict[str, int] = defaultdict(int)
        for p in pins[:40]:
            for tok in p["clean_text"].split():
                pin_tokens[tok] += 1

        # Tu khoa phong cach ("boho", "watercolor") tu no khong noi len san pham nao.
        # Truong hop do lay loai san pham pho bien nhat trong chinh nhung pin chua tu khoa -
        # doi R&D can biet "boho thi lam cai gi", khong phai mot o trong.
        match_method = "term_anchor"
        if not term_tokens & (POD_LEXICON["product"] | POD_LEXICON["material"]):
            context = sorted(
                ((cnt, tok) for tok, cnt in pin_tokens.items()
                 if tok in POD_LEXICON["product"] or tok in POD_LEXICON["material"]),
                reverse=True,
            )
            if context:
                term_tokens = term_tokens | {tok for _, tok in context[:2]}
                match_method = "pin_context_anchor"

        best, best_score = None, 0.0
        for entry in self.catalog:
            entry_tokens = set()
            for kw in entry.get("keywords", []):
                entry_tokens.update(kw.lower().split())
            entry_tokens.update(entry.get("product_type", "").lower().split())
            entry_tokens.update(entry.get("material", "").lower().split())

            # "custom" / "personalized" / "gift" xuat hien o gan nhu moi dong catalog nen
            # khong phan biet duoc gi - chi tinh diem cho tu chi loai san pham hoac chat lieu.
            overlap = (term_tokens & entry_tokens) - GENERIC_MATCH_TOKENS
            anchor = overlap & (POD_LEXICON["product"] | POD_LEXICON["material"])
            if not anchor:
                continue

            score = 3.0 * len(anchor) + 1.0 * len(overlap - anchor)
            for tok in entry_tokens - GENERIC_MATCH_TOKENS:
                score += 0.02 * min(pin_tokens.get(tok, 0), 10)
            if score > best_score:
                best, best_score = entry, score

        hits = lexicon_hits(term)
        if not best or best_score < 1.0:
            return {
                "product": None,
                "material": (hits.get("material") or [None])[0],
                "price_band": None,
                "category": None,
                "match_score": round(best_score, 2),
                "match_method": "no_catalog_match",
            }

        price = best.get("avg_retail_price_usd")
        return {
            "product": best.get("product_type"),
            "product_type_id": best.get("product_type_id"),
            "material": best.get("material"),
            "category": best.get("category"),
            "price_band": f"${price:.2f} (margin {best.get('avg_margin_pct')}%)" if price else None,
            "avg_retail_price_usd": price,
            "avg_margin_pct": best.get("avg_margin_pct"),
            "match_score": round(best_score, 2),
            "match_method": match_method,
        }

    @staticmethod
    def _suppress_redundant(ranked: List[Dict[str, Any]],
                            term_pins: Dict[str, List[Dict[str, Any]]],
                            jaccard_threshold: float = 0.75) -> List[Dict[str, Any]]:
        """
        Bo gram trung lap.

        "anniversary handmade" va "anniversary handmade personalized" phu gan nhu cung mot
        tap pin - giu ca hai chi lam loang bang xep hang. Giu ban xep hang cao hon,
        bo ban con lai khi mot gram chua gram kia VA hai tap pin trung nhau tren nguong.
        """
        kept: List[Dict[str, Any]] = []
        kept_sets: List[tuple] = []
        for item in ranked:
            pin_ids = {p["pin_id"] for p in term_pins.get(item["term"], [])}
            redundant = False
            for kept_term, kept_ids in kept_sets:
                if item["term"] not in kept_term and kept_term not in item["term"]:
                    continue
                union = pin_ids | kept_ids
                if union and len(pin_ids & kept_ids) / len(union) >= jaccard_threshold:
                    redundant = True
                    break
            if not redundant:
                kept.append(item)
                kept_sets.append((item["term"], pin_ids))
        return kept

    def _candidate_terms(self, min_df: int, max_df_ratio: float) -> Dict[str, List[Dict[str, Any]]]:
        total_pins = len(self.pins)
        max_df = (max(int(total_pins * max_df_ratio), min_df)
                  if total_pins >= 20 else total_pins)
        return {t: ps for t, ps in self.term_pins.items() if min_df <= len(ps) <= max_df}

    def design_attributes(self, window_days: int = 30, top_n: int = 8,
                          min_df: int = 3, max_df_ratio: float = 0.5) -> List[Dict[str, Any]]:
        """
        Tin hieu tham my thuan tuy: "boho", "watercolor", "farmhouse"...

        Day chinh la thu Pinterest lam tot hon moi san khac, nhung no khong phai tu khoa
        de dat ten san pham - no la HUONG THIET KE. Tach ra bang rieng de doi design
        doc duoc, thay vi de lan vao bang Top Keywords roi day het tu khoa thuong mai xuong.
        """
        out: List[Dict[str, Any]] = []
        for term, pins in self._candidate_terms(min_df, max_df_ratio).items():
            hits = lexicon_hits(term)
            if "style" not in hits or any(g in hits for g in COMMERCIAL_GROUPS):
                continue
            total_saves = sum(p.get("saves") or 0 for p in pins)
            growth_pct, _ = self._growth(pins, window_days)
            paired = self._suggest_product(term, pins)
            out.append({
                "term": term,
                "pin_count": len(pins),
                "total_saves": total_saves,
                "avg_saves_per_pin": round(total_saves / max(len(pins), 1), 1),
                "growth_pct": growth_pct,
                "pairs_with_product": paired["product"],
                "board_count": len({p.get("board_name") for p in pins if p.get("board_name")}),
            })
        out.sort(key=lambda x: x["total_saves"], reverse=True)
        return self._suppress_redundant(out, self.term_pins)[:top_n]

    def keyword_metrics(self, window_days: int = 30, top_n: int = 15,
                        min_df: int = 3, max_df_ratio: float = 0.5,
                        require_commercial_anchor: bool = True) -> List[Dict[str, Any]]:
        """
        Bo chi so tu khoa: Demand, Growth, Collection, De xuat san pham.

        min_df: term phai xuat hien o it nhat bay nhieu pin moi duoc tinh -
        tranh mot pin viral duy nhat de ra mot "xu huong" khong co that.

        max_df_ratio: term phu qua nhieu pin thi bo. Tu nhu "personalized" hay "custom"
        xuat hien o gan nhu moi pin POD - dung la co that nhung khong chi ra duoc viec gi
        de lam, va no day het cac tu khoa co gia tri xuong duoi.

        require_commercial_anchor: chi giu tu khoa co cham vao loai san pham, chat lieu,
        dip tang hoac kieu ca nhan hoa. Tu thuan phong cach di sang design_attributes().
        """
        candidates = self._candidate_terms(min_df, max_df_ratio)
        if require_commercial_anchor:
            candidates = {t: ps for t, ps in candidates.items()
                          if any(g in lexicon_hits(t) for g in COMMERCIAL_GROUPS)}
        if not candidates:
            return []

        raw: Dict[str, Dict[str, Any]] = {}
        for term, pins in candidates.items():
            total_saves = sum(p.get("saves") or 0 for p in pins)
            total_comments = sum(p.get("comments") or 0 for p in pins)
            boards = {p.get("board_name") for p in pins if p.get("board_name")}
            domains = {p.get("domain") for p in pins if p.get("domain")}
            creators = {p.get("creator") for p in pins if p.get("creator")}

            demand_raw = (total_saves + 0.5 * total_comments + 3.0 * len(pins)) * lexicon_weight(term)
            growth_pct, growth_method = self._growth(pins, window_days)

            raw[term] = {
                "term": term,
                "ngram": self.term_ngram.get(term, 1),
                "pins": pins,
                "pin_count": len(pins),
                "total_saves": total_saves,
                "total_comments": total_comments,
                "demand_raw": round(demand_raw, 2),
                "growth_pct": growth_pct,
                "growth_method": growth_method,
                "collection_count": len(boards) or len(creators) or len(domains),
                "creator_count": len(creators) or len(domains) or len(pins),
            }

        max_demand = max(r["demand_raw"] for r in raw.values())
        max_collection = max(r["collection_count"] for r in raw.values()) or 1
        max_creators = max(r["creator_count"] for r in raw.values()) or 1

        out: List[Dict[str, Any]] = []
        for term, r in raw.items():
            demand_score = _log_norm(r["demand_raw"], max_demand)
            collection_score = _log_norm(r["collection_count"], max_collection)
            competition_score = _log_norm(r["creator_count"], max_creators)

            if r["growth_pct"] is None:
                growth_score = 50.0            # trung tinh khi khong du du lieu ngay thang
            else:
                growth_score = round(max(min(50.0 + r["growth_pct"] / 4.0, 100.0), 0.0), 2)

            opportunity = round(
                WEIGHTS["demand"] * demand_score
                + WEIGHTS["growth"] * growth_score
                + WEIGHTS["collection"] * collection_score
                + WEIGHTS["low_competition"] * (100.0 - competition_score),
                2,
            )

            dated_share = sum(1 for p in r["pins"] if p["_dated"]) / max(r["pin_count"], 1)
            if r["pin_count"] >= 8 and dated_share >= 0.5:
                confidence = "high"
            elif r["pin_count"] >= 5 or dated_share >= 0.3:
                confidence = "medium"
            else:
                confidence = "low"

            suggestion = self._suggest_product(term, r["pins"])

            out.append({
                "term": term,
                "ngram": r["ngram"],
                "window_days": window_days,
                "pin_count": r["pin_count"],
                "total_saves": r["total_saves"],
                "total_comments": r["total_comments"],
                "demand_score": demand_score,
                "demand_raw": r["demand_raw"],
                "growth_pct": r["growth_pct"],
                "growth_score": growth_score,
                "growth_method": r["growth_method"],
                "collection_count": r["collection_count"],
                "collection_score": collection_score,
                "competition_score": competition_score,
                "opportunity_score": opportunity,
                "suggested_product": suggestion["product"],
                "suggested_material": suggestion["material"],
                "suggested_price_band": suggestion["price_band"],
                "suggestion_detail": suggestion,
                "lexicon_hits": lexicon_hits(term),
                "confidence": confidence,
                "method": "pinterest_keyword_metrics_v1",
                "evidence_pin_ids": [p["pin_id"] for p in
                                     sorted(r["pins"], key=lambda x: x.get("saves") or 0,
                                            reverse=True)[:3]],
            })

        out.sort(key=lambda x: (x["opportunity_score"], x["demand_score"]), reverse=True)
        return self._suppress_redundant(out, self.term_pins)[:top_n]

    # ---------------------------------------------------------- san pham

    def _classify_pin(self, pin: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Gan pin vao mot cum san pham (loai san pham + chat lieu) tu tu vung POD."""
        tokens = set(pin["clean_text"].split())
        product = sorted(tokens & POD_LEXICON["product"])
        material = sorted(tokens & POD_LEXICON["material"])
        if not product:
            return None
        ptype = product[0]
        mat = material[0] if material else "unspecified"
        return {
            "product_key": f"{ptype}|{mat}",
            "product_type": ptype,
            "material": mat,
            "display_name": f"{mat.title()} {ptype.title()}" if mat != "unspecified"
                            else ptype.title(),
        }

    def _catalog_for(self, product_type: str, material: str) -> Optional[Dict[str, Any]]:
        best, best_score = None, 0
        for entry in self.catalog:
            tokens = set()
            for kw in entry.get("keywords", []):
                tokens.update(kw.lower().split())
            tokens.update(entry.get("product_type", "").lower().split())
            tokens.update(entry.get("material", "").lower().split())
            score = (2 if product_type in tokens else 0) + (1 if material in tokens else 0)
            if score > best_score:
                best, best_score = entry, score
        return best if best_score >= 2 else None

    def product_metrics(self, window_days: int = 30, top_n: int = 10) -> List[Dict[str, Any]]:
        """
        Revenue / Quantity uoc luong theo ESTIMATION_MODEL.

        CANH BAO: Pinterest khong cong bo doanh so. Day la uoc luong tu engagement,
        dung de XEP HANG co hoi giua cac cum san pham, khong phai de bao cao tai chinh.
        """
        clusters: Dict[str, Dict[str, Any]] = {}
        for pin in self.pins:
            cls = self._classify_pin(pin)
            if not cls:
                continue
            c = clusters.setdefault(cls["product_key"], {**cls, "pins": []})
            c["pins"].append(pin)

        cps = ESTIMATION_MODEL["click_per_save"]
        cvr_table = ESTIMATION_MODEL["cvr_by_category"]

        out: List[Dict[str, Any]] = []
        for key, c in clusters.items():
            pins = c["pins"]
            if len(pins) < 2:
                continue

            catalog = self._catalog_for(c["product_type"], c["material"])
            category = catalog.get("category") if catalog else "default"
            cvr = cvr_table.get(category, cvr_table["default"])

            observed_prices = [p["price_value"] for p in pins if p.get("price_value")]
            price = _median(observed_prices)
            if price:
                price_source = ("product_pin"
                                if any(p.get("is_product_pin") for p in pins) else "text_parsed")
            elif catalog:
                price = catalog.get("avg_retail_price_usd")
                price_source = "printway_catalog"
            else:
                price = 19.99
                price_source = "global_default"

            windowed_saves = sum((p.get("saves") or 0) * window_factor(p["age_days"], window_days)
                                 for p in pins)
            est_clicks = windowed_saves * cps
            est_quantity = est_clicks * cvr
            est_revenue = est_quantity * (price or 0.0)

            dated_share = sum(1 for p in pins if p["_dated"]) / len(pins)
            priced_share = len(observed_prices) / len(pins)
            if len(pins) >= 8 and dated_share >= 0.5 and priced_share >= 0.3:
                confidence = "high"
            elif len(pins) >= 4 and (dated_share >= 0.3 or priced_share >= 0.1):
                confidence = "medium"
            else:
                confidence = "low"

            margin_pct = catalog.get("avg_margin_pct") if catalog else None
            out.append({
                "product": {
                    "product_key": key,
                    "display_name": c["display_name"],
                    "category": catalog.get("category") if catalog else None,
                    "product_type": catalog.get("product_type") if catalog else c["product_type"],
                    "material": catalog.get("material") if catalog else c["material"],
                    "representative_pin_id": max(pins, key=lambda p: p.get("saves") or 0)["pin_id"],
                    "image_url": max(pins, key=lambda p: p.get("saves") or 0).get("image_url"),
                },
                "window_days": window_days,
                "pin_count": len(pins),
                "total_saves": sum(p.get("saves") or 0 for p in pins),
                "windowed_saves": round(windowed_saves, 1),
                "avg_price_usd": round(price, 2) if price else None,
                "price_source": price_source,
                "est_clicks": round(est_clicks, 1),
                "est_quantity": round(est_quantity, 1),
                "est_revenue_usd": round(est_revenue, 2),
                "est_gross_profit_usd": (round(est_revenue * margin_pct / 100.0, 2)
                                         if margin_pct else None),
                "cvr_used": cvr,
                "click_per_save_used": cps,
                "confidence": confidence,
                "method": ESTIMATION_MODEL["name"],
            })

        out.sort(key=lambda x: x["est_revenue_usd"], reverse=True)
        return out[:top_n]

    # ----------------------------------------------------------- du bao

    def _weekly_velocity(self, weeks: int = 12) -> List[float]:
        """
        Chuoi toc do save theo tuan, dung lop pin theo ngay tao.

        velocity[k] = tong (saves / so ngay tuoi) cua nhung pin tao trong tuan thu k,
        don vi la saves/ngay (k = 0 la tuan xa nhat).

        Dung save-rate chu KHONG dung tong saves. Pin moi dang tuan chua kip tich saves,
        nen neu cong tong saves tho thi tuan nao cang gan hien tai cang thap, va mo hinh
        se luon ket luan "dang giam" du thi truong dang len. Chia cho tuoi pin loai bo
        dung cai thien lech do.
        """
        buckets = [0.0] * weeks
        for p in self.pins:
            if not p["_dated"]:
                continue
            idx = int(p["age_days"] // 7)
            if 0 <= idx < weeks:
                buckets[weeks - 1 - idx] += p["_save_rate"]
        return [round(b, 3) for b in buckets]

    @staticmethod
    def _holt_linear(series: List[float], horizon: int,
                     alpha: float = 0.5, beta: float = 0.3) -> Tuple[List[float], float]:
        """Holt linear trend - du bao co xu huong, khong can thu vien ngoai, deterministic."""
        clean = [v for v in series if v is not None]
        if len(clean) < 3:
            base = clean[-1] if clean else 0.0
            return [base] * horizon, 0.0
        level, trend = clean[0], clean[1] - clean[0]
        residuals: List[float] = []
        for value in clean[1:]:
            prev_level = level
            forecast = level + trend
            residuals.append(value - forecast)
            level = alpha * value + (1 - alpha) * (level + trend)
            trend = beta * (level - prev_level) + (1 - beta) * trend
        preds = [max(level + (h + 1) * trend, 0.0) for h in range(horizon)]
        if residuals:
            mean = sum(residuals) / len(residuals)
            std = math.sqrt(sum((r - mean) ** 2 for r in residuals) / len(residuals))
        else:
            std = 0.0
        return preds, std

    def forecast(self, horizon_days: int = 30) -> Dict[str, Any]:
        """
        Du bao 30 ngay cho ca thi truong dang xet.

        Cach lam: chuoi toc do save theo tuan -> Holt linear -> nhan he so mua vu cua
        thang dich. Khoang tin cay lay tu do lech chuan phan du cua chinh mo hinh.
        """
        weeks_ahead = max(int(round(horizon_days / 7.0)), 1)
        series = self._weekly_velocity(weeks=12)
        dated_pins = sum(1 for p in self.pins if p["_dated"])

        preds, resid_std = self._holt_linear(series, weeks_ahead)
        baseline = sum(series[-weeks_ahead:]) * 7.0 if any(series) else 0.0
        raw_forecast = sum(preds) * 7.0

        target_month = ((self.now.month - 1 + max(horizon_days // 30, 1)) % 12) + 1
        season = SEASONALITY_BY_MONTH.get(target_month, 1.0)
        current_season = SEASONALITY_BY_MONTH.get(self.now.month, 1.0)
        season_factor = round(season / current_season, 3)

        forecast_value = round(raw_forecast * season_factor, 1)
        band = round(resid_std * 7.0 * math.sqrt(weeks_ahead) * season_factor, 1)

        if baseline > 0:
            change_pct = round((forecast_value - baseline) / baseline * 100.0, 1)
        else:
            change_pct = None

        if change_pct is None:
            direction = "unknown"
        elif change_pct >= 15:
            direction = "tang manh"
        elif change_pct >= 5:
            direction = "tang nhe"
        elif change_pct > -5:
            direction = "di ngang"
        elif change_pct > -15:
            direction = "giam nhe"
        else:
            direction = "giam manh"

        if dated_pins >= 25 and sum(1 for v in series if v > 0) >= 6:
            confidence = "high"
        elif dated_pins >= 10:
            confidence = "medium"
        else:
            confidence = "low"

        cps = ESTIMATION_MODEL["click_per_save"]
        cvr = ESTIMATION_MODEL["cvr_by_category"]["default"]
        est_qty = round(forecast_value * cps * cvr, 1)

        return {
            "entity_type": "market",
            "entity_key": "pinterest_corpus",
            "snapshot_date": self.snapshot_date,
            "horizon_days": horizon_days,
            "weekly_series": series,
            "baseline_value": round(baseline, 1),
            "forecast_value": forecast_value,
            "lower_bound": round(max(forecast_value - band, 0.0), 1),
            "upper_bound": round(forecast_value + band, 1),
            "change_pct": change_pct,
            "direction": direction,
            "seasonality_factor": season_factor,
            "target_month": target_month,
            "est_quantity_in_horizon": est_qty,
            "dated_pins_used": dated_pins,
            "method": "holt_linear_trend + pod_seasonality_v1",
            "confidence": confidence,
            "unit": "saves du kien tich luy trong ky",
        }

    # --------------------------------------------------------- tong quan

    def market_summary(self) -> Dict[str, Any]:
        """So lieu nen cua ca corpus - dung lam bo so goc de kiem tra LLM khong bia so."""
        saves = [p.get("saves") or 0 for p in self.pins]
        prices = [p["price_value"] for p in self.pins if p.get("price_value")]
        dated = [p for p in self.pins if p["_dated"]]
        return {
            "snapshot_date": self.snapshot_date,
            "pin_count": len(self.pins),
            "total_saves": sum(saves),
            "median_saves": _median([float(s) for s in saves]),
            "max_saves": max(saves) if saves else 0,
            "dated_pin_count": len(dated),
            "product_pin_count": sum(1 for p in self.pins if p.get("is_product_pin")),
            "median_price_usd": round(_median(prices), 2) if prices else None,
            "distinct_boards": len({p.get("board_name") for p in self.pins if p.get("board_name")}),
            "distinct_domains": len({p.get("domain") for p in self.pins if p.get("domain")}),
            "median_age_days": round(_median([p["age_days"] for p in self.pins]) or 0.0, 1),
        }
