"""
Kiem thu duong ong Pinterest: lam sach -> DB -> chi so -> AI agent.

Chay:  PYTHONPATH=. python test_pinterest_pipeline.py

Khong dung pytest de dong bo voi cac script test san co trong repo.
Khong goi mang: toan bo test chay tren corpus co dinh trong bo nho.
"""

import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.agents.pinterest_analyst_agent import PinterestAnalystAgent
from src.analytics.pinterest_metrics import (
    PinterestMetricsEngine,
    WEIGHTS,
    window_factor,
)
from src.analytics.text_utils import clean_text, extract_ngrams, looks_like_spam, title_fingerprint
from src.crawlers.pinterest_scraper import (
    PinterestScraper,
    merge_pin_records,
    normalize_api_pin,
    normalize_dom_pin,
    upgrade_image_url,
)
from src.db.pinterest_db import PinterestDB
from src.pipeline.pinterest_pipeline import PinterestCleaner, PinterestIngestPipeline

NOW = datetime(2026, 8, 21, 12, 0, 0, tzinfo=timezone.utc)
PASSED, FAILED = [], []


def check(name: str, condition: bool, detail: str = ""):
    (PASSED if condition else FAILED).append(name)
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {name}" + (f" -> {detail}" if detail and not condition else ""))


def make_pin(pid: str, title: str, saves: int, age_days: float,
             price=None, board="Board A", creator="seller_1"):
    return {
        "pin_id": pid,
        "title": title,
        "description": title,
        "alt_text": "",
        "saves": saves,
        "comments": max(saves // 50, 0),
        "board_name": board,
        "creator": creator,
        "domain": "etsy.com",
        "price_value": price,
        "is_product_pin": 1 if price else 0,
        "created_at": (NOW - timedelta(days=age_days)).isoformat(timespec="seconds"),
        "collected_at": NOW.isoformat(timespec="seconds"),
        "data_quality": "rich_json",
    }


# Bien the tieu de - pin that tren Pinterest gan nhu khong bao gio trung tieu de tuyet doi.
VARIANTS = ["Minimalist", "Vintage", "Boho", "Rustic", "Modern", "Floral",
            "Retro", "Coastal", "Farmhouse", "Watercolor", "Scandinavian", "Botanical"]


def corpus():
    pins = []
    for i in range(12):
        pins.append(make_pin(
            f"orn-{i}", f"{VARIANTS[i]} Personalized Acrylic Ornament for Christmas",
            400 + i * 25, 5 + i * 2, price=17.99 if i % 2 else None,
            board=f"Ornament Board {i % 4}", creator=f"seller_{i % 5}"))
    for i in range(10):
        pins.append(make_pin(
            f"tmb-{i}", f"{VARIANTS[i]} Engraved Stainless Steel Tumbler for Birthday",
            120 + i * 10, 120 + i * 8, price=28.99 if i % 3 else None,
            board=f"Tumbler Board {i % 3}", creator=f"seller_{i % 4}"))
    for i in range(8):
        pins.append(make_pin(
            f"mug-{i}", f"{VARIANTS[i]} Custom Ceramic Mug Watercolor Pet Portrait",
            60 + i * 5, 200 + i * 10, price=15.99,
            board="Mug Board", creator=f"seller_{i % 3}"))
    return pins


# ---------------------------------------------------------------- 1. text
def test_text_utils():
    print("\n1. Lam sach text & trich xuat n-gram")
    check("clean_text bo url va emoji",
          clean_text("Custom Mug https://x.co 🎁 #handmade") == "custom mug handmade",
          clean_text("Custom Mug https://x.co 🎁 #handmade"))
    check("looks_like_spam bat pin rong",
          looks_like_spam({"title": "  ", "description": "", "alt_text": ""}))
    check("looks_like_spam giu pin that",
          not looks_like_spam({"title": "Personalized Acrylic Ornament", "description": ""}))
    grams = dict(extract_ngrams("personalized acrylic ornament for christmas"))
    check("n-gram khong bat dau/ket thuc bang stopword",
          "ornament for" not in grams and "for christmas" not in grams)
    check("n-gram giu cum co nghia", "acrylic ornament" in grams)
    check("fingerprint bo qua thu tu tu",
          title_fingerprint("Acrylic Custom Ornament") == title_fingerprint("Custom Ornament Acrylic"))


# -------------------------------------------------------------- 2. scraper
def test_scraper_normalizers():
    print("\n2. Chuan hoa du lieu crawler")
    check("nang do phan giai anh",
          upgrade_image_url("https://i.pinimg.com/236x/ab/cd.jpg")
          == "https://i.pinimg.com/736x/ab/cd.jpg")
    api = normalize_api_pin({
        "id": "123", "title": "Custom Ornament", "description": "d",
        "repin_count": 500, "comment_count": 4,
        "created_at": "Tue, 01 Oct 2024 12:00:00 +0000",
        "images": {"736x": {"url": "https://i.pinimg.com/736x/a.jpg"}},
        "board": {"name": "Xmas"}, "domain": "etsy.com",
        "rich_metadata": {"products": [{"offer": {"price_value": 19.99, "currency_code": "USD"}}]},
    }, "custom ornament")
    check("api pin lay dung saves", api["saves"] == 500, str(api["saves"]))
    check("api pin lay dung gia san pham",
          api["price_value"] == 19.99 and api["is_product_pin"] == 1)
    check("api pin parse duoc ngay tao", api["created_at"].startswith("2024-10-01"))

    dom = normalize_dom_pin({"href": "/pin/987/", "title": "DOM title",
                             "img": "https://i.pinimg.com/236x/b.jpg"}, "q")
    check("dom pin lay dung pin_id", dom["pin_id"] == "987")
    check("dom pin bi danh dau chat luong thap", dom["data_quality"] == "dom_only")

    merged = {p["pin_id"]: p for p in merge_pin_records([dom], [dict(api, pin_id="987")])}
    check("gop hai nguon giu chi so cua ban API", merged["987"]["saves"] == 500)
    check("gop hai nguon nang chat luong len", merged["987"]["data_quality"] == "rich_json")

    edge = PinterestScraper(channel="msedge")
    plain = PinterestScraper()
    check("chon dung trinh duyet Edge", edge._channel_kwargs() == {"channel": "msedge"})
    check("khong dat channel thi dung Chromium di kem",
          plain._channel_kwargs() == {})
    check("headless Edge phai ep UA Edge (khong de lo HeadlessChrome)",
          "Edg/" in (edge._user_agent(headless=True) or ""),
          str(edge._user_agent(headless=True)))
    check("che do co giao dien de trinh duyet tu khai bao UA that",
          edge._user_agent(headless=False) is None)
    check("Chromium tran van ep UA o ca hai che do",
          plain._user_agent(headless=True) == plain._user_agent(headless=False) is not None)


# --------------------------------------------------------------- 3. cleaner
def test_cleaner():
    print("\n3. Lam sach truoc khi vao kho")
    cleaner = PinterestCleaner()
    raw = [
        make_pin("a", "Personalized Acrylic Ornament", 100, 10),
        make_pin("a", "Personalized Acrylic Ornament", 50, 10),          # trung pin_id
        make_pin("b", "Acrylic Personalized Ornament", 30, 10),          # trung noi dung
        {"pin_id": "c", "title": "", "description": "", "saves": 5},     # rong
        {"pin_id": "", "title": "Custom Mug Ceramic", "saves": 5},       # thieu id
        make_pin("d", "個性的なアクリルオーナメント商品", 80, 10),          # khong phai chu Latin
        make_pin("e", "Custom Ceramic Mug Watercolor", 90, 10),
    ]
    kept, rejected = cleaner.clean(raw, run_id=1)
    ids = {p["pin_id"] for p in kept}
    reasons = {r["reason"].split(":")[0] for r in rejected}
    check("giu lai pin hop le", ids == {"a", "e"}, str(ids))
    check("ban trung pin_id giu ban saves cao hon",
          next(p for p in kept if p["pin_id"] == "a")["saves"] == 100)
    check("bat duoc trung noi dung khac id", "duplicate_content_of" in reasons, str(reasons))
    check("loai pin rong", "empty_or_spam_text" in reasons)
    check("loai pin thieu id", "missing_pin_id" in reasons)
    check("loai pin khong phai chu Latin", "non_latin_text" in reasons)
    check("moi pin bi loai deu co ly do", all(r["reason"] for r in rejected))


# -------------------------------------------------------------------- 4. DB
def test_db_roundtrip():
    print("\n4. Ghi va doc SQLite")
    path = os.path.join(tempfile.mkdtemp(), "t.db")
    db = PinterestDB(path)
    run_id = db.start_run("test_engine", ["kw"])
    pipeline = PinterestIngestPipeline(db=db)
    result = pipeline._store(run_id, corpus(), "success", "", "", {})

    check("ghi du so pin", result["pins_stored"] == 30, str(result["pins_stored"]))
    check("dem lai tu kho khop", db.count_pins() == 30)
    check("trang thai lan chay duoc luu", db.get_run(run_id)["status"] == "success")
    check("FTS tim duoc pin", len(db.search_pins("ornament")) == 12,
          str(len(db.search_pins("ornament"))))

    db.upsert_pins([dict(corpus()[0], saves=1)])
    top = db.conn.execute("SELECT saves FROM pins WHERE pin_id='orn-0'").fetchone()["saves"]
    check("ghi de khong lam tut saves", top == 400, str(top))
    db.close()


# ---------------------------------------------------------------- 5. metrics
def test_metrics():
    print("\n5. Engine chi so")
    check("trong so Opportunity cong lai bang 1.0", abs(sum(WEIGHTS.values()) - 1.0) < 1e-9)
    check("window_factor: pin tre hon cua so tinh tron", window_factor(10, 30) == 1.0)
    check("window_factor: pin gia hon chia theo ty le", window_factor(60, 30) == 0.5)
    check("window_factor: thieu tuoi thi dung mac dinh", window_factor(None, 30) == 0.1667)

    engine = PinterestMetricsEngine(corpus(), now=NOW)
    kws = engine.keyword_metrics(window_days=30, top_n=10, min_df=3)
    check("co tra ve tu khoa", len(kws) > 0, str(len(kws)))
    check("moi diem so nam trong 0-100",
          all(0 <= k["demand_score"] <= 100 and 0 <= k["opportunity_score"] <= 100 for k in kws))
    check("khong co diem NaN/None",
          all(k["opportunity_score"] == k["opportunity_score"] for k in kws))
    check("moi tu khoa co do tin cay",
          all(k["confidence"] in {"high", "medium", "low"} for k in kws))
    check("moi tu khoa co pin lam bang chung",
          all(k["evidence_pin_ids"] for k in kws))

    terms = {k["term"] for k in kws}
    check("tu khoa thuong mai co mat",
          any("ornament" in t or "tumbler" in t or "mug" in t for t in terms), str(terms))

    prods = engine.product_metrics(window_days=30, top_n=10)
    check("co tra ve san pham", len(prods) >= 2, str(len(prods)))
    check("Revenue khong am", all(p["est_revenue_usd"] >= 0 for p in prods))
    check("Quantity khong am", all(p["est_quantity"] >= 0 for p in prods))
    check("moi dong ghi ro mo hinh uoc luong",
          all(p["method"] == "pinterest_commerce_estimator_v1" for p in prods))
    check("moi dong ghi ro nguon gia",
          all(p["price_source"] in
              {"product_pin", "text_parsed", "printway_catalog", "global_default"}
              for p in prods))

    w30 = {p["product"]["product_key"]: p for p in engine.product_metrics(30, top_n=20)}
    w365 = {p["product"]["product_key"]: p for p in engine.product_metrics(365, top_n=20)}
    key = next(iter(w30))
    check("cua so rong hon cho Revenue lon hon",
          w365[key]["est_revenue_usd"] >= w30[key]["est_revenue_usd"],
          f"{w30[key]['est_revenue_usd']} vs {w365[key]['est_revenue_usd']}")

    fc = engine.forecast(30)
    check("du bao co du khoang tin cay",
          fc["lower_bound"] <= fc["forecast_value"] <= fc["upper_bound"],
          f"{fc['lower_bound']}/{fc['forecast_value']}/{fc['upper_bound']}")
    check("du bao ghi ro phuong phap va do tin cay",
          bool(fc["method"]) and fc["confidence"] in {"high", "medium", "low"})

    again = PinterestMetricsEngine(corpus(), now=NOW)
    check("chay lai cung moc thoi gian ra ket qua giong het",
          again.keyword_metrics(30, 10, 3) == kws)


# ------------------------------------------------------------------ 6. agent
def test_agent():
    print("\n6. AI agent tong hop bao cao")
    path = os.path.join(tempfile.mkdtemp(), "agent.db")
    db = PinterestDB(path)
    run_id = db.start_run("test_engine", ["kw"])
    PinterestIngestPipeline(db=db)._store(run_id, corpus(), "success", "", "", {})

    agent = PinterestAnalystAgent(db=db)
    report = agent.analyze(run_id=run_id, window_days=30, use_llm=False)

    for section in ["top_keywords", "top_products", "key_insights",
                    "forecast_30d", "rd_recommendation"]:
        check(f"bao cao co muc '{section}'", bool(report.get(section)))

    md = report["markdown"]
    for heading in ["1. Top Keywords", "2. Top Products", "3. Key Insights",
                    "4. 30 Days Forecast", "5. R&D Recommendation"]:
        check(f"markdown co tieu de '{heading}'", heading in md)

    check("markdown canh bao ro Revenue la uoc luong", "uoc luong" in md.lower())
    check("khong con so nao bia ra ngoai evidence pack",
          report["unverified_numbers"] == [], str(report["unverified_numbers"]))
    check("bao cao duoc luu vao SQLite", db.latest_report() is not None)
    check("bao cao ghi ra file", os.path.exists(report["report_paths"]["markdown"]))

    # Bay so bia: nhet mot con so khong co trong pack vao phan dien giai.
    fake = {"key_insights": [{"headline": "Doanh thu 999999 USD", "detail": "", "so_what": ""}]}
    facts = {"market_summary": {"pin_count": 30}}
    check("verify_numbers bat duoc so bia",
          "999999" in PinterestAnalystAgent.verify_numbers(fake, facts))
    check("verify_numbers khong bao dong gia voi so co that",
          PinterestAnalystAgent.verify_numbers(
              {"a": "co 30 pin"}, {"market_summary": {"pin_count": 30}}) == [])
    db.close()


# ------------------------------------------------------------ 7. kho rong
def test_empty_store():
    print("\n7. Kho rong thi bao cao noi thang, khong bia")
    path = os.path.join(tempfile.mkdtemp(), "empty.db")
    db = PinterestDB(path)
    report = PinterestAnalystAgent(db=db).analyze(use_llm=False)
    check("bao dung trang thai khong co du lieu", report["data_mode"] == "NO_DATA")
    check("khong tu sinh tu khoa gia", report["top_keywords"] == [])
    check("co thong bao loi ro rang", bool(report.get("error")))
    db.close()


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    print("=" * 74)
    print("KIEM THU DUONG ONG PINTEREST R&D")
    print("=" * 74)

    test_text_utils()
    test_scraper_normalizers()
    test_cleaner()
    test_db_roundtrip()
    test_metrics()
    test_agent()
    test_empty_store()

    print("\n" + "=" * 74)
    print(f"KET QUA: {len(PASSED)} pass / {len(FAILED)} fail")
    if FAILED:
        for name in FAILED:
            print(f"  - FAIL: {name}")
    print("=" * 74)
    raise SystemExit(1 if FAILED else 0)
