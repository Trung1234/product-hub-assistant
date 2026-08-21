import json
from langchain_core.tools import tool
from src.normalizers.taxonomy_normalizer import ProductTaxonomyNormalizer

taxonomy_normalizer = ProductTaxonomyNormalizer()

@tool
def printway_taxonomy_subagent_tool(query: str) -> str:
    """Specialized Tool/Agent for normalizing titles to Printway Catalog taxonomy."""
    norm = taxonomy_normalizer.normalize(query)
    return json.dumps({
        "subagent": "PrintwayTaxonomySubAgent",
        "taxonomy_mapping": norm
    }, indent=2)
