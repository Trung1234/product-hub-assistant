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

def test_tool_accuracy_suite():
    print("=================================================================")
    print("🔍 VALIDATING GRANULAR SPECIALIZED TOOLS (FAST & MODULAR)")
    print("=================================================================\n")

    kw = "Custom Stainless Steel Tumbler 20oz"

    print("📌 [1] Testing fetch_etsy_market_data (Dedicated Etsy Tool)...")
    etsy_res_str = fetch_etsy_market_data.invoke({"keyword": kw})
    etsy_res = json.loads(etsy_res_str)
    assert "search_volume" in etsy_res and etsy_res["search_volume"] > 0
    assert "active_listings" in etsy_res and etsy_res["active_listings"] > 0
    assert "avg_price_usd" in etsy_res and etsy_res["avg_price_usd"] > 0
    print(f"  ✅ Etsy Tool Passed! (Search Vol: {etsy_res['search_volume']:,}, Listings: {etsy_res['active_listings']}, Avg Price: ${etsy_res['avg_price_usd']})")

    print("\n📌 [2] Testing fetch_amazon_market_data (Dedicated Amazon Tool)...")
    amazon_res_str = fetch_amazon_market_data.invoke({"keyword": kw})
    amazon_res = json.loads(amazon_res_str)
    assert "monthly_sales_units" in amazon_res and amazon_res["monthly_sales_units"] > 0
    assert "price_range_usd" in amazon_res
    print(f"  ✅ Amazon Tool Passed! (Monthly Sales: {amazon_res['monthly_sales_units']:,} units, Price: {amazon_res['price_range_usd']})")

    print("\n📌 [3] Testing evaluate_5d_opportunity_score (Dedicated Math Scoring Tool)...")
    scoring_res_str = evaluate_5d_opportunity_score.invoke({
        "etsy_json": etsy_res_str,
        "amazon_json": amazon_res_str
    })
    scoring_res = json.loads(scoring_res_str)
    assert 0 <= scoring_res["opportunity_score"] <= 100
    print(f"  ✅ Scoring Tool Passed! (Opportunity Score: {scoring_res['opportunity_score']}/100 - {scoring_res['recommendation']})")

    print("\n📌 [4] Testing record_product_opportunity_matrix (Dedicated CSV & Citation Tool)...")
    record_res_str = record_product_opportunity_matrix.invoke({
        "keyword": kw,
        "category": "Drinkware",
        "material": "stainless steel",
        "recommended_product": "stainless steel tumbler 20oz",
        "opportunity_score": scoring_res["opportunity_score"],
        "demand_score": scoring_res["dimensions"]["etsy_demand"],
        "competition_score": scoring_res["dimensions"]["etsy_competition_score"],
        "sales_velocity_score": scoring_res["dimensions"]["amazon_sales_velocity"],
        "etsy_price": etsy_res["avg_price_usd"],
        "etsy_active_listings": etsy_res["active_listings"],
        "etsy_monthly_sales": int(etsy_res["search_volume"] * 0.08),
        "amazon_sales_units": amazon_res["monthly_sales_units"],
        "price_range": amazon_res["price_range_usd"],
        "seasonality": "medium",
        "buyer_intent": "gift",
        "collection": "Drinkware",
        "strategic_reason": "Strong demand for personalized drinkware on Etsy and high sales velocity on Amazon."
    })
    record_res = json.loads(record_res_str)
    assert record_res.get("status") == "RECORDED_SUCCESSFULLY"
    assert "citations" in record_res and len(record_res["citations"]) > 0
    print(f"  ✅ Record Tool Passed! (Citations generated: {len(record_res['citations'])}, Offloaded: {record_res['offloaded_context_file']})")

    print("\n📌 [5] Testing consult_ecommerce_skill (Dedicated Skill Tool)...")
    skill_res_str = consult_ecommerce_skill.invoke({
        "skill_name": "etsy-pricing-strategy",
        "inquiry": "Price tiers for stainless steel tumblers"
    })
    skill_res = json.loads(skill_res_str)
    assert skill_res.get("status") == "SKILL_LOADED"
    print(f"  ✅ Skill Tool Passed! (Loaded: {skill_res['skill_name']})")

    print("\n=================================================================")
    print("🎉 ALL GRANULAR SPECIALIZED TOOLS PASSED VALIDATION 100%!")
    print("=================================================================")

if __name__ == "__main__":
    test_tool_accuracy_suite()
