"""
PRINTWAY NEXUS PRODUCTION LANGGRAPH API SERVER ENTRYPOINT
Robust production server handling dynamic port binding for Render Cloud & local development.
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Ensure current directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from langgraph_api.cli import run_server

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "2024"))
    host = os.environ.get("HOST", "0.0.0.0")
    
    print("=" * 80)
    print(f"🚀 [PRINTWAY NEXUS] STARTING LANGGRAPH SERVER ON {host}:{port}")
    print("=" * 80)
    
    graphs = {
        "product_opportunity_hub": "./src/agent_graph.py:graph"
    }
    
    run_server(
        host,
        port,
        False,  # no reload to prevent ulimit issues
        graphs,
        open_browser=False,
        allow_blocking=True,
        server_level="INFO"
    )
