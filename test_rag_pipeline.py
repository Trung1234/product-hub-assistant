import json
from src.tools.rag_tools import retrieve_printway_knowledge_rag

def test_rag_pipeline_suite():
    print("=================================================================")
    print("📚 VALIDATING SEMANTIC RAG PIPELINE (LANGCHAIN DEEPAGENTS)")
    print("=================================================================\n")

    print("📌 [1] Testing RAG Retrieval for Printway Factory Catalog (Acrylic Ornament)...")
    res1_str = retrieve_printway_knowledge_rag.invoke({
        "query": "acrylic ornament custom shape base cost and lead time",
        "domain": "catalog"
    })
    res1 = json.loads(res1_str)
    assert res1.get("status") == "RAG_RETRIEVAL_SUCCESS"
    assert len(res1.get("retrieved_documents", [])) > 0
    top_doc = res1["retrieved_documents"][0]
    assert "Acrylic Ornament" in top_doc["title"] or "PT-ACR" in top_doc["content_snippet"]
    print(f"  ✅ Catalog RAG Passed! (Found: {top_doc['title']}, Relevance: {top_doc['relevance_score']})")

    print("\n📌 [2] Testing RAG Retrieval for eCommerce Skills (Etsy Pricing Strategy)...")
    res2_str = retrieve_printway_knowledge_rag.invoke({
        "query": "etsy pricing formula profit margin calculation",
        "domain": "ecommerce_skills"
    })
    res2 = json.loads(res2_str)
    assert res2.get("status") == "RAG_RETRIEVAL_SUCCESS"
    assert len(res2.get("retrieved_documents", [])) > 0
    top_skill = res2["retrieved_documents"][0]
    print(f"  ✅ Skills RAG Passed! (Found: {top_skill['title']}, Relevance: {top_skill['relevance_score']})")

    print("\n📌 [3] Testing Cross-Domain Hybrid RAG Retrieval (Drinkware Tumbler)...")
    res3_str = retrieve_printway_knowledge_rag.invoke({
        "query": "stainless steel tumbler 20oz",
        "domain": "all"
    })
    res3 = json.loads(res3_str)
    assert res3.get("status") == "RAG_RETRIEVAL_SUCCESS"
    assert len(res3.get("retrieved_documents", [])) > 0
    print(f"  ✅ Hybrid RAG Passed! (Retrieved {res3['total_matches']} cross-domain documents)")

    print("\n=================================================================")
    print("🎉 SEMANTIC RAG RETRIEVAL PIPELINE PASSED 100%!")
    print("=================================================================")

if __name__ == "__main__":
    test_rag_pipeline_suite()
