import json
from typing import Dict, Any, List

class DesignInsightsEngine:
    """
    Extracts design trends, high-converting quotes, top colors, and competitor alerts.
    """
    def __init__(self, sample_listings_path: str = "data/sample_listings.json"):
        with open(sample_listings_path, "r", encoding="utf-8") as f:
            self.listings = json.load(f)

    def get_early_trend_alerts(self) -> List[Dict[str, Any]]:
        """
        Detects early surging trends before market saturation (Growth > 30% and Competitors < 250).
        """
        alerts = []
        for listing in self.listings:
            growth = listing.get("google_trends_growth_pct", 0)
            comps = listing.get("active_competitors", 1000)
            if growth >= 30.0 and comps <= 250:
                alerts.append({
                    "niche": listing.get("niche"),
                    "title": listing.get("title"),
                    "growth_surge": f"+{growth}%",
                    "competitor_count": comps,
                    "opportunity_level": "🔥 EARLY OPPORTUNITY",
                    "recommended_action": "Launch design within 10 days before saturation."
                })
        return sorted(alerts, key=lambda x: x["growth_surge"], reverse=True)

    def get_design_insights(self, niche: str = "All") -> Dict[str, Any]:
        """
        Returns top colors, converting quotes, themes, and personalization strategies.
        """
        return {
            "top_quotes": [
                "\"No matter how tall I grow, I will always look up to you\"",
                "\"You held my hand for a short while, but my heart forever\"",
                "\"First my Mother, Forever my Friend\"",
                "\"Best Grandpa / Papa in the World\""
            ],
            "popular_themes": [
                "Grandparent & Family Bonds",
                "Pet Memorial & Loss Comfort",
                "Outdoor Garden & Monogram Monikers",
                "Anniversary & Long Distance Couples"
            ],
            "top_converting_colors": [
                "Clear Transparent Acrylic + Soft Warm LED",
                "Rustic Natural Wood Grain (Oak / Birch)",
                "Matte Black Powder Coated Steel",
                "Pastel Floral / Watercolor Accents"
            ],
            "personalization_hooks": [
                "Custom Names & Children Birthstones",
                "Pet Photo Cutout & Memorial Dates",
                "Custom Map Location & Coordinates",
                "Handwritten Signature Reproduction"
            ]
        }

    def get_competitor_insights(self) -> List[Dict[str, Any]]:
        """
        Tracks competitor benchmarks (price points, review velocities).
        """
        trackers = []
        for listing in self.listings:
            trackers.append({
                "marketplace": listing.get("marketplace"),
                "title": listing.get("title")[:45] + "...",
                "price": f"${listing.get('price_usd'):.2f}",
                "monthly_sales": listing.get("estimated_monthly_sales"),
                "review_velocity": f"+{int(listing.get('review_count') * 0.08)} reviews/mo",
                "rating": listing.get("avg_rating")
            })
        return trackers
