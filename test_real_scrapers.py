import json
from src.providers.etsy_provider import EtsyDataProvider
from src.providers.amazon_provider import AmazonDataProvider
from src.providers.shopee_provider import ShopeeDataProvider
from src.providers.google_trends_provider import GoogleTrendsDataProvider

def test_realtime_scrapers():
    print("=================================================================")
    print("🔍 TESTING REAL LIVE WEB SCRAPERS (NO API KEYS REQUIRED)")
    print("=================================================================\n")
    
    query = "personalized grandpa acrylic ornament"
    
    # 1. Test Etsy Scraper
    etsy = EtsyDataProvider()
    etsy_res = etsy.fetch_signals(query)
    print("📌 [1] Etsy Web Scraper Output:")
    print(json.dumps(etsy_res, indent=2))
    assert etsy_res["data_mode"] == "LIVE_WEB_SCRAPED", "Etsy scraper mode failed!"
    print("  ✅ Etsy Web Scraper Verified!\n")
    
    # 2. Test Amazon Scraper
    amazon = AmazonDataProvider()
    amazon_res = amazon.fetch_signals(query)
    print("📌 [2] Amazon Web Scraper Output:")
    print(json.dumps(amazon_res, indent=2))
    assert amazon_res["data_mode"] == "LIVE_WEB_SCRAPED", "Amazon scraper mode failed!"
    print("  ✅ Amazon Web Scraper Verified!\n")
    
    # 3. Test Shopee Scraper
    shopee = ShopeeDataProvider()
    shopee_res = shopee.fetch_signals(query)
    print("📌 [3] Shopee Web Scraper Output:")
    print(json.dumps(shopee_res, indent=2))
    assert shopee_res["data_mode"] == "LIVE_WEB_SCRAPED", "Shopee scraper mode failed!"
    print("  ✅ Shopee Web Scraper Verified!\n")
    
    # 4. Test Google Trends Scraper
    trends = GoogleTrendsDataProvider()
    trends_res = trends.fetch_signals(query)
    print("📌 [4] Google Trends Web Scraper Output:")
    print(json.dumps(trends_res, indent=2))
    assert trends_res["data_mode"] == "LIVE_WEB_SCRAPED", "Google Trends scraper mode failed!"
    print("  ✅ Google Trends Web Scraper Verified!\n")

    print("=================================================================")
    print("🎉 ALL 4 REAL WEB SCRAPERS VERIFIED AND WORKING LIVE!")
    print("=================================================================")

if __name__ == "__main__":
    test_realtime_scrapers()
