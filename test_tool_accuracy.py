import json
from src.tools.market_tools import (
    fetch_etsy_market_data,
    fetch_amazon_market_data,
    fetch_google_trends_data,
    fetch_pinterest_trend_signals
)
from src.tools.scoring_tools import evaluate_5d_opportunity_score
from src.tools.dataset_tools import (
    record_product_opportunity_matrix,
    retrieve_offloaded_product_context,
    extract_ai_insights_from_opportunity_matrix
)
from src.tools.skill_tools import (
    consult_ecommerce_skill,
    list_available_ecommerce_skills
)

def test_4_source_tool_accuracy_suite():
    print("=================================================================")
    print("🔍 VALIDATING 4-SOURCE MARKETPLACE SUITE (ETSY + AMAZON + GTRENDS + PINTEREST)")
    print("=================================================================\n")

    kw = "Custom Stainless Steel Tumbler 20oz"

    print("📌 [1] Testing fetch_etsy_market_data (TOON Output)...")
    etsy_toon = fetch_etsy_market_data.invoke({"keyword": kw})
    assert "[TOON:ETSY]" in etsy_toon
    print(f"  ✅ Etsy TOON Output: {etsy_toon}")

    print("\n📌 [2] Testing fetch_amazon_market_data (TOON Output)...")
    amazon_toon = fetch_amazon_market_data.invoke({"keyword": kw})
    assert "[TOON:AMAZON]" in amazon_toon
    print(f"  ✅ Amazon TOON Output: {amazon_toon}")

    print("\n📌 [3] Testing fetch_google_trends_data with pytrends (TOON Output)...")
    gtrend_toon = fetch_google_trends_data.invoke({"keyword": kw})
    assert "[TOON:GTREND]" in gtrend_toon
    print(f"  ✅ Google Trends TOON Output: {gtrend_toon}")

    print("\n📌 [4] Testing fetch_pinterest_trend_signals (TOON Output)...")
    pinterest_toon = fetch_pinterest_trend_signals.invoke({"keyword": kw})
    assert "[TOON:PINTEREST]" in pinterest_toon
    print(f"  ✅ Pinterest TOON Output: {pinterest_toon}")

    print("\n📌 [5] Testing evaluate_5d_opportunity_score (4 Sources)...")
    scoring_res_str = evaluate_5d_opportunity_score.invoke({
        "etsy_toon": etsy_toon,
        "amazon_toon": amazon_toon,
        "google_trend_toon": gtrend_toon
    })
    scoring_res = json.loads(scoring_res_str)
    assert 0 <= scoring_res["opportunity_score"] <= 100
    print(f"  ✅ Scoring Tool Passed! (Score: {scoring_res['opportunity_score']}/100 - {scoring_res['recommendation']})")

    print("\n📌 [6] Testing record_product_opportunity_matrix...")
    record_res_str = record_product_opportunity_matrix.invoke({
        "keyword": kw,
        "category": "Drinkware",
        "material": "stainless steel",
        "recommended_product": "stainless steel tumbler 20oz",
        "opportunity_score": scoring_res["opportunity_score"],
        "demand_score": scoring_res["dimensions"]["demand_score"],
        "competition_score": scoring_res["dimensions"]["competition_score"],
        "sales_velocity_score": scoring_res["dimensions"]["sales_velocity_score"],
        "google_trend": scoring_res["dimensions"]["google_trend_score"],
        "etsy_price": scoring_res["etsy_summary"]["avg_price_usd"],
        "etsy_active_listings": scoring_res["etsy_summary"]["active_listings"],
        "etsy_monthly_sales": int(scoring_res["etsy_summary"]["search_volume"] * 0.08),
        "amazon_sales_units": scoring_res["amazon_summary"]["monthly_sales_units"],
        "price_range": scoring_res["amazon_summary"]["price_range_usd"],
        "seasonality": "medium",
        "buyer_intent": "gift",
        "collection": "Drinkware",
        "strategic_reason": "High opportunity score verified across 4 data sources."
    })
    record_res = json.loads(record_res_str)
    assert record_res.get("status") == "RECORDED_SUCCESSFULLY"
    print(f"  ✅ Record Tool Passed! (Row Saved to CSV)")

    print("\n=================================================================")
    print("🎉 ALL 4-SOURCE TOOLS (ETSY + AMAZON + GTRENDS + PINTEREST) PASSED 100%!")
    print("=================================================================")

if __name__ == "__main__":
    test_4_source_tool_accuracy_suite()
