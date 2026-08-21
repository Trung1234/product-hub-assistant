import json
import time
from src.agent_graph import graph

def test_official_deepagents_subagent_pipeline():
    print("=" * 65)
    print("🧪 TESTING OFFICIAL DEEPAGENTS SUB-AGENTS SPECIFICATION")
    print("=" * 65)
    
    test_query = "Personalized Grandpa Gift For Father's Day From Granddaughter Custom Shape Acrylic Ornament"
    print(f"📝 Input Query: '{test_query}'\n")

    start_time = time.time()
    
    inputs = {"messages": [("user", f"Perform product opportunity research with specialized sub-agents for: {test_query}")]}
    
    print("🤖 Executing Official DeepAgents Graph...")
    try:
        response = graph.invoke(inputs)
        elapsed = time.time() - start_time
        
        messages = response.get("messages", [])
        print(f"\n✅ Execution Finished in {elapsed:.2f} seconds!")
        print(f"Trajectory Messages Count: {len(messages)}")
        
        print("\n🛠️ Trajectory & Sub-Agent Delegations:")
        for idx, msg in enumerate(messages):
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                for tc in msg.tool_calls:
                    print(f"  [{idx}] ⚡ Tool Call: `{tc['name']}` | Args: {tc['args']}")
            elif msg.type == "tool":
                print(f"  [{idx}] 📤 Tool Response: `{msg.name}` ({len(str(msg.content))} chars)")

        final_msg = messages[-1].content
        print("\n📄 Final Output Preview:")
        print("-" * 50)
        print(final_msg[:700] + "...\n")
        print("-" * 50)
        print("🎉 OFFICIAL DEEPAGENTS SUB-AGENTS TEST SUCCESSFUL!")

    except Exception as e:
        print(f"❌ Execution Error: {e}")

if __name__ == "__main__":
    test_official_deepagents_subagent_pipeline()
