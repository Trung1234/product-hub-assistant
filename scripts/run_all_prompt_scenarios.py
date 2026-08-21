import json
import time
from src.agent_graph import graph

SCENARIOS = [
    {
        "id": "SCENARIO_1",
        "title": "Father's Day / Grandpa Acrylic Ornament Research",
        "prompt": "Hãy nghiên cứu cơ hội thị trường cho sản phẩm 'Personalized Grandpa Gift For Father's Day From Granddaughter Custom Shape Acrylic Ornament'. Xuất bản dữ liệu 23 cột chuẩn Google Sheet, tính Opportunity Score và trả lời 6 câu hỏi R&D."
    },
    {
        "id": "SCENARIO_2",
        "title": "Pet Lovers Ceramic Drinkware Niche Research",
        "prompt": "Phân tích cơ hội thị trường cho ngách: 'Custom Photo Cat Mom Ceramic Mug Gift For Pet Lovers'. Đánh giá nhu cầu tìm kiếm, dải giá bán lẻ và biên lợi nhuận sản xuất của Printway."
    },
    {
        "id": "SCENARIO_3",
        "title": "Embroidered Mama Apparel Niche Research",
        "prompt": "Kiểm tra xu hướng sản phẩm 'Custom Embroidered Mama Sweatshirt With Kids Names On Sleeve'. Cho biết mức độ cạnh tranh, tính mùa vụ và cửa sổ thời gian ra mắt tối ưu."
    },
    {
        "id": "SCENARIO_4",
        "title": "Dirty Title Normalization & Dataset Insight Query",
        "prompt": "Hãy chuẩn hóa dirty title '2026 Funny New Papa Est Acrylic Desk Sign Plaque With Wood Base Light' và trích xuất top các sản phẩm có Opportunity Score cao nhất từ dataset."
    }
]

def run_scenarios():
    print("=================================================================")
    print("🚀 EXECUTING 4 REAL-WORLD PROMPT SCENARIOS ON DEEPAGENTS")
    print("=================================================================\n")
    
    results_summary = []
    
    for idx, sc in enumerate(SCENARIOS, 1):
        print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        print(f"🎬 [{idx}/{len(SCENARIOS)}] CHẠY KỊCH BẢN {idx}: {sc['title']}")
        print(f"📝 User Prompt: \"{sc['prompt']}\"\n")
        
        start_time = time.time()
        try:
            inputs = {"messages": [("user", sc["prompt"])]}
            response = graph.invoke(inputs)
            elapsed = round(time.time() - start_time, 2)
            
            messages = response.get("messages", [])
            final_text = messages[-1].content if messages else "No response generated."
            
            print(f"⏱️ Thời gian thực thi: {elapsed} giây | Tổng số bước Trajectory: {len(messages)} bước")
            print("\n📄 KẾT QUẢ ĐỀ XUẤT HÀNH ĐỘNG TÓM TẮT:")
            print("  " + "-" * 55)
            for line in final_text.split("\n")[:12]:
                print("  " + line)
            print("  " + "-" * 55 + "\n")
            
            results_summary.append({
                "scenario_id": sc["id"],
                "title": sc["title"],
                "status": "SUCCESS",
                "latency_seconds": elapsed,
                "steps_count": len(messages)
            })
        except Exception as e:
            print(f"❌ Error in Scenario {idx}: {e}\n")
            results_summary.append({
                "scenario_id": sc["id"],
                "title": sc["title"],
                "status": f"FAILED: {str(e)}",
                "latency_seconds": 0,
                "steps_count": 0
            })
            
    print("=================================================================")
    print("📊 TỔNG KẾT KẾT QUẢ THỬ NGHIỆM 4 KỊCH BẢN PROMPTS")
    print("=================================================================")
    for res in results_summary:
        print(f"  • {res['scenario_id']} ({res['title']}): {res['status']} ({res['latency_seconds']}s, {res['steps_count']} steps)")
    print("=================================================================\n")

if __name__ == "__main__":
    run_scenarios()
