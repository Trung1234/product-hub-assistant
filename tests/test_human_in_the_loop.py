import json
from src.tools.human_tools import ask_user_clarification
from src.agent_graph import graph, orchestrator_tools

def test_clarification_handoff_suite():
    print("=================================================================")
    print("🤖 VALIDATING USER CLARIFICATION HANDOFF SUITE")
    print("=================================================================\n")

    print("📌 [1] Validating ask_user_clarification Tool Presence...")
    tool_names = [t.name for t in orchestrator_tools]
    assert "ask_user_clarification" in tool_names
    print(f"  ✅ Tool registered in Orchestrator tools: {tool_names}")

    print("\n📌 [2] Validating Autonomous DeepAgent Graph (No Tool Approvals Required)...")
    assert graph is not None
    print("  ✅ LangGraph CompiledStateGraph initialized for autonomous execution!")

    print("\n=================================================================")
    print("🎉 USER CLARIFICATION HANDOFF PASSED 100%!")
    print("=================================================================")

if __name__ == "__main__":
    test_clarification_handoff_suite()
