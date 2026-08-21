# SPEC-001: Pinterest Demand Signal Ingestion

> Spec-driven development document. Đọc toàn bộ file này trước khi viết dòng code đầu tiên.
> Mọi quyết định thiết kế nằm ở đây; code chỉ là bản hiện thực của spec.

---

## 0. Context

Module này là một **data source adapter** trong Product Opportunity Hub (Printway POD).
Nó KHÔNG phải hệ thống độc lập. Nó chỉ chịu trách nhiệm: lấy tín hiệu nhu cầu từ Pinterest,
chuẩn hoá về schema chung, và ghi ra nơi mà AI agent đọc được.

**Ràng buộc nền tảng — đọc kỹ, đây là gốc của mọi quyết định bên dưới:**

1. Pinterest KHÔNG phải marketplace. Không có checkout, không có đơn hàng, không có
   "units sold". Module này **không bao giờ** sinh ra field tên `revenue`, `sales`,
   `units_sold`, `quantity`. Vi phạm điều này = spec fail.
2. Pinterest Developer Guidelines cấm lưu trữ dài hạn dữ liệu lấy từ API (ngoại trừ
   campaign analytics của chính mình). Vì vậy dữ liệu Pinterest được xử lý như
   **ephemeral cache**, không phải bảng lưu trữ vĩnh viễn.
3. Cấm mọi hình thức scraping: Selenium, Playwright, BeautifulSoup lên pinterest.com,
   Apify actors, Bright Data, proxy rotation. Chỉ dùng REST API chính thức.

---

## 1. Goal

Sinh ra, cho mỗi `canonical_product_type` trong taxonomy Printway, một
**Pinterest Demand Score (0-100)** kèm bằng chứng giải thích được, để Opportunity Score
tổng hợp có thêm một chiều tín hiệu độc lập với Etsy/Amazon.

### 1.1 Non-goals

Những thứ module này KHÔNG làm, đừng tự ý mở rộng:

- Không lấy dữ liệu sản phẩm/doanh số của đối thủ (Pinterest không cung cấp).
- Không gọi `/v5/search/partner/pins` (beta, cần Pinterest duyệt riêng).
- Không đụng vào Catalog API (chỉ dùng khi Printway có catalog riêng trên Pinterest).
- Không tự crawl Top Pins. Phần đó là input thủ công (xem §6).

---

## 2. Prerequisites

Trước khi code, xác nhận đủ 3 thứ sau. **Nếu thiếu, dừng và báo, đừng code vòng tránh:**

| Điều kiện | Cách xác nhận |
|---|---|
| Pinterest Business Account | Đăng nhập được business.pinterest.com |
| App đã đăng ký tại developers.pinterest.com | Có `APP_ID` + `APP_SECRET` |
| OAuth access token còn hiệu lực | Gọi thử `GET /v5/user_account` trả 200 |

**Biến môi trường bắt buộc** (đọc từ `.env`, KHÔNG hardcode, KHÔNG commit):

```
PINTEREST_ACCESS_TOKEN=
PINTEREST_REGION=US
```

---

## 3. Task 0 — Access probe (LÀM ĐẦU TIÊN, TRƯỚC MỌI THỨ KHÁC)

Đây là rủi ro lớn nhất của cả module. Pinterest định vị Trends API cho
"agencies, Enterprise clients và partner platforms"; chưa xác nhận được app Trial
thông thường có gọi được không.

**Deliverable:** script `probe_access.py`, chạy độc lập, in ra kết luận rõ ràng.

```
python probe_access.py
```

**Hành vi:**

1. Gọi `GET /v5/trends/keywords/{REGION}/top/growing?limit=1`
2. In một trong 3 kết luận:
   - `ACCESS_OK` — có quyền, tiếp tục Task 1
   - `ACCESS_DENIED_403` — không có quyền, **chuyển sang Plan B (§6.2)**
   - `ACCESS_ERROR_<code>` — lỗi khác, in nguyên response body để debug

**Acceptance criteria:**
- [ ] Script chạy được mà không cần import phần còn lại của codebase
- [ ] Không crash khi nhận 403; in kết luận rồi exit code 0
- [ ] In ra HTTP status + response body khi lỗi, không nuốt exception

> **Quyết định phụ thuộc:** nếu kết quả là `ACCESS_DENIED_403`, bỏ qua Task 1-2,
> nhảy thẳng tới §6.2. Đừng cố tìm cách vòng qua bằng scraping.

---

## 4. Task 1 — Trends API client

**Deliverable:** `pinterest_client.py`

### 4.1 Interface contract

```python
def fetch_trends(
    region: str,
    trend_type: Literal["growing", "monthly", "yearly", "seasonal"],
    include_keywords: list[str] | None = None,
    limit: int = 50,
) -> list[TrendRecord]:
    ...
```

`TrendRecord` (dataclass hoặc pydantic model):

```python
keyword: str
pct_growth_wow: float | None
pct_growth_mom: float | None
pct_growth_yoy: float | None
time_series: dict[str, int]   # tuần -> chỉ số 0-100
region: str
trend_type: str
retrieved_at: str             # ISO 8601 UTC
```

### 4.2 Endpoint

```
GET https://api.pinterest.com/v5/trends/keywords/{region}/top/{trend_type}
Authorization: Bearer {PINTEREST_ACCESS_TOKEN}
```

Query params dùng: `limit`, `include_keywords`, `normalize_against_group=true`.

### 4.3 Ràng buộc bắt buộc

- **Rate limit:** Trial ~1.000 req/ngày; Standard nhóm `trends_read` 60 req/phút.
  Implement token bucket hoặc đơn giản là `sleep` giữa các call để không vượt 60/phút.
- **Retry:** chỉ retry với 429 và 5xx. Exponential backoff, tối đa 3 lần.
  KHÔNG retry với 401/403 — đó là lỗi cấu hình, retry vô nghĩa.
- **Missing value:** nếu API không trả `pct_growth_yoy`, giữ `None`.
  **Tuyệt đối không thay bằng 0** — 0 nghĩa là "không tăng trưởng", `None` nghĩa là
  "không có dữ liệu". Nhầm hai cái này làm sai Demand Score.
- **`time_series` format:** tài liệu mô tả chuỗi 52 tuần nhưng format thực tế
  (object keyed theo ngày, hay array) **phải xác nhận bằng một call thật** trước khi
  viết parser. Đừng tin ví dụ trong bất kỳ tài liệu nào kể cả spec này.
- Log mỗi call: endpoint, params, status, số record trả về.

### 4.4 Acceptance criteria

- [ ] Gọi được cả 4 `trend_type`
- [ ] Không vượt rate limit khi chạy liên tục 20 call
- [ ] Token không xuất hiện trong log
- [ ] Unit test với response mock cho: happy path, 429, thiếu field growth

---

## 5. Task 2 — Keyword to product type mapping

**Deliverable:** `keyword_mapper.py`

### 5.1 Vấn đề

Pinterest trả về keyword tự do (`"personalized christmas ornament"`).
Product Hub cần `canonical_product_type` theo taxonomy Printway (`ORNAMENT`).
`top/growing` trả rất nhiều keyword không liên quan tới POD — phải lọc.

### 5.2 Chiến lược 2 chiều

**Chiều A — seed-driven (chính, ưu tiên):**
Từ taxonomy Printway, sinh seed keyword, gọi API với `include_keywords`.
Kết quả trả về đã gắn sẵn product type vì ta biết mình hỏi cái gì.

Seed list tối thiểu, lưu ở `config/seed_keywords.yaml`:

```yaml
ORNAMENT:
  - personalized christmas ornament
  - memorial ornament
  - pet ornament
DRINKWARE:
  - personalized tumbler
  - custom mug
HOME_DECOR:
  - personalized wall art
  - custom doormat
ACCESSORIES:
  - acrylic keychain
  - personalized phone case
APPAREL:
  - dog mom sweatshirt
  - custom family shirt
```

> Seed list phải khớp với file taxonomy BTC cung cấp. Nếu taxonomy có product type
> chưa có seed, ghi log cảnh báo `MISSING_SEED: <product_type>` chứ đừng bỏ qua im lặng.

**Chiều B — discovery (phụ, để bắt trend mới):**
Gọi `top/growing` không filter, rồi map keyword lạ về product type bằng LLM.
Chỉ giữ keyword có confidence cao; keyword không map được thì gắn
`canonical_product_type: UNMAPPED` và vẫn lưu — đây là nguồn cho tính năng
early-trend alert sau này.

### 5.3 Contract

```python
def map_keyword(keyword: str) -> MappingResult:
    ...
```

```python
canonical_product_type: str    # hoặc "UNMAPPED"
category: str | None
material: str | None
confidence: float              # 0.0 - 1.0
method: Literal["seed", "llm", "unmapped"]
```

### 5.4 Acceptance criteria

- [ ] Mọi seed keyword map đúng 100% (vì đã biết trước)
- [ ] Keyword không liên quan POD (vd `"nail art ideas"`) → `UNMAPPED`, không ép map bừa
- [ ] `method` luôn được ghi, để phân biệt tin cậy cao/thấp khi debug

---

## 6. Task 3 — Top Pins snapshot (thủ công)

### 6.1 Tại sao thủ công

Không có API công khai cho "top pins theo keyword" (endpoint `partner/pins` là beta).
Tự động hoá phần này = scraping = vi phạm ToS. Nên đây là input do người nhập.

### 6.2 Plan B — cũng là đường này nếu Task 0 trả 403

**Deliverable:** file `data/manual_pins_snapshot.csv` + loader đọc file đó.

Quy trình con người thực hiện (ghi vào README, không code):
1. Mở trends.pinterest.com, chọn region US/CA/UK
2. Tra 20-50 seed keyword
3. Ghi lại: related terms, xu hướng 12 tháng, demographics, Top Pins
4. Nhập vào CSV theo schema dưới

CSV schema:

```csv
keyword,canonical_product_type,region,top_pin_theme,observed_saves,observed_at,notes
```

**Acceptance criteria:**
- [ ] Loader validate: thiếu cột → báo lỗi rõ ràng, không silent fail
- [ ] `observed_at` bắt buộc, để UI hiển thị "snapshot ngày dd/mm"
- [ ] Nếu file không tồn tại, module vẫn chạy được (snapshot là optional input)

---

## 7. Task 4 — Demand Score

**Deliverable:** `demand_score.py`

### 7.1 Công thức

```
PinterestDemandScore =
    0.35 * current_interest
  + 0.25 * yoy_growth_score
  + 0.20 * mom_growth_score
  + 0.20 * seasonality_fit
```

Trong đó:
- `current_interest` — giá trị cuối của `time_series` (đã là 0-100)
- `yoy_growth_score`, `mom_growth_score` — normalize growth % về thang 0-100
  (định nghĩa hàm normalize rõ ràng trong code, không magic number rải rác)
- `seasonality_fit` — độ khớp giữa đỉnh mùa vụ của keyword và cửa sổ launch đang xét

### 7.2 Xử lý dữ liệu thiếu

Nếu một thành phần là `None`:
- **Không** thay bằng 0
- Tái phân bổ trọng số cho các thành phần còn lại
- Ghi `confidence` giảm tương ứng, và liệt kê thành phần thiếu trong output

### 7.3 Giải thích được

Mỗi score phải kèm breakdown. Đề bài chấm điểm phần "giải thích được" — score trần trụi
không có giá trị.

```json
{
  "score": 83.5,
  "breakdown": {
    "current_interest": {"raw": 80, "weighted": 28.0},
    "yoy_growth": {"raw": 70, "weighted": 17.5},
    "mom_growth": {"raw": 90, "weighted": 18.0},
    "seasonality_fit": {"raw": 100, "weighted": 20.0}
  },
  "missing_components": [],
  "confidence": 0.85
}
```

### 7.4 Acceptance criteria

- [ ] Score luôn trong khoảng 0-100
- [ ] Thiếu 1 thành phần vẫn tính được, confidence giảm
- [ ] Thiếu toàn bộ growth data → trả `None`, không trả 0
- [ ] Breakdown luôn cộng lại đúng bằng score

---

## 8. Output contract

**Deliverable:** `pinterest_signals.json` (hoặc ghi vào bảng cache, xem §9)

Đây là mặt tiếp xúc duy nhất giữa module này và phần còn lại của Product Hub.
Thay đổi schema này = phải sửa AI agent, nên chốt sớm.

```json
{
  "source": "pinterest_trends",
  "source_type": "demand_interest_signal",
  "keyword": "personalized christmas ornament",
  "canonical_product_type": "ORNAMENT",
  "category": "Home Decor",
  "market": "US",
  "trend_type": "growing",
  "growth_wow": 35,
  "growth_mom": 120,
  "growth_yoy": 48,
  "current_interest_index": 46,
  "pinterest_demand_score": 83.5,
  "score_breakdown": { },
  "mapping_method": "seed",
  "confidence": 0.75,
  "collected_at": "2026-08-21T00:00:00Z",
  "expires_at": "2026-08-21T06:00:00Z"
}
```

**Cấm tuyệt đối** các field: `revenue`, `sales`, `units_sold`, `quantity`, `gmv`.

---

## 9. Storage policy

Pinterest Developer Guidelines hạn chế lưu trữ dữ liệu API dài hạn. Vì vậy:

| Loại dữ liệu | Nơi lưu | Thời hạn |
|---|---|---|
| Raw API response | Cache tạm (file/Redis/SQLite ephemeral) | TTL ≤ 6 giờ |
| Demand Score (dữ liệu phái sinh của ta) | DB chính | Lưu được |
| Manual snapshot | CSV do người tạo | Lưu được |

Implement `expires_at` và một hàm `purge_expired()`. UI hiển thị timestamp để người dùng
biết dữ liệu tươi tới đâu — đây cũng là điểm chấm "độ tươi nguồn dữ liệu".

**Acceptance criteria:**
- [ ] Raw response quá TTL bị xoá tự động
- [ ] Demand Score vẫn còn sau khi raw bị purge
- [ ] README nêu rõ chính sách này

---

## 10. Definition of Done

Module coi là xong khi tất cả đúng:

- [ ] `probe_access.py` chạy được, kết luận rõ ràng
- [ ] Lấy được trends cho toàn bộ seed keyword (hoặc Plan B nếu 403)
- [ ] Mọi keyword có `canonical_product_type` hoặc `UNMAPPED`, không có null
- [ ] Demand Score có breakdown cộng đúng
- [ ] Output JSON đúng schema §8, không có field bị cấm
- [ ] Không có credential trong source code hoặc log
- [ ] Không có thư viện scraping trong dependency
- [ ] README ghi: nguồn dữ liệu, phương thức, cơ sở tuân thủ ToS, chính sách lưu trữ
- [ ] Chạy end-to-end từ máy sạch trong ≤ 15 phút theo README

---

## 11. Thứ tự thực hiện

```
Task 0 (probe)  ──┬── ACCESS_OK ──→ Task 1 → Task 2 → Task 4 → Output
                  │
                  └── 403 ────────→ Task 3 (Plan B) → Task 4 → Output
```

Task 3 (manual snapshot) chạy song song được với Task 1-2, không phụ thuộc.

---

## 12. Câu hỏi mở — xác nhận trước khi code

1. Format thực tế của `time_series`? → xác nhận bằng call thật ở Task 0.
2. Taxonomy Printway có bao nhiêu product type? → cần file BTC để hoàn thiện seed list.
3. Region nào là thị trường chính? → mặc định US; nếu cần CA/UK thì Shopping Trends
   trong UI cũng chỉ hỗ trợ US/CA/GB-IE.
4. Cửa sổ launch nào dùng để tính `seasonality_fit`? → cần chốt trước khi code §7.
