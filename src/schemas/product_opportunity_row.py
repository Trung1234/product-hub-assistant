from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import date

class ProductOpportunityRow(BaseModel):
    """
    Standardized Schema matching the Printway Hackathon Opportunity Matrix Google Sheet.
    23 columns exact match:
    https://docs.google.com/spreadsheets/d/1E3QAo62sW7z5GJDA0VgPCS1t6HvQtsUQN0kOuVPePzo/edit?gid=0#gid=0
    """
    model_config = ConfigDict(populate_by_name=True)

    date: str = Field(default_factory=lambda: date.today().isoformat(), description="Date of research YYYY-MM-DD")
    keyword: str = Field(..., description="Target search keyword or product niche")
    google_trend: Optional[float] = Field(None, description="Google Trends relative search index (0-100)")
    etsy_reviews: Optional[int] = Field(None, description="Average or top seller reviews on Etsy")
    amazon_bsr: Optional[int] = Field(None, description="Amazon Best Seller Rank in primary category")
    demand: int = Field(..., ge=0, le=100, description="Demand score (0-100)")
    competition: int = Field(..., ge=0, le=100, description="Competition score (0-100, lower competition = higher score)")
    growth: int = Field(..., ge=0, le=100, description="Search growth momentum score (0-100)")
    trend: int = Field(..., ge=0, le=100, description="Trend strength score (0-100)")
    opportunity: int = Field(..., ge=0, le=100, description="Final 6D Opportunity Score (0-100)")
    seasonality: str = Field("medium", description="Seasonality level: 'high', 'medium', 'low', 'none'")
    buyer_intent: str = Field("gift", description="Buyer intent: 'gift', 'decor', 'apparel', 'functional', etc.")
    collection: str = Field("general", description="Collection theme: 'holiday', 'home decor', 'Halloween', 'gifts', 'Mom', 'Grandpa'")
    material: str = Field("acrylic", description="Printway standard material: 'ceramic', 'glass', 'stainless steel', 'acrylic', 'wood'")
    style: str = Field("personalized", description="Product style: 'personalized', 'themed', 'spooky', 'modern', 'functional'")
    recommended_product: str = Field("ornament", description="Standard recommended product type: 'mug', 'tumbler', 'ornament', 'plaque'")
    price_range: str = Field("$15-$25", description="Marketplace recommended retail price range USD")
    reason: str = Field(..., description="Strategic R&D rationale explaining why this product has high/low opportunity")
    etsy_price: Optional[float] = Field(None, description="Real live observed price on Etsy USD")
    etsy_sales: Optional[int] = Field(None, description="Estimated monthly sales volume on Etsy")
    amazon_reviews: Optional[int] = Field(None, description="Observed review count on Amazon")
    category: Optional[str] = Field(None, description="Printway standard category: 'Home Decor', 'Drinkware', 'Apparel'")
    ai_failed: Optional[bool] = Field(False, alias="_ai_failed", description="Diagnostic flag if AI extraction failed")
