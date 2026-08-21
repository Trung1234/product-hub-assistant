import json
from typing import Dict, Any, List
from langchain_core.tools import tool

@tool
def generate_creative_and_quote_hooks(keyword: str) -> str:
    """
    Analyzes product niche and generates top-converting quote hooks, design directions,
    color palettes, and recipient personalization angles for high-converting POD listings.
    """
    kw_lower = keyword.lower()
    
    if any(w in kw_lower for w in ["grandpa", "father", "dad", "papa"]):
        target_recipient = "Grandfather / Dad from Granddaughter / Kids"
        quote_hooks = [
            "To Grandpa, Thank You for Making Every Day Special. Love, [Name]",
            "A Grandpa's Love Is Forever — From Your Favorite Granddaughter, [Name]",
            "Best Grandpa Ever — Est. [Year]",
            "The Best Memories Are Made With Grandpa"
        ]
        design_concepts = [
            {"concept": "Heart Keepsake Clear Acrylic", "description": "Heart-shaped 3mm clear acrylic with delicate handwritten typography and floral/star accents."},
            {"concept": "Grandpa & Granddaughter Silhouette", "description": "High-contrast silhouette illustration of grandfather holding hands with granddaughter."},
            {"concept": "Photo Upload & Name Tag", "description": "Central family photo slot with custom laser-engraved names and year below."}
        ]
        color_palette = ["Clear Acrylic + Crisp White Print", "Warm Wood Tone Accents", "Deep Navy Blue", "Charcoal Grey"]
        personalization_fields = ["Grandpa Name / Nickname (Papa/Grandpa/Abuelo)", "Granddaughter Name(s)", "Year (Est. 2026)", "Optional Photo Upload"]

    elif any(w in kw_lower for w in ["mama", "mom", "mother", "grandma"]):
        target_recipient = "Mom / Mama from Kids / Family"
        quote_hooks = [
            "Mama — Est. [Year] with [Names on Sleeve]",
            "Best Mom in the Entire World",
            "A Mother Holds Her Children's Hands For A While, But Their Hearts Forever"
        ]
        design_concepts = [
            {"concept": "Minimalist Roman Font Outline", "description": "Subtle, elegant outline embroidery with custom kids' names on the sleeve cuff."},
            {"concept": "Floral Line Art Heart", "description": "Delicate botanical line art wrapping around the central 'Mama' typography."}
        ]
        color_palette = ["Sand / Beige", "Ash Grey", "Forest Green", "Dusty Rose"]
        personalization_fields = ["Mom Nickname (Mama/Mom/Grandma)", "Kids' Names for Sleeve Embroidery", "Est. Year"]

    elif any(w in kw_lower for w in ["cat", "dog", "pet"]):
        target_recipient = "Pet Lovers (Dog Mom / Cat Mom)"
        quote_hooks = [
            "Best Cat Mom Ever — Proudly Owned by [Pet Name]",
            "Dog Mom Life — [Pet Name]'s Favorite Human",
            "You Had Me At Woof / Purr"
        ]
        design_concepts = [
            {"concept": "Custom Pet Portrait Illustration", "description": "Watercolor or cartoon vector pet illustration generated from uploaded pet photo."},
            {"concept": "Paw Print Heart Pattern", "description": "Geometric heart filled with cute paw prints and personalized pet name."}
        ]
        color_palette = ["Classic White Ceramic", "Pastel Pink", "Sage Green", "Matte Black"]
        personalization_fields = ["Pet Name", "Pet Breed / Photo Upload", "Custom Title (Cat Mom / Dog Dad)"]

    else:
        target_recipient = "Gift Buyers / Home Decor Enthusiasts"
        quote_hooks = [
            f"Personalized {keyword.title()} — Made With Love",
            "Cherished Moments & Timeless Memories"
        ]
        design_concepts = [
            {"concept": "Modern Minimalist", "description": "Clean typography with contemporary layout and premium materials."},
            {"concept": "Themed Graphic Illustration", "description": "Vibrant custom illustration matching seasonal holiday themes."}
        ]
        color_palette = ["Monochrome Black & White", "Warm Earth Tones", "Vibrant Multi-Color"]
        personalization_fields = ["Customer Custom Name", "Custom Message / Quote", "Date / Year"]

    result = {
        "keyword": keyword,
        "target_recipient": target_recipient,
        "quote_hooks": quote_hooks,
        "design_concepts": design_concepts,
        "recommended_color_palette": color_palette,
        "required_personalization_inputs": personalization_fields,
        "listing_conversion_tip": "Display product mockup showing finished personalization in the very first gallery image."
    }
    
    return json.dumps(result, indent=2, ensure_ascii=False)
