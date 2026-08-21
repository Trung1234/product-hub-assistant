import hashlib
from langchain_core.tools import tool

def _derive_signals_from_keyword(keyword: str):
    """Generates instant, realistic, deterministic market signals from keyword without network delay (0ms latency)."""
    kw_clean = keyword.lower().strip()
    h = int(hashlib.md5(kw_clean.encode()).hexdigest(), 16)
    
    # Deterministic yet realistic variance
    base_vol = 12000 + (h % 18000)
    base_listings = 45 + (h % 220)
    base_price = 14.99 + ((h % 1500) / 100.0)
    monthly_sales = int(base_vol * 0.08) + (h % 300)
    amazon_units = 850 + (h % 1600)
    bsr = 8000 + (h % 24000)
    reviews = int(amazon_units * 0.035) + 12
    price_high = round(base_price + 6.0 + (h % 5), 2)
    price_range = f"${base_price:.2f} - ${price_high:.2f}"
    
    tags = ["personalized gift", "custom ornament", "handmade decor"]
    if "mug" in kw_clean or "cup" in kw_clean or "tumbler" in kw_clean:
        tags = ["custom drinkware", "coffee mug gift", "pet lovers mug"]
    elif "shirt" in kw_clean or "sweatshirt" in kw_clean or "hoodie" in kw_clean:
        tags = ["embroidered apparel", "mama sweatshirt", "custom sleeve"]
    elif "plaque" in kw_clean or "sign" in kw_clean or "desk" in kw_clean:
        tags = ["desk plaque light", "laser cut wood", "office gift"]
        
    return {
        "search_volume": base_vol,
        "active_listings": base_listings,
        "avg_price_usd": round(base_price, 2),
        "monthly_sales": monthly_sales,
        "amazon_units": amazon_units,
        "price_range_usd": price_range,
        "bsr": bsr,
        "reviews": reviews,
        "tags": ",".join(tags)
    }

@tool
def fetch_etsy_market_data(keyword: str) -> str:
    """
    Harvests instant Etsy marketplace intelligence in ultra-compact TOON format (0ms mockup).
    Output: [TOON:ETSY] kw="..." | vol=... | listings=... | avg_price=... | mo_sales=... | tags="..."
    """
    sig = _derive_signals_from_keyword(keyword)
    return f"[TOON:ETSY] kw=\"{keyword.strip()}\" | vol={sig['search_volume']} | listings={sig['active_listings']} | avg_price={sig['avg_price_usd']} | mo_sales={sig['monthly_sales']} | tags=\"{sig['tags']}\""

@tool
def fetch_amazon_market_data(keyword: str) -> str:
    """
    Harvests instant Amazon US marketplace intelligence in ultra-compact TOON format (0ms mockup).
    Output: [TOON:AMAZON] kw="..." | sales_units=... | price_range="..." | bsr=... | reviews=...
    """
    sig = _derive_signals_from_keyword(keyword)
    return f"[TOON:AMAZON] kw=\"{keyword.strip()}\" | sales_units={sig['amazon_units']} | price_range=\"{sig['price_range_usd']}\" | bsr={sig['bsr']} | reviews={sig['reviews']}"

# Backward compatibility aliases
etsy_subagent_tool = fetch_etsy_market_data
amazon_subagent_tool = fetch_amazon_market_data
