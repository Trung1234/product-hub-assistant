import os
import json
import time
from typing import Dict, Any, List
from src.crawlers.antidetect_cdp_crawler import AntiDetectBrowserCDPCrawler

RAW_CRAWLS_DIR = "data/raw_crawls"
os.makedirs(RAW_CRAWLS_DIR, exist_ok=True)

class MarketplaceRawDataWorker:
    """
    Independent Worker Process for Crawling RAW Marketplace Data.
    - Uses Anti-Detect Browser CDP (AdsPower / GoLogin / Multilogin)
    - Saves un-parsed RAW HTML / RAW JSON payloads to disk (data/raw_crawls/)
    - Zero API Cost ($0.00)
    - Zero-Account Mode (No user login credentials needed)
    """
    def __init__(self):
        self.cdp_crawler = AntiDetectBrowserCDPCrawler()

    def execute_worker_crawl(self, marketplace: str, query: str) -> Dict[str, Any]:
        """Runs the Anti-Detect CDP worker to crawl RAW data and save raw file artifact."""
        print(f"⚙️ [WORKER RUNNING] Executing Anti-Detect CDP Crawl on {marketplace.upper()} for: '{query}'")
        
        # 1. Perform Crawl via Anti-Detect CDP Browser
        crawl_result = self.cdp_crawler.fetch_raw_marketplace_page(marketplace, query)
        
        # 2. Save RAW Payload File Artifact for AI Agent Inspection
        timestamp = int(time.time())
        clean_query = "".join(c if c.isalnum() else "_" for c in query.lower())[:30]
        raw_filename = f"{timestamp}_{marketplace.lower()}_{clean_query}_raw.json"
        raw_filepath = os.path.join(RAW_CRAWLS_DIR, raw_filename)
        
        raw_file_artifact = {
            "worker_id": f"worker-antidetect-{timestamp}",
            "marketplace": marketplace.upper(),
            "query": query,
            "saved_at_timestamp": timestamp,
            "raw_payload_filepath": os.path.abspath(raw_filepath),
            "payload_size_bytes": crawl_result["raw_payload_size_bytes"],
            "crawl_latency_ms": crawl_result["crawl_latency_ms"],
            "cost_usd": 0.00,
            "account_required": False,
            "anti_detect_status": crawl_result["anti_detect_fingerprint_status"],
            "raw_content": crawl_result["raw_content_sample"]
        }
        
        with open(raw_filepath, "w", encoding="utf-8") as f:
            json.dump(raw_file_artifact, f, indent=2, ensure_ascii=False)
            
        print(f"  ✅ [WORKER COMPLETED] RAW Data Saved: '{raw_filepath}' (Size: {raw_file_artifact['payload_size_bytes']} bytes, Cost: $0.00)")
        return raw_file_artifact

if __name__ == "__main__":
    worker = MarketplaceRawDataWorker()
    artifact = worker.execute_worker_crawl("etsy", "personalized grandpa acrylic ornament")
    print(json.dumps(artifact, indent=2, ensure_ascii=False))
