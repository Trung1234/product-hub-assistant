"""
AI Agent tong hop bao cao R&D tu kho du lieu Pinterest.

Phan cong ro rang giua may tinh va mo hinh:

  * SO LIEU  -> PinterestMetricsEngine tinh, deterministic, luu vao SQLite.
  * DIEN GIAI -> LLM viet, chi duoc dung lai nhung con so da co trong evidence pack.

Sau khi LLM tra loi, `verify_numbers()` quet lai toan bo van ban: con so nao khong
khop voi evidence pack se bi danh dau `unverified_numbers` va ghi thang vao bao cao.
Khong co API key thi agent van chay va tra ve ban dien giai deterministic.

Bao cao gom 5 muc theo dung yeu cau nghiep vu:
  1. Top Keywords  - Demand, Growth, Collection, De xuat san pham
  2. Top Products  - Revenue, Quantity (loc theo cua so thoi gian)
  3. Key Insights
  4. 30 Days Forecast
  5. R&D Recommendation
"""

import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.analytics.pinterest_metrics import (
    ESTIMATION_MODEL,
    MARKETPLACE_WINDOWS,
    PinterestMetricsEngine,
    WEIGHTS,
)
from src.config import MODEL_NAME, OPENAI_API_BASE, OPENAI_API_KEY
from src.db.pinterest_db import PinterestDB

REPORT_DIR = os.getenv("PINTEREST_REPORT_DIR", "data/reports")

SYSTEM_PROMPT = """Ban la Chief R&D Analyst cua mot xuong Print-on-Demand.
Ban nhan mot EVIDENCE PACK da duoc tinh san tu du lieu Pinterest that.

LUAT BAT BUOC:
1. CHI duoc dung nhung con so xuat hien trong evidence pack. Tuyet doi khong tu tinh
   ra con so moi, khong lam tron thanh so khac, khong bia ty le phan tram.
2. Revenue va Quantity trong pack la GIA TRI UOC LUONG tu engagement cua Pinterest,
   khong phai doanh so that. Khi nhac den chung phai goi la "uoc luong".
3. Viet bang tieng Viet, giong nguoi lam nghe noi voi dong nghiep: ngan, cu the,
   hanh dong duoc. Khong sao rong, khong marketing.
4. Neu du lieu khong du de ket luan mot y, hay noi thang la khong du du lieu.
5. Tra ve DUY NHAT mot JSON hop le theo schema duoc yeu cau, khong kem loi dan.
"""

RESPONSE_SCHEMA = """{
  "key_insights": [
    {"headline": "cau ngan", "detail": "2-3 cau giai thich, co dan so tu evidence pack",
     "so_what": "hanh dong rut ra"}
  ],
  "keyword_notes": {"<term>": "mot cau ve vi sao tu khoa nay dang chu y"},
  "forecast_narrative": "2-4 cau doc ket qua du bao 30 ngay va gioi han cua no",
  "rd_recommendation": {
    "priority_actions": [{"action": "viec can lam", "why": "ly do dua tren so lieu",
                          "owner_hint": "Design | Sourcing | Marketing", "timeline": "vd: tuan 1-2"}],
    "products_to_launch": [{"product": "ten san pham", "angle": "goc thiet ke / ca nhan hoa",
                            "price_point": "muc gia de xuat", "evidence": "dua tren chi so nao"}],
    "risks": ["rui ro cu the"]
  }
}"""


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _fmt(value: Any, digits: int = 1) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:,.{digits}f}"
    return f"{value:,}" if isinstance(value, int) else str(value)


class PinterestAnalystAgent:
    """Doc kho Pinterest -> tinh chi so -> nho LLM viet dien giai -> xuat bao cao."""

    def __init__(self, db: Optional[PinterestDB] = None, model: str = MODEL_NAME,
                 temperature: float = 0.2, timeout: float = 90.0):
        self.db = db or PinterestDB()
        self.model = model
        self.temperature = temperature
        self.timeout = timeout
        os.makedirs(REPORT_DIR, exist_ok=True)

    # ------------------------------------------------------------ main

    def analyze(self, run_id: Optional[int] = None, window_days: int = 30,
                top_keywords: int = 10, top_products: int = 8,
                min_df: int = 3, use_llm: bool = True) -> Dict[str, Any]:
        pins = self.db.fetch_pins(run_id=run_id)
        if not pins:
            return self._empty_report(run_id, window_days)

        engine = PinterestMetricsEngine(pins)
        summary = engine.market_summary()
        keywords = engine.keyword_metrics(window_days=window_days, top_n=top_keywords,
                                          min_df=min_df)
        design_attrs = engine.design_attributes(window_days=window_days, top_n=8, min_df=min_df)
        products = engine.product_metrics(window_days=window_days, top_n=top_products)
        forecast = engine.forecast(horizon_days=30)

        # Ghi chi so vao kho truoc khi goi LLM: so lieu phai ton tai doc lap voi mo hinh.
        effective_run_id = run_id or (self.db.latest_run() or {}).get("id") or 0
        self.db.save_keyword_metrics(effective_run_id, engine.snapshot_date, window_days, keywords)
        self.db.save_product_metrics(engine.snapshot_date, window_days, products)
        self.db.save_forecast(forecast)

        facts = self._build_evidence_pack(summary, keywords, products, forecast,
                                          design_attrs, window_days)
        narrative, llm_used, llm_error = self._synthesize(facts, use_llm=use_llm)
        unverified = self.verify_numbers(narrative, facts)

        data_mode = self._data_mode(pins, effective_run_id)
        payload = {
            "generated_at": _utc_now_iso(),
            "run_id": effective_run_id,
            "window_days": window_days,
            "window_label": MARKETPLACE_WINDOWS["pinterest"]["labels"].get(
                window_days, f"{window_days} ngay"),
            "data_mode": data_mode,
            "model": self.model,
            "market_summary": summary,
            "top_keywords": keywords,
            "top_products": products,
            "design_attributes": design_attrs,
            "forecast_30d": forecast,
            "key_insights": narrative.get("key_insights", []),
            "keyword_notes": narrative.get("keyword_notes", {}),
            "forecast_narrative": narrative.get("forecast_narrative", ""),
            "rd_recommendation": narrative.get("rd_recommendation", {}),
            "estimation_model": ESTIMATION_MODEL,
            "scoring_weights": WEIGHTS,
            "llm_used": llm_used,
            "llm_error": llm_error,
            "unverified_numbers": unverified,
        }

        markdown = self.render_markdown(payload)
        payload["report_id"] = self.db.save_report(
            run_id=effective_run_id, window_days=window_days, model=self.model,
            llm_used=llm_used, data_mode=data_mode, payload=payload, markdown=markdown,
        )
        payload["markdown"] = markdown
        payload["report_paths"] = self._write_files(payload, markdown)
        return payload

    # -------------------------------------------------- evidence pack

    def _build_evidence_pack(self, summary, keywords, products, forecast,
                             design_attrs, window_days: int) -> Dict[str, Any]:
        """Ban rut gon chi chua so lieu - day la thu duy nhat LLM duoc nhin thay."""
        return {
            "window_days": window_days,
            "window_rationale": MARKETPLACE_WINDOWS["pinterest"]["rationale"],
            "market_summary": summary,
            "top_keywords": [
                {
                    "term": k["term"],
                    "demand_score": k["demand_score"],
                    "growth_pct": k["growth_pct"],
                    "growth_method": k["growth_method"],
                    "collection_count": k["collection_count"],
                    "competition_score": k["competition_score"],
                    "opportunity_score": k["opportunity_score"],
                    "pin_count": k["pin_count"],
                    "total_saves": k["total_saves"],
                    "suggested_product": k["suggested_product"],
                    "suggested_price_band": k["suggested_price_band"],
                    "confidence": k["confidence"],
                }
                for k in keywords
            ],
            "top_products": [
                {
                    "display_name": p["product"]["display_name"],
                    "category": p["product"]["category"],
                    "est_revenue_usd": p["est_revenue_usd"],
                    "est_quantity": p["est_quantity"],
                    "avg_price_usd": p["avg_price_usd"],
                    "price_source": p["price_source"],
                    "pin_count": p["pin_count"],
                    "total_saves": p["total_saves"],
                    "confidence": p["confidence"],
                }
                for p in products
            ],
            "design_attributes": [
                {"term": d["term"], "total_saves": d["total_saves"],
                 "pin_count": d["pin_count"], "avg_saves_per_pin": d["avg_saves_per_pin"],
                 "pairs_with_product": d["pairs_with_product"]}
                for d in design_attrs
            ],
            "forecast_30d": {
                "baseline_value": forecast["baseline_value"],
                "forecast_value": forecast["forecast_value"],
                "lower_bound": forecast["lower_bound"],
                "upper_bound": forecast["upper_bound"],
                "change_pct": forecast["change_pct"],
                "direction": forecast["direction"],
                "seasonality_factor": forecast["seasonality_factor"],
                "confidence": forecast["confidence"],
                "unit": forecast["unit"],
            },
            "estimation_caveat": (
                "Revenue va Quantity la uoc luong theo chuoi saves -> clicks -> orders "
                f"(click_per_save={ESTIMATION_MODEL['click_per_save']}, "
                "cvr theo nganh hang). Pinterest khong cong bo doanh so that."
            ),
        }

    # ------------------------------------------------------ synthesize

    def _synthesize(self, facts: Dict[str, Any],
                    use_llm: bool = True) -> tuple[Dict[str, Any], bool, str]:
        if not use_llm or not OPENAI_API_KEY:
            reason = "use_llm=False" if not use_llm else "thieu OPENAI_API_KEY"
            return self._fallback_narrative(facts), False, reason
        try:
            from openai import OpenAI

            client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_API_BASE,
                            timeout=self.timeout)
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content":
                    "EVIDENCE PACK:\n"
                    + json.dumps(facts, ensure_ascii=False, indent=2)
                    + "\n\nTra ve JSON dung schema sau:\n" + RESPONSE_SCHEMA},
            ]
            content = self._call_with_fallbacks(client, messages)
            data = self._parse_json(content)
            if not isinstance(data, dict) or not data.get("key_insights"):
                raise ValueError("LLM tra ve JSON thieu key_insights")
            return data, True, ""
        except Exception as exc:
            return self._fallback_narrative(facts), False, f"{type(exc).__name__}: {exc}"

    def _call_with_fallbacks(self, client, messages) -> str:
        """
        Goi LLM va tu bo dan tham so ma endpoint khong chap nhan.

        Cac dong model suy luan (gpt-5.x, o-series) chi chap nhan temperature mac dinh,
        va mot so endpoint OpenAI-compatible khong ho tro response_format json_object.
        Thay vi hong ca lan chay, ta thu lai voi bo tham so hep dan.
        """
        attempts = [
            {"temperature": self.temperature, "response_format": {"type": "json_object"}},
            {"response_format": {"type": "json_object"}},
            {"temperature": self.temperature},
            {},
        ]
        last_error: Optional[Exception] = None
        for extra in attempts:
            try:
                resp = client.chat.completions.create(
                    model=self.model, messages=messages, **extra)
                return resp.choices[0].message.content or "{}"
            except Exception as exc:
                message = str(exc).lower()
                retriable = any(word in message for word in
                                ("temperature", "response_format", "unsupported", "invalid_request"))
                last_error = exc
                if not retriable:
                    raise
        raise last_error if last_error else RuntimeError("Goi LLM that bai khong ro ly do")

    @staticmethod
    def _parse_json(content: str) -> Any:
        """Mot so model boc JSON trong ```json ... ``` du da yeu cau tra JSON thuan."""
        text = (content or "").strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S).strip()
        return json.loads(text)

    def _fallback_narrative(self, facts: Dict[str, Any]) -> Dict[str, Any]:
        """Ban dien giai deterministic - chay duoc khi khong co LLM, van bam sat so lieu."""
        kws = facts["top_keywords"]
        prods = facts["top_products"]
        fc = facts["forecast_30d"]
        summary = facts["market_summary"]

        insights: List[Dict[str, str]] = []
        if kws:
            top = kws[0]
            insights.append({
                "headline": f"'{top['term']}' dan dau co hoi voi Opportunity {top['opportunity_score']}",
                "detail": (f"Tu khoa nay xuat hien o {top['pin_count']} pin, tong "
                           f"{top['total_saves']} saves, Demand {top['demand_score']}, "
                           f"Collection {top['collection_count']} board. "
                           f"Do tin cay: {top['confidence']}."),
                "so_what": (f"Uu tien test san pham: {top['suggested_product'] or 'chua map duoc catalog'}."),
            })
        risers = [k for k in kws if k.get("growth_pct") is not None and k["growth_pct"] > 20]
        if risers:
            r = max(risers, key=lambda k: k["growth_pct"])
            insights.append({
                "headline": f"'{r['term']}' dang tang toc {r['growth_pct']}%",
                "detail": (f"Toc do tich luy saves cua lop pin moi cao hon lop truoc "
                           f"{r['growth_pct']}% (phuong phap {r['growth_method']}), "
                           f"trong khi Competition moi o muc {r['competition_score']}."),
                "so_what": "Cua so vao som con mo - nen dung design truoc khi nguon cung bat kip.",
            })
        if prods:
            p = prods[0]
            insights.append({
                "headline": f"{p['display_name']} dan dau ve doanh thu uoc luong",
                "detail": (f"Uoc luong {p['est_revenue_usd']} USD tu {p['est_quantity']} don "
                           f"trong {facts['window_days']} ngay, gia tham chieu "
                           f"{p['avg_price_usd']} USD (nguon gia: {p['price_source']}). "
                           f"Do tin cay: {p['confidence']}."),
                "so_what": "Dung lam gia tri neo khi so sanh cac cum san pham voi nhau.",
            })
        insights.append({
            "headline": f"Corpus dang phan tich: {summary['pin_count']} pin, "
                        f"{summary['total_saves']} saves",
            "detail": (f"Trong do {summary['dated_pin_count']} pin co ngay tao (dung de tinh "
                       f"Growth va Forecast) va {summary['product_pin_count']} pin la product pin "
                       f"co gia that."),
            "so_what": "Ty le pin co ngay tao cang cao thi Growth va Forecast cang dang tin.",
        })

        return {
            "key_insights": insights,
            "keyword_notes": {
                k["term"]: (f"Demand {k['demand_score']}, Growth "
                            f"{'n/a' if k['growth_pct'] is None else str(k['growth_pct']) + '%'}, "
                            f"Collection {k['collection_count']}, "
                            f"de xuat: {k['suggested_product'] or 'chua map duoc catalog'}")
                for k in kws
            },
            "forecast_narrative": (
                f"Du bao 30 ngay: {fc['forecast_value']} {fc['unit']} "
                f"(khoang {fc['lower_bound']} - {fc['upper_bound']}), so voi nen "
                f"{fc['baseline_value']}. Xu huong: {fc['direction']}"
                + (f", thay doi {fc['change_pct']}%." if fc["change_pct"] is not None else ".")
                + f" He so mua vu ap dung: {fc['seasonality_factor']}. "
                f"Do tin cay {fc['confidence']} - du bao dua tren lop pin theo ngay tao, "
                "khong phai doanh so that."
            ),
            "rd_recommendation": {
                "priority_actions": [
                    {"action": f"Dung 3 concept design cho '{k['term']}'",
                     "why": (f"Opportunity {k['opportunity_score']}, Demand {k['demand_score']}, "
                             f"Competition {k['competition_score']}"),
                     "owner_hint": "Design", "timeline": "tuan 1-2"}
                    for k in kws[:3]
                ],
                "products_to_launch": [
                    {"product": k["suggested_product"] or k["term"],
                     "angle": k["term"],
                     "price_point": k["suggested_price_band"] or "theo catalog Printway",
                     "evidence": f"Opportunity {k['opportunity_score']} / {k['pin_count']} pin"}
                    for k in kws[:3] if k.get("suggested_product")
                ],
                "risks": [
                    "Revenue va Quantity la uoc luong tu engagement, khong phai doanh so that.",
                    f"Chi {summary['dated_pin_count']}/{summary['pin_count']} pin co ngay tao, "
                    "phan Growth va Forecast phu thuoc vao nhom nay.",
                ],
            },
        }

    # -------------------------------------------------- verification

    @staticmethod
    def verify_numbers(narrative: Dict[str, Any], facts: Dict[str, Any],
                       tolerance: float = 0.01) -> List[str]:
        """
        Quet moi con so trong phan dien giai, doi chieu voi evidence pack.

        Con so nao khong ton tai trong pack se duoc liet ke ra - chot chan cuoi cung
        chong viec mo hinh tu bia so lieu.
        """
        allowed: set = set()

        def collect(node: Any):
            if isinstance(node, dict):
                for v in node.values():
                    collect(v)
            elif isinstance(node, list):
                for v in node:
                    collect(v)
            elif isinstance(node, (int, float)) and not isinstance(node, bool):
                allowed.add(round(float(node), 2))
                allowed.add(round(abs(float(node)), 2))
            elif isinstance(node, str):
                for m in re.findall(r"-?\d+(?:[.,]\d+)?", node):
                    try:
                        allowed.add(round(float(m.replace(",", ".")), 2))
                    except ValueError:
                        pass

        collect(facts)
        allowed.update({float(y) for y in range(2020, 2036)})   # nam thang khong phai so lieu
        allowed.update({float(n) for n in range(0, 13)})        # so thu tu / thang / so nho

        text_parts: List[str] = []

        def gather(node: Any):
            if isinstance(node, dict):
                for k, v in node.items():
                    gather(k)
                    gather(v)
            elif isinstance(node, list):
                for v in node:
                    gather(v)
            elif isinstance(node, str):
                text_parts.append(node)

        gather(narrative)

        unverified: List[str] = []
        # `(?<![\w.,])` de "tuan 1-2" khong bi doc nham thanh so am -2.
        for token in re.findall(r"(?<![\w.,])-?\d[\d.,]*", " ".join(text_parts)):
            raw = token.rstrip(".,")
            try:
                value = float(raw.replace(",", ""))
            except ValueError:
                continue
            rounded = round(value, 2)
            if any(abs(rounded - a) <= max(tolerance, abs(a) * tolerance) for a in allowed):
                continue
            unverified.append(raw)
        return sorted(set(unverified))

    # ------------------------------------------------------- rendering

    def render_markdown(self, p: Dict[str, Any]) -> str:
        s = p["market_summary"]
        fc = p["forecast_30d"]
        lines: List[str] = []
        a = lines.append

        a("# Pinterest R&D Report — Product Opportunity Hub")
        a("")
        a(f"- **Snapshot**: {s['snapshot_date']} · **Cua so**: {p['window_label']} "
          f"· **Run**: #{p['run_id']}")
        a(f"- **Corpus**: {_fmt(s['pin_count'])} pin · {_fmt(s['total_saves'])} saves "
          f"· {_fmt(s['dated_pin_count'])} pin co ngay tao · "
          f"{_fmt(s['product_pin_count'])} product pin co gia")
        a(f"- **Che do du lieu**: `{p['data_mode']}` · "
          f"**Dien giai boi**: {'LLM ' + p['model'] if p.get('llm_used') else 'fallback deterministic'}")
        if p.get("llm_error"):
            a(f"- **Ghi chu LLM**: {p['llm_error']}")
        if p.get("unverified_numbers"):
            a(f"- ⚠️ **So chua doi chieu duoc**: {', '.join(p['unverified_numbers'])}")
        a("")
        a("> Revenue va Quantity duoi day la **uoc luong** tu engagement Pinterest "
          f"(mo hinh `{ESTIMATION_MODEL['name']}`), khong phai doanh so thuc te.")
        a("")

        a("## 1. Top Keywords")
        a("")
        a("| # | Keyword | Demand | Growth | Collection | Pins | Saves | De xuat san pham | Gia | Tin cay |")
        a("|---|---------|--------|--------|------------|------|-------|------------------|-----|---------|")
        for i, k in enumerate(p["top_keywords"], 1):
            growth = "n/a" if k["growth_pct"] is None else f"{k['growth_pct']:+.1f}%"
            a(f"| {i} | **{k['term']}** | {k['demand_score']} | {growth} | "
              f"{k['collection_count']} | {k['pin_count']} | {_fmt(k['total_saves'])} | "
              f"{k['suggested_product'] or '—'} | {k['suggested_price_band'] or '—'} | "
              f"{k['confidence']} |")
        a("")
        if p.get("keyword_notes"):
            for term, note in list(p["keyword_notes"].items())[:10]:
                a(f"- **{term}** — {note}")
            a("")

        if p.get("design_attributes"):
            a("### Design attributes — huong tham my dang chay")
            a("")
            a("*Day la tin hieu manh nhat cua Pinterest so voi cac san khac: khong phai "
              "\"ban cai gi\" ma la \"ve theo phong cach nao\".*")
            a("")
            a("| Phong cach | Saves | Pins | Saves/pin | Hop voi san pham |")
            a("|------------|-------|------|-----------|------------------|")
            for d in p["design_attributes"]:
                a(f"| **{d['term']}** | {_fmt(d['total_saves'])} | {d['pin_count']} | "
                  f"{_fmt(d['avg_saves_per_pin'])} | {d['pairs_with_product'] or '—'} |")
            a("")

        a(f"## 2. Top Products — cua so {p['window_label']}")
        a("")
        a("| # | San pham | Nganh hang | Revenue (uoc luong) | Quantity (uoc luong) | "
          "Gia | Nguon gia | Pins | Saves | Tin cay |")
        a("|---|----------|------------|--------------------|---------------------|-----|"
          "-----------|------|-------|---------|")
        for i, pr in enumerate(p["top_products"], 1):
            a(f"| {i} | **{pr['product']['display_name']}** | {pr['product']['category'] or '—'} | "
              f"${_fmt(pr['est_revenue_usd'], 2)} | {_fmt(pr['est_quantity'])} | "
              f"${_fmt(pr['avg_price_usd'], 2)} | {pr['price_source']} | {pr['pin_count']} | "
              f"{_fmt(pr['total_saves'])} | {pr['confidence']} |")
        a("")
        a(f"*Cua so kha dung cho Pinterest: "
          f"{', '.join(str(w) + 'd' for w in MARKETPLACE_WINDOWS['pinterest']['options'])}. "
          f"{MARKETPLACE_WINDOWS['pinterest']['rationale']}*")
        a("")

        a("## 3. Key Insights")
        a("")
        for ins in p["key_insights"]:
            a(f"### {ins.get('headline', '')}")
            a(ins.get("detail", ""))
            if ins.get("so_what"):
                a(f"**Nen lam gi:** {ins['so_what']}")
            a("")

        a("## 4. 30 Days Forecast")
        a("")
        a(f"- **Nen hien tai**: {_fmt(fc['baseline_value'])} {fc['unit']}")
        a(f"- **Du bao 30 ngay**: **{_fmt(fc['forecast_value'])}** "
          f"(khoang {_fmt(fc['lower_bound'])} – {_fmt(fc['upper_bound'])})")
        a(f"- **Xu huong**: {fc['direction']}"
          + (f" ({fc['change_pct']:+.1f}%)" if fc["change_pct"] is not None else ""))
        a(f"- **He so mua vu**: {fc['seasonality_factor']} (thang dich: {fc['target_month']})")
        a(f"- **Phuong phap**: `{fc['method']}` · do tin cay **{fc['confidence']}** "
          f"· dua tren {fc['dated_pins_used']} pin co ngay tao")
        a("")
        if p.get("forecast_narrative"):
            a(p["forecast_narrative"])
            a("")

        a("## 5. R&D Recommendation")
        a("")
        rec = p.get("rd_recommendation") or {}
        if rec.get("priority_actions"):
            a("### Viec uu tien")
            a("")
            a("| Viec | Ly do | Bo phan | Thoi gian |")
            a("|------|-------|---------|-----------|")
            for act in rec["priority_actions"]:
                a(f"| {act.get('action', '')} | {act.get('why', '')} | "
                  f"{act.get('owner_hint', '—')} | {act.get('timeline', '—')} |")
            a("")
        if rec.get("products_to_launch"):
            a("### San pham nen dung thu")
            a("")
            for item in rec["products_to_launch"]:
                a(f"- **{item.get('product', '')}** — goc: {item.get('angle', '')} · "
                  f"gia: {item.get('price_point', '')} · can cu: {item.get('evidence', '')}")
            a("")
        if rec.get("risks"):
            a("### Rui ro can luu y")
            a("")
            for risk in rec["risks"]:
                a(f"- {risk}")
            a("")

        a("---")
        a(f"*Sinh luc {p['generated_at']} · mo hinh chi so `pinterest_keyword_metrics_v1` "
          f"· mo hinh uoc luong `{ESTIMATION_MODEL['name']}` "
          f"· trong so Opportunity {json.dumps(WEIGHTS)}*")
        return "\n".join(lines)

    # ----------------------------------------------------------- utils

    def _data_mode(self, pins: List[Dict[str, Any]], run_id: int) -> str:
        run = self.db.get_run(run_id) or {}
        engine = (run.get("engine") or "").lower()
        if "fixture" in engine or any(str(p.get("pin_id", "")).startswith("fixture-") for p in pins):
            return "SYNTHETIC_FIXTURE"
        if run.get("status") == "blocked":
            return "NO_LIVE_DATA"
        return "LIVE_PINTEREST"

    def _empty_report(self, run_id: Optional[int], window_days: int) -> Dict[str, Any]:
        run = self.db.get_run(run_id) if run_id else self.db.latest_run()
        note = (run or {}).get("notes") or "Kho chua co pin nao."
        return {
            "generated_at": _utc_now_iso(),
            "run_id": run_id,
            "window_days": window_days,
            "data_mode": "NO_DATA",
            "error": "Khong co pin nao trong kho de phan tich.",
            "note": note,
            "top_keywords": [], "top_products": [], "key_insights": [],
            "forecast_30d": {}, "rd_recommendation": {},
            "markdown": f"# Pinterest R&D Report\n\nKhong co du lieu de phan tich.\n\n{note}\n",
        }

    def _write_files(self, payload: Dict[str, Any], markdown: str) -> Dict[str, str]:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        md_path = os.path.join(REPORT_DIR, f"pinterest_rnd_report_{stamp}.md")
        js_path = os.path.join(REPORT_DIR, f"pinterest_rnd_report_{stamp}.json")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(markdown)
        with open(js_path, "w", encoding="utf-8") as f:
            json.dump({k: v for k, v in payload.items() if k != "markdown"},
                      f, indent=2, ensure_ascii=False)
        return {"markdown": os.path.abspath(md_path), "json": os.path.abspath(js_path)}
