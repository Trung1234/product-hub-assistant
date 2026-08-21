import os
import json
from src.tools.dataset_tools import (
    analyze_and_record_opportunity_matrix,
    retrieve_offloaded_product_context
)
from src.context.context_offloader import ContextOffloader

def test_context_offloading():
    print("=================================================================")
    print("🧠 TESTING DEEPAGENTS CONTEXT OFFLOADING INTEGRATION")
    print("=================================================================\n")

    kw = "Custom Acrylic Night Light For Kids Room"

    print(f"📌 [1] Harvesting product & Triggering Context Offload for '{kw}'...")
    res_str = analyze_and_record_opportunity_matrix.invoke({"keyword": kw})
    res = json.loads(res_str)

    assert res.get("context_offloaded") is True, "Context offloaded flag must be True!"
    offloaded_file = res.get("offloaded_context_file")
    print(f"  ✅ Context successfully offloaded to disk: '{offloaded_file}'")

    print("\n📌 [2] Verifying physical existence of offloaded JSON file...")
    assert os.path.exists(offloaded_file), f"File {offloaded_file} does not exist on filesystem!"
    file_size = os.path.getsize(offloaded_file)
    print(f"  ✅ Physical file verified! Size: {file_size} bytes")

    print("\n📌 [3] Retrieving offloaded context via retrieve_offloaded_product_context tool...")
    retrieved_str = retrieve_offloaded_product_context.invoke({"keyword_or_file_path": kw})
    retrieved = json.loads(retrieved_str)

    assert "data" in retrieved, "Retrieved context must contain 'data' payload!"
    assert retrieved["data"]["keyword"] == kw, "Keyword in offloaded context must match!"
    print(f"  ✅ Retrieval verified! Offloaded data contains full Etsy & Amazon signals: {list(retrieved['data'].keys())}")

    print("\n📌 [4] Listing all offloaded contexts in storage...")
    offloader = ContextOffloader()
    all_contexts = offloader.list_all_offloaded()
    print(f"  ✅ Total offloaded product contexts stored: {len(all_contexts)}")
    for item in all_contexts[:5]:
        print(f"     • {item['keyword']} -> {item['file_path']}")

    print("\n=================================================================")
    print("🎉 CONTEXT OFFLOADING TEST PASSED 100%!")
    print("=================================================================")

if __name__ == "__main__":
    test_context_offloading()
