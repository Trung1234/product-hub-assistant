import json
import time
from src.agent_graph import graph

def run_live_demo():
    print("=================================================================")
    print("🚀 LIVE DEMO TEST RUN: DEEPAGENTS MULTI-AGENT POD OPPORTUNITY HUB")
    print("=================================================================\n")
    
    prompt = """
    Hãy phân tích cơ hội thị trường và đưa ra đề xuất hành động cụ thể cho sản phẩm: 
    "Personalized Grandpa Gift For Father's Day From Granddaughter Custom Shape Acrylic Ornament". 

    Yêu cầu:
    1. Chạy song song các Sub-Agents cào dữ liệu từ Etsy, Amazon, Shopee, AWS PA-API và Google Trends.
    2. Chuẩn hóa sản phẩm về đúng Printway Catalog Taxonomy.
    3. Tính toán 6D Opportunity Score (0-100) và đưa ra quyết định RECOMMEND / NOT RECOMMEND.
    4. Trả lời 6 câu hỏi R&D và sinh đường link tải báo cáo PDF.
    """
    
    print(f"📥 [USER INPUT PROMPT]:\n{prompt.strip()}\n")
    print("⚙️ [EXECUTING DEEPAGENTS GRAPH] Processing sub-agents workflow...\n")
    
    start_time = time.time()
    inputs = {"messages": [("user", prompt)]}
    
    response = graph.invoke(inputs)
    elapsed = round(time.time() - start_time, 2)
    
    messages = response.get("messages", [])
    print(f"✅ [EXECUTION COMPLETED IN {elapsed} SECONDS]")
    print(f"  • Total Trajectory Steps: {len(messages)} Steps")
    
    final_output = messages[-1].content
    print("\n=================================================================")
    print("📄 FINAL EXECUTIVE RESPONSE OUTPUT:")
    print("=================================================================\n")
    print(final_output)

if __name__ == "__main__":
    run_live_demo()
