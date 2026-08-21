---
doc_id: DEV-PW1-SCOPE-002
title: "Product Opportunity Hub — Kiến trúc Agent, Scope & Acceptance (48h)"
version: "4.0"
audience: "Engineering team (2-3 dev, 48h)"
changelog: "v4.0 — chuyển sang agent hội thoại; quyết định không dùng Gemini Deep Research API; taxonomy bridge"
replaces: "prd.md v2.0"
language: "vi"
---

# 02 — KIẾN TRÚC AGENT, SCOPE & ACCEPTANCE CRITERIA

**Ràng buộc:** 48 giờ · 2-3 dev · chưa test nguồn dữ liệu nào.

---

## 1. Quyết định số 1: KHÔNG dùng Gemini Deep Research API

Team muốn trải nghiệm giống Gemini Deep Research. Google có API thật cho việc đó (`deep-research-preview-04-2026`, `deep-research-max-preview-04-2026`). Nhưng đọc kỹ đặc tính của nó thì nó không dùng được cho bài này:

| Đặc tính Deep Research API | Hệ quả với ta |
| :--- | :--- |
| Tác vụ chạy **20 phút, tối đa 60 phút**, bắt buộc `background=True` rồi poll | Giám khảo hỏi 8-10 câu trong vài phút. 20 phút/câu là loại thẳng |
| **Không hỗ trợ custom function calling** — chỉ có built-in tool (Google Search, URL Context, Code Execution, File Search) + MCP server | Ta không nhét được `search_etsy()`, `get_printway_catalog()`, `score()` vào. Muốn dùng phải bọc thành MCP server — thêm việc, thêm chỗ hỏng |
| Nó tự quyết định research thế nào | Ta mất kiểm soát: không ép được nó chấm điểm bằng công thức của ta, không ép được nó chỉ map vào taxonomy Printway |
| ~$1-3/task, bản Max $3-7/task | Test 200 lần trong 48h là $200-600 |

**Quyết định: tự dựng agent loop.** Plan → parallel tool calls → deterministic scoring → synthesize. Dùng Gemini 2.5 Flash hoặc Claude Sonnet với function calling thường. Latency 45-60s, kiểm soát hoàn toàn, chi phí ~$0.02/query.

Trải nghiệm "deep research" không đến từ việc gọi đúng cái API tên là Deep Research. Nó đến từ: **hiện kế hoạch ra trước khi chạy · stream tiến độ từng bước · trích dẫn nguồn bấm được · report có mục phản biện.** Bốn thứ đó ta tự làm được trong 48h.

> Nếu muốn ghi điểm bonus: thêm nút **"Deep mode"** chạy Gemini Deep Research API ở background cho những câu hỏi rộng, trả kết quả sau vài phút vào tab riêng. Chỉ làm nếu MUST và SHOULD đã xong. Đừng đưa vào đường demo chính.

---

## 2. Quyết định số 2: kiến trúc chạy được trong 48h

| Tầng | Chọn | Vì sao |
| :--- | :--- | :--- |
| Agent orchestrator | **Python thuần** — vòng lặp `plan → asyncio.gather(tools) → score → synthesize` | Không dùng LangChain/LlamaIndex. Với 5 tool và 3 intent, framework tốn thời gian debug hơn là tiết kiệm |
| LLM | **Gemini 2.5 Flash** (parse/plan/synthesize) — nhanh, rẻ, JSON mode tốt | Có thể đổi sang Claude/GPT qua 1 biến env. Không khoá cứng vào 1 vendor |
| Frontend | **Streamlit** + `st.write_stream` | Dựng UI chat có streaming trong ~5h. Rubric chấm UX, không chấm framework |
| Backend | **FastAPI**, 1 process, endpoint SSE | Ranh giới để 3 dev làm song song |
| Corpus | **SQLite + FTS5** (full-text search built-in) | Tool `search_etsy` query local trước, API sau. FTS5 có sẵn trong Python, zero setup |
| Embedding | **`all-MiniLM-L6-v2`** local, 384 dims | Chỉ dùng làm fallback khi bridge không quyết được. Chạy offline |
| Vector store | **numpy matrix trong RAM** | Taxonomy Printway ~150 node. Chroma là thừa ở quy mô này |
| Deploy | 1 `Dockerfile` hoặc `pip install -r requirements.txt && streamlit run app.py` | README yêu cầu cài ≤15 phút |

### Chiến lược dữ liệu: local-first, API-second

Đây là thứ quyết định demo sống hay chết.

```
tool search_etsy(keywords, timeframe):
    1. Query SQLite FTS5 corpus local          → 50ms, luôn có kết quả
    2. Nếu có ETSY_API_KEY và corpus thiếu     → gọi live findAllListingsActive
    3. Kết quả live ghi ngược vào corpus       → lần sau nhanh
    4. API lỗi/429/timeout 3s                  → dùng kết quả local, gắn cờ degraded
```

Corpus local seed sẵn 500-800 listing. Nghĩa là: **mọi câu hỏi luôn có câu trả lời trong 60s, kể cả khi wifi hội trường chết hoặc Etsy trả 429.** Live API là phần thưởng thêm, không phải phụ thuộc.

---

## 3. Bộ tool của agent

| Tool | Nguồn thật | Ưu tiên |
| :--- | :--- | :---: |
| `search_etsy(keywords, timeframe, limit)` | SQLite FTS5 corpus (Alura export) → Etsy API v3 nếu có key | MUST |
| `search_amazon(keywords, limit)` | SQLite FTS5 corpus (Helium 10 export). **Không dùng PA-API** | MUST |
| `get_google_trends(keywords, window_days)` | CSV đã cache. pytrends chỉ chạy offline trước demo | SHOULD |
| `get_printway_catalog(product_type?, material?)` | File JSON BTC cấp, load vào dict | MUST |
| `normalize_taxonomy(listings)` | Bridge table + material extraction + embedding fallback | MUST |
| `score_opportunities(clusters)` | Deterministic Python, **không LLM** | MUST |

Sáu tool. Không hơn. Mỗi tool thêm vào là thêm một nhánh agent chọn sai.

---

## 4. Scope: MUST / SHOULD / WON'T

### 🔴 MUST — không có thì không nộp được (~28h)

| ID | Tính năng | Rubric | Est. |
| :--- | :--- | :---: | :---: |
| **F-01** | Prompt parser: free text → `ResearchQuery` (intent + entities), nhận đúng 3 intent | 30đ | 3h |
| **F-02** | Agent loop: plan → parallel tools → score → synthesize, có streaming từng bước | 30đ + 15đ UX | 6h |
| **F-03** | Tool `search_etsy` + `search_amazon` trên SQLite FTS5, ≥2 nguồn độc lập | 15đ | 4h |
| **F-04** | **Taxonomy bridge**: Etsy/Amazon category → Printway, + material extraction | 20đ | 6h |
| **F-05** | Cluster + Opportunity Score 6 chiều + Confidence + Hard Gates | 20đ | 5h |
| **F-06** | UI chat Streamlit: ô prompt, hiện plan, stream tiến độ, bảng kết quả | 15đ | 4h |

### 🟡 SHOULD — làm nếu MUST xong trước giờ 32 (~11h)

| ID | Tính năng | Rubric | Est. |
| :--- | :--- | :---: | :---: |
| **F-07** | Deep research report 8 mục → Markdown + PDF | 30đ | 5h |
| **F-08** | Citation bấm được: chip `[E:142]` → panel listing gốc | traceability | 2h |
| **F-09** | Intent `COMPARE` với ma trận niche + câu kết luận tự sinh | 30đ | 2h |
| **F-10** | Design Insights: top màu / quote / kiểu personalization từ tag + title | bonus | 2h |

### 🟢 COULD — chỉ khi còn >8h

| ID | Tính năng | Est. |
| :--- | :--- | :---: |
| **F-11** | Sửa kế hoạch trước khi chạy (chỉnh danh sách keyword) | 1h |
| **F-12** | Etsy API live adapter cắm vào tool đã có | 2h |
| **F-13** | "Deep mode" gọi Gemini Deep Research API ở background | 3h |
| **F-14** | Early-trend alert (growth cao + seller thấp) | 2h |

### ⛔ WON'T — ghi vào README mục Limitations

| Bỏ | Lý do |
| :--- | :--- |
| Amazon PA-API live | Cần Associates account duy trì ≥3 qualifying sales/30 ngày, ~1 req/s, **không trả sales rank lẫn sales volume**. Vô dụng với ta kể cả khi có |
| Gemini Deep Research API làm đường chính | §1 |
| LangChain / LlamaIndex / AutoGen | Debug framework tốn hơn tự viết vòng lặp 80 dòng |
| Postgres · Redis · ChromaDB · Next.js | SQLite + numpy đủ ở quy mô này |
| Walmart · TikTok Shop · Facebook Ads Library · Pinterest | Đề nói "có thể mở rộng". Mỗi nguồn +3h, +0 điểm chắc chắn |
| Multi-turn hội thoại có nhớ ngữ cảnh | Mỗi query độc lập. Multi-turn thêm cả tầng state, không ăn điểm rubric nào |
| Auth / multi-user | Demo 1 người |
| Cam kết "accuracy ≥95%" | §6 |

---

## 5. Acceptance Criteria

### F-01 Parser
```
GIVEN 15 prompt mẫu trong tests/fixtures/prompts.json (5 DISCOVER, 5 INSPECT, 5 COMPARE)
      + 3 prompt rác ("hôm nay ăn gì")
WHEN parse_query(prompt)
THEN intent đúng ≥ 14/15
AND 3 prompt rác trả intent = "UNSUPPORTED", KHÔNG cố trả lời
AND entities trích được: keywords[], materials[], timeframe_days, niches[], top_n
```

### F-02 Agent loop
```
1. Mỗi run sinh ra RunState JSON đầy đủ (plan, tool_calls, timings, sources, results)
2. Thời gian đến câu trả lời ≤ 60s (đo trên máy demo, 10 lần liên tiếp, p95)
3. Tool chạy SONG SONG — assert: tổng thời gian research < tổng thời gian từng tool cộng lại
4. Tool nào lỗi → run vẫn hoàn thành, câu trả lời NÊU RÕ nguồn nào thiếu
5. TẮT WIFI → mọi query vẫn ra kết quả từ corpus local (chỉ khối synthesize cần mạng)
6. Mọi con số trong câu trả lời tồn tại trong RunState — chạy verify_numbers() tự động
```
Tiêu chí 6 là chốt chặn LLM bịa số. Bắt buộc.

### F-04 Taxonomy bridge ← **20 điểm**
```
GIVEN data/gold/taxonomy_testset.csv (50 dòng: raw_title, etsy_taxonomy_path, materials,
      expected_category, expected_product_type, expected_material)
WHEN pytest tests/test_taxonomy.py
THEN accuracy(category)     ≥ 0.92   (cao vì lấy từ category nền tảng)
AND  accuracy(product_type) ≥ 0.85
AND  accuracy(material)     ≥ 0.80
AND  mọi kết quả có field `method` ∈ {bridge, bridge+material, embedding_fallback, llm_resolved, unclassified}
AND  mọi kết quả có `evidence` chỉ rõ suy ra từ đâu (category path nào / material field nào)
```
> **Giờ đầu tiên của dự án là xây gold set 50 dòng, không phải giờ thứ 30.** Không có gold set thì không đo được; không đo được thì không tune được; và giám khảo chấm đúng bằng một bộ test kiểu này.

### F-05 Scoring
```
1. score(opp) ∈ [0,100] với mọi input — không NaN, không None, không >100
2. sum(WEIGHTS.values()) == 1.0  (assert ở module level)
3. Chạy 2 lần trên cùng input → BIT-IDENTICAL (deterministic, không LLM)
4. Breakdown có chiều = None → total vẫn tính được (chia lại trọng số) VÀ confidence giảm ≥15
5. Title dính IP keyword → verdict == "BLOCKED" bất kể score
6. Printway không có SKU → verdict KHÔNG BAO GIỜ == "RECOMMEND"
7. Mỗi chiều có `reason` sinh bằng f-string từ chính số đã dùng, độ dài > 20 ký tự
```

### F-06 UI
```
1. Từ giây thứ 3 trở đi luôn có thứ đang chuyển động trên màn hình
2. Kế hoạch hiện ra trước khi tool chạy
3. Không traceback Python nào lộ ra màn hình ở bất kỳ luồng nào
4. Người không biết code chạy được 3 nguyên mẫu prompt mà không cần hướng dẫn
```

### F-07 Report
```
1. Bấm 1 nút → .md sinh ra ≤ 30s
2. Có đủ 8 mục (§0-§7 theo 01-USER-JOURNEY §9)
3. Mỗi mục có dòng "Nguồn:" — source_id + số listing + collected_at
4. §7 (phản biện) không rỗng, không phải câu sáo
5. Mọi số trong file tồn tại trong RunState — assert đối chiếu tự động
```

---

## 6. Về con số "≥95% accuracy"

Đừng đưa vào slide hay README. Chưa ai đo. Đo ra 87% mà slide ghi 95% thì giám khảo mất niềm tin vào mọi con số còn lại.

**Nói đúng cách:** *"Chúng tôi xây gold set 50 listing, đo được X% product_type / Y% category. Sai chủ yếu ở [loại lỗi], vì [lý do], hướng xử lý là [gì]."* Rubric có riêng 20đ cho độ chính xác trên bộ test ~50 listing và giám khảo sẽ chạy bộ test của họ — trả lời kiểu này ăn điểm cao hơn con số 95% không bằng chứng.

---

## 7. Non-functional

| Yêu cầu | Cam kết | Đạt bằng |
| :--- | :--- | :--- |
| Câu trả lời | p95 ≤ 60s, mục tiêu 45s | Tool chạy song song + corpus local |
| Report đầy đủ | ≤ 30s | Jinja2 + 1 lần gọi LLM streaming |
| Chạy khi mất mạng | **Bắt buộc cho phần research** | Corpus SQLite + embedding local đóng gói trong repo |
| Setup máy BGK | ≤ 15 phút | 1 lệnh, corpus commit sẵn |
| Chi phí | ≤ $0.05/query | Gemini Flash, 3 LLM call/query |

> Dòng "chạy khi mất mạng" là kinh nghiệm xương máu. Wifi hội trường sẽ hỏng đúng lúc demo. Chuẩn bị sẵn **1 run đã cache đầy đủ** cho prompt demo chính, để kể cả LLM không gọi được vẫn có gì chiếu.

---

## 8. Chia việc 3 dev

Ranh giới giữa 3 người là **schema JSON trong `03-IO-CONTRACT.md`**, không phải "ai xong trước".

| Dev | Sở hữu | Giờ 12 | Giờ 32 |
| :--- | :--- | :--- | :--- |
| **A — Data & Taxonomy** | `hub/tools/`, `hub/taxonomy/` | Corpus SQLite 500+ listing · gold set 50 dòng · bridge table v1 | Accuracy đo xong, tune xong |
| **B — Agent & Scoring** | `hub/agent/`, `hub/scoring/`, `hub/report/` | Agent loop chạy trên **tool giả trả fixture JSON** | Nối tool thật, report xong |
| **C — API & UI** | `hub/api/`, `app.py` | Chat UI stream từ **`runstate.mock.json`** phát lại | Nối SSE thật, đánh bóng UX |

**Giờ thứ 2, cả 3 ngồi chốt `runstate.mock.json`** — một run hoàn chỉnh với plan, 3 tool call, 8 opportunity đã chấm điểm. Sau đó mỗi người code độc lập 30 tiếng. Đây là cách duy nhất 3 người song song được trong 48h.

### Timeline

| Mốc | Việc |
| :--- | :--- |
| H0-H2 | Chốt schema + `runstate.mock.json` + repo skeleton (cả 3) |
| H2-H12 | A: corpus + gold set + bridge · B: agent loop trên mock tool · C: chat UI trên mock |
| H12 | **Checkpoint 1** — 3 người demo phần mình cho nhau |
| H12-H32 | A: tune taxonomy · B: scoring + report · C: nối SSE thật |
| H32 | **Checkpoint 2 — FEATURE FREEZE.** MUST còn bug thì cắt SHOULD |
| H32-H42 | Integration, chạy 3 nguyên mẫu prompt end-to-end, sinh 1 report mẫu để nộp, cache sẵn run demo |
| H42-H48 | README · video 3-5 phút · slide · **tập trả lời 10 câu hỏi** |

> H42-H48 không phải giờ dự phòng. 45/100 điểm (tính hành động 30 + UX 15) chấm qua chính buổi demo. Code thêm 6 tiếng ở đoạn này ăn ít điểm hơn tập demo 6 tiếng.

---

## 9. Sản phẩm nộp

| Deliverable | Yêu cầu của đề | Chủ | Deadline |
| :--- | :--- | :---: | :---: |
| GitHub repo public | Có `.env.example`, không có `.env` | C | H44 |
| README 1-2 trang | 4 mục: kiến trúc · nguồn dữ liệu · phương pháp scoring · cài đặt ≤15 phút | B | H44 |
| Demo video 3-5 phút | **≥3 luồng: trend discovery → scoring → report** | C | H46 |
| ≥1 report mẫu tự sinh | Không sửa tay, commit vào `samples/` | B | H42 |
| Bộ slide | ≥1 slide nói thẳng về giới hạn dữ liệu | A | H46 |
| *(tuỳ chọn)* live demo URL | Streamlit Community Cloud, free | C | nếu còn giờ |

### 10 câu giám khảo sẽ hỏi — chuẩn bị sẵn câu trả lời

1. *"Con số revenue này từ đâu?"* → bấm chip citation, ra listing gốc ngay trên màn hình.
2. *"Sao chiều này 61 điểm mà không phải 70?"* → đọc `reason`, chỉ vào công thức.
3. *"Sản phẩm X xưởng không làm được, hệ thống biết không?"* → gõ vào ô chat, ra `NOT_FEASIBLE` tại chỗ.
4. *"Dữ liệu tươi đến ngày nào?"* → `collected_at` hiện trong phần phạm vi dữ liệu của mọi câu trả lời.
5. *"Tôi dán một title hoàn toàn lạ thì sao?"* → `Unclassified` + top-3 gợi ý, không crash.
6. *"Sao biết listing này là acrylic chứ không phải gỗ?"* → chỉ vào `evidence`: field `materials` của Etsy + từ khoá trong title.
7. *"Nếu Etsy API chết thì sao?"* → tắt wifi, chạy lại, vẫn ra kết quả kèm cảnh báo degraded.
8. *"Hệ thống có bịa số không?"* → mở `verify_numbers()`, giải thích cơ chế đối chiếu.
9. *"Đây có phải chỉ là ChatGPT wrapper không?"* → chỉ vào `hub/scoring/` — deterministic, không LLM, chạy 2 lần ra y hệt.
10. *"Scale lên 100k listing thì sao?"* → nói thật: SQLite FTS5 chịu được ~1M dòng; quá ngưỡng thì đổi sang Postgres + pgvector, ranh giới đã tách sẵn ở tầng tool.

---

**Tiếp theo:** `03-IO-CONTRACT.md` — tool schema, bridge table, run state, công thức chấm điểm.
