"""
COMPREHENSIVE STRESS TEST SUITE FOR AMAZON & ETSY CRAWLEE TOOLS
Runs 16 multi-condition test cases across 8 diverse e-commerce niches.
"""

import time
import json
from src.tools.market_tools import fetch_etsy_market_data, fetch_amazon_market_data

TEST_CASES = [
    {
        "niche": "Apparel (Áo nỉ thêu)",
        "keyword": "personalized mama sweatshirt embroidered",
        "amazon_filter": {"limit": 3, "sort_by": "price_high"},
        "etsy_filter": {"limit": 3, "sort_by": "bestseller"}
    },
    {
        "niche": "Pets Memorial (Móc khóa / Ornament thú cưng)",
        "keyword": "custom acrylic dog memorial ornament",
        "amazon_filter": {"limit": 4, "sort_by": "reviews_high"},
        "etsy_filter": {"limit": 4, "sort_by": "price_low"}
    },
    {
        "niche": "Drinkware (Ly giữ nhiệt 40oz)",
        "keyword": "stainless steel tumbler 40oz laser engraved",
        "amazon_filter": {"limit": 3, "sort_by": "bestseller"},
        "etsy_filter": {"limit": 3, "sort_by": "relevance"}
    },
    {
        "niche": "Home Decor (Đèn led để bàn Mica Gỗ)",
        "keyword": "custom wooden desk plaque led light",
        "amazon_filter": {"limit": 3, "sort_by": "price_high"},
        "etsy_filter": {"limit": 3, "sort_by": "reviews_high"}
    },
    {
        "niche": "Window Decor (Suncatcher Acrylic)",
        "keyword": "suncatcher acrylic window hanging stained glass",
        "amazon_filter": {"limit": 3, "sort_by": "price_low"},
        "etsy_filter": {"limit": 3, "sort_by": "bestseller"}
    },
    {
        "niche": "Holiday Q4 (Baby First Christmas 2026)",
        "keyword": "custom baby first christmas ornament 2026",
        "amazon_filter": {"limit": 3, "sort_by": "relevance"},
        "etsy_filter": {"limit": 3, "sort_by": "price_high"}
    },
    {
        "niche": "Accessories (Móc khóa da khắc tên)",
        "keyword": "personalized leather keychain custom photo",
        "amazon_filter": {"limit": 3, "sort_by": "price_low"},
        "etsy_filter": {"limit": 3, "sort_by": "reviews_high"}
    },
    {
        "niche": "Gifts for Family (Quà tặng Ông / Bố)",
        "keyword": "grandpa birthday gift custom acrylic sign with stand",
        "amazon_filter": {"limit": 3, "sort_by": "reviews_high"},
        "etsy_filter": {"limit": 3, "sort_by": "bestseller"}
    }
]

def run_suite():
    print("=" * 70)
    print("🚀 BẮT ĐẦU CHẠY BỘ KIỂM THỬ STRESS TEST TOÀN DIỆN (16 TEST CASES)")
    print("=" * 70)
    
    total_tests = len(TEST_CASES) * 2
    passed_tests = 0
    start_total = time.time()
    results_log = []

    for idx, tc in enumerate(TEST_CASES, 1):
        niche = tc["niche"]
        kw = tc["keyword"]
        
        print(f"\n[{idx}/8] 📦 Ngách: {niche} | Keyword: \"{kw}\"")
        print("-" * 65)

        # 1. Test Amazon Tool
        amz_f = tc["amazon_filter"]
        t0 = time.time()
        try:
            amz_out = fetch_amazon_market_data.invoke({
                "keyword": kw,
                "limit": amz_f["limit"],
                "sort_by": amz_f["sort_by"]
            })
            dur_amz = time.time() - t0
            assert "[TOON:AMAZON]" in amz_out, "Missing [TOON:AMAZON] tag"
            assert "top_products=" in amz_out, "Missing top_products field"
            print(f"  ✅ AMAZON ({amz_f['sort_by']}, limit={amz_f['limit']}) - {dur_amz:.2f}s")
            print(f"     👉 {amz_out[:120]}...")
            passed_tests += 1
            results_log.append({"test": f"Amazon - {niche}", "status": "PASSED", "duration": f"{dur_amz:.2f}s", "output": amz_out})
        except Exception as e:
            dur_amz = time.time() - t0
            print(f"  ❌ AMAZON FAILED ({dur_amz:.2f}s): {e}")
            results_log.append({"test": f"Amazon - {niche}", "status": "FAILED", "duration": f"{dur_amz:.2f}s", "error": str(e)})

        # 2. Test Etsy Tool
        etsy_f = tc["etsy_filter"]
        t0 = time.time()
        try:
            etsy_out = fetch_etsy_market_data.invoke({
                "keyword": kw,
                "limit": etsy_f["limit"],
                "sort_by": etsy_f["sort_by"]
            })
            dur_etsy = time.time() - t0
            assert "[TOON:ETSY]" in etsy_out, "Missing [TOON:ETSY] tag"
            assert "top_products=" in etsy_out, "Missing top_products field"
            print(f"  ✅ ETSY ({etsy_f['sort_by']}, limit={etsy_f['limit']}) - {dur_etsy:.2f}s")
            print(f"     👉 {etsy_out[:120]}...")
            passed_tests += 1
            results_log.append({"test": f"Etsy - {niche}", "status": "PASSED", "duration": f"{dur_etsy:.2f}s", "output": etsy_out})
        except Exception as e:
            dur_etsy = time.time() - t0
            print(f"  ❌ ETSY FAILED ({dur_etsy:.2f}s): {e}")
            results_log.append({"test": f"Etsy - {niche}", "status": "FAILED", "duration": f"{dur_etsy:.2f}s", "error": str(e)})

    total_duration = time.time() - start_total
    print("\n" + "=" * 70)
    print(f"🏆 KẾT QUẢ TỔNG THỂ: {passed_tests}/{total_tests} TESTS PASSED ({(passed_tests/total_tests)*100:.1f}%)")
    print(f"⏱️ Tổng thời gian thực thi: {total_duration:.2f}s (Trung bình: {total_duration/total_tests:.2f}s/test)")
    print("=" * 70)

if __name__ == "__main__":
    run_suite()
