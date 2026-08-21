import json
from src.pipeline.real_data_pipeline import RealMarketDataPipeline

KEYWORDS_TO_POPULATE = [
    "Personalized Grandpa Gift For Father's Day From Granddaughter Custom Shape Acrylic Ornament",
    "halloween mug",
    "ghost mirror",
    "teacher tumbler",
    "Custom Photo Cat Mom Ceramic Mug Gift For Pet Lovers",
    "Custom Embroidered Mama Sweatshirt With Kids Names On Sleeve"
]

def populate():
    pipeline = RealMarketDataPipeline()
    print("=================================================================")
    print("📊 POPULATING REAL MULTI-SOURCE OPPORTUNITY MATRIX DATASET (23 COLUMNS)")
    print("=================================================================\n")
    
    for idx, kw in enumerate(KEYWORDS_TO_POPULATE, 1):
        print(f"[{idx}/{len(KEYWORDS_TO_POPULATE)}] Analyzing: '{kw}'")
        row = pipeline.analyze_keyword(kw)
        print(f"  ➔ Mapped: {row.recommended_product} ({row.material}) | Opp Score: {row.opportunity}/100 | Seasonality: {row.seasonality}")
        print(f"  ➔ Reason: {row.reason[:100]}...\n")
        
    print("=================================================================")
    print("🎉 DATASET POPULATED SUCCESSFULLY AT 'data/product_opportunities.csv'!")
    print("=================================================================")

if __name__ == "__main__":
    populate()
