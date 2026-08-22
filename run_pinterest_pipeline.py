"""
Chay toan bo duong ong Pinterest tu dau den cuoi:

    crawl -> lam sach -> SQLite -> chi so -> AI agent -> bao cao Markdown/JSON

Vi du:

  # Crawl that (can mang khong bi Pinterest chan)
  python run_pinterest_pipeline.py --queries "personalized christmas ornament" "custom tumbler"

  # Dang nhap mot lan roi tai dung session do cho nhung lan sau
  python run_pinterest_pipeline.py --engine persistent --queries "acrylic ornament"

  # Gan vao trinh duyet anti-detect da mo (AdsPower / GoLogin / Chrome remote-debugging)
  python run_pinterest_pipeline.py --engine cdp --cdp-url http://127.0.0.1:9222 --queries "custom mug"

  # Khong crawl, chi phan tich lai kho da co
  python run_pinterest_pipeline.py --analyze-only --window 90

  # Nap lai mot file artifact da crawl truoc do
  python run_pinterest_pipeline.py --from-file data/pinterest_raw/xxx_raw.json
"""

import argparse
import json
import sys

from src.agents.pinterest_analyst_agent import PinterestAnalystAgent
from src.analytics.pinterest_metrics import MARKETPLACE_WINDOWS
from src.db.pinterest_db import PinterestDB
from src.pipeline.pinterest_pipeline import PinterestIngestPipeline

DEFAULT_QUERIES = [
    "personalized christmas ornament",
    "custom acrylic plaque",
    "engraved stainless steel tumbler",
    "embroidered mama sweatshirt",
    "custom pet portrait mug",
]


def main() -> int:
    # Console Windows mac dinh la cp1252, bao cao co ky tu tieng Viet se vo neu khong ep utf-8.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    ap = argparse.ArgumentParser(description="Pinterest R&D pipeline")
    ap.add_argument("--queries", nargs="*", default=DEFAULT_QUERIES,
                    help="Tu khoa can crawl")
    ap.add_argument("--engine", default="headless",
                    choices=["headless", "persistent", "cdp"],
                    help="headless: khong dang nhap | persistent: dang nhap mot lan "
                         "| cdp: gan vao trinh duyet anti-detect da mo")
    ap.add_argument("--cdp-url", default="", help="Vi du http://127.0.0.1:9222")
    ap.add_argument("--browser", default="msedge", choices=["msedge", "chrome", "chromium"],
                    help="Trinh duyet dung de crawl. msedge = Microsoft Edge da cai tren may "
                         "(mac dinh), chromium = ban di kem Playwright")
    ap.add_argument("--limit", type=int, default=60, help="So pin toi da moi tu khoa")
    ap.add_argument("--window", type=int, default=30,
                    choices=MARKETPLACE_WINDOWS["pinterest"]["options"],
                    help="Cua so thoi gian cho Top Products")
    ap.add_argument("--db", default="data/pinterest_rnd.db")
    ap.add_argument("--top-keywords", type=int, default=10)
    ap.add_argument("--top-products", type=int, default=8)
    ap.add_argument("--analyze-only", action="store_true", help="Bo qua buoc crawl")
    ap.add_argument("--from-file", default="", help="Nap lai artifact JSON da crawl")
    ap.add_argument("--no-llm", action="store_true", help="Chi dung dien giai deterministic")
    ap.add_argument("--login", action="store_true",
                    help="Mo trinh duyet de dang nhap Pinterest mot lan, roi thoat")
    ap.add_argument("--login-timeout", type=int, default=5,
                    help="So phut cho dang nhap (mac dinh 5)")
    ap.add_argument("--check-login", action="store_true",
                    help="Kiem tra profile da dang nhap Pinterest chua")
    args = ap.parse_args()

    channel = "" if args.browser == "chromium" else args.browser

    if args.check_login:
        from src.crawlers.pinterest_scraper import PinterestScraper

        st = PinterestScraper(engine="persistent", channel=channel).check_session()
        print(f"Profile           : {st['profile_dir']}")
        print(f"Cookie _auth      : {st['auth_cookie']!r}   (phai la '1' moi la da dang nhap)")
        print(f"is_authenticated  : {st['is_authenticated']}")
        print(f"Trang con nut Login: {st['shows_login_button']}")
        print(f"IP bi gan co bot   : {st['botspam_asn']}")
        print()
        print("DA DANG NHAP." if st["logged_in"] else
              "CHUA DANG NHAP - chay lai voi --login va hoan tat NGAY TRONG cua so do mo ra.")
        return 0 if st["logged_in"] else 1

    if args.login:
        from src.crawlers.pinterest_scraper import PinterestScraper

        info = PinterestScraper(engine="persistent",
                                channel=channel).open_login_session(args.login_timeout)
        if info["logged_in"]:
            print(f"Da dang nhap. Session luu tai: {info['profile_dir']}")
            print(f"Tu gio chay crawl voi:  --engine persistent --browser {args.browser}")
        else:
            print("Chua phat hien dang nhap (het thoi gian cho).")
            print("Chay lai lenh --login va hoan tat dang nhap trong cua so trinh duyet.")
        return 0 if info["logged_in"] else 1

    db = PinterestDB(args.db)
    pipeline = PinterestIngestPipeline(db=db)
    run_id = None

    # --------------------------------------------------------- 1. Nap du lieu
    if args.from_file:
        result = pipeline.ingest_file(args.from_file)
        run_id = result["run_id"]
    elif not args.analyze_only:
        scraper_kwargs = {"channel": channel}
        if args.cdp_url:
            scraper_kwargs["cdp_url"] = args.cdp_url
        result = pipeline.run(args.queries, engine=args.engine,
                              per_query_limit=args.limit, **scraper_kwargs)
        run_id = result["run_id"]

        if result["status"] == "blocked":
            print("\n" + "=" * 78)
            print("CRAWL BI CHAN — khong lay duoc pin nao.")
            print(result.get("notes") or "")
            print("Cach xu ly:")
            print(f"  1. python run_pinterest_pipeline.py --login --browser {args.browser}")
            print(f"     roi chay lai voi: --engine persistent --browser {args.browser}")
            print("  2. --engine cdp  -> gan vao Edge/Chrome/AdsPower dang mo cong debug")
            print("  3. Doi sang mang khac / proxy dan cu roi chay lai")
            print("=" * 78 + "\n")

        if result["pins_stored"] == 0:
            # Lan crawl nay khong ra pin nao. Neu kho da co du lieu tu truoc thi phan tich
            # tren toan kho, va noi ro la du lieu cu - im lang tra bao cao rong thi vo ich.
            run_id = None
            if db.count_pins():
                print(f"Lan crawl nay khong bo sung duoc pin nao. Phan tich tren "
                      f"{db.count_pins()} pin da co san trong kho (du lieu tu cac lan truoc).\n")

    if db.count_pins() == 0:
        print("Kho chua co pin nao. Chay lai voi --from-file hoac doi engine crawl.")
        return 1

    # ------------------------------------------------------ 2. Phan tich AI
    agent = PinterestAnalystAgent(db=db)
    report = agent.analyze(
        run_id=run_id,
        window_days=args.window,
        top_keywords=args.top_keywords,
        top_products=args.top_products,
        use_llm=not args.no_llm,
    )

    if report.get("error"):
        print(report["error"])
        return 1

    print("\n" + report["markdown"])
    print("\n" + "-" * 78)
    print(f"Markdown : {report['report_paths']['markdown']}")
    print(f"JSON     : {report['report_paths']['json']}")
    print(f"SQLite   : {args.db}  (report_id={report['report_id']})")
    print(f"Che do   : {report['data_mode']} | "
          f"dien giai: {'LLM ' + report['model'] if report['llm_used'] else 'deterministic'}")
    if report.get("unverified_numbers"):
        print(f"CANH BAO : co so chua doi chieu duoc voi evidence pack: "
              f"{', '.join(report['unverified_numbers'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
