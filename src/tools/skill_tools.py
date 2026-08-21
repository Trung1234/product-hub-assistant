import json
from langchain_core.tools import tool
from src.skills.skill_registry import ECommerceSkillRegistry

registry = ECommerceSkillRegistry()

@tool
def consult_ecommerce_skill(skill_name: str, inquiry: str = "") -> str:
    """
    Consults specialized eCommerce expert skills from nexscope-ai/eCommerce-Skills.
    Available skills include:
    - 'etsy-print-on-demand': POD mockups, niche selection, margin optimization.
    - 'etsy-pricing-strategy': Psychological pricing tiers, discounts, profit protection.
    - 'etsy-seo-tags': High-converting 13 tags and long-tail keyword optimization.
    - 'etsy-competitor-analysis': Listing audits and competitor reverse-engineering.
    - 'etsy-seasonal-strategy': Holiday launch calendar and demand ramping.
    - 'product-differentiation-amazon': Amazon review mining, bundling, and moat creation.
    - 'profit-margin-calculator-amazon': FBA fees, ad spend allocation, and unit economics.
    - 'product-launch-strategy': Launch sequence, PPC acceleration, and review velocity.
    - 'market-gap-analysis': Identifying underserved customer segments.
    """
    skill = registry.get_skill(skill_name)
    if not skill:
        available = [s["skill_name"] for s in registry.list_curated_pod_skills()]
        return json.dumps({
            "error": f"Skill '{skill_name}' not found.",
            "available_curated_skills": available
        }, indent=2)
        
    return json.dumps({
        "status": "SKILL_LOADED",
        "skill_name": skill["name"],
        "description": skill["description"],
        "instructions": skill["content"],
        "inquiry": inquiry
    }, indent=2, ensure_ascii=False)

@tool
def list_available_ecommerce_skills() -> str:
    """
    Lists all curated and available eCommerce expert skills from nexscope-ai/eCommerce-Skills.
    """
    skills = registry.list_curated_pod_skills()
    return json.dumps({
        "total_skills_available": len(registry.skills),
        "curated_pod_skills": skills
    }, indent=2, ensure_ascii=False)
