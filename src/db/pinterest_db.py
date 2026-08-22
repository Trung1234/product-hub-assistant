import os
import json
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

DEFAULT_DB_PATH = os.getenv("PINTEREST_DB_PATH", "data/pinterest_rnd.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "schema.sql")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class PinterestDB:
    """
    Tang luu tru SQLite cho pipeline Pinterest R&D.

    Pin tho da lam sach nam o bang `pins`, chi so tinh toan nam o `keyword_metrics` /
    `product_metrics` / `forecasts`, ban tong hop cua AI agent nam o `analysis_reports`.
    Moi so trong bao cao deu truy nguoc duoc ve mot dong trong nhung bang nay.
    """

    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self._init_schema()

    def _init_schema(self):
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            self.conn.executescript(f.read())
        self.conn.commit()

    def close(self):
        self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    # ---------------------------------------------------------------- runs

    def start_run(self, engine: str, seed_queries: List[str]) -> int:
        cur = self.conn.execute(
            "INSERT INTO crawl_runs (source, engine, seed_queries, started_at, status) "
            "VALUES ('pinterest', ?, ?, ?, 'running')",
            (engine, json.dumps(seed_queries, ensure_ascii=False), utc_now()),
        )
        self.conn.commit()
        return int(cur.lastrowid)

    def finish_run(self, run_id: int, status: str, pins_seen: int, pins_stored: int,
                   pins_rejected: int, raw_artifact_path: str = "", notes: str = ""):
        self.conn.execute(
            "UPDATE crawl_runs SET finished_at=?, status=?, pins_seen=?, pins_stored=?, "
            "pins_rejected=?, raw_artifact_path=?, notes=? WHERE id=?",
            (utc_now(), status, pins_seen, pins_stored, pins_rejected,
             raw_artifact_path, notes, run_id),
        )
        self.conn.commit()

    def get_run(self, run_id: int) -> Optional[Dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM crawl_runs WHERE id=?", (run_id,)).fetchone()
        return dict(row) if row else None

    def latest_run(self) -> Optional[Dict[str, Any]]:
        row = self.conn.execute("SELECT * FROM crawl_runs ORDER BY id DESC LIMIT 1").fetchone()
        return dict(row) if row else None

    # ---------------------------------------------------------------- pins

    PIN_COLUMNS = [
        "pin_id", "run_id", "query_seed", "title", "description", "alt_text", "clean_text",
        "pin_url", "image_url", "outbound_link", "domain", "board_name", "creator",
        "saves", "comments", "reactions", "is_product_pin", "price_value", "price_currency",
        "dominant_color", "created_at", "age_days", "collected_at", "data_quality", "raw_json",
    ]

    def upsert_pins(self, pins: Iterable[Dict[str, Any]]) -> int:
        """
        Ghi pin da lam sach. Trung pin_id thi gop thay vi ghi de:
        saves/comments chi tang theo thoi gian nen lay MAX de khong tut nguoc chi so.
        """
        placeholders = ", ".join(["?"] * len(self.PIN_COLUMNS))
        updates = ", ".join(
            "{c}=excluded.{c}".format(c=c) for c in self.PIN_COLUMNS
            if c not in ("pin_id", "saves", "comments")
        )
        sql = (
            "INSERT INTO pins (" + ", ".join(self.PIN_COLUMNS) + ") "
            "VALUES (" + placeholders + ") "
            "ON CONFLICT(pin_id) DO UPDATE SET " + updates + ", "
            "saves=MAX(pins.saves, excluded.saves), "
            "comments=MAX(pins.comments, excluded.comments)"
        )
        written = 0
        for pin in pins:
            self.conn.execute(sql, [pin.get(c) for c in self.PIN_COLUMNS])
            self.conn.execute("DELETE FROM pins_fts WHERE pin_id=?", (pin["pin_id"],))
            self.conn.execute(
                "INSERT INTO pins_fts (pin_id, clean_text) VALUES (?, ?)",
                (pin["pin_id"], pin.get("clean_text") or ""),
            )
            written += 1
        self.conn.commit()
        return written

    def fetch_pins(self, run_id: Optional[int] = None,
                   max_age_days: Optional[float] = None) -> List[Dict[str, Any]]:
        sql = "SELECT * FROM pins"
        where, args = [], []
        if run_id is not None:
            where.append("run_id = ?")
            args.append(run_id)
        if max_age_days is not None:
            where.append("(age_days IS NULL OR age_days <= ?)")
            args.append(max_age_days)
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY saves DESC"
        return [dict(r) for r in self.conn.execute(sql, args).fetchall()]

    def search_pins(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Tim pin bang FTS5 - dung cho tool cua agent va cho UI."""
        rows = self.conn.execute(
            "SELECT p.* FROM pins_fts f JOIN pins p ON p.pin_id = f.pin_id "
            "WHERE pins_fts MATCH ? ORDER BY p.saves DESC LIMIT ?",
            (query, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def count_pins(self) -> int:
        return int(self.conn.execute("SELECT COUNT(*) c FROM pins").fetchone()["c"])

    # ------------------------------------------------------------ keywords

    def upsert_keyword(self, term: str, ngram: int) -> int:
        now = utc_now()
        self.conn.execute(
            "INSERT INTO keywords (term, ngram, first_seen, last_seen) VALUES (?,?,?,?) "
            "ON CONFLICT(term) DO UPDATE SET last_seen=excluded.last_seen",
            (term, ngram, now, now),
        )
        return int(self.conn.execute("SELECT id FROM keywords WHERE term=?", (term,)).fetchone()["id"])

    def save_keyword_metrics(self, run_id: int, snapshot_date: str,
                             window_days: int, metrics: List[Dict[str, Any]]):
        for m in metrics:
            kid = self.upsert_keyword(m["term"], m.get("ngram", 1))
            self.conn.execute(
                "INSERT INTO keyword_metrics (keyword_id, run_id, snapshot_date, window_days, "
                "pin_count, total_saves, total_comments, demand_score, demand_raw, growth_pct, "
                "growth_score, collection_count, collection_score, competition_score, "
                "opportunity_score, suggested_product, suggested_material, suggested_price_band, "
                "confidence, method) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(keyword_id, snapshot_date, window_days) DO UPDATE SET "
                "pin_count=excluded.pin_count, total_saves=excluded.total_saves, "
                "total_comments=excluded.total_comments, demand_score=excluded.demand_score, "
                "demand_raw=excluded.demand_raw, growth_pct=excluded.growth_pct, "
                "growth_score=excluded.growth_score, collection_count=excluded.collection_count, "
                "collection_score=excluded.collection_score, "
                "competition_score=excluded.competition_score, "
                "opportunity_score=excluded.opportunity_score, "
                "suggested_product=excluded.suggested_product, "
                "suggested_material=excluded.suggested_material, "
                "suggested_price_band=excluded.suggested_price_band, "
                "confidence=excluded.confidence, method=excluded.method",
                (kid, run_id, snapshot_date, window_days, m.get("pin_count"),
                 m.get("total_saves"), m.get("total_comments"), m.get("demand_score"),
                 m.get("demand_raw"), m.get("growth_pct"), m.get("growth_score"),
                 m.get("collection_count"), m.get("collection_score"),
                 m.get("competition_score"), m.get("opportunity_score"),
                 m.get("suggested_product"), m.get("suggested_material"),
                 m.get("suggested_price_band"), m.get("confidence"), m.get("method")),
            )
        self.conn.commit()

    def top_keywords(self, snapshot_date: str, window_days: int,
                     limit: int = 10) -> List[Dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT k.term, k.ngram, m.* FROM keyword_metrics m "
            "JOIN keywords k ON k.id = m.keyword_id "
            "WHERE m.snapshot_date=? AND m.window_days=? "
            "ORDER BY m.opportunity_score DESC, m.demand_score DESC LIMIT ?",
            (snapshot_date, window_days, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    # ------------------------------------------------------------ products

    def upsert_product(self, product: Dict[str, Any]) -> int:
        now = utc_now()
        self.conn.execute(
            "INSERT INTO products (product_key, display_name, category, product_type, material, "
            "representative_pin_id, image_url, first_seen, last_seen) VALUES (?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(product_key) DO UPDATE SET display_name=excluded.display_name, "
            "category=excluded.category, product_type=excluded.product_type, "
            "material=excluded.material, representative_pin_id=excluded.representative_pin_id, "
            "image_url=excluded.image_url, last_seen=excluded.last_seen",
            (product["product_key"], product.get("display_name"), product.get("category"),
             product.get("product_type"), product.get("material"),
             product.get("representative_pin_id"), product.get("image_url"), now, now),
        )
        return int(self.conn.execute(
            "SELECT id FROM products WHERE product_key=?", (product["product_key"],)
        ).fetchone()["id"])

    def save_product_metrics(self, snapshot_date: str, window_days: int,
                             metrics: List[Dict[str, Any]]):
        for m in metrics:
            pid = self.upsert_product(m["product"])
            self.conn.execute(
                "INSERT INTO product_metrics (product_id, snapshot_date, window_days, pin_count, "
                "total_saves, avg_price_usd, price_source, est_clicks, est_quantity, "
                "est_revenue_usd, cvr_used, click_per_save_used, confidence, method) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(product_id, snapshot_date, window_days) DO UPDATE SET "
                "pin_count=excluded.pin_count, total_saves=excluded.total_saves, "
                "avg_price_usd=excluded.avg_price_usd, price_source=excluded.price_source, "
                "est_clicks=excluded.est_clicks, est_quantity=excluded.est_quantity, "
                "est_revenue_usd=excluded.est_revenue_usd, cvr_used=excluded.cvr_used, "
                "click_per_save_used=excluded.click_per_save_used, "
                "confidence=excluded.confidence, method=excluded.method",
                (pid, snapshot_date, window_days, m.get("pin_count"), m.get("total_saves"),
                 m.get("avg_price_usd"), m.get("price_source"), m.get("est_clicks"),
                 m.get("est_quantity"), m.get("est_revenue_usd"), m.get("cvr_used"),
                 m.get("click_per_save_used"), m.get("confidence"), m.get("method")),
            )
        self.conn.commit()

    def top_products(self, snapshot_date: str, window_days: int,
                     limit: int = 10) -> List[Dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT p.product_key, p.display_name, p.category, p.product_type, p.material, "
            "p.image_url, m.* FROM product_metrics m JOIN products p ON p.id = m.product_id "
            "WHERE m.snapshot_date=? AND m.window_days=? "
            "ORDER BY m.est_revenue_usd DESC LIMIT ?",
            (snapshot_date, window_days, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    # ----------------------------------------------------------- forecasts

    def save_forecast(self, f: Dict[str, Any]):
        self.conn.execute(
            "INSERT INTO forecasts (entity_type, entity_key, snapshot_date, horizon_days, "
            "baseline_value, forecast_value, lower_bound, upper_bound, direction, "
            "seasonality_factor, method, confidence) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) "
            "ON CONFLICT(entity_type, entity_key, snapshot_date, horizon_days) DO UPDATE SET "
            "baseline_value=excluded.baseline_value, forecast_value=excluded.forecast_value, "
            "lower_bound=excluded.lower_bound, upper_bound=excluded.upper_bound, "
            "direction=excluded.direction, seasonality_factor=excluded.seasonality_factor, "
            "method=excluded.method, confidence=excluded.confidence",
            (f["entity_type"], f["entity_key"], f["snapshot_date"], f["horizon_days"],
             f.get("baseline_value"), f.get("forecast_value"), f.get("lower_bound"),
             f.get("upper_bound"), f.get("direction"), f.get("seasonality_factor"),
             f.get("method"), f.get("confidence")),
        )
        self.conn.commit()

    def get_forecasts(self, snapshot_date: str, horizon_days: int = 30) -> List[Dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM forecasts WHERE snapshot_date=? AND horizon_days=? "
            "ORDER BY forecast_value DESC",
            (snapshot_date, horizon_days),
        ).fetchall()
        return [dict(r) for r in rows]

    # ------------------------------------------------------------- reports

    def save_report(self, run_id: int, window_days: int, model: str, llm_used: bool,
                    data_mode: str, payload: Dict[str, Any], markdown: str) -> int:
        cur = self.conn.execute(
            "INSERT INTO analysis_reports (run_id, generated_at, window_days, model, llm_used, "
            "data_mode, payload_json, markdown) VALUES (?,?,?,?,?,?,?,?)",
            (run_id, utc_now(), window_days, model, 1 if llm_used else 0, data_mode,
             json.dumps(payload, ensure_ascii=False), markdown),
        )
        self.conn.commit()
        return int(cur.lastrowid)

    def latest_report(self) -> Optional[Dict[str, Any]]:
        row = self.conn.execute(
            "SELECT * FROM analysis_reports ORDER BY id DESC LIMIT 1"
        ).fetchone()
        return dict(row) if row else None
