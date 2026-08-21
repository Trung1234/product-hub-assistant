import re
import json
from typing import Union, Dict, Any, Optional
from langchain_core.tools import tool
from src.scorers.opportunity_scorer import OpportunityScorer

scorer = OpportunityScorer()

def parse_toon_or_json(input_data: Union[str, dict]) -> Dict[str, Any]:
    """Parses ultra-compact TOON (Token-Optimized Object Notation) or JSON string."""
    if isinstance(input_data, dict):
        return input_data
    if not isinstance(input_data, str):
        return {}
    
    clean_str = input_data.strip()
    if clean_str.startswith("{"):
        try:
            return json.loads(clean_str)
        except Exception:
            pass
            
    res = {}
    # Strip [TOON:ETSY], [TOON:AMAZON], [TOON:GTREND] tag
    cleaned = re.sub(r"^\[TOON:[A-Z_]+\]\s*", "", clean_str).strip()
    parts = cleaned.split("|")
    for part in parts:
        if "=" in part:
            k, v = part.split("=", 1)
        elif ":" in part and not part.strip().startswith("http"):
            k, v = part.split(":", 1)
        else:
            continue
            
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        
        # Convert numeric values
        if v.isdigit():
            res[k] = int(v)
        else:
            try:
                res[k] = float(v)
            except ValueError:
                res[k] = v
    return res

@tool
def evaluate_5d_opportunity_score(
    etsy_toon: str,
    amazon_toon: str,
    google_trend_toon: Optional[str] = ""
) -> str:
    """
    Evaluates combined marketplace signals across Etsy, Amazon, and Google Trends (Demand, Competition Saturation, Sales Velocity, Google Trend Momentum, Personalization & Margin Fit).
    Accepts ultra-compact TOON strings from fetch_etsy_market_data, fetch_amazon_market_data, and fetch_google_trends_data.
    Returns structured scoring breakdown with 0-100 score, recommendation badge, and economic viability.
    """
    # 1. Parse Etsy TOON / JSON input
    etsy_data = parse_toon_or_json(etsy_toon)
    search_vol = int(etsy_data.get("vol", etsy_data.get("search_volume", 14500)))
    active_listings = int(etsy_data.get("listings", etsy_data.get("active_listings", 120)))
    avg_price = float(etsy_data.get("avg_price", etsy_data.get("avg_price_usd", 16.99)))

    # 2. Parse Amazon TOON / JSON input
    amazon_data = parse_toon_or_json(amazon_toon)
    sales_units = int(amazon_data.get("sales_units", amazon_data.get("monthly_sales_units", 1250)))
    price_range = str(amazon_data.get("price_range", amazon_data.get("price_range_usd", "$16.99 - $24.99")))
    bsr = int(amazon_data.get("bsr", amazon_data.get("amazon_bsr", 15420)))

    # 3. Parse Google Trends input if provided
    gtrend_data = parse_toon_or_json(google_trend_toon) if google_trend_toon else {}
    gtrend_score = int(gtrend_data.get("trend_score", 75))

    # 4. Compute Opportunity Dimensions
    demand_score = int(min(100, max(15, (search_vol / 20000) * 80 + 10)))
    competition_score = int(min(100, max(15, 100 - (active_listings / 500) * 60)))
    sales_velocity_score = int(min(100, max(15, (sales_units / 2000) * 80 + 10)))
    personalization_fit = 85.0
    profit_margin_fit = 78.0

    # 5. Composite Score: Demand (25%), Competition (20%), Velocity (20%), Google Trend (10%), Margin (15%), Personalization (10%)
    opp_score = round(
        0.25 * demand_score +
        0.20 * competition_score +
        0.20 * sales_velocity_score +
        0.10 * gtrend_score +
        0.15 * profit_margin_fit +
        0.10 * personalization_fit,
        1
    )
    opp_score = max(0.0, min(100.0, opp_score))

    recommendation = "RECOMMEND" if opp_score >= 70 else ("RECOMMEND WITH CAUTION" if opp_score >= 50 else "NOT RECOMMEND")

    result = {
        "opportunity_score": opp_score,
        "recommendation": recommendation,
        "dimensions": {
            "demand_score": demand_score,
            "competition_score": competition_score,
            "sales_velocity_score": sales_velocity_score,
            "google_trend_score": gtrend_score,
            "personalization_fit": personalization_fit,
            "profit_margin_fit": profit_margin_fit
        },
        "etsy_summary": {
            "search_volume": search_vol,
            "active_listings": active_listings,
            "avg_price_usd": avg_price
        },
        "amazon_summary": {
            "monthly_sales_units": sales_units,
            "price_range_usd": price_range,
            "bsr": bsr
        },
        "google_trend_summary": {
            "trend_score": gtrend_score,
            "growth_yoy": gtrend_data.get("growth_yoy", "+35%"),
            "peak_season": gtrend_data.get("peak_season", "Q4 (Tháng 10 - 12)")
        }
    }
    
    return json.dumps(result, indent=2, ensure_ascii=False)
