-- Pinterest R&D Warehouse (SQLite)
-- Tang luu tru chuan hoa cho pipeline: crawl -> clean -> metrics -> AI synthesis.

PRAGMA journal_mode=WAL;

-- 1. Moi lan chay worker crawl
CREATE TABLE IF NOT EXISTS crawl_runs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    source            TEXT NOT NULL DEFAULT 'pinterest',
    engine            TEXT,          -- playwright_headless | playwright_persistent | cdp_attach | seed_corpus
    seed_queries      TEXT,          -- JSON array
    started_at        TEXT NOT NULL,
    finished_at       TEXT,
    status            TEXT,          -- success | partial | blocked | failed
    pins_seen         INTEGER DEFAULT 0,
    pins_stored       INTEGER DEFAULT 0,
    pins_rejected     INTEGER DEFAULT 0,
    raw_artifact_path TEXT,
    notes             TEXT
);

-- 2. Pin da lam sach (1 dong = 1 pin duy nhat)
CREATE TABLE IF NOT EXISTS pins (
    pin_id          TEXT PRIMARY KEY,
    run_id          INTEGER REFERENCES crawl_runs(id),
    query_seed      TEXT,
    title           TEXT,
    description     TEXT,
    alt_text        TEXT,
    clean_text      TEXT,
    pin_url         TEXT,
    image_url       TEXT,
    outbound_link   TEXT,
    domain          TEXT,
    board_name      TEXT,
    creator         TEXT,
    saves           INTEGER DEFAULT 0,
    comments        INTEGER DEFAULT 0,
    reactions       INTEGER DEFAULT 0,
    is_product_pin  INTEGER DEFAULT 0,
    price_value     REAL,
    price_currency  TEXT,
    dominant_color  TEXT,
    created_at      TEXT,            -- ngay tao pin (ISO) neu lay duoc
    age_days        REAL,
    collected_at    TEXT NOT NULL,
    data_quality    TEXT,            -- rich_json | dom_only | partial
    raw_json        TEXT
);
CREATE INDEX IF NOT EXISTS idx_pins_seed    ON pins(query_seed);
CREATE INDEX IF NOT EXISTS idx_pins_created ON pins(created_at);
CREATE INDEX IF NOT EXISTS idx_pins_domain  ON pins(domain);
CREATE INDEX IF NOT EXISTS idx_pins_run     ON pins(run_id);

-- 3. Full-text search tren noi dung pin da lam sach
CREATE VIRTUAL TABLE IF NOT EXISTS pins_fts USING fts5(
    pin_id UNINDEXED,
    clean_text,
    tokenize = 'porter unicode61'
);

-- 4. Tu khoa trich xuat tu corpus
CREATE TABLE IF NOT EXISTS keywords (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    term       TEXT UNIQUE NOT NULL,
    ngram      INTEGER,
    first_seen TEXT,
    last_seen  TEXT
);

-- 5. Bo chi so tu khoa theo tung cua so thoi gian
CREATE TABLE IF NOT EXISTS keyword_metrics (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword_id           INTEGER REFERENCES keywords(id),
    run_id               INTEGER REFERENCES crawl_runs(id),
    snapshot_date        TEXT NOT NULL,
    window_days          INTEGER NOT NULL,
    pin_count            INTEGER,
    total_saves          INTEGER,
    total_comments       INTEGER,
    demand_score         REAL,
    demand_raw           REAL,
    growth_pct           REAL,
    growth_score         REAL,
    collection_count     INTEGER,
    collection_score     REAL,
    competition_score    REAL,
    opportunity_score    REAL,
    suggested_product    TEXT,
    suggested_material   TEXT,
    suggested_price_band TEXT,
    confidence           TEXT,
    method               TEXT,
    UNIQUE(keyword_id, snapshot_date, window_days)
);

-- 6. Cum san pham suy ra tu pin
CREATE TABLE IF NOT EXISTS products (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    product_key           TEXT UNIQUE NOT NULL,
    display_name          TEXT,
    category              TEXT,
    product_type          TEXT,
    material              TEXT,
    representative_pin_id TEXT,
    image_url             TEXT,
    first_seen            TEXT,
    last_seen             TEXT
);

-- 7. Revenue / Quantity uoc luong theo cua so thoi gian
CREATE TABLE IF NOT EXISTS product_metrics (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id           INTEGER REFERENCES products(id),
    snapshot_date        TEXT NOT NULL,
    window_days          INTEGER NOT NULL,
    pin_count            INTEGER,
    total_saves          INTEGER,
    avg_price_usd        REAL,
    price_source         TEXT,        -- product_pin | text_parsed | category_median
    est_clicks           REAL,
    est_quantity         REAL,
    est_revenue_usd      REAL,
    cvr_used             REAL,
    click_per_save_used  REAL,
    confidence           TEXT,
    method               TEXT,
    UNIQUE(product_id, snapshot_date, window_days)
);

-- 8. Du bao
CREATE TABLE IF NOT EXISTS forecasts (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type        TEXT NOT NULL,   -- keyword | product | market
    entity_key         TEXT NOT NULL,
    snapshot_date      TEXT NOT NULL,
    horizon_days       INTEGER NOT NULL,
    baseline_value     REAL,
    forecast_value     REAL,
    lower_bound        REAL,
    upper_bound        REAL,
    direction          TEXT,
    seasonality_factor REAL,
    method             TEXT,
    confidence         TEXT,
    UNIQUE(entity_type, entity_key, snapshot_date, horizon_days)
);

-- 9. Ban bao cao AI agent da tong hop
CREATE TABLE IF NOT EXISTS analysis_reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id       INTEGER REFERENCES crawl_runs(id),
    generated_at TEXT NOT NULL,
    window_days  INTEGER,
    model        TEXT,
    llm_used     INTEGER DEFAULT 0,
    data_mode    TEXT,
    payload_json TEXT,
    markdown     TEXT
);
