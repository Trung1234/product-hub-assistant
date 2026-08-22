---
doc_id: DEV-PW1-PINTEREST-003
title: "Pinterest R&D Pipeline — Crawl, Kho du lieu, Chi so & AI Synthesis"
audience: "Engineering + R&D team"
language: "vi"
---

# 03 — PINTEREST R&D PIPELINE

Duong ong day du: **crawl → lam sach → SQLite → chi so → AI agent → bao cao 5 muc.**

```
 ┌────────────────────────────────────────────────────────────────────┐
 │ 1. CRAWL   src/crawlers/pinterest_scraper.py                       │
 │    Playwright (trinh duyet that) + bat JSON /resource/*/get/       │
 │    3 engine: headless | persistent | cdp (AdsPower/GoLogin)        │
 │    Artifact tho -> data/pinterest_raw/*.json                       │
 └───────────────────────────┬────────────────────────────────────────┘
                             ▼
 ┌────────────────────────────────────────────────────────────────────┐
 │ 2. CLEAN   src/pipeline/pinterest_pipeline.py (PinterestCleaner)   │
 │    bo spam / pin rong / chu khong Latin / domain rut gon           │
 │    chong trung theo pin_id VA theo van tay noi dung + nguoi dang   │
 │    moi pin bi loai deu duoc ghi lai ly do                          │
 └───────────────────────────┬────────────────────────────────────────┘
                             ▼
 ┌────────────────────────────────────────────────────────────────────┐
 │ 3. STORE   src/db/  (SQLite + FTS5)  data/pinterest_rnd.db         │
 │    crawl_runs · pins · pins_fts · keywords · keyword_metrics       │
 │    products · product_metrics · forecasts · analysis_reports       │
 └───────────────────────────┬────────────────────────────────────────┘
                             ▼
 ┌────────────────────────────────────────────────────────────────────┐
 │ 4. METRICS src/analytics/pinterest_metrics.py  (KHONG dung LLM)    │
 │    Demand · Growth · Collection · Competition · Opportunity        │
 │    Revenue / Quantity uoc luong · Forecast 30 ngay                 │
 └───────────────────────────┬────────────────────────────────────────┘
                             ▼
 ┌────────────────────────────────────────────────────────────────────┐
 │ 5. AI AGENT src/agents/pinterest_analyst_agent.py                  │
 │    LLM CHI viet dien giai · verify_numbers() chong bia so          │
 │    Xuat Markdown + JSON + luu vao analysis_reports                 │
 └────────────────────────────────────────────────────────────────────┘
```

---

## 1. Crawl — vi sao phai dung trinh duyet that

Pinterest la SPA React. `requests` + BeautifulSoup tra ve khung HTML rong, khong co pin nao.
Vi vay crawler dung **Playwright** dieu khien Chromium that, cuon trang de kich hoat
infinite scroll, roi doc DOM.

Ngoai DOM, crawler con **bat cac response JSON `/resource/*/get/`** ma chinh app Pinterest goi
trong luc cuon. Day la diem khac biet quan trong:

| Nguon | Lay duoc gi |
| :--- | :--- |
| DOM (`div[data-test-id='pinWrapper']`) | title (aria-label), link pin, anh |
| JSON `/resource/*/get/` | **repin_count (saves)**, comment_count, **created_at**, **gia san pham**, board, domain, dominant_color |

Chi so R&D nam gan het o nguon thu hai. Hai nguon duoc gop theo `pin_id`
(`merge_pin_records`), ban JSON thang ve chi so, ban DOM bu title/anh cho pin thieu.

`robots.txt` cua Pinterest cho phep `/resource/*/get/` (dong `Allow: /resource/*/get/`),
va crawler khong dang nhap, khong lay du lieu ca nhan, co delay giua cac lan cuon.

### Anh: nang do phan giai

Pinterest nhung kich thuoc vao duong dan anh. `upgrade_image_url()` doi `/236x/` (thumbnail luoi)
thanh `/736x/` — ban dung duoc cho moodboard. **Khong dung `/originals/`**: Pinterest tra 403
cho phan lon pin tu 2025.

### Cuon vo han: dung khi nao

Khong dung so vong lap co dinh. Sau moi lan cuon, crawler dem so link `/pin/` moi;
neu **3 lan cuon lien tiep khong ra pin moi** thi dung. Tranh treo script khi het pin.

### Ba engine

| Engine | Dung khi | Lenh |
| :--- | :--- | :--- |
| `headless` | IP sach, khong can dang nhap | `--engine headless` |
| `persistent` | IP bi chan → mo trinh duyet, ban tu dang nhap **mot lan**, session luu o `data/browser_profile/` | `--engine persistent` |
| `cdp` | Gan vao AdsPower / GoLogin / Edge-Chrome chay `--remote-debugging-port` | `--engine cdp --cdp-url http://127.0.0.1:9222` |

### Chon trinh duyet: `--browser`

| Gia tri | Dung gi |
| :--- | :--- |
| `msedge` (mac dinh) | Microsoft Edge da cai san tren may |
| `chrome` | Google Chrome da cai san |
| `chromium` | Ban Chromium di kem Playwright |

**User-Agent**: che do co giao dien de trinh duyet tu khai bao UA that (khop hoan toan voi
phan con lai cua fingerprint). Che do headless thi **buoc phai ep UA**, vi Chromium headless
tu ghi `HeadlessChrome/...` vao UA — do la co bao bot ro rang nhat.

> **Doi trinh duyet KHONG go duoc chan ASN.** Da do: Edge headless, Edge co giao dien
> (UA sach `Edg/131`), Chromium headless — ca ba deu nhan cung mot cau
> "We couldn't find any Pins". Chan nam o tang IP + chua dang nhap, khong phai o fingerprint.
> Chi dang nhap (`--login`) hoac doi IP moi go duoc.

### ⚠️ Chan theo dai IP (ASN)

Pinterest tra **feed rong** cho khach chua dang nhap den tu nhung dai IP bi gan co
`is_unauth_botspam_asn`. Response van la `200 OK`, `results: []` — rat de tuong nham la
"khong co du lieu".

Crawler phat hien tinh huong nay (doc co trong `client_context` + bat chuoi
*"We couldn't find any Pins"* tren trang) va tra ve `status = "blocked"` kem ly do,
**thay vi im lang tra ve 0 pin**. Lan chay do duoc ghi vao `crawl_runs` voi trang thai
`blocked`, va bao cao mang co `data_mode = NO_LIVE_DATA`.

Ba cach xu ly: `--engine persistent` (dang nhap), `--engine cdp` (trinh duyet anti-detect),
hoac doi sang mang / proxy dan cu.

---

## 2. Lam sach

| Luat | Ly do |
| :--- | :--- |
| Bo pin khong co chu / duoi 8 ky tu / toan stopword | Khong trich duoc tu khoa nao |
| Bo pin khong phai chu Latin (kiem tra **truoc** khi clean) | Corpus huong thi truong US/EU. Kiem tra truoc de pin tieng Nhat khong bi ghi nham ly do la "rong" |
| Bo domain rut gon (`bit.ly`, `linktr.ee`…) | Gan nhu luon la spam affiliate |
| Trung `pin_id` → giu ban co saves cao hon | Saves chi tang theo thoi gian |
| Trung noi dung **cua cung mot nguoi dang** → gop | Mot seller dang lai mot listing thanh nhieu pin |
| Trung noi dung nhung **khac nguoi dang** → giu ca hai | Hai seller cung ban mot thu chinh la tin hieu canh tranh can do. Gop lai se lam mat tin hieu do |

Moi pin bi loai deu duoc ghi ly do va dem vao `crawl_runs.pins_rejected` —
con so nay khong bien mat im lang.

---

## 3. Bo chi so

### Demand (0–100)

```
demand_raw = (tong_saves + 0.5 × tong_comments + 3 × so_pin) × lexicon_weight(term)
demand_score = 100 × log1p(demand_raw) / log1p(max_demand_raw trong corpus)
```

Chuan hoa theo **log** de mot pin viral khong nuot het thang do.
`lexicon_weight` uu tien gram co ten san pham + tin hieu ca nhan hoa + dip tang.

### Growth (%)

So sanh **toc do tich luy saves/ngay** (`saves / tuoi_pin`) giua lop pin moi
(tuoi ≤ cua so) va lop pin truoc do (cua so < tuoi ≤ 2× cua so).

> Vi sao khong dung tong saves: pin dang moi chua kip tich saves. So sanh tong saves
> se **luon** ket luan "dang giam" ke ca khi thi truong dang len. Chia cho tuoi pin loai bo
> dung cai thien lech do. Day la loi de mac nhat khi lam chi so tren du lieu social.

Ket qua chan trong `[-100%, +500%]`. Khong du pin co ngay tao → tra `None`,
`growth_score = 50` (trung tinh), confidence bi ha.

### Collection

So **board / bo suu tap khac nhau** dang chua tu khoa do. Tu khoa nam rai o nhieu board
la tu khoa da vao nhieu ngach nguoi dung khac nhau, khong phai chi mot nhom nho.

### Competition & Opportunity

`competition_score` = so **nguoi dang khac nhau** (chuan hoa log) — bao nhieu seller
dang day tu khoa nay.

```
Opportunity = 0.35 × Demand
            + 0.30 × Growth_score
            + 0.15 × Collection_score
            + 0.20 × (100 − Competition)
```

Tong trong so = 1.0, `assert` ngay o module level.

### Loc tu khoa

| Bo loc | Muc dich |
| :--- | :--- |
| `min_df = 3` | Mot pin viral khong duoc de ra mot "xu huong" |
| `max_df_ratio = 0.5` | "personalized", "custom" xuat hien o gan het pin POD — dung nhung khong chi ra viec gi de lam, va day het tu khoa co gia tri xuong duoi |
| `require_commercial_anchor` | Tu khoa phai cham vao loai san pham / chat lieu / dip tang / kieu ca nhan hoa |
| Chong trung n-gram | "anniversary handmade" va "anniversary handmade personalized" phu cung tap pin (Jaccard ≥ 0.75) → chi giu ban xep hang cao hon |

Tu **thuan phong cach** ("boho", "watercolor", "farmhouse") khong bi vut di — chung sang
bang rieng **Design Attributes**, kem san pham ma chung hay di cung. Day la thu Pinterest
lam tot hon moi san khac: khong phai *ban cai gi*, ma la *ve theo phong cach nao*.

---

## 4. Revenue & Quantity — mo hinh uoc luong

> **Pinterest khong cong bo doanh thu hay so luong ban.** Moi con so Revenue/Quantity
> trong he thong nay la **uoc luong**, sinh ra tu mo hinh duoi day, va **luon** di kem
> `method` + `confidence`. Khong duoc trinh bay nhu so lieu ban hang that.

`ESTIMATION_MODEL = pinterest_commerce_estimator_v1`:

```
saves_trong_cua_so = Σ  saves(pin) × window_factor(tuoi_pin, cua_so)
clicks             = saves_trong_cua_so × 0.28        # click_per_save
quantity           = clicks × CVR(nganh_hang)          # 1.2% – 1.8%
revenue            = quantity × gia
loi_gop            = revenue × margin_pct (tu catalog Printway)
```

| Tham so | Gia tri | Ghi chu |
| :--- | :--- | :--- |
| `click_per_save` | 0.28 | Mot pin san pham tao ~0.25–0.30 click ra ngoai tren moi save. **He so gia dinh** — thay bang so GA4 that khi co |
| `CVR` | Home Decor 1.8% · Drinkware 1.6% · Apparel 1.2% · Jewelry 1.4% · mac dinh 1.5% | Traffic POD den tu social discovery |
| `window_factor` | `1.0` neu tuoi ≤ cua so, nguoc lai `cua_so / tuoi` | Gia dinh saves tich luy tuyen tinh theo doi pin |
| `default_age_days` | 180 | Pin khong lay duoc ngay tao. Dong do bi **ha confidence** |

**Nguon gia** duoc ghi ro tren tung dong: `product_pin` (gia that tu rich metadata) >
`text_parsed` (bat `$xx.xx` trong tieu de) > `printway_catalog` (gia tham chieu) >
`global_default`.

Muon doi gia dinh: sua `ESTIMATION_MODEL` trong `src/analytics/pinterest_metrics.py`.
Toan bo bao cao tinh lai theo, va gia tri moi duoc in ra trong bao cao.

---

## 5. Cua so thoi gian theo tung san

Doi low-tech chi can chon "30 ngay" hay "12 thang". Viec **cua so nao hop ly voi san nao**
da duoc quyet san trong `MARKETPLACE_WINDOWS`, kem ly do — nguoi dung khong phai tu suy nghi:

| San | Cua so | Ly do |
| :--- | :--- | :--- |
| **Pinterest** | 30 / 90 / 365 | Pinterest la kenh len y tuong truoc khi mua 30–60 ngay va co chu ky mua vu rat manh. 30 ngay bat song moi; 90 ngay bat ca doan da tang cua mua vu; 365 ngay so sanh cung ky nam truoc |
| **Etsy** | 30 / 365 | Etsy chi lo review va ngay listing, khong lo doanh so theo ngay. Hai moc nay la hai moc duy nhat co du du lieu |
| **Amazon** | 30 / 90 | BSR xoay rat nhanh; qua 90 ngay tin hieu khong con phan anh hien tai |

---

## 6. Du bao 30 ngay

1. Dung chuoi **toc do saves theo tuan** tu lop pin theo ngay tao (12 tuan gan nhat),
   don vi saves/ngay — cung cach chua lech do tuoi nhu phan Growth.
2. **Holt linear trend** (α = 0.5, β = 0.3) du bao 4 tuan toi. Khong thu vien ngoai, deterministic.
3. Nhan **he so mua vu POD** theo thang dich (Q4 la mua qua tang: T11 = 1.55, T10 = 1.35).
4. Khoang tin cay lay tu do lech chuan phan du cua chinh mo hinh.

Confidence: `high` neu ≥ 25 pin co ngay tao va ≥ 6 tuan co du lieu; `low` neu < 10 pin.

---

## 7. AI Agent — ranh gioi giua may tinh va mo hinh

| Viec | Ai lam |
| :--- | :--- |
| Moi con so (Demand, Growth, Revenue, Forecast…) | `PinterestMetricsEngine`, deterministic, luu vao SQLite **truoc khi** goi LLM |
| Dien giai: Key Insights, forecast narrative, R&D Recommendation | LLM |

LLM chi duoc nhin thay **evidence pack** — ban rut gon chi chua so lieu da tinh.
Sau khi LLM tra loi, `verify_numbers()` quet moi con so trong van ban va doi chieu voi
evidence pack; con so nao khong khop bi liet ke vao `unverified_numbers` va **in thang len
dau bao cao**. Day la chot chan cuoi chong viec mo hinh bia so lieu.

Khong co `OPENAI_API_KEY` → agent van chay, dung ban dien giai deterministic,
va bao cao ghi ro `dien giai boi: fallback deterministic`.

---

## 8. Cach chay

```bash
# Cai dat (Playwright can tai Chromium mot lan)
pip install -r requirements.txt
python -m playwright install chromium

# IP bi chan -> dang nhap Pinterest MOT LAN (script khong nhin thay mat khau,
# ban go truc tiep vao trinh duyet, cookie luu o data/browser_profile/)
PYTHONPATH=. python run_pinterest_pipeline.py --login

# Crawl that + phan tich
PYTHONPATH=. python run_pinterest_pipeline.py --queries "personalized christmas ornament" "custom tumbler"

# IP bi chan -> dang nhap mot lan
PYTHONPATH=. python run_pinterest_pipeline.py --engine persistent --queries "acrylic ornament"

# Gan vao AdsPower / GoLogin dang mo
PYTHONPATH=. python run_pinterest_pipeline.py --engine cdp --cdp-url http://127.0.0.1:9222 --queries "custom mug"

# Chi phan tich lai kho da co, cua so 90 ngay
PYTHONPATH=. python run_pinterest_pipeline.py --analyze-only --window 90

# Nap lai artifact da crawl truoc do
PYTHONPATH=. python run_pinterest_pipeline.py --from-file data/pinterest_raw/xxx_raw.json

# Kiem chung nguon goc du lieu dang co trong kho
PYTHONPATH=. python verify_pinterest_source.py
PYTHONPATH=. python verify_pinterest_source.py --live   # mo thu pin bang trinh duyet

# Kiem thu (khong goi mang)
PYTHONPATH=. python test_pinterest_pipeline.py

# Dashboard
streamlit run app.py     # chon trang "Pinterest RnD" o sidebar
```

Corpus mo phong de thu giao dien khi chua crawl duoc:

```bash
python tools_make_fixture_corpus.py
PYTHONPATH=. python run_pinterest_pipeline.py --from-file data/seed/pinterest_sample_corpus.json
```

Bao cao sinh tu corpus nay mang co `data_mode = SYNTHETIC_FIXTURE` va banner canh bao.
**Khong dung de ra quyet dinh kinh doanh.**

---

## 9. Tool cho agent orchestrator

`src/tools/pinterest_tools.py` — da noi vao `src/agent_graph.py`:

| Tool | Viec |
| :--- | :--- |
| `get_pinterest_data_status` | Kho dang co gi. **Goi truoc** khi khang dinh bat cu dieu gi ve du lieu Pinterest |
| `crawl_pinterest_keywords` | Crawl va nap vao kho |
| `search_stored_pinterest_pins` | FTS5 tren pin da luu — dan chung cu that cho mot nhan dinh |
| `get_pinterest_top_keywords` | Demand / Growth / Collection / de xuat san pham |
| `get_pinterest_top_products` | Revenue / Quantity uoc luong theo cua so |
| `generate_pinterest_rnd_report` | Bao cao day du 5 muc, tra ve Markdown |

---

## 10. Lam sao biet du lieu that su tu Pinterest?

Chay `verify_pinterest_source.py`. Cong cu nay khong khang dinh, no doi chieu bon lop bang chung:

| Lop | Kiem tra gi |
| :--- | :--- |
| 1. Lich su chay | Bang `crawl_runs`: engine nao, `status` gi, file artifact tho nam o dau (mo ra doc duoc response goc cua Pinterest) |
| 2. Dinh dang `pin_id` | Pinterest dung ID so **15-20 chu so**. Du lieu mo phong mang tien to `fixture-` |
| 3. Ten mien tai nguyen | `pin_url` phai tro ve `pinterest.com`, `image_url` phai nam tren `i.pinimg.com`. Corpus mo phong dung `fixture.invalid` de khong the gia mao |
| 4. Kiem tra live (`--live`) | Mo chinh URL pin dang luu bang Chromium, so `og:title` cua trang voi title dang luu trong kho |

Ket luan in ra la mot trong bon: `LIVE_PINTEREST`, `MIXED`, `SYNTHETIC_FIXTURE`, `NO_DATA`.
Ma thoat khac 0 khi kho con lan du lieu mo phong — cam duoc vao CI.

Ngoai ra moi ban bao cao deu mang truong `data_mode` va in ngay dong dau file, nen khong
the vo tinh doc bao cao chay tren du lieu mo phong ma tuong la du lieu that.

---

## 11. Gioi han da biet

- **Pinterest khong co doanh so.** Revenue/Quantity la uoc luong tu engagement. Muon so that
  phai doi chieu voi Etsy/Amazon hoac GA4 cua chinh shop.
- **`created_at` khong phai luon co.** Pin thieu ngay tao bi gan tuoi mac dinh 180 ngay va
  bi ha confidence; Growth va Forecast chi tinh tren nhom pin co ngay tao.
- **Crawl phu thuoc IP.** Xem muc 1. Day la rang buoc van hanh, khong phai loi code.
- **`click_per_save` va `CVR` la gia dinh nganh**, chua hieu chinh bang du lieu Printway that.
  Do la viec dau tien nen lam khi co so lieu don hang thuc te.
- Chua so sanh **cung ky nam truoc** (can nhieu snapshot tich luy qua thoi gian).
