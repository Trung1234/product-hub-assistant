import json
import re
import os
import requests
from typing import Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from src.config import PRINTWAY_CATALOG_PATH

TAXONOMY_SERVICE_URL = os.getenv("TAXONOMY_SERVICE_URL", "http://127.0.0.1:8001/api/v1/normalize")

class ProductTaxonomyNormalizer:
    """
    Product Taxonomy Normalizer Client.
    Primary Mode: Calls the standalone Taxonomy Normalization Microservice (FastAPI at http://127.0.0.1:8001).
    Fallback Mode: Executes local in-memory normalization if the Microservice is offline.
    """
    def __init__(self, catalog_path: str = PRINTWAY_CATALOG_PATH, service_url: str = TAXONOMY_SERVICE_URL):
        self.catalog_path = catalog_path
        self.service_url = service_url
        self._init_local_fallback()

    def normalize(self, title_or_url: str) -> Dict[str, Any]:
        """Tries calling Taxonomy Microservice via HTTP POST; falls back to local execution if offline."""
        try:
            response = requests.post(
                self.service_url,
                json={"title_or_url": title_or_url},
                timeout=2.0
            )
            if response.status_code == 200:
                result = response.json()
                result["execution_mode"] = "MICROSERVICE_FASTAPI"
                return result
        except Exception:
            pass
        
        # Local Fallback Execution
        result = self._local_normalize(title_or_url)
        result["execution_mode"] = "LOCAL_FALLBACK"
        return result

    def _init_local_fallback(self):
        with open(self.catalog_path, "r", encoding="utf-8") as f:
            self.catalog = json.load(f)
        
        self.documents = []
        for item in self.catalog:
            doc = f"{item['product_type']} {item['category']} {item['material']} {' '.join(item['keywords'])} {item['description']}"
            self.documents.append(doc.lower())
        
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 3), stop_words='english')
        self.doc_vectors = self.vectorizer.fit_transform(self.documents)

    def _local_normalize(self, title_or_url: str) -> Dict[str, Any]:
        clean_text = re.sub(r'https?://\S+', '', title_or_url)
        clean_text = re.sub(r'[/_.-]', ' ', clean_text)
        clean_text = re.sub(r'[^a-zA-Z0-9\s]', '', clean_text)
        
        query_vec = self.vectorizer.transform([clean_text.lower()])
        sim_scores = cosine_similarity(query_vec, self.doc_vectors)[0]
        
        boosted_scores = list(sim_scores)
        for idx, item in enumerate(self.catalog):
            for kw in item['keywords']:
                if kw.lower() in clean_text.lower():
                    boosted_scores[idx] += 0.35
            if item['material'].lower() in clean_text.lower():
                boosted_scores[idx] += 0.20

        best_idx = int(max(range(len(boosted_scores)), key=lambda i: boosted_scores[i]))
        max_score = boosted_scores[best_idx]
        confidence = min(round(max_score * 100, 1), 99.9)

        matched_item = self.catalog[best_idx]
        detected_material = matched_item['material']
        for mat in matched_item.get('supported_materials', []):
            if mat.lower() in clean_text.lower():
                detected_material = mat
                break

        return {
            "matched_product_type_id": matched_item["product_type_id"],
            "product_type": matched_item["product_type"],
            "category": matched_item["category"],
            "material": detected_material,
            "canonical_material": matched_item["material"],
            "supported_materials": matched_item["supported_materials"],
            "production_difficulty": matched_item["production_difficulty"],
            "production_capacity": matched_item["production_capacity"],
            "avg_base_cost_usd": matched_item["avg_base_cost_usd"],
            "avg_retail_price_usd": matched_item["avg_retail_price_usd"],
            "avg_margin_pct": matched_item["avg_margin_pct"],
            "lead_time_days": matched_item["lead_time_days"],
            "normalization_confidence_pct": confidence,
            "raw_input": title_or_url
        }
