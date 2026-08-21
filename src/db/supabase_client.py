"""
SUPABASE POSTGRESQL & AUTH CLIENT REPOSITORY
Provides seamless connection to Supabase Cloud PostgreSQL & Auth
with automatic local SQLite fallback for offline development.
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("SupabaseClient")

class SupabaseRepository:
    """
    Unified Supabase PostgreSQL & Auth Client.
    Connects to Supabase Cloud if SUPABASE_URL and SUPABASE_KEY are provided,
    otherwise falls back to local SQLite database repository.
    """
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL", "").strip()
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", "").strip()
        self.client = None
        self._init_client()

    def _init_client(self):
        if self.supabase_url and self.supabase_key:
            try:
                from supabase import create_client, Client
                self.client: Client = create_client(self.supabase_url, self.supabase_key)
                logger.info(f"[Supabase] Connected to Supabase Cloud at {self.supabase_url}")
            except Exception as e:
                logger.warning(f"[Supabase] Failed to initialize Supabase client: {e}. Falling back to SQLite.")
                self.client = None
        else:
            logger.info("[Supabase] No SUPABASE_URL configured. Using local SQLite Repository fallback.")

    def record_opportunity(
        self,
        user_id: Optional[str],
        org_id: str,
        keyword: str,
        score: float,
        recommendation: str,
        breakdown: Dict[str, Any],
        tax_info: Dict[str, Any],
        market_metrics: Dict[str, Any],
        reason: str = ""
    ) -> Dict[str, Any]:
        """Saves opportunity to Supabase PostgreSQL or local SQLite."""
        # 1. Supabase Cloud Execution
        if self.client:
            try:
                payload = {
                    "user_id": user_id,
                    "org_id": org_id or "printway_internal",
                    "keyword": keyword,
                    "product_type": tax_info.get("product_type", "Unknown"),
                    "category": tax_info.get("category", "General"),
                    "material": tax_info.get("material", "Acrylic"),
                    "opportunity_score": score,
                    "recommendation": recommendation,
                    "demand_score": breakdown.get("demand", {}).get("score", 70.0),
                    "competition_score": breakdown.get("competition", {}).get("score", 70.0),
                    "growth_score": breakdown.get("growth", {}).get("score", 70.0),
                    "seasonality_score": breakdown.get("seasonality", {}).get("score", 70.0),
                    "personalization_score": breakdown.get("personalization", {}).get("score", 70.0),
                    "production_fit_score": breakdown.get("production_fit", {}).get("score", 70.0),
                    "price_range": market_metrics.get("price_range", "$16.99 - $24.99"),
                    "monthly_sales": market_metrics.get("monthly_sales", 1150),
                    "amazon_bsr": market_metrics.get("amazon_bsr", 15420),
                    "reason": reason,
                    "raw_data_json": {
                        "breakdown": breakdown,
                        "taxonomy": tax_info,
                        "metrics": market_metrics
                    }
                }
                res = self.client.table("product_opportunities").insert(payload).execute()
                if res.data:
                    return {"engine": "SUPABASE_POSTGRESQL", "record": res.data[0]}
            except Exception as e:
                logger.warning(f"[Supabase] Insert error: {e}. Falling back to SQLite.")

        # 2. Local SQLite Fallback
        from src.db.opportunity_repository import db_repo
        row_id = db_repo.record_opportunity(
            user_id=user_id or "usr_default_admin",
            org_id=org_id or "printway_internal",
            keyword=keyword,
            score=score,
            recommendation=recommendation,
            breakdown=breakdown,
            tax_info=tax_info,
            market_metrics=market_metrics,
            reason=reason
        )
        return {"engine": "LOCAL_SQLITE", "record_id": row_id}

    def get_user_opportunities(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Queries opportunities for user from Supabase or SQLite."""
        if self.client and user_id:
            try:
                res = self.client.table("product_opportunities")\
                    .select("*")\
                    .eq("user_id", user_id)\
                    .order("id", desc=True)\
                    .limit(limit)\
                    .execute()
                if res.data:
                    return res.data
            except Exception:
                pass

        from src.db.opportunity_repository import db_repo
        return db_repo.get_user_opportunities(user_id=user_id or "usr_default_admin", limit=limit)

# Global singleton repository instance
supabase_repo = SupabaseRepository()
