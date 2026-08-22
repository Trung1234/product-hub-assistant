"""
Pipeline Pinterest: crawl -> lam sach -> chuan hoa -> ghi vao SQLite.

Tach lam hai lop de test duoc rieng:
  * PinterestCleaner        - thuan ham, khong cham mang, khong cham DB.
  * PinterestIngestPipeline - dieu phoi crawler + cleaner + DB.
"""

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from src.analytics.text_utils import clean_text, is_latin_text, looks_like_spam, title_fingerprint
from src.db.pinterest_db import PinterestDB

# Domain rac hay bam vao pin - loai truoc khi vao kho.
BLOCKED_DOMAINS = {"bit.ly", "tinyurl.com", "linktr.ee", "t.co", "shorturl.at"}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class PinterestCleaner:
    """
    Lam sach corpus pin truoc khi ghi vao DB.

    Tra ve ca danh sach bi loai kem ly do - de con so "pins_rejected" trong bao cao
    truy nguoc duoc, thay vi bien mat im lang.
    """

    def __init__(self, min_saves: int = 0, blocked_domains: Optional[set] = None):
        self.min_saves = min_saves
        self.blocked_domains = blocked_domains or BLOCKED_DOMAINS

    def clean(self, pins: List[Dict[str, Any]],
              run_id: Optional[int] = None) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        kept: Dict[str, Dict[str, Any]] = {}
        by_fingerprint: Dict[str, str] = {}
        rejected: List[Dict[str, Any]] = []

        def reject(pin: Dict[str, Any], reason: str):
            rejected.append({"pin_id": pin.get("pin_id"), "reason": reason,
                             "title": (pin.get("title") or "")[:80]})

        for pin in pins:
            pin_id = str(pin.get("pin_id") or "").strip()
            if not pin_id:
                reject(pin, "missing_pin_id")
                continue

            # Kiem tra ngon ngu trên text GOC, truoc khi clean_text kip cat het ky tu
            # ngoai bang chu Latin - neu lam nguoc lai thi pin tieng Nhat/Nga se bi ghi
            # nham ly do la "rong", che mat van de that.
            raw_text = " ".join(filter(None, [pin.get("title"), pin.get("description"),
                                              pin.get("alt_text")]))
            if raw_text.strip() and not is_latin_text(raw_text):
                reject(pin, "non_latin_text")
                continue

            if looks_like_spam(pin):
                reject(pin, "empty_or_spam_text")
                continue

            text = clean_text(pin.get("title") or "", pin.get("description") or "",
                              pin.get("alt_text") or "")

            domain = (pin.get("domain") or "").lower().strip()
            if not domain and pin.get("outbound_link"):
                try:
                    domain = (urlparse(pin["outbound_link"]).netloc or "").lower()
                except ValueError:
                    domain = ""
            domain = domain.replace("www.", "")
            if domain in self.blocked_domains:
                reject(pin, f"blocked_domain:{domain}")
                continue

            saves = int(pin.get("saves") or 0)
            if saves < self.min_saves:
                reject(pin, f"below_min_saves:{saves}")
                continue

            record = dict(pin)
            record.update({
                "pin_id": pin_id,
                "run_id": run_id,
                "clean_text": text,
                "domain": domain,
                "saves": saves,
                "comments": int(pin.get("comments") or 0),
                "reactions": int(pin.get("reactions") or 0),
                "is_product_pin": int(pin.get("is_product_pin") or 0),
                "collected_at": pin.get("collected_at") or _utc_now_iso(),
                "age_days": self._age_days(pin),
            })
            record.setdefault("data_quality", "partial")
            if isinstance(record.get("raw_json"), (dict, list)):
                record["raw_json"] = json.dumps(record["raw_json"], ensure_ascii=False)[:20000]

            # Chong trung noi dung: cung mot nguoi ban dang lai mot listing thanh nhieu pin.
            #
            # Van tay co gan nguoi dang (hoac domain) vao. Hai seller khac nhau cung dat
            # tieu de giong het la chuyen binh thuong tren Pinterest, va do chinh la tin hieu
            # canh tranh ma bao cao can do - gop chung lai se lam mat tin hieu do.
            owner = record.get("creator") or record.get("domain") or ""
            base_fp = title_fingerprint(record.get("title") or text)
            fp = f"{base_fp}::{owner}" if base_fp else ""
            if fp:
                twin_id = by_fingerprint.get(fp)
                if twin_id and twin_id in kept:
                    if record["saves"] <= kept[twin_id]["saves"]:
                        reject(pin, f"duplicate_content_of:{twin_id}")
                        continue
                    reject(kept.pop(twin_id), f"duplicate_content_of:{pin_id}")
                by_fingerprint[fp] = pin_id

            existing = kept.get(pin_id)
            if existing and existing["saves"] >= record["saves"]:
                reject(pin, "duplicate_pin_id")
                continue
            kept[pin_id] = record

        return list(kept.values()), rejected

    @staticmethod
    def _age_days(pin: Dict[str, Any]) -> Optional[float]:
        created = pin.get("created_at")
        if not created:
            return pin.get("age_days")
        try:
            dt = datetime.fromisoformat(created)
        except (TypeError, ValueError):
            return pin.get("age_days")
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return round(max((datetime.now(timezone.utc) - dt).total_seconds() / 86400.0, 0.0), 2)


class PinterestIngestPipeline:
    """Chay worker crawl, lam sach ket qua, ghi vao SQLite va tra ve thong ke lan chay."""

    def __init__(self, db: Optional[PinterestDB] = None, cleaner: Optional[PinterestCleaner] = None):
        self.db = db or PinterestDB()
        self.cleaner = cleaner or PinterestCleaner()

    def run(self, queries: List[str], engine: str = "headless",
            per_query_limit: int = 60, **scraper_kwargs) -> Dict[str, Any]:
        """Crawl truc tiep tu Pinterest roi nap vao kho."""
        from src.crawlers.pinterest_scraper import PinterestScraper

        run_id = self.db.start_run(engine=engine, seed_queries=queries)
        print(f"[Pinterest] Bat dau run #{run_id} | engine={engine} | {len(queries)} tu khoa")

        scraper = PinterestScraper(engine=engine, **scraper_kwargs)
        result = scraper.scrape_queries(queries, per_query_limit=per_query_limit)

        return self._store(run_id, result.get("pins", []), status_hint=result.get("status"),
                           raw_path=result.get("raw_artifact_path", ""),
                           notes=result.get("block_reason", ""),
                           extra={"engine": engine, "elapsed_sec": result.get("elapsed_sec"),
                                  "per_query": result.get("per_query", [])})

    def ingest_file(self, path: str, engine_label: str = "file_replay") -> Dict[str, Any]:
        """
        Nap lai mot file artifact da co (data/pinterest_raw/*.json hoac corpus mau).

        Dung khi can chay lai phan phan tich ma khong crawl lai, hoac khi mang bi chan.
        """
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)

        pins = payload.get("pins", payload if isinstance(payload, list) else [])
        queries = payload.get("queries", []) if isinstance(payload, dict) else []
        engine = payload.get("engine", engine_label) if isinstance(payload, dict) else engine_label

        run_id = self.db.start_run(engine=f"{engine_label}:{engine}", seed_queries=queries)
        print(f"[Pinterest] Nap lai run #{run_id} tu {path} ({len(pins)} pin)")
        return self._store(run_id, pins, status_hint="success" if pins else "failed",
                           raw_path=os.path.abspath(path), notes=f"replay from {path}",
                           extra={"engine": engine})

    def _store(self, run_id: int, pins: List[Dict[str, Any]], status_hint: str,
               raw_path: str, notes: str, extra: Dict[str, Any]) -> Dict[str, Any]:
        kept, rejected = self.cleaner.clean(pins, run_id=run_id)
        stored = self.db.upsert_pins(kept) if kept else 0

        if status_hint == "blocked":
            status = "blocked"
        elif stored and rejected:
            status = "partial"
        elif stored:
            status = "success"
        else:
            status = "failed"

        self.db.finish_run(run_id, status=status, pins_seen=len(pins), pins_stored=stored,
                           pins_rejected=len(rejected), raw_artifact_path=raw_path, notes=notes)

        reason_counts: Dict[str, int] = {}
        for r in rejected:
            key = r["reason"].split(":")[0]
            reason_counts[key] = reason_counts.get(key, 0) + 1

        print(f"[Pinterest] run #{run_id} -> {status}: {stored} pin luu kho, "
              f"{len(rejected)} pin bi loai {reason_counts or ''}")

        return {
            "run_id": run_id,
            "status": status,
            "pins_seen": len(pins),
            "pins_stored": stored,
            "pins_rejected": len(rejected),
            "rejection_reasons": reason_counts,
            "rejected_sample": rejected[:10],
            "raw_artifact_path": raw_path,
            "notes": notes,
            **extra,
        }
