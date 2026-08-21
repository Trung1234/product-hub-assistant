import json
from src.tools.skill_tools import (
    consult_ecommerce_skill,
    list_available_ecommerce_skills
)
from src.skills.skill_registry import ECommerceSkillRegistry

def test_ecommerce_skills():
    print("=================================================================")
    print("🛍️ TESTING NEXSCOPE-AI/ECOMMERCE-SKILLS INTEGRATION")
    print("=================================================================\n")

    registry = ECommerceSkillRegistry()
    print(f"📌 [1] Total skills discovered in repository: {len(registry.skills)}")
    assert len(registry.skills) > 50, "Expected over 50 skills loaded!"
    print("  ✅ All skills successfully indexed from repository!")

    print("\n📌 [2] Testing list_available_ecommerce_skills tool...")
    list_res_str = list_available_ecommerce_skills.invoke({})
    list_res = json.loads(list_res_str)
    assert "curated_pod_skills" in list_res and len(list_res["curated_pod_skills"]) > 0
    print(f"  ✅ Curated POD skills found: {len(list_res['curated_pod_skills'])}")
    for s in list_res["curated_pod_skills"][:5]:
        print(f"     • {s['skill_name']}: {s['description'][:60]}...")

    print("\n📌 [3] Testing consult_ecommerce_skill for 'etsy-print-on-demand'...")
    pod_skill_str = consult_ecommerce_skill.invoke({
        "skill_name": "etsy-print-on-demand",
        "inquiry": "How to optimize profit margins for acrylic ornaments on Etsy?"
    })
    pod_skill = json.loads(pod_skill_str)
    assert pod_skill.get("status") == "SKILL_LOADED", "Skill failed to load!"
    assert "Print on Demand" in pod_skill.get("instructions", ""), "Instructions missing content!"
    print(f"  ✅ 'etsy-print-on-demand' skill loaded! (Length: {len(pod_skill['instructions'])} chars)")

    print("\n📌 [4] Testing consult_ecommerce_skill for 'etsy-pricing-strategy'...")
    pricing_skill_str = consult_ecommerce_skill.invoke({
        "skill_name": "etsy-pricing-strategy",
        "inquiry": "Tiered pricing for personalized gifts"
    })
    pricing_skill = json.loads(pricing_skill_str)
    assert pricing_skill.get("status") == "SKILL_LOADED"
    print(f"  ✅ 'etsy-pricing-strategy' skill loaded! (Length: {len(pricing_skill['instructions'])} chars)")

    print("\n=================================================================")
    print("🎉 ECOMMERCE-SKILLS INTEGRATION TEST PASSED 100%!")
    print("=================================================================")

if __name__ == "__main__":
    test_ecommerce_skills()
