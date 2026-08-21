"""Official Pinterest Trends ingestion for Product Opportunity Hub.

This package intentionally contains no Pinterest scraping code. API data is
treated as an ephemeral input and every exported signal carries an expiry.
"""

from .demand_score import calculate_demand_score, normalize_growth
from .keyword_mapper import KeywordMapper, map_keyword
from .models import DemandScoreResult, MappingResult, TrendRecord
from .pinterest_client import PinterestClient, fetch_trends

__all__ = [
    "DemandScoreResult",
    "KeywordMapper",
    "MappingResult",
    "PinterestClient",
    "TrendRecord",
    "calculate_demand_score",
    "fetch_trends",
    "map_keyword",
    "normalize_growth",
]
