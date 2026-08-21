import os
import re
import json
import time
from typing import Dict, Any, Optional, List

OFFLOAD_DIR = "data/context_offloading"
os.makedirs(OFFLOAD_DIR, exist_ok=True)

def _slugify(text: str) -> str:
    """Converts a keyword or title into a clean filename slug."""
    text = re.sub(r'[^\w\s-]', '', text.lower())
    return re.sub(r'[-\s]+', '_', text).strip('_')[:60]

class ContextOffloader:
    """
    DeepAgents Context Offloading Engine.
    Follows official LangChain DeepAgents Context Engineering standard:
    https://docs.langchain.com/oss/python/deepagents/context-engineering#offloading
    
    Offloads heavy raw marketplace listings, reviews, competitor data, and signals
    to disk to preserve LLM context window while maintaining full lossless retrieval.
    """
    def __init__(self, storage_dir: str = OFFLOAD_DIR):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)

    def offload(self, keyword: str, payload: Dict[str, Any]) -> str:
        """
        Saves rich product data payload to the filesystem and returns the relative file path.
        """
        slug = _slugify(keyword)
        timestamp = int(time.time())
        filename = f"{timestamp}_{slug}.json"
        file_path = os.path.join(self.storage_dir, filename)
        
        # Also maintain a latest reference for quick lookup
        latest_path = os.path.join(self.storage_dir, f"latest_{slug}.json")
        
        full_context = {
            "keyword": keyword,
            "timestamp": timestamp,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "data": payload
        }
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(full_context, f, indent=2, ensure_ascii=False)
            
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(full_context, f, indent=2, ensure_ascii=False)
            
        return file_path

    def load(self, keyword_or_path: str) -> Optional[Dict[str, Any]]:
        """
        Loads offloaded context either by exact file path or by keyword slug.
        """
        if os.path.exists(keyword_or_path):
            with open(keyword_or_path, "r", encoding="utf-8") as f:
                return json.load(f)
                
        slug = _slugify(keyword_or_path)
        latest_path = os.path.join(self.storage_dir, f"latest_{slug}.json")
        if os.path.exists(latest_path):
            with open(latest_path, "r", encoding="utf-8") as f:
                return json.load(f)
                
        return None

    def list_all_offloaded(self) -> List[Dict[str, Any]]:
        """Lists all offloaded product context files with basic metadata."""
        results = []
        if not os.path.exists(self.storage_dir):
            return results
            
        for fname in os.listdir(self.storage_dir):
            if fname.startswith("latest_") and fname.endswith(".json"):
                fpath = os.path.join(self.storage_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        results.append({
                            "keyword": data.get("keyword"),
                            "created_at": data.get("created_at"),
                            "file_path": fpath
                        })
                except Exception:
                    pass
        return results
