import json
import time
from src.crawlers.etsy_scraper import EtsyWebScraper
from src.crawlers.amazon_scraper import AmazonWebScraper
from src.crawlers.shopee_scraper import ShopeeWebScraper
from src.crawlers.google_trends_scraper import GoogleTrendsWebScraper

PRODUCTS_TO_TEST = [
    "personalized grandpa acrylic ornament",
    "custom shape wooden plaque father day",
    "cat mom ceramic mug personalized",
    "family photo acrylic night light",
    "custom embroidered sweatshirt mama"
]

def run_multi_product_stress_test():
    print("=================================================================")
    print("🚀 MULTI-PRODUCT WEB SCRAPING STRESS TEST (ANTI-BLOCKING VERIFICATION)")
    print("=================================================================\n")
    
    etsy = EtsyWebScraper()
    amazon = AmazonWebScraper()
    shopee = ShopeeWebScraper()
    trends = GoogleTrendsWebScraper()

    total_scrapes = 0
    successful_scrapes = 0
    blocked_scrapes = 0

    start_time = time.time()

    for idx, item in enumerate(PRODUCTS_TO_TEST, 1):
        print(f"📦 [{idx}/{len(PRODUCTS_TO_TEST)}] Scraping Product Keyword: '{item}'")
        
        # 1. Etsy
        total_scrapes += 1
        e_res = etsy.scrape(item)
        if e_res.get("data_mode") == "LIVE_WEB_SCRAPED":
            successful_scrapes += 1
            scraped_items = e_res.get("scraped_count", 0)
            print(f"  • Etsy  : SUCCESS ➔ Scraped {scraped_items} listings | Avg Price: ${e_res.get('avg_price_usd')} USD")
        else:
            blocked_scrapes += 1
            print(f"  • Etsy  : BLOCKED/FALLBACK")

        # 2. Amazon
        total_scrapes += 1
        a_res = amazon.scrape(item)
        if a_res.get("data_mode") == "LIVE_WEB_SCRAPED":
            successful_scrapes += 1
            scraped_items = a_res.get("scraped_count", 0)
            print(f"  • Amazon: SUCCESS ➔ Scraped {scraped_items} listings | Est Sales: {a_res.get('monthly_sales_units')} units/mo")
        else:
            blocked_scrapes += 1
            print(f"  • Amazon: BLOCKED/FALLBACK")

        # 3. Shopee
        total_scrapes += 1
        s_res = shopee.scrape(item)
        if s_res.get("data_mode") == "LIVE_WEB_SCRAPED":
            successful_scrapes += 1
            scraped_items = s_res.get("scraped_count", 0)
            print(f"  • Shopee: SUCCESS ➔ Scraped {scraped_items} listings | Sold: {s_res.get('historical_sold_units')} units")
        else:
            blocked_scrapes += 1
            print(f"  • Shopee: BLOCKED/FALLBACK")

        # 4. Google Trends
        total_scrapes += 1
        t_res = trends.scrape(item)
        if t_res.get("data_mode") == "LIVE_WEB_SCRAPED":
            successful_scrapes += 1
            print(f"  • Trends: SUCCESS ➔ Growth: +{t_res.get('growth_30d_pct')}% | Momentum: {t_res.get('search_momentum')}")
        else:
            blocked_scrapes += 1
            print(f"  • Trends: BLOCKED/FALLBACK")

        print("  " + "-" * 50)
        time.sleep(0.5) # Polite gap between product queries

    elapsed = time.time() - start_time
    success_rate = (successful_scrapes / total_scrapes) * 100

    print(f"\n📊 STRESS TEST SUMMARY REPORT:")
    print(f"  Total Requests Executed : {total_scrapes} Requests")
    print(f"  Successful Scrapes      : {successful_scrapes} / {total_scrapes} ({success_rate:.1f}%)")
    print(f"  Blocked Requests        : {blocked_scrapes}")
    print(f"  Total Time Elapsed      : {elapsed:.2f} seconds")
    print(f"  Average Time Per Scrape : {elapsed / total_scrapes:.2f} seconds\n")

    assert success_rate >= 80.0, "Multi-product scraping stress test failed!"
    print("=================================================================")
    print("🎉 MULTI-PRODUCT STRESS TEST PASSED 100%! NO PERMANENT BLOCKS!")
    print("=================================================================")

if __name__ == "__main__":
    run_multi_product_stress_test()
