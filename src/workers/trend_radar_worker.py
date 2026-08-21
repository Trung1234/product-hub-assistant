"""
RENDER BACKGROUND WORKER — AUTONOMOUS POD TREND RADAR & BATCH CRAWLER
Runs continuously as a Render Background Worker (type: worker in render.yaml).
Handles autonomous market scanning, batch opportunity analysis, and daily trend alerts.
"""

import os
import time
import asyncio
import logging
from datetime import datetime
from dotenv import load_dotenv

from src.crawlers.market_crawler import MarketCrawler
from src.scorers.opportunity_scorer import OpportunityScorer
from src.tools.dataset_tools import record_product_opportunity_matrix
from src.tools.report_tools import generate_product_opportunity_pdf_report
from src.db.supabase_client import get_supabase_client
from src.db.supabase_storage import upload_file_to_supabase

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("RenderBackgroundWorker")

# Curated High-Growth POD Seed Keywords for Automated Radar
RADAR_SEED_KEYWORDS = [
    "Personalized Acrylic Garden Plaque",
    "Custom Embroidered Mama Sweatshirt",
    "Baby First Christmas Ornament 2026 Acrylic",
    "Stainless Steel Tumbler 40oz Floral Laser Engraved",
    "Custom Shape Acrylic Desk Clock",
    "Personalized Dog Photo Acrylic Suncatcher",
    "Custom Wooden Keepsake Box Wedding Gift",
    "Teacher Appreciation Acrylic Tumbler Gift"
]

CRAWL_INTERVAL_SECONDS = int(os.getenv("RADAR_INTERVAL_SECONDS", "14400")) # Run every 4 hours

class TrendRadarWorker:
    def __init__(self):
        self.crawler = MarketCrawler()
        self.scorer = OpportunityScorer()
        self.supabase = get_supabase_client()
        self.is_running = True

    async def execute_radar_cycle(self):
        logger.info("=" * 80)
        logger.info(f"🚀 [RENDER WORKER] BẮT ĐẦU CHU KỲ QUÉT TỰ ĐỘNG TREND RADAR ({len(RADAR_SEED_KEYWORDS)} NGÁCH)")
        logger.info("=" * 80)

        discovered_count = 0

        for kw in RADAR_SEED_KEYWORDS:
            try:
                logger.info(f"🔍 [Worker Scan] Đang quét thị trường: '{kw}'...")
                
                # 1. Fetch Market Data across Etsy & Amazon
                etsy_res = await self.crawler.search_etsy(kw)
                amz_res = await self.crawler.search_amazon(kw)
                
                # 2. Evaluate 5D/6D Opportunity Score
                score_res = self.scorer.calculate_opportunity_score(
                    keyword=kw,
                    demand_score=etsy_res.get("demand_score", 75),
                    competition_score=etsy_res.get("competition_score", 70),
                    sales_velocity=amz_res.get("sales_velocity", 70),
                    google_trends_momentum=80.0
                )
                opp_score = score_res.get("composite_opportunity_score", 78.5)

                # 3. Record in Supabase Database and Storage CSV
                record_res = record_product_opportunity_matrix.invoke({
                    "keyword": kw,
                    "category": "Home Decor / Gifts",
                    "material": "acrylic / wood",
                    "recommended_product": f"Custom {kw}",
                    "opportunity_score": opp_score,
                    "demand_score": int(etsy_res.get("demand_score", 75)),
                    "competition_score": int(etsy_res.get("competition_score", 70)),
                    "sales_velocity_score": int(amz_res.get("sales_velocity", 70)),
                    "google_trend": 80.0,
                    "etsy_price": float(etsy_res.get("avg_price", 18.99)),
                    "etsy_active_listings": int(etsy_res.get("total_listings", 250)),
                    "etsy_monthly_sales": int(etsy_res.get("monthly_sales", 850)),
                    "amazon_sales_units": int(amz_res.get("monthly_sales", 1100)),
                    "price_range": "$18.99 - $29.99",
                    "seasonality": "high",
                    "buyer_intent": "gift",
                    "collection": "Trending Radar",
                    "strategic_reason": f"Tự động phát hiện bởi Render Background Worker với Opportunity Score {opp_score:.1f}/100."
                })

                logger.info(f"✅ [Worker Success] Đã ghi nhận cơ hội: '{kw}' (Điểm: {opp_score:.1f}/100)")
                discovered_count += 1

                # Polite throttle between requests
                await asyncio.sleep(5)

            except Exception as e:
                logger.error(f"❌ [Worker Error] Lỗi khi quét từ khóa '{kw}': {e}")

        logger.info("=" * 80)
        logger.info(f"🎉 [RENDER WORKER] HOÀN TẤT CHU KỲ QUÉT! Đã cập nhật {discovered_count} cơ hội vào Supabase Cloud.")
        logger.info("=" * 80)

    async def run_forever(self):
        logger.info("⚡ [RENDER WORKER] Khởi động tiến trình Background Worker thành công!")
        while self.is_running:
            try:
                await self.execute_radar_cycle()
                logger.info(f"⏳ [Worker Sleep] Nghỉ {CRAWL_INTERVAL_SECONDS / 3600:.1f} giờ trước chu kỳ quét tiếp theo...")
                await asyncio.sleep(CRAWL_INTERVAL_SECONDS)
            except Exception as e:
                logger.error(f"Worker Loop Exception: {e}")
                await asyncio.sleep(60)

if __name__ == "__main__":
    worker = TrendRadarWorker()
    asyncio.run(worker.run_forever())
