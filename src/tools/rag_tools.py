import json
from typing import Optional
from langchain_core.tools import tool
from src.rag.rag_engine import PrintwayRAGEngine

rag_engine = PrintwayRAGEngine()

@tool
def retrieve_printway_knowledge_rag(
    query: str,
    domain: str = "all",
    top_k: int = 3
) -> str:
    """
    Semantic Retrieval-Augmented Generation (RAG) Tool for DeepAgents.
    Specification: https://docs.langchain.com/oss/python/deepagents/retrieval
    
    Retrieves high-relevance domain knowledge matching the user's product or query across:
    - 'catalog': Printway Factory specs, base costs ($), material types, SKU IDs, lead times, margins.
    - 'ecommerce_skills': 162 expert skill guides (pricing tiers, 13 Etsy tags, Amazon BSR, seasonal launch windows).
    - 'historical_opportunities': Past high-scoring product opportunities in the Printway R&D matrix.
    - 'all': Cross-domain hybrid retrieval.
    
    Returns structured JSON with top matching documents, relevance scores, and actionable factory economics.
    """
    try:
        matches = rag_engine.retrieve(query=query, domain=domain, top_k=top_k)
        
        formatted_matches = []
        for m in matches:
            formatted_matches.append({
                "title": m["title"],
                "domain": m["domain"],
                "relevance_score": m["relevance_score"],
                "content_snippet": m["content"][:800],
                "metadata": m.get("raw_metadata", {})
            })
            
        return json.dumps({
            "status": "RAG_RETRIEVAL_SUCCESS",
            "query": query,
            "domain_filtered": domain,
            "total_matches": len(formatted_matches),
            "retrieved_documents": formatted_matches
        }, indent=2, ensure_ascii=False)
    except Exception as e:
        return json.dumps({
            "status": "RAG_ERROR",
            "error": str(e),
            "query": query
        })
