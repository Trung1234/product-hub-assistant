import json
from src.tools.market_tools import (
    fetch_etsy_market_data,
    fetch_amazon_market_data
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
from src.subagents.subagents_config import SUBAGENTS_CONFIG

def test_tool_accuracy_suite():
    print("=================================================================")
    print("🔍 VALIDATING TOON TOKEN-OPTIMIZED TOOLS & SUBAGENTS SUITE")
    print("=================================================================\n")

    kw = "Custom Stainless Steel Tumbler 20oz"

    print("📌 [1] Testing fetch_etsy_market_data (TOON Output)...")
    etsy_toon = fetch_etsy_market_data.invoke({"keyword": kw})
    assert "[TOON:ETSY]" in etsy_toon
    assert "vol=" in etsy_toon and "listings=" in etsy_toon and "avg_price=" in etsy_toon
    print(f"  ✅ Etsy TOON Output ({len(etsy_toon)} chars): {etsy_toon}")

    print("\n📌 [2] Testing fetch_amazon_market_data (TOON Output)...")
    amazon_toon = fetch_amazon_market_data.invoke({"keyword": kw})
    assert "[TOON:AMAZON]" in amazon_toon
    assert "sales_units=" in amazon_toon and "price_range=" in amazon_toon
    print(f"  ✅ Amazon TOON Output ({len(amazon_toon)} chars): {amazon_toon}")

    print("\n📌 [3] Testing evaluate_5d_opportunity_score with TOON Inputs (Opportunity Analyst Tool)...")
    scoring_res_str = evaluate_5d_opportunity_score.invoke({
        "etsy_toon": etsy_toon,
        "amazon_toon": amazon_toon
    })
    scoring_res = json.loads(scoring_res_str)
    assert 0 <= scoring_res["opportunity_score"] <= 100
    assert "dimensions" in scoring_res
    print(f"  ✅ Scoring Tool Passed! (Opportunity Score: {scoring_res['opportunity_score']}/100 - {scoring_res['recommendation']})")
    print(f"     Breakdown: {scoring_res['dimensions']}")

    print("\n📌 [4] Validating 3 Sub-Agents Configuration...")
    subagent_names = [sa["name"] for sa in SUBAGENTS_CONFIG]
    assert "etsy_analyst" in subagent_names
    assert "amazon_analyst" in subagent_names
    assert "opportunity_analyst" in subagent_names
    print(f"  ✅ 3 Sub-Agents Registered: {subagent_names}")

    print("\n📌 [5] Testing record_product_opportunity_matrix...")
    record_res_str = record_product_opportunity_matrix.invoke({
        "keyword": kw,
        "category": "Drinkware",
        "material": "stainless steel",
        "recommended_product": "stainless steel tumbler 20oz",
        "opportunity_score": scoring_res["opportunity_score"],
        "demand_score": scoring_res["dimensions"]["demand_score"],
        "competition_score": scoring_res["dimensions"]["competition_score"],
        "sales_velocity_score": scoring_res["dimensions"]["sales_velocity_score"],
        "etsy_price": scoring_res["etsy_summary"]["avg_price_usd"],
        "etsy_active_listings": scoring_res["etsy_summary"]["active_listings"],
        "etsy_monthly_sales": int(scoring_res["etsy_summary"]["search_volume"] * 0.08),
        "amazon_sales_units": scoring_res["amazon_summary"]["monthly_sales_units"],
        "price_range": scoring_res["amazon_summary"]["price_range_usd"],
        "seasonality": "medium",
        "buyer_intent": "gift",
        "collection": "Drinkware",
        "strategic_reason": "High opportunity score calculated by opportunity_analyst sub-agent with strong unit economics."
    })
    record_res = json.loads(record_res_str)
    assert record_res.get("status") == "RECORDED_SUCCESSFULLY"
    print(f"  ✅ Record Tool Passed! (Citations: {len(record_res['citations'])})")

    print("\n=================================================================")
    print("🎉 ALL TOON TOOLS & SUBAGENTS PASSED VALIDATION 100%!")
    print("=================================================================")

if __name__ == "__main__":
    test_tool_accuracy_suite()
