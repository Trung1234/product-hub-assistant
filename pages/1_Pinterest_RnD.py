"""
Dashboard Pinterest R&D (Streamlit multipage).

Chay cung app chinh:  streamlit run app.py  -> chon trang "Pinterest RnD" o sidebar.

Trang nay danh cho nguoi khong lam ky thuat: chon tu khoa, bam mot nut, doc ket qua.
Moi bang deu ghi ro con so nao la do dac va con so nao la uoc luong.
"""

import json
import os
import sys

import pandas as pd
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.agents.pinterest_analyst_agent import PinterestAnalystAgent
from src.analytics.pinterest_metrics import ESTIMATION_MODEL, MARKETPLACE_WINDOWS
from src.db.pinterest_db import PinterestDB
from src.pipeline.pinterest_pipeline import PinterestIngestPipeline

st.set_page_config(page_title="Pinterest R&D | Product Opportunity Hub",
                   page_icon="📌", layout="wide")

DB_PATH = os.getenv("PINTEREST_DB_PATH", "data/pinterest_rnd.db")
WINDOWS = MARKETPLACE_WINDOWS["pinterest"]


@st.cache_resource
def get_db() -> PinterestDB:
    return PinterestDB(DB_PATH)


db = get_db()

st.title("📌 Pinterest R&D — Product Opportunity Hub")
st.caption("Crawl Pinterest → lam sach → SQLite → AI agent tong hop. "
           "Moi con so trong bao cao deu truy nguoc duoc ve mot dong trong kho du lieu.")

# ------------------------------------------------------------------ sidebar
with st.sidebar:
    st.header("Nguon du lieu")
    run = db.latest_run()
    pin_count = db.count_pins()

    if run:
        status_icon = {"success": "✅", "partial": "⚠️", "blocked": "⛔", "failed": "❌"}
        st.metric("Pin trong kho", f"{pin_count:,}")
        st.write(f"{status_icon.get(run['status'], '•')} Lan chay gan nhat: "
                 f"**#{run['id']}** · `{run['status']}`")
        st.caption(f"Engine: `{run['engine']}` · luu {run['pins_stored']} · "
                   f"loai {run['pins_rejected']}")
        if run.get("notes"):
            st.caption(run["notes"])
    else:
        st.info("Kho chua co du lieu. Crawl hoac nap file mau ben duoi.")

    st.divider()
    st.subheader("Crawl moi")
    queries = st.text_area(
        "Tu khoa (moi dong mot tu khoa)",
        "personalized christmas ornament\ncustom acrylic plaque\nengraved tumbler",
        height=100,
    )
    engine = st.selectbox(
        "Che do trinh duyet", ["headless", "persistent", "cdp"],
        help="headless: khong dang nhap (bi chan neu IP xau) · "
             "persistent: mo trinh duyet de ban dang nhap mot lan · "
             "cdp: gan vao AdsPower / GoLogin dang mo san",
    )
    limit = st.slider("So pin toi da moi tu khoa", 20, 200, 60, step=20)

    if st.button("🚀 Crawl Pinterest", use_container_width=True, type="primary"):
        terms = [q.strip() for q in queries.splitlines() if q.strip()]
        with st.spinner(f"Dang crawl {len(terms)} tu khoa..."):
            result = PinterestIngestPipeline(db=db).run(terms, engine=engine,
                                                        per_query_limit=limit)
        if result["status"] == "blocked":
            st.error("Pinterest tra feed rong cho lan crawl nay.")
            st.caption(result.get("notes", ""))
        else:
            st.success(f"Luu {result['pins_stored']} pin "
                       f"(loai {result['pins_rejected']}).")
        st.rerun()

    st.divider()
    if st.button("📥 Nap corpus mau (de thu giao dien)", use_container_width=True):
        path = "data/seed/pinterest_sample_corpus.json"
        if os.path.exists(path):
            PinterestIngestPipeline(db=db).ingest_file(path, engine_label="fixture")
            st.warning("Da nap DU LIEU MO PHONG - chi de xem giao dien, "
                       "khong dung de ra quyet dinh.")
            st.rerun()
        else:
            st.error(f"Khong tim thay {path}. Chay: python tools_make_fixture_corpus.py")

# --------------------------------------------------------------------- body
if db.count_pins() == 0:
    st.info("Chua co pin nao trong kho. Dung khung ben trai de crawl hoac nap corpus mau.")
    st.stop()

col_a, col_b, col_c = st.columns([2, 2, 3])
with col_a:
    window = st.selectbox(
        "Cua so thoi gian", WINDOWS["options"],
        index=WINDOWS["options"].index(WINDOWS["default"]),
        format_func=lambda w: WINDOWS["labels"].get(w, f"{w} ngay"),
    )
with col_b:
    use_llm = st.toggle("Dung LLM viet dien giai", value=False,
                        help="Tat thi dung ban dien giai deterministic, khong goi API.")
with col_c:
    st.caption(f"**Vi sao la nhung moc nay?** {WINDOWS['rationale']}")

if st.button("📊 Sinh bao cao R&D", type="primary"):
    with st.spinner("Dang tinh chi so va tong hop..."):
        st.session_state["report"] = PinterestAnalystAgent(db=db).analyze(
            window_days=window, use_llm=use_llm)

report = st.session_state.get("report")
if not report:
    st.info("Bam **Sinh bao cao R&D** de chay phan tich.")
    st.stop()

if report.get("error"):
    st.error(report["error"])
    st.stop()

if report["data_mode"] == "SYNTHETIC_FIXTURE":
    st.warning("⚠️ Bao cao nay chay tren **du lieu mo phong**, khong phai du lieu Pinterest that.")
elif report["data_mode"] == "NO_LIVE_DATA":
    st.error("⛔ Lan crawl gan nhat bi Pinterest chan - so lieu ben duoi khong day du.")

st.info(f"**Revenue va Quantity la UOC LUONG** theo mo hinh "
        f"`{ESTIMATION_MODEL['name']}`: {ESTIMATION_MODEL['chain']}. "
        f"Pinterest khong cong bo doanh so that.")

summary = report["market_summary"]
m1, m2, m3, m4 = st.columns(4)
m1.metric("Pin phan tich", f"{summary['pin_count']:,}")
m2.metric("Tong saves", f"{summary['total_saves']:,}")
m3.metric("Pin co ngay tao", f"{summary['dated_pin_count']:,}",
          help="Growth va Forecast chi tinh duoc tren nhom nay.")
m4.metric("Product pin co gia", f"{summary['product_pin_count']:,}")

tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "1 · Top Keywords", "2 · Top Products", "3 · Key Insights",
    "4 · 30 Days Forecast", "5 · R&D Recommendation",
])

with tab1:
    rows = [{
        "Keyword": k["term"],
        "Demand": k["demand_score"],
        "Growth %": k["growth_pct"],
        "Collection": k["collection_count"],
        "Opportunity": k["opportunity_score"],
        "Pins": k["pin_count"],
        "Saves": k["total_saves"],
        "De xuat san pham": k["suggested_product"] or "—",
        "Gia de xuat": k["suggested_price_band"] or "—",
        "Tin cay": k["confidence"],
    } for k in report["top_keywords"]]
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True,
                 column_config={
                     "Demand": st.column_config.ProgressColumn(
                         "Demand", min_value=0, max_value=100, format="%.1f"),
                     "Opportunity": st.column_config.ProgressColumn(
                         "Opportunity", min_value=0, max_value=100, format="%.1f"),
                 })
    st.caption("Demand / Opportunity la thang 0-100 chuan hoa trong chinh corpus nay. "
               "Growth so sanh toc do tich luy saves cua pin moi voi pin cu.")

    if report.get("design_attributes"):
        st.subheader("Design attributes — huong tham my dang chay")
        st.caption("Day la tin hieu Pinterest manh hon moi san khac: khong phai "
                   "*ban cai gi* ma la *ve theo phong cach nao*.")
        st.dataframe(pd.DataFrame([{
            "Phong cach": d["term"],
            "Saves": d["total_saves"],
            "Pins": d["pin_count"],
            "Saves/pin": d["avg_saves_per_pin"],
            "Hop voi san pham": d["pairs_with_product"] or "—",
        } for d in report["design_attributes"]]),
            use_container_width=True, hide_index=True)

with tab2:
    st.caption(f"Cua so: **{report['window_label']}** · "
               f"click_per_save={ESTIMATION_MODEL['click_per_save']} · "
               "CVR theo nganh hang")
    st.dataframe(pd.DataFrame([{
        "San pham": p["product"]["display_name"],
        "Nganh hang": p["product"]["category"] or "—",
        "Revenue uoc luong (USD)": p["est_revenue_usd"],
        "Quantity uoc luong": p["est_quantity"],
        "Loi gop uoc luong (USD)": p["est_gross_profit_usd"],
        "Gia (USD)": p["avg_price_usd"],
        "Nguon gia": p["price_source"],
        "Pins": p["pin_count"],
        "Saves": p["total_saves"],
        "Tin cay": p["confidence"],
    } for p in report["top_products"]]), use_container_width=True, hide_index=True)
    with st.expander("Mo hinh uoc luong hoat dong the nao?"):
        st.json(ESTIMATION_MODEL)

with tab3:
    for ins in report["key_insights"]:
        st.subheader(ins.get("headline", ""))
        st.write(ins.get("detail", ""))
        if ins.get("so_what"):
            st.success(f"**Nen lam gi:** {ins['so_what']}")

with tab4:
    fc = report["forecast_30d"]
    f1, f2, f3 = st.columns(3)
    f1.metric("Nen hien tai", f"{fc['baseline_value']:,.0f}")
    f2.metric("Du bao 30 ngay", f"{fc['forecast_value']:,.0f}",
              delta=(f"{fc['change_pct']:+.1f}%" if fc.get("change_pct") is not None else None))
    f3.metric("He so mua vu", fc["seasonality_factor"])
    st.caption(f"Khoang tin cay: {fc['lower_bound']:,.0f} – {fc['upper_bound']:,.0f} "
               f"· don vi: {fc['unit']} · phuong phap `{fc['method']}` "
               f"· do tin cay **{fc['confidence']}** · dua tren {fc['dated_pins_used']} pin co ngay tao")
    if fc.get("weekly_series"):
        st.line_chart(pd.DataFrame({"saves/ngay theo lop pin": fc["weekly_series"]}))
    if report.get("forecast_narrative"):
        st.write(report["forecast_narrative"])

with tab5:
    rec = report.get("rd_recommendation") or {}
    if rec.get("priority_actions"):
        st.subheader("Viec uu tien")
        st.dataframe(pd.DataFrame(rec["priority_actions"]),
                     use_container_width=True, hide_index=True)
    if rec.get("products_to_launch"):
        st.subheader("San pham nen dung thu")
        st.dataframe(pd.DataFrame(rec["products_to_launch"]),
                     use_container_width=True, hide_index=True)
    if rec.get("risks"):
        st.subheader("Rui ro can luu y")
        for risk in rec["risks"]:
            st.warning(risk)

st.divider()
d1, d2 = st.columns(2)
d1.download_button("⬇️ Tai bao cao Markdown", report["markdown"],
                   file_name=f"pinterest_rnd_report_{report['window_days']}d.md",
                   use_container_width=True)
d2.download_button("⬇️ Tai du lieu JSON",
                   json.dumps({k: v for k, v in report.items() if k != "markdown"},
                              ensure_ascii=False, indent=2),
                   file_name=f"pinterest_rnd_report_{report['window_days']}d.json",
                   use_container_width=True)

if report.get("unverified_numbers"):
    st.error("Co con so trong phan dien giai khong doi chieu duoc voi du lieu goc: "
             + ", ".join(report["unverified_numbers"]))
st.caption(f"Dien giai boi: "
           f"{'LLM ' + report['model'] if report['llm_used'] else 'fallback deterministic'}"
           + (f" · {report['llm_error']}" if report.get("llm_error") else ""))
