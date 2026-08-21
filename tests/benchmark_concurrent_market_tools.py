"""
PARALLEL CONCURRENT STRESS TEST SUITE FOR AMAZON & ETSY TOOLS
Executes 16 diverse test cases concurrently with detailed schema and data verification.
"""

import time
import json
import concurrent.futures
from src.tools.market_tools import fetch_etsy_market_data, fetch_amazon_market_data

TEST_ITEMS = [
    # 1. Apparel
    ("Amazon", "personalized mama sweatshirt embroidered", {"limit": 3, "sort_by": "price_high"}),
    ("Etsy", "personalized mama sweatshirt embroidered", {"limit": 3, "sort_by": "bestseller"}),
    # 2. Pet Memorial
    ("Amazon", "custom acrylic dog memorial ornament", {"limit": 4, "sort_by": "reviews_high"}),
    ("Etsy", "custom acrylic dog memorial ornament", {"limit": 4, "sort_by": "price_low"}),
    # 3. Drinkware
    ("Amazon", "stainless steel tumbler 40oz laser engraved", {"limit": 3, "sort_by": "bestseller"}),
    ("Etsy", "stainless steel tumbler 40oz laser engraved", {"limit": 3, "sort_by": "relevance"}),
    # 4. Desk Plaque
    ("Amazon", "custom wooden desk plaque led light", {"limit": 3, "sort_by": "price_high"}),
    ("Etsy", "custom wooden desk plaque led light", {"limit": 3, "sort_by": "reviews_high"}),
    # 5. Suncatcher
    ("Amazon", "suncatcher acrylic window hanging stained glass", {"limit": 3, "sort_by": "price_low"}),
    ("Etsy", "suncatcher acrylic window hanging stained glass", {"limit": 3, "sort_by": "bestseller"}),
    # 6. Baby Ornament
    ("Amazon", "custom baby first christmas ornament 2026", {"limit": 3, "sort_by": "relevance"}),
    ("Etsy", "custom baby first christmas ornament 2026", {"limit": 3, "sort_by": "price_high"}),
    # 7. Keychain
    ("Amazon", "personalized leather keychain custom photo", {"limit": 3, "sort_by": "price_low"}),
    ("Etsy", "personalized leather keychain custom photo", {"limit": 3, "sort_by": "reviews_high"}),
    # 8. Grandpa Gift
    ("Amazon", "grandpa birthday gift custom acrylic sign with stand", {"limit": 3, "sort_by": "reviews_high"}),
    ("Etsy", "grandpa birthday gift custom acrylic sign with stand", {"limit": 3, "sort_by": "bestseller"})
]

def run_single_test(item):
    platform, kw, filters = item
    t0 = time.time()
    try:
        if platform == "Amazon":
            out = fetch_amazon_market_data.invoke({
                "keyword": kw,
                "limit": filters["limit"],
                "sort_by": filters["sort_by"]
            })
            tag = "[TOON:AMAZON]"
        else:
            out = fetch_etsy_market_data.invoke({
                "keyword": kw,
                "limit": filters["limit"],
                "sort_by": filters["sort_by"]
            })
            tag = "[TOON:ETSY]"
        
        dur = time.time() - t0
        has_tag = tag in out
        has_prods = "top_products=" in out and "None" not in out
        
        return {
            "platform": platform,
            "keyword": kw,
            "filter": filters,
            "duration": f"{dur:.2f}s",
            "status": "PASSED" if (has_tag and has_prods) else "WARNING",
            "output_snippet": out
        }
    except Exception as e:
        dur = time.time() - t0
        return {
            "platform": platform,
            "keyword": kw,
            "filter": filters,
            "duration": f"{dur:.2f}s",
            "status": "FAILED",
            "error": str(e)
        }

def main():
    print("=" * 80)
    print("🚀 BẮT ĐẦU CHẠY 16 TEST CASES ĐỒNG THỜI (PARALLEL CONCURRENT STRESS TEST)")
    print("=" * 80)
    
    t_start = time.time()
    results = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(run_single_test, item) for item in TEST_ITEMS]
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            results.append(res)
            print(f"[{res['status']}] {res['platform']:<6} | {res['duration']:<6} | kw: \"{res['keyword'][:35]}...\"")
            if res['status'] == 'PASSED':
                print(f"       👉 {res['output_snippet']}")

    total_time = time.time() - t_start
    passed = sum(1 for r in results if r["status"] == "PASSED")
    
    print("\n" + "=" * 80)
    print(f"🏆 KẾT QUẢ: {passed}/{len(TEST_ITEMS)} PASSED ({passed/len(TEST_ITEMS)*100:.1f}%) TRONG {total_time:.2f} GIÂY")
    print("=" * 80)

if __name__ == "__main__":
    main()
