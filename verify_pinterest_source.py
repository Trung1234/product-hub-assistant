"""
Kiem chung nguon goc du lieu trong kho Pinterest.

Tra loi cau hoi "lam sao biet du lieu nay that su crawl tu Pinterest?" bang bang chung
kiem tra duoc, khong phai bang loi khang dinh.

    PYTHONPATH=. python verify_pinterest_source.py            # kiem tra offline
    PYTHONPATH=. python verify_pinterest_source.py --live     # mo thu pin that bang trinh duyet
    PYTHONPATH=. python verify_pinterest_source.py --live --sample 5

Bon lop bang chung:
  1. Lich su lan chay  - engine nao, trang thai gi, file artifact tho nam o dau
  2. Dinh dang pin_id  - Pinterest dung ID so 15-20 chu so; fixture co tien to `fixture-`
  3. Ten mien tai nguyen - anh pin that luon nam tren i.pinimg.com
  4. Kiem tra live     - mo chinh URL pin do bang trinh duyet, xem co noi dung that khong
"""

import argparse
import json
import os
import re
import sys
from collections import Counter

from src.db.pinterest_db import PinterestDB

REAL_PIN_ID = re.compile(r"^\d{15,20}$")
PIN_URL = re.compile(r"^https://([a-z]{2,6}\.)?pinterest\.[a-z.]{2,6}/pin/\d+/?$")
IMAGE_HOST = re.compile(r"^https://i\.pinimg\.com/")


def line(char="-", width=78):
    print(char * width)


def verify_offline(db: PinterestDB) -> dict:
    print("=" * 78)
    print("KIEM CHUNG NGUON GOC DU LIEU PINTEREST")
    print("=" * 78)

    # ------------------------------------------------------ 1. lich su chay
    print("\n1. LICH SU CRAWL  (bang crawl_runs)")
    line()
    runs = [dict(r) for r in db.conn.execute(
        "SELECT * FROM crawl_runs ORDER BY id").fetchall()]
    if not runs:
        print("  Chua co lan chay nao.")
    for r in runs:
        queries = ", ".join(json.loads(r["seed_queries"] or "[]"))[:60]
        print(f"  run #{r['id']:<3} {r['started_at']}  engine={r['engine']}")
        print(f"          status={r['status']:8} seen={r['pins_seen']:<5} "
              f"stored={r['pins_stored']:<5} rejected={r['pins_rejected']}")
        print(f"          queries: {queries}")
        artifact = r["raw_artifact_path"] or ""
        exists = "co file" if artifact and os.path.exists(artifact) else "khong tim thay"
        print(f"          artifact tho: {artifact or '(khong co)'}  [{exists}]")
        if r["notes"]:
            print(f"          ghi chu: {r['notes'][:100]}")

    # ------------------------------------------------------- 2. phan loai
    print("\n2. PHAN LOAI PIN THEO NGUON  (bang pins)")
    line()
    pins = db.fetch_pins()
    if not pins:
        print("  Kho rong.")
        return {"verdict": "NO_DATA", "real": 0, "fixture": 0, "pins": []}

    real, fixture, unknown = [], [], []
    for p in pins:
        pid = str(p["pin_id"])
        if REAL_PIN_ID.match(pid):
            real.append(p)
        elif pid.startswith("fixture-"):
            fixture.append(p)
        else:
            unknown.append(p)

    quality = Counter(p["data_quality"] for p in pins)
    engines = Counter()
    for p in pins:
        run = db.get_run(p["run_id"]) if p["run_id"] else None
        engines[(run or {}).get("engine", "khong ro")] += 1

    print(f"  Tong so pin trong kho          : {len(pins)}")
    print(f"  Pin co ID that cua Pinterest   : {len(real)}")
    print(f"  Pin mo phong (tien to fixture-): {len(fixture)}")
    print(f"  Pin khong xac dinh             : {len(unknown)}")
    print(f"  Theo chat luong du lieu        : {dict(quality)}")
    print(f"  Theo engine da crawl           : {dict(engines)}")

    # ---------------------------------------------------- 3. dinh dang URL
    print("\n3. KIEM TRA DINH DANG  (pin that phai thoa ca ba)")
    line()
    checks = [
        ("pin_id la so 15-20 chu so", lambda p: bool(REAL_PIN_ID.match(str(p["pin_id"])))),
        ("pin_url tro ve pinterest.com", lambda p: bool(PIN_URL.match(p["pin_url"] or ""))),
        ("image_url nam tren i.pinimg.com", lambda p: bool(IMAGE_HOST.match(p["image_url"] or ""))),
    ]
    for label, fn in checks:
        passed = sum(1 for p in pins if fn(p))
        pct = passed / len(pins) * 100
        mark = "OK  " if pct >= 99 else ("MOT PHAN" if pct > 0 else "KHONG")
        print(f"  [{mark:8}] {label:34} {passed}/{len(pins)} ({pct:.0f}%)")

    # --------------------------------------------------- 4. mau tu kiem tra
    print("\n4. MAU DE BAN TU MO BANG TRINH DUYET")
    line()
    sample = (real or pins)[:5]
    for p in sample:
        tag = "THAT" if REAL_PIN_ID.match(str(p["pin_id"])) else "MO PHONG"
        print(f"  [{tag:8}] {p['pin_url']}")
        print(f"             saves={p['saves']:<7} \"{(p['title'] or '')[:56]}\"")
    if not real:
        print("\n  Chua co pin that nao trong kho - nhung URL tren la du lieu mo phong,")
        print("  mo ra se khong thay pin nao.")

    verdict = ("LIVE_PINTEREST" if real and not fixture else
               "MIXED" if real and fixture else
               "SYNTHETIC_FIXTURE")
    return {"verdict": verdict, "real": len(real), "fixture": len(fixture), "pins": real[:20]}


def verify_live(pins: list, sample_size: int) -> None:
    """
    Mo chinh nhung URL pin dang luu bang trinh duyet that va xem trang co noi dung khong.

    Day la lop bang chung manh nhat: neu pin ton tai that tren Pinterest, trang render ra
    se co the pin (og:title / noi dung). Neu kho chi chua du lieu mo phong, trang se rong.
    Luu ý: khi IP bi Pinterest chan, ke ca pin that cung co the render rong - luc do
    ket qua chi noi len tinh trang mang, khong ket luan duoc ve du lieu.
    """
    print("\n5. KIEM TRA LIVE  (mo tung URL bang Chromium)")
    line()
    if not pins:
        print("  Bo qua: khong co pin that nao de kiem tra.")
        return

    import asyncio
    from playwright.async_api import async_playwright

    targets = pins[:sample_size]

    async def run():
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            page = await (await browser.new_context(
                viewport={"width": 1280, "height": 800}, locale="en-US")).new_page()
            for p in targets:
                try:
                    await page.goto(p["pin_url"], wait_until="domcontentloaded", timeout=45000)
                    await page.wait_for_timeout(3500)
                    og = await page.evaluate(
                        "() => { const m = document.querySelector('meta[property=\"og:title\"]');"
                        " return m ? m.content : ''; }")
                    body_len = len(await page.inner_text("body"))
                    status = "CO NOI DUNG" if (og or body_len > 200) else "TRANG RONG"
                    print(f"  [{status:12}] {p['pin_url']}")
                    if og:
                        print(f"                 og:title = \"{og[:60]}\"")
                    print(f"                 kho luu   = \"{(p['title'] or '')[:60]}\"")
                except Exception as exc:
                    print(f"  [LOI        ] {p['pin_url']} -> {type(exc).__name__}: {exc}")
            await browser.close()

    asyncio.run(run())


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

    ap = argparse.ArgumentParser(description="Kiem chung nguon goc du lieu Pinterest")
    ap.add_argument("--db", default="data/pinterest_rnd.db")
    ap.add_argument("--live", action="store_true",
                    help="Mo thu pin bang trinh duyet de xac nhan pin ton tai that")
    ap.add_argument("--sample", type=int, default=3, help="So pin kiem tra live")
    args = ap.parse_args()

    db = PinterestDB(args.db)
    result = verify_offline(db)

    if args.live:
        verify_live(result["pins"], args.sample)

    print("\n" + "=" * 78)
    messages = {
        "LIVE_PINTEREST": "KET LUAN: kho chua du lieu Pinterest THAT.",
        "MIXED": (f"KET LUAN: kho TRON du lieu that ({result['real']} pin) va mo phong "
                  f"({result['fixture']} pin). Nen xoa DB va crawl lai truoc khi bao cao."),
        "SYNTHETIC_FIXTURE": ("KET LUAN: kho chi chua DU LIEU MO PHONG, chua co pin that nao. "
                              "Moi bao cao sinh ra tu day chi de kiem thu giao dien."),
        "NO_DATA": "KET LUAN: kho rong.",
    }
    print(messages[result["verdict"]])
    print("=" * 78)
    return 0 if result["verdict"] in ("LIVE_PINTEREST", "NO_DATA") else 2


if __name__ == "__main__":
    raise SystemExit(main())
