---
doc_id: DEV-PW1-JOURNEY-001
title: "Product Opportunity Hub — User Journey (Conversational Deep Research Agent)"
version: "4.0"
audience: "Engineering team (2-3 dev, 48h)"
changelog: "v4.0 — đổi mô hình từ dashboard precompute sang agent hội thoại kiểu Deep Research. Taxonomy chuyển sang bridge qua category Etsy/Amazon."
replaces: "brd.md v2.0"
language: "vi"
---

# 01 — USER JOURNEY: AGENT DEEP RESEARCH

**Sản phẩm là một ô chat.** Người dùng gõ một câu tiếng Anh/tiếng Việt như gõ vào Gemini. Agent tự lập kế hoạch, tự gọi API Etsy / Amazon / Google Trends, tự chuẩn hoá về taxonomy Printway, tự chấm Opportunity Score, và trả về **một bản deep research report** kèm bảng cơ hội.

Không có leaderboard tĩnh làm màn hình chính nữa. Leaderboard chỉ là **một dạng output** mà agent render ra khi câu hỏi cần nó.

---

## 1. Sản phẩm nhìn từ ngoài vào

```
┌──────────────────────────────────────────────────────────────────┐
│  PRINTWAY PRODUCT OPPORTUNITY HUB                                │
│                                                                  │
│   💬  "Top 10 sản phẩm personalized gift tăng trưởng nhanh      │
│        nhất 30 ngày qua? Cái nào làm được bằng acrylic?"         │
│                                                    [ Nghiên cứu ]│
│                                                                  │
│   Gợi ý:  [So sánh niche Q4]  [Inspect 1 listing]  [Trend 30d]  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
        Agent hiện KẾ HOẠCH → chạy từng bước có streaming
                              ↓
        Câu trả lời + Bảng Opportunity + Nút "Xuất báo cáo đầy đủ"
```

---

## 2. Vòng đời một truy vấn (đây là toàn bộ sản phẩm)

```
 [1] PARSE       Prompt tự do → ResearchQuery có cấu trúc
                 (intent, keywords, category, material, niche, timeframe, market)
                              ↓
 [2] PLAN        Agent sinh 3-6 bước, HIỂN THỊ CHO NGƯỜI DÙNG THẤY trước khi chạy
                              ↓
 [3] RESEARCH    Gọi tool song song:
                 search_etsy · search_amazon · get_google_trends · get_printway_catalog
                              ↓
 [4] NORMALIZE   listing → taxonomy Printway (qua bridge category Etsy/Amazon)
                              ↓
 [5] CLUSTER     ~200-600 listing → 10-40 Opportunity
                              ↓
 [6] SCORE       6 chiều + Confidence + Hard Gates → verdict  (deterministic, không LLM)
                              ↓
 [7] ANSWER      LLM viết câu trả lời trực tiếp cho đúng câu hỏi + bảng + citation
                              ↓
 [8] REPORT      (tuỳ chọn) Deep research report đầy đủ → Markdown / PDF
```

**Bước 6 không được để LLM làm.** Điểm số phải reproduce được — chạy 2 lần ra 2 kết quả khác nhau là mất 20đ rubric "giải thích được".

---

## 3. Ngân sách thời gian — cam kết với người dùng

Đây là phần dễ chết nhất của mô hình agent. Deep Research thật (Gemini) mất **20 phút/task**. Giám khảo không ngồi chờ 20 phút.

| Bước | Ngân sách | Ghi chú |
| :--- | :---: | :--- |
| [1] Parse | ≤ 2s | 1 LLM call, JSON mode |
| [2] Plan | ≤ 3s | 1 LLM call, hiện ra ngay để người dùng có gì đó đọc |
| [3] Research | ≤ 25s | **Chạy song song `asyncio.gather`**, không tuần tự. Cache warm cho keyword phổ biến |
| [4-6] Normalize + Cluster + Score | ≤ 8s | Thuần Python + embedding local |
| [7] Answer | ≤ 15s | Streaming token, người dùng thấy chữ chạy ngay |
| **Tổng đến câu trả lời** | **≤ 60s** | Mục tiêu 45s |
| [8] Report đầy đủ | +30s | Bấm nút riêng, không nằm trong đường chính |

**Quy tắc UX bù cho độ trễ:** từ giây thứ 3 trở đi màn hình **luôn phải có thứ đang chuyển động** — kế hoạch hiện ra, từng bước tick xanh, đếm số listing đã lấy được, tên nguồn đang gọi. 45 giây có progress cảm giác nhanh hơn 15 giây màn hình trắng.

```
✅ Đã hiểu yêu cầu: 10 sản phẩm · personalized gift · 30 ngày · vật liệu acrylic
✅ Kế hoạch 4 bước
⏳ Bước 1/4 — Tìm trên Etsy ................ 312 listing
⏳ Bước 2/4 — Đối chiếu Amazon ............. 187 listing
⏳ Bước 3/4 — Google Trends 90 ngày ........ 12 keyword
◻️ Bước 4/4 — Chuẩn hoá & chấm điểm
```

---

## 4. Ba nguyên mẫu prompt — bám đúng 3 tình huống mẫu của đề

Đề bài cho sẵn 3 tình huống. Ba nguyên mẫu dưới đây là 3 nhánh `intent` mà parser phải nhận ra. **Chỉ làm 3 cái này cho chắc, đừng cố tổng quát hoá.**

### A. `DISCOVER` — tìm cơ hội
> *"Top 10 sản phẩm personalized gift tăng trưởng nhanh nhất 30 ngày qua là gì? Cái nào phù hợp năng lực sản xuất acrylic / wood / metal?"*

**Output:** 1 đoạn trả lời + bảng 10 dòng (product_type · taxonomy · Score · Confidence · Margin · verdict) + 2-3 câu "vì sao 3 cái đầu đáng chú ý" + nút xuất report.

### B. `INSPECT` — soi một listing cụ thể
> *Dán title: "Personalized Grandpa Gift For Father's Day From Granddaughter"*

**Output:** Taxonomy 3 tầng + nguồn suy ra taxonomy đó (category Etsy nào, material lấy từ đâu) + Score breakdown 6 chiều + Printway fit (SKU, base cost, margin) + verdict.

Parser nhận ra đây là INSPECT khi input **không có động từ hỏi** và trông giống title/URL sản phẩm.

### C. `COMPARE` — so sánh niche
> *"So sánh niche Memorial / Pet / Gardening cho Q4 — niche nào còn ít cạnh tranh nhất? Xuất report đề xuất kèm material và thời điểm launch."*

**Output:** Bảng ma trận 3 cột × 7 dòng chỉ số + **một câu kết luận thẳng** + report.

> Câu kết luận là bắt buộc. Đề ghi rõ: *"BẮT BUỘC trả lời bằng đề xuất hành động — không phải dashboard số liệu thuần"*. Bảng số không có câu kết luận = mất phần lớn 30đ.

### Prompt ngoài 3 nhánh
Parser trả `intent: UNSUPPORTED` → agent trả lời trung thực: *"Tôi làm được 3 việc: tìm cơ hội sản phẩm, phân tích một listing, so sánh niche. Câu hỏi của bạn nằm ngoài phạm vi đó."* kèm 3 nút gợi ý.
**Không được cố trả lời bừa.** Giám khảo sẽ thử một câu vớ vẩn để xem hệ thống có bịa không.

---

## 5. Kế hoạch (bước [2]) phải hiện ra cho người dùng thấy

Đây là thứ làm sản phẩm "giống Gemini Deep Research" nhất, và nó gần như miễn phí về công sức code.

```
Kế hoạch nghiên cứu:
  1. Tìm listing trên Etsy với keyword "personalized acrylic ornament",
     "custom wood plaque", "engraved metal keychain" — 30 ngày gần nhất
  2. Đối chiếu cùng keyword trên dữ liệu Amazon
  3. Lấy Google Trends 90 ngày cho 12 keyword liên quan
  4. Chuẩn hoá về taxonomy Printway, lọc còn acrylic / wood / metal,
     chấm điểm và xếp hạng
                                        [ Chạy ]  [ Sửa kế hoạch ]
```

Nút **"Sửa kế hoạch"** cho phép người dùng bỏ bớt bước hoặc thêm keyword. Bản 48h chỉ cần cho sửa **danh sách keyword** — đủ để thể hiện tính tương tác, tốn 30 phút code.

---

## 6. Citation — mỗi con số phải bấm được

Mọi số trong câu trả lời gắn một chip nhỏ `[E:142]` nghĩa là *142 listing Etsy*. Click ra panel bên phải hiện danh sách listing gốc kèm link, giá, ngày thu thập.

Không có citation thì mất cả 15đ "độ phủ và độ tươi của nguồn dữ liệu" lẫn điểm traceability trong phần hỏi đáp. Đây là tính năng rẻ nhất trên mỗi điểm ăn được — đừng để đến cuối mới làm.

---

## 7. Bốn tình huống hỏng bắt buộc xử lý

| Tình huống | Agent phải làm | Cấm |
| :--- | :--- | :--- |
| API Etsy trả 429 / timeout | Fallback sang corpus local đã cache, **nói rõ trong câu trả lời**: *"Etsy API bị giới hạn, dùng snapshot ngày 20/08"* | Im lặng trả kết quả như thường |
| Không tìm được listing nào | *"Không tìm thấy dữ liệu cho keyword này"* + gợi ý keyword gần | Trả bảng rỗng, hoặc bịa |
| Title không map được taxonomy | `Unclassified` + top-3 ứng viên + nút chọn tay | Đoán bừa product_type |
| Printway không sản xuất được | Hard gate → verdict tối đa `WATCHING`, nêu lý do vật liệu/công nghệ | Cho `RECOMMEND` |
| Dính nhãn hiệu (Disney, Nike…) | `BLOCKED — IP Risk`, hiện keyword đã match | Chấm điểm rồi mới cảnh báo ở dưới |

---

## 8. Taxonomy: dùng category của Etsy/Amazon làm cầu nối

**Hướng team đề xuất là đúng, và tốt hơn cách embed thẳng title.** Lý do:

Etsy có endpoint `getSellerTaxonomyNodes` trả về **toàn bộ cây danh mục chính thức**, chỉ cần API key, không cần OAuth. Mỗi listing mang sẵn `taxonomy_id` và mảng `materials` do seller khai. Nghĩa là ta có **dữ liệu có cấu trúc do chính nền tảng cung cấp** thay vì phải đoán từ chuỗi tiêu đề marketing.

Cách map 2 tầng:

```
  Etsy taxonomy_id 1234
     → path "Home & Living > Home Decor > Ornaments & Accents > Ornaments"
     → [BẢNG BRIDGE do người map tay]
     → thu hẹp từ 150 node Printway xuống còn 3-8 ứng viên

  listing.materials = ["acrylic", "vinyl"]  +  title chứa "acrylic"
     → chọn trong 3-8 ứng viên đó → "Custom Shape Acrylic Ornament / Acrylic 3mm"
```

**Điểm mấu chốt:** category nền tảng cho ra `Category` và thu hẹp `Product Type` với độ tin cậy cao (`method: observed`), nhưng **không bao giờ cho ra `Material`** — Etsy không phân biệt ornament acrylic với ornament gỗ. Material vẫn phải trích từ `materials[]` + title. Nên kiến trúc là **hợp nhất 2 tín hiệu**, không phải thay thế.

Đổi lại:
- Bảng bridge chỉ ~60-120 dòng người map tay một lần, sửa trong 10 giây khi sai — khác hẳn việc phải tune ngưỡng embedding.
- Sai ở đâu chỉ được ra ngay: sai bridge, hay sai material extraction.
- Seller Etsy hay chọn node quá chung ("Home Decor" trần) → khi bridge trả >8 ứng viên thì **rơi về embedding title** như phương án dự phòng. Giữ cả hai đường.

Chi tiết thuật toán và schema bảng bridge: `03-IO-CONTRACT.md § 4`.

---

## 9. Deep research report (bước [8])

Bấm nút "Xuất báo cáo đầy đủ" → Markdown + PDF, cấu trúc bám đúng 6 câu hỏi của đề:

| § | Nội dung | Nguồn số liệu |
| :-- | :--- | :--- |
| 0 | Câu hỏi gốc + kế hoạch đã chạy + phạm vi dữ liệu (nguồn nào, bao nhiêu listing, thu thập lúc nào) | Run state |
| 1 | Sản phẩm đề xuất: tên chuẩn, taxonomy 3 tầng, SKU Printway | Normalize + Catalog |
| 2 | Tín hiệu tăng trưởng: revenue 30d, growth %, Trends slope | Metrics |
| 3 | Niche ít cạnh tranh: top 3 niche + số seller + giá TB | Cluster |
| 4 | Design insight: top màu / top quote / kiểu personalization — **trích từ tag và title thật** | Listing corpus |
| 5 | Năng lực xưởng & tài chính: base cost, retail đề xuất, margin, complexity, lead time | Catalog |
| 6 | Launch window: ngày cụ thể + lý do (lead time + mùa vụ) | Season logic |
| 7 | **Bằng chứng phản biện** + việc cần làm tiếp + điều kiện dừng | LLM + gates |

§7 là thứ phân biệt một bản deep research thật với một bài quảng cáo. Một dòng kiểu *"rủi ro: 34% doanh thu đang nằm ở 3 shop, nếu họ giảm giá thì margin dự kiến không giữ được"* ăn điểm cao hơn mười dòng khen sản phẩm.

**Ràng buộc cứng:** mọi con số trong report phải tồn tại trong JSON run state. Report sinh bằng **template Jinja2 điền từ JSON**, LLM chỉ viết phần văn xuôi. Không cho LLM quyền phát minh con số.

---

## 10. Business rules — dịch thẳng thành assertion

| ID | Rule | Chỗ implement |
| :--- | :--- | :--- |
| **R1** | Mọi số hiển thị có `source_id` + `collected_at` | Pydantic `Metric` bắt buộc 2 field |
| **R2** | Thiếu dữ liệu → `N/A`, không phải `0` | `score_dimension()` trả `None`, orchestrator chia lại trọng số |
| **R3** | Score và Confidence độc lập, hiện riêng | 2 hàm, 2 cột |
| **R4** | Score ≥75 mà Confidence <60 → badge vàng "điểm cao, dữ liệu yếu" | `decide_verdict()` |
| **R5** | Hard gate ghi đè verdict, score cao không override được | `apply_gates()` chạy sau `score()` |
| **R6** | Taxonomy chỉ map vào node có trong file Printway | Bridge table validate FK lúc load |
| **R7** | Scoring deterministic — chạy 2 lần ra kết quả y hệt | Không LLM trong `hub/scoring/` |
| **R8** | Agent chỉ được lấy số qua tool, không tự nhớ | Prompt cấm; validate số trong answer phải có trong run state |
| **R9** | Không commit `.env` | `.gitignore` từ commit đầu |

R8 là rule quan trọng nhất của mô hình agent. LLM rất giỏi bịa ra "$145,000/tháng" nghe hợp lý. Sau bước [7] chạy một **hàm kiểm tra**: trích mọi số trong câu trả lời, đối chiếu với run state, số nào không khớp thì đánh dấu và bắt sinh lại.

---

## 11. Cái chúng ta không làm — nói thẳng trên slide

- Không realtime liên tục. Mỗi lần chạy là một **snapshot có `collected_at`**, đóng băng để truy vết được.
- Sales và revenue của Etsy/Amazon là **ước lượng** (`method: estimated`) — không nền tảng nào công khai số bán thật. Xem `03-IO-CONTRACT.md § 2`.
- Không crawl vượt ToS. API chính thức + export được cấp phép.
- Không auto-đặt lệnh sản xuất, không sinh file thiết kế.
- Agent chỉ khuyến nghị. Người bấm duyệt.

---

**Tiếp theo:** `02-PRD-SCOPE.md` — chọn kiến trúc agent và cắt scope xuống 48h.
