"""
Sinh corpus MAU (synthetic fixture) de kiem thu duong ong DB -> chi so -> AI agent
khi khong crawl duoc du lieu that.

QUAN TRONG: day KHONG phai du lieu Pinterest that.
- Moi pin_id deu co tien to `fixture-`.
- Bao cao sinh ra tu corpus nay se mang co `data_mode = SYNTHETIC_FIXTURE`.
Khong duoc dung so lieu tu corpus nay de ra quyet dinh kinh doanh.

Chay:  python tools_make_fixture_corpus.py
"""

import json
import os
import random
from datetime import datetime, timedelta, timezone

OUT_PATH = "data/seed/pinterest_sample_corpus.json"
SEED = 20260821          # co dinh de corpus tai lap lai duoc

NICHES = [
    {
        "niche": "acrylic ornament",
        "titles": [
            "Personalized Acrylic Christmas Ornament with Family Names",
            "Custom Shape Acrylic Ornament Stained Glass Effect",
            "Baby First Christmas Acrylic Keepsake Ornament 2026",
            "Pet Memorial Acrylic Ornament with Photo Engraving",
            "Botanical Floral Acrylic Ornament Minimalist Design",
            "Grandpa Memorial Custom Acrylic Ornament Gift",
        ],
        "boards": ["Christmas Gift Ideas", "Personalized Ornaments", "Holiday Decor 2026"],
        "domain": "etsy.com", "price": (14.99, 24.99), "saves": (120, 4200),
    },
    {
        "niche": "stainless steel tumbler",
        "titles": [
            "Custom Stainless Steel Tumbler 20oz Laser Engraved",
            "Personalized Tumbler with Name Pastel Gradient",
            "Retro Wavy Font Insulated Tumbler Custom Gift",
            "Floral Line Art Stainless Tumbler for Teacher",
            "Monogram Steel Tumbler Minimalist Engraved Cup",
        ],
        "boards": ["Custom Drinkware", "Teacher Gift Ideas", "Aesthetic Tumblers"],
        "domain": "amazon.com", "price": (24.99, 34.99), "saves": (80, 2600),
    },
    {
        "niche": "embroidered sweatshirt",
        "titles": [
            "Custom Embroidered Mama Sweatshirt with Kids Names on Sleeve",
            "Vintage Varsity Chenille Embroidered Hoodie Custom",
            "Spooky Mama Retro Embroidered Sweatshirt Halloween",
            "Dog Mom Embroidered Sweatshirt Personalized Pet Name",
            "Custom Cotton Sweatshirt Embroidered Birth Flower",
        ],
        "boards": ["Cozy Fall Outfits", "Mama Style", "Custom Apparel Ideas"],
        "domain": "etsy.com", "price": (38.00, 58.00), "saves": (200, 5200),
    },
    {
        "niche": "acrylic desk plaque",
        "titles": [
            "Custom Acrylic Desk Sign Plaque with Wood Base Light",
            "Personalized Acrylic Name Plaque LED Warm Light",
            "Spotify Code Song Acrylic Plaque Anniversary Gift",
            "Architectural Cutout Acrylic Plaque Minimalist Typography",
        ],
        "boards": ["Office Desk Decor", "Anniversary Gifts", "Acrylic Signs"],
        "domain": "printway.io", "price": (22.99, 39.99), "saves": (60, 1400),
    },
    {
        "niche": "ceramic mug",
        "titles": [
            "Custom Pet Portrait Ceramic Mug Watercolor Handdrawn",
            "Cozy Autumn Aesthetic Personalized Coffee Mug",
            "Funny Quote Ceramic Mug Custom Name Office Gift",
            "Campfire Enamel Look Ceramic Mug Custom Design",
        ],
        "boards": ["Mug Design Inspo", "Pet Lover Gifts", "Coffee Bar Ideas"],
        "domain": "etsy.com", "price": (13.99, 21.99), "saves": (90, 1900),
    },
    {
        "niche": "engraved necklace",
        "titles": [
            "Personalized Engraved Necklace with Kids Names Gold",
            "Custom Message Card Necklace Minimalist Pendant",
            "Birthstone Engraved Necklace for Mom Gift",
        ],
        "boards": ["Jewelry Gift Guide", "Minimalist Jewelry"],
        "domain": "amazon.com", "price": (28.00, 42.00), "saves": (140, 2200),
    },
]

# Nhung niche nay duoc co tinh cho "moi hon" de phan Growth co tin hieu that de kiem tra.
FAST_RISERS = {"embroidered sweatshirt", "acrylic ornament"}

# Bien the thuc te tren Pinterest: cung mot san pham nhung khac goc thiet ke / dip tang.
STYLE_MODIFIERS = [
    "Minimalist", "Vintage Rustic", "Boho Watercolor", "Modern Farmhouse",
    "Retro Aesthetic", "Botanical Floral", "Scandinavian",
]
OCCASION_MODIFIERS = [
    "for Christmas", "for Birthday", "for Anniversary", "for Mothers Day",
    "for Housewarming", "for Graduation", "for Wedding",
]


def build_corpus():
    rng = random.Random(SEED)
    now = datetime.now(timezone.utc)
    pins = []
    counter = 0

    for niche in NICHES:
        for title in niche["titles"]:
            for variant in range(rng.randint(4, 7)):
                counter += 1
                if niche["niche"] in FAST_RISERS:
                    age_days = rng.uniform(3, 45) if variant % 2 == 0 else rng.uniform(46, 200)
                else:
                    age_days = rng.uniform(20, 320)

                created = now - timedelta(days=age_days)
                saves = int(rng.uniform(*niche["saves"]) * (1.0 if variant == 0 else rng.uniform(0.3, 0.9)))
                has_price = rng.random() < 0.55
                price = round(rng.uniform(*niche["price"]), 2) if has_price else None
                style = STYLE_MODIFIERS[(counter + variant) % len(STYLE_MODIFIERS)]
                occasion = OCCASION_MODIFIERS[(counter * 3 + variant) % len(OCCASION_MODIFIERS)]
                full_title = f"{style} {title} {occasion}"

                pins.append({
                    "pin_id": f"fixture-{counter:05d}",
                    "query_seed": niche["niche"],
                    "title": full_title,
                    "description": f"{full_title}. Handmade personalized gift idea, custom made to order.",
                    "alt_text": full_title,
                    "pin_url": f"https://fixture.invalid/pin/{counter:05d}/",
                    # Ten mien gia co y: de verify_pinterest_source.py phan biet duoc that/gia.
                    "image_url": f"https://fixture.invalid/736x/{counter:05d}.jpg",
                    "outbound_link": f"https://{niche['domain']}/listing/{counter}",
                    "domain": niche["domain"],
                    "board_name": rng.choice(niche["boards"]),
                    "creator": f"seller_{rng.randint(1, 24):02d}",
                    "saves": saves,
                    "comments": int(saves * rng.uniform(0.005, 0.03)),
                    "reactions": int(saves * rng.uniform(0.02, 0.08)),
                    "is_product_pin": 1 if has_price else 0,
                    "price_value": price,
                    "price_currency": "USD" if price else None,
                    "dominant_color": rng.choice(["#d9c7b8", "#2f4f4f", "#f2e8e5", "#8b5e3c"]),
                    "created_at": created.isoformat(timespec="seconds"),
                    "collected_at": now.isoformat(timespec="seconds"),
                    "data_quality": "fixture",
                    "raw_json": json.dumps({"fixture": True, "niche": niche["niche"]}),
                })

    return {
        "source": "pinterest",
        "engine": "fixture",
        "data_mode": "SYNTHETIC_FIXTURE",
        "warning": "Du lieu MO PHONG de kiem thu pipeline. KHONG phai du lieu Pinterest that.",
        "queries": [n["niche"] for n in NICHES],
        "status": "success",
        "collected_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "pin_count": len(pins),
        "pins": pins,
    }


if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    corpus = build_corpus()
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(corpus, f, indent=2, ensure_ascii=False)
    print(f"Da ghi {corpus['pin_count']} pin mo phong vao {OUT_PATH}")
    print("Luu y: corpus nay chi de kiem thu, khong dung de ra quyet dinh kinh doanh.")
