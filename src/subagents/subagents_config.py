from src.tools.market_tools import (
    fetch_etsy_market_data,
    fetch_amazon_market_data
)
from src.prompts import (
    ETSY_ANALYST_SUBAGENT_PROMPT,
    AMAZON_ANALYST_SUBAGENT_PROMPT
)

# Sub-Agents configuration list focused exclusively on Etsy and Amazon:
# https://docs.langchain.com/oss/python/deepagents/subagents
SUBAGENTS_CONFIG = [
    {
        "name": "etsy_analyst",
        "description": "Specialized DeepAgent for analyzing Etsy search volume, listing counts, seller saturation, and pricing.",
        "prompt": ETSY_ANALYST_SUBAGENT_PROMPT,
        "runnable": fetch_etsy_market_data
    },
    {
        "name": "amazon_analyst",
        "description": "Specialized DeepAgent for analyzing Amazon sales velocity, BSR category rank, review counts, and price bands.",
        "prompt": AMAZON_ANALYST_SUBAGENT_PROMPT,
        "runnable": fetch_amazon_market_data
    }
]
