import os
import json
import glob
import re
import pandas as pd
from typing import List, Dict, Any, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class PrintwayRAGEngine:
    """
    Production Semantic Retrieval-Augmented Generation (RAG) Engine for Printway DeepAgents:
    Specification: https://docs.langchain.com/oss/python/deepagents/retrieval
    
    Indexes 3 Core Knowledge Bases:
    1. Printway Factory Manufacturing Catalog (SKU, Base Cost, Margins, Materials, Lead Time)
    2. 162 eCommerce Skills Knowledge Base (nexscope-ai/eCommerce-Skills)
    3. Historical Product Opportunity Matrix Dataset (23 Columns)
    """

    def __init__(
        self,
        catalog_path: str = "data/printway_catalog.json",
        skills_dir: str = "skills/ecommerce_skills",
        dataset_path: str = "data/product_opportunities.csv"
    ):
        self.catalog_path = catalog_path
        self.skills_dir = skills_dir
        self.dataset_path = dataset_path
        
        self.documents: List[Dict[str, Any]] = []
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.doc_vectors = None
        
        self._build_index()

    def _clean_text(self, text: str) -> str:
        return re.sub(r'\s+', ' ', str(text)).strip().lower()

    def _build_index(self):
        docs = []

        # 1. Index Printway Factory Catalog
        if os.path.exists(self.catalog_path):
            try:
                with open(self.catalog_path, "r", encoding="utf-8") as f:
                    catalog_items = json.load(f)
                    for item in catalog_items:
                        content = f"Product Type: {item.get('product_type', '')}. SKU ID: {item.get('product_type_id', '')}. Category: {item.get('category', '')}. Material: {item.get('material', '')}. Base Cost: ${item.get('avg_base_cost_usd', '')}. Avg Retail Price: ${item.get('avg_retail_price_usd', '')}. Profit Margin: {item.get('avg_margin_pct', '')}%. Lead Time: {item.get('lead_time_days', '')} days. Description: {item.get('description', '')}. Keywords: {', '.join(item.get('keywords', []))}."
                        docs.append({
                            "id": f"catalog_{item.get('product_type_id', 'unknown')}",
                            "domain": "catalog",
                            "title": f"Printway Catalog: {item.get('product_type', '')}",
                            "content": content,
                            "raw_metadata": item
                        })
            except Exception as e:
                print(f"[RAG] Error indexing catalog: {e}")

        # 2. Index 162 eCommerce Skills
        if os.path.exists(self.skills_dir):
            skill_files = glob.glob(f"{self.skills_dir}/**/SKILL.md", recursive=True)
            for file_path in skill_files:
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        skill_text = f.read()
                    
                    # Extract skill name from folder
                    folder_name = os.path.basename(os.path.dirname(file_path))
                    # Take first 1500 chars of skill content for dense indexing
                    snippet = skill_text[:2000]
                    
                    docs.append({
                        "id": f"skill_{folder_name}",
                        "domain": "ecommerce_skills",
                        "title": f"eCommerce Skill: {folder_name}",
                        "content": f"Skill: {folder_name}\n\n{snippet}",
                        "raw_metadata": {"file_path": file_path, "skill_name": folder_name}
                    })
                except Exception as e:
                    pass

        # 3. Index Historical Product Opportunity Matrix
        if os.path.exists(self.dataset_path):
            try:
                df = pd.read_csv(self.dataset_path)
                for idx, row in df.iterrows():
                    kw = row.get("keyword", "")
                    content = f"Target Keyword: {kw}. Opportunity Score: {row.get('opportunity', '')}/100. Category: {row.get('category', '')}. Material: {row.get('material', '')}. Recommended Product: {row.get('recommended_product', '')}. Price Range: {row.get('price_range', '')}. Reason: {row.get('reason', '')}."
                    docs.append({
                        "id": f"dataset_{idx}_{kw}",
                        "domain": "historical_opportunities",
                        "title": f"Historical R&D Opportunity: {kw}",
                        "content": content,
                        "raw_metadata": row.to_dict()
                    })
            except Exception as e:
                pass

        self.documents = docs
        if docs:
            corpus = [doc["content"] for doc in docs]
            self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
            self.doc_vectors = self.vectorizer.fit_transform(corpus)
            print(f"[RAG Engine] Indexed {len(docs)} knowledge documents across Factory Catalog, Skills, and Historical Dataset.")

    def retrieve(self, query: str, domain: str = "all", top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Retrieves top-k most relevant knowledge documents matching the query.
        """
        if not self.documents or self.vectorizer is None or self.doc_vectors is None:
            return []

        # Filter indices by domain if requested
        valid_indices = list(range(len(self.documents)))
        if domain != "all":
            valid_indices = [i for i, doc in enumerate(self.documents) if doc["domain"] == domain]
            if not valid_indices:
                valid_indices = list(range(len(self.documents)))

        query_vec = self.vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self.doc_vectors)[0]

        # Rank valid indices by score
        scored_docs = [(i, similarities[i]) for i in valid_indices]
        scored_docs.sort(key=lambda x: x[1], reverse=True)

        results = []
        for idx, score in scored_docs[:top_k]:
            if score > 0.01:
                doc = self.documents[idx].copy()
                doc["relevance_score"] = round(float(score), 4)
                results.append(doc)

        return results
