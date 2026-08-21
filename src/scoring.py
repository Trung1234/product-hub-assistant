import json
from typing import Dict, Any, List

class OpportunityScorer:
    """
    Computes 0-100 Opportunity Score across 6 explainable dimensions:
    1. Demand Score (25%)
    2. Competition Score (20%)
    3. Growth Trend Score (20%)
    4. Seasonality & Launch Timing (15%)
    5. Personalization Potential (10%)
    6. Manufacturing Fit & Margin (10%)
    """
    def __init__(self):
        pass

    def evaluate(self, listing_data: Dict[str, Any], taxonomy_fit: Dict[str, Any]) -> Dict[str, Any]:
        # 1. Demand Score (0-100)
        searches = listing_data.get("estimated_monthly_searches", 10000)
        sales = listing_data.get("estimated_monthly_sales", 500)
        demand_score = min(100.0, (searches / 30000.0 * 50) + (sales / 1500.0 * 50))
        demand_score = round(demand_score, 1)

        # 2. Competition Score (0-100) -> Inverse of competition density
        competitors = listing_data.get("active_competitors", 500)
        if competitors < 100:
            comp_score = 90.0
        elif competitors < 300:
            comp_score = 75.0
        elif competitors < 800:
            comp_score = 55.0
        elif competitors < 1500:
            comp_score = 35.0
        else:
            comp_score = 20.0
        comp_score = round(comp_score, 1)

        # 3. Growth Trend Score (0-100)
        growth_pct = listing_data.get("google_trends_growth_pct", 0.0)
        if growth_pct >= 50:
            growth_score = 95.0
        elif growth_pct >= 30:
            growth_score = 85.0
        elif growth_pct >= 10:
            growth_score = 70.0
        elif growth_pct >= 0:
            growth_score = 50.0
        else:
            growth_score = 25.0
        growth_score = round(growth_score, 1)

        # 4. Seasonality Score (0-100)
        seasonality = listing_data.get("seasonality_peak", "Evergreen")
        if seasonality == "Evergreen":
            seasonality_score = 90.0
            season_reason = "High stability - steady sales year-round without holiday crash risk."
        elif seasonality in ["Q2", "Q4"]:
            seasonality_score = 85.0
            season_reason = f"High seasonal surge in {seasonality} (Father's Day / Mother's Day or Q4 Qmas)."
        else:
            seasonality_score = 65.0
            season_reason = f"Moderate seasonal peak in {seasonality}."

        # 5. Personalization Potential (0-100)
        has_pers = listing_data.get("has_personalization", True)
        pers_types = listing_data.get("personalization_type", [])
        if has_pers and len(pers_types) >= 3:
            pers_score = 95.0
            pers_reason = f"High customization potential ({', '.join(pers_types)}) allowing higher markup."
        elif has_pers:
            pers_score = 80.0
            pers_reason = f"Standard personalization ({', '.join(pers_types)})."
        else:
            pers_score = 40.0
            pers_reason = "Generic non-personalized product - high price pressure."

        # 6. Manufacturing Fit & Profit Margin Score (0-100)
        difficulty = taxonomy_fit.get("production_difficulty", 2)
        margin_pct = taxonomy_fit.get("avg_margin_pct", 70)
        
        # Difficulty penalty: 1 (easy) -> 90, 5 (hard) -> 40
        diff_score = 100 - (difficulty * 12)
        margin_score = min(100.0, margin_pct * 1.2)
        fit_score = round((diff_score * 0.5) + (margin_score * 0.5), 1)

        # Overall Weighted Score calculation
        total_score = round(
            (demand_score * 0.25) +
            (comp_score * 0.20) +
            (growth_score * 0.20) +
            (seasonality_score * 0.15) +
            (pers_score * 0.10) +
            (fit_score * 0.10),
            1
        )

        # Recommendation status
        if total_score >= 78:
            recommendation = "RECOMMEND"
            badge = "🔥 HIGH OPPORTUNITY"
            summary_reason = "High market demand combined with strong growth momentum and favorable manufacturing fit."
        elif total_score >= 65:
            recommendation = "RECOMMEND WITH CAUTION"
            badge = "⚠️ MODERATE OPPORTUNITY"
            summary_reason = "Decent demand and margin, but moderate competition density requires unique design differentiation."
        else:
            recommendation = "NOT RECOMMEND"
            badge = "❌ HIGH RISK / SATURATED"
            summary_reason = "Market is heavily saturated or experiencing negative growth trends."

        # Breakdown dictionary
        breakdown = {
            "demand": {
                "score": demand_score,
                "weight": "25%",
                "reason": f"Monthly searches: {searches:,} | Est. monthly sales: {sales:,} units."
            },
            "competition": {
                "score": comp_score,
                "weight": "20%",
                "reason": f"Active listing competitors: {competitors:,}. Lower density allows faster organic ranking."
            },
            "growth": {
                "score": growth_score,
                "weight": "20%",
                "reason": f"Google Trends & marketplace 30-day growth: +{growth_pct}%."
            },
            "seasonality": {
                "score": seasonality_score,
                "weight": "15%",
                "reason": season_reason
            },
            "personalization": {
                "score": pers_score,
                "weight": "10%",
                "reason": pers_reason
            },
            "production_fit": {
                "score": fit_score,
                "weight": "10%",
                "reason": f"Printway Material: {taxonomy_fit.get('material')}, Difficulty Level: {difficulty}/5, Est. Margin: {margin_pct}%."
            }
        }

        return {
            "opportunity_score": total_score,
            "recommendation": recommendation,
            "badge": badge,
            "summary_reason": summary_reason,
            "breakdown": breakdown,
            "evaluated_listing": listing_data["title"],
            "marketplace": listing_data.get("marketplace", "Etsy/Amazon"),
            "niche": listing_data.get("niche", "General POD")
        }

if __name__ == "__main__":
    from taxonomy import ProductTaxonomyNormalizer
    norm = ProductTaxonomyNormalizer()
    scorer = OpportunityScorer()
    
    test_listing = {
        "title": "Personalized Grandpa Gift For Father's Day From Granddaughter Custom Shape Acrylic Ornament",
        "estimated_monthly_searches": 14500,
        "estimated_monthly_sales": 850,
        "active_competitors": 120,
        "google_trends_growth_pct": 45.2,
        "seasonality_peak": "Q2",
        "has_personalization": True,
        "personalization_type": ["custom_names", "photo_upload", "year"]
    }
    tax = norm.normalize(test_listing["title"])
    res = scorer.evaluate(test_listing, tax)
    print("Scoring Result:")
    print(json.dumps(res, indent=2))
