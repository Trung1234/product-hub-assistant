import json
from typing import List, Optional
from langchain_core.tools import tool
from langgraph.types import interrupt

@tool
def ask_user_clarification(
    question: str,
    context: str = "",
    options: Optional[List[str]] = None
) -> str:
    """
    Human-in-the-Loop Clarification Tool (https://docs.langchain.com/oss/python/deepagents/human-in-the-loop).
    Use this tool to ask the user a clarifying question when:
    - Requirements are underspecified or ambiguous (e.g. target selling price range, specific material like acrylic vs wood, target gift recipient).
    - Strategic R&D decisions require human approval or alignment.
    Pauses agent execution and prompts the user in the UI, resuming once the user responds.
    """
    payload = {
        "action": "clarification_request",
        "question": question,
        "context": context,
        "options": options or []
    }
    
    # LangGraph Interrupt mechanism
    user_feedback = interrupt(payload)
    
    return json.dumps({
        "status": "CLARIFICATION_RECEIVED",
        "user_response": user_feedback
    }, ensure_ascii=False)
