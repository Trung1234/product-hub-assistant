"""
Tool Pinterest cho agent orchestrator.

Khac voi `fetch_pinterest_trend_signals` (tra ve kien thuc tham my dung san),
nhung tool o day doc **du lieu that da crawl va luu trong SQLite**. Moi con so tra ve
deu truy nguoc duoc ve mot dong trong bang `pins` / `keyword_metrics` / `product_metrics`.
"""

import json

from langchain_core.tools import tool

from src.agents.pinterest_analyst_agent import PinterestAnalystAgent
from src.analytics.pinterest_metrics import MARKETPLACE_WINDOWS
from src.db.pinterest_db import PinterestDB
from src.pipeline.pinterest_pipeline import PinterestIngestPipeline


def _db() -> PinterestDB:
    return PinterestDB()


@tool
def crawl_pinterest_keywords(queries: str, engine: str = "headless") -> str:
    """
    Crawl Pinterest cho mot hoac nhieu tu khoa (ngan cach bang dau phay) va nap vao kho SQLite.

    engine: 'headless' (mac dinh), 'persistent' (dang nhap mot lan), 'cdp' (gan vao
    trinh duyet anti-detect da mo). Tra ve thong ke lan chay, ke ca khi bi Pinterest chan.
    """
    terms = [q.strip() for q in queries.split(",") if q.strip()]
    if not terms:
        return "[PINTEREST:CRAWL] loi: khong co tu khoa nao."

    result = PinterestIngestPipeline(db=_db()).run(terms, engine=engine)
    line = (f"[PINTEREST:CRAWL] run={result['run_id']} status={result['status']} "
            f"seen={result['pins_seen']} stored={result['pins_stored']} "
            f"rejected={result['pins_rejected']}")
    if result["status"] == "blocked":
        line += f" | {result.get('notes', '')}"
    return line


@tool
def search_stored_pinterest_pins(query: str, limit: int = 10) -> str:
    """
    Tim pin da luu trong kho bang full-text search (FTS5). Dung de dan chung cu that
    cho mot nhan dinh, thay vi noi chung chung.
    """
    db = _db()
    try:
        pins = db.search_pins(query, limit=limit)
    except Exception as exc:
        return f"[PINTEREST:SEARCH] loi truy van: {exc}"
    if not pins:
        return f"[PINTEREST:SEARCH] khong tim thay pin nao khop '{query}' trong kho."
    rows = [f"  - [{p['saves']} saves] {(p['title'] or '')[:80]} | {p['pin_url']}"
            for p in pins]
    return f"[PINTEREST:SEARCH] q=\"{query}\" ({len(pins)} pin)\n" + "\n".join(rows)


@tool
def get_pinterest_top_keywords(window_days: int = 30, limit: int = 10) -> str:
    """
    Top keywords tu kho Pinterest kem Demand, Growth, Collection va de xuat san pham Printway.
    window_days hop le: 30, 90, 365.
    """
    from src.analytics.pinterest_metrics import PinterestMetricsEngine

    db = _db()
    pins = db.fetch_pins()
    if not pins:
        return "[PINTEREST:KEYWORDS] kho rong - chay crawl_pinterest_keywords truoc."

    metrics = PinterestMetricsEngine(pins).keyword_metrics(window_days=window_days, top_n=limit)
    rows = []
    for i, k in enumerate(metrics, 1):
        growth = "n/a" if k["growth_pct"] is None else f"{k['growth_pct']:+.1f}%"
        rows.append(
            f"  {i}. {k['term']} | Demand={k['demand_score']} | Growth={growth} "
            f"| Collection={k['collection_count']} | Opportunity={k['opportunity_score']} "
            f"| De xuat={k['suggested_product'] or 'n/a'} | tin cay={k['confidence']}"
        )
    return f"[PINTEREST:KEYWORDS] window={window_days}d\n" + "\n".join(rows)


@tool
def get_pinterest_top_products(window_days: int = 30, limit: int = 8) -> str:
    """
    Top products tu kho Pinterest kem Revenue va Quantity UOC LUONG theo cua so thoi gian.

    Luu y bat buoc neu khi tra loi nguoi dung: Pinterest khong cong bo doanh so,
    day la uoc luong tu engagement (saves -> clicks -> orders).
    """
    from src.analytics.pinterest_metrics import PinterestMetricsEngine

    db = _db()
    pins = db.fetch_pins()
    if not pins:
        return "[PINTEREST:PRODUCTS] kho rong - chay crawl_pinterest_keywords truoc."

    metrics = PinterestMetricsEngine(pins).product_metrics(window_days=window_days, top_n=limit)
    rows = []
    for i, m in enumerate(metrics, 1):
        rows.append(
            f"  {i}. {m['product']['display_name']} | Revenue~${m['est_revenue_usd']:,.2f} "
            f"| Quantity~{m['est_quantity']} | gia=${m['avg_price_usd']} "
            f"({m['price_source']}) | pins={m['pin_count']} | tin cay={m['confidence']}"
        )
    windows = ", ".join(f"{w}d" for w in MARKETPLACE_WINDOWS["pinterest"]["options"])
    return (f"[PINTEREST:PRODUCTS] window={window_days}d (kha dung: {windows}) "
            f"| UOC LUONG, khong phai doanh so that\n" + "\n".join(rows))


@tool
def generate_pinterest_rnd_report(window_days: int = 30) -> str:
    """
    Sinh bao cao R&D Pinterest day du 5 muc: Top Keywords, Top Products,
    Key Insights, 30 Days Forecast, R&D Recommendation. Tra ve Markdown.
    """
    report = PinterestAnalystAgent(db=_db()).analyze(window_days=window_days)
    if report.get("error"):
        return f"[PINTEREST:REPORT] {report['error']} {report.get('note', '')}"
    return report["markdown"]


@tool
def get_pinterest_data_status() -> str:
    """
    Cho biet kho Pinterest dang co gi: lan crawl gan nhat, so pin, che do du lieu.
    Dung tool nay TRUOC khi khang dinh bat cu dieu gi ve du lieu Pinterest.
    """
    db = _db()
    run = db.latest_run()
    count = db.count_pins()
    if not run:
        return f"[PINTEREST:STATUS] chua co lan crawl nao. So pin trong kho: {count}."
    return (f"[PINTEREST:STATUS] run #{run['id']} | engine={run['engine']} "
            f"| status={run['status']} | stored={run['pins_stored']} "
            f"| rejected={run['pins_rejected']} | tong pin trong kho={count} "
            f"| queries={run['seed_queries']}"
            + (f" | ghi chu: {run['notes']}" if run.get("notes") else ""))


PINTEREST_TOOLS = [
    get_pinterest_data_status,
    crawl_pinterest_keywords,
    search_stored_pinterest_pins,
    get_pinterest_top_keywords,
    get_pinterest_top_products,
    generate_pinterest_rnd_report,
]
