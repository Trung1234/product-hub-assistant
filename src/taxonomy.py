import json
import re
from typing import Dict, Any, List, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

class ProductTaxonomyNormalizer:
    """
    Normalizes arbitrary listing titles or URLs into Printway's standardized catalog taxonomy:
    Product Type -> Category -> Material
    Uses hybrid TF-IDF + Keyword Weighting + Semantic rules.
    """
    def __init__(self, catalog_path: str = "data/printway_catalog.json"):
        with open(catalog_path, "r", encoding="utf-8") as f:
            self.catalog = json.load(f)
        
        self.documents = []
        for item in self.catalog:
            # Combine product_type, category, material, keywords, and description for vector matching
            doc = f"{item['product_type']} {item['category']} {item['material']} {' '.join(item['keywords'])} {item['description']}"
            self.documents.append(doc.lower())
        
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 3), stop_words='english')
        self.doc_vectors = self.vectorizer.fit_transform(self.documents)

    def normalize(self, title_or_url: str) -> Dict[str, Any]:
        """
        Takes dirty title/URL and returns mapped canonical Printway product taxonomy item with confidence.
        """
        clean_text = self._clean_text(title_or_url)
        query_vec = self.vectorizer.transform([clean_text.lower()])
        sim_scores = cosine_similarity(query_vec, self.doc_vectors)[0]
        
        # Keyword boosting rules
        boosted_scores = list(sim_scores)
        for idx, item in enumerate(self.catalog):
            # Direct keyword matching bonus
            for kw in item['keywords']:
                if kw.lower() in clean_text.lower():
                    boosted_scores[idx] += 0.35
            # Material matching bonus
            if item['material'].lower() in clean_text.lower():
                boosted_scores[idx] += 0.20

        best_idx = int(max(range(len(boosted_scores)), key=lambda i: boosted_scores[i]))
        max_score = boosted_scores[best_idx]
        confidence = min(round(max_score * 100, 1), 99.9)

        matched_item = self.catalog[best_idx]
        
        # Extract detected material from title if available, else default to catalog material
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

    def _clean_text(self, text: str) -> str:
        # Strip URL components if string is URL
        text = re.sub(r'https?://\S+', '', text)
        text = re.sub(r'[/_.-]', ' ', text)
        # Keep alphanumeric and spaces
        text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
        return text

if __name__ == "__main__":
    normalizer = ProductTaxonomyNormalizer()
    test_title = "Personalized Grandpa Gift For Father's Day From Granddaughter Custom Shape Acrylic Ornament"
    res = normalizer.normalize(test_title)
    print("Test Normalization Result:")
    print(json.dumps(res, indent=2))
