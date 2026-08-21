import os
import re
from typing import Dict, Any, List, Optional

SKILLS_BASE_DIR = os.path.join(os.path.dirname(__file__), "../../skills/ecommerce_skills")

class ECommerceSkillRegistry:
    """
    Skill Registry for nexscope-ai/eCommerce-Skills.
    Parses and loads expert skills from SKILL.md files.
    """
    def __init__(self, base_dir: str = SKILLS_BASE_DIR):
        self.base_dir = os.path.abspath(base_dir)
        self.skills: Dict[str, Dict[str, Any]] = {}
        self._load_skills()

    def _load_skills(self):
        """Scans and indexes all SKILL.md files in the skills directory."""
        if not os.path.exists(self.base_dir):
            return

        for root, _, files in os.walk(self.base_dir):
            if "SKILL.md" in files:
                skill_path = os.path.join(root, "SKILL.md")
                rel_dir = os.path.relpath(root, self.base_dir)
                skill_name = os.path.basename(root)
                
                try:
                    with open(skill_path, "r", encoding="utf-8") as f:
                        content = f.read()
                        
                    # Extract frontmatter description if present
                    desc_match = re.search(r'description:\s*["\']?([^"\']+)["\']?', content)
                    description = desc_match.group(1) if desc_match else f"Expert eCommerce skill for {skill_name}"
                    
                    self.skills[skill_name] = {
                        "name": skill_name,
                        "relative_path": rel_dir,
                        "full_path": skill_path,
                        "description": description,
                        "content": content
                    }
                except Exception:
                    pass

    def get_skill(self, skill_name: str) -> Optional[Dict[str, Any]]:
        """Retrieves a skill by exact or partial name."""
        if skill_name in self.skills:
            return self.skills[skill_name]
            
        # Partial match
        clean_name = skill_name.lower().replace("_", "-")
        for k, v in self.skills.items():
            if clean_name in k.lower():
                return v
        return None

    def list_curated_pod_skills(self) -> List[Dict[str, str]]:
        """Returns the top curated skills most relevant for Etsy & Amazon POD."""
        target_skills = [
            "etsy-print-on-demand",
            "etsy-pricing-strategy",
            "etsy-seo-tags",
            "etsy-competitor-analysis",
            "etsy-seasonal-strategy",
            "etsy-product-description",
            "product-differentiation-amazon",
            "profit-margin-calculator-amazon",
            "product-launch-strategy",
            "market-gap-analysis",
            "product-title-optimization",
            "product-review-analysis"
        ]
        
        results = []
        for name in target_skills:
            skill = self.get_skill(name)
            if skill:
                results.append({
                    "skill_name": skill["name"],
                    "description": skill["description"]
                })
        return results

    def list_all_skills(self) -> List[Dict[str, str]]:
        """Returns all loaded skills."""
        return [
            {"skill_name": k, "description": v["description"]}
            for k, v in self.skills.items()
        ]
