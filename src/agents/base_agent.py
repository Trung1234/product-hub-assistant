import json
import logging
from typing import Dict, Any, List, Callable, Optional

class DeepAgentState:
    """
    State container for DeepAgent workflows.
    Tracks persistent context, task history, and intermediate evaluation artifacts.
    """
    def __init__(self, query: str):
        self.query = query
        self.normalized_product: Optional[Dict[str, Any]] = None
        self.scoring_result: Optional[Dict[str, Any]] = None
        self.market_insights: Optional[Dict[str, Any]] = None
        self.report_markdown: Optional[str] = None
        self.history: List[Dict[str, str]] = []

    def log_step(self, agent_name: str, status: str, message: str):
        self.history.append({
            "agent": agent_name,
            "status": status,
            "message": message
        })

class DeepAgentTaskHarness:
    """
    DeepAgents execution manager. Provides task orchestration, 
    sub-agent delegation, state management, and fallback execution.
    """
    def __init__(self, name: str, role: str, description: str):
        self.name = name
        self.role = role
        self.description = description
        self.tools: Dict[str, Callable] = {}

    def register_tool(self, name: str, fn: Callable):
        self.tools[name] = fn

    def execute_step(self, tool_name: str, *args, **kwargs):
        if tool_name in self.tools:
            return self.tools[tool_name](*args, **kwargs)
        raise ValueError(f"Tool '{tool_name}' is not registered in Agent '{self.name}'.")
