from src.tools.market_tools import (
    fetch_etsy_market_data,
    fetch_amazon_market_data
)
from src.tools.scoring_tools import evaluate_5d_opportunity_score
from src.prompts import (
    ETSY_ANALYST_SUBAGENT_PROMPT,
    AMAZON_ANALYST_SUBAGENT_PROMPT,
    OPPORTUNITY_ANALYST_SUBAGENT_PROMPT
)

# 3 Focused Sub-Agents Architecture:
# 1. etsy_analyst: Collects Etsy intelligence in compact TOON
# 2. amazon_analyst: Collects Amazon intelligence in compact TOON
# 3. opportunity_analyst: Specialized Sub-Agent for calculating Opportunity Score & Economics
SUBAGENTS_CONFIG = [
    {
        "name": "etsy_analyst",
        "description": "Specialized DeepAgent for harvesting Etsy search volume, listings, and pricing in token-optimized TOON format.",
        "prompt": ETSY_ANALYST_SUBAGENT_PROMPT,
        "runnable": fetch_etsy_market_data
    },
    {
        "name": "amazon_analyst",
        "description": "Specialized DeepAgent for harvesting Amazon sales velocity, BSR category, and price range in token-optimized TOON format.",
        "prompt": AMAZON_ANALYST_SUBAGENT_PROMPT,
        "runnable": fetch_amazon_market_data
    },
    {
        "name": "opportunity_analyst",
        "description": "Specialized DeepAgent for computing multi-dimensional Opportunity Score (Demand, Competition, Velocity, Margin, Personalization) and recommending GO/NO-GO strategy.",
        "prompt": OPPORTUNITY_ANALYST_SUBAGENT_PROMPT,
        "runnable": evaluate_5d_opportunity_score
    }
]
