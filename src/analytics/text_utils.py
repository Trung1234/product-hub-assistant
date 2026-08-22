"""
Lam sach text va trich xuat tu khoa tu pin Pinterest.

Tach rieng khoi module chi so de test duoc doc lap: cung mot input phai ra cung mot output.
"""

import re
import unicodedata
from typing import Any, Dict, List, Tuple

# Stopword tieng Anh + nhieu dac trung cua Pinterest (tu chung chung khong mang y nghia R&D).
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "best", "but", "by", "can", "cute", "do", "diy",
    "easy", "for", "from", "get", "great", "has", "have", "how", "idea", "ideas", "if", "in",
    "inspiration", "inspo", "into", "is", "it", "its", "just", "like", "love", "make", "making",
    "more", "most", "my", "new", "of", "on", "or", "our", "out", "perfect", "pin", "pinterest",
    "shop", "so", "that", "the", "their", "them", "these", "they", "this", "to", "top", "up",
    "us", "use", "very", "want", "was", "we", "what", "when", "where", "which", "will", "with",
    "you", "your", "amazing", "beautiful", "check", "click", "free", "here", "link", "now",
    "only", "sale", "see", "shipping", "today", "www", "com", "etsy", "http", "https",
}

# Tu vung POD: cac gram cham vao day duoc uu tien vi mang y nghia san xuat / thi truong.
POD_LEXICON = {
    "product": {
        "ornament", "tumbler", "mug", "sweatshirt", "hoodie", "shirt", "tshirt", "plaque",
        "sign", "keychain", "necklace", "blanket", "pillow", "poster", "print", "sticker",
        "candle", "coaster", "doormat", "nightlight", "lamp", "bracelet", "earrings", "tote",
        "apron", "jewelry", "frame", "cutting", "board", "wallet", "bookmark", "magnet",
    },
    "material": {
        "acrylic", "wood", "wooden", "ceramic", "steel", "stainless", "glass", "leather",
        "metal", "canvas", "cotton", "linen", "resin", "bamboo", "slate", "marble",
    },
    "occasion": {
        "christmas", "xmas", "halloween", "thanksgiving", "birthday", "wedding", "anniversary",
        "valentine", "valentines", "graduation", "baby", "shower", "mothers", "fathers",
        "easter", "holiday", "memorial", "retirement", "housewarming", "newborn",
    },
    "personalization": {
        "personalized", "custom", "customized", "monogram", "monogrammed", "engraved",
        "engraving", "name", "names", "initial", "photo", "handwritten", "birthstone",
    },
    "style": {
        "minimalist", "vintage", "retro", "boho", "aesthetic", "rustic", "modern", "floral",
        "botanical", "watercolor", "farmhouse", "cottagecore", "coastal", "scandinavian",
    },
}
ALL_LEXICON = set().union(*POD_LEXICON.values())

_EMOJI_RE = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF←-⇿⬀-⯿]",
    flags=re.UNICODE,
)
_URL_RE = re.compile(r"https?://\S+|www\.\S+")
_HASHTAG_RE = re.compile(r"#(\w+)")
_NON_TEXT_RE = re.compile(r"[^a-z0-9\s\-']")
_MULTISPACE_RE = re.compile(r"\s+")


def clean_text(*parts: str) -> str:
    """
    Chuan hoa noi dung pin: bo URL, emoji, dau cau; giu lai chu trong hashtag
    (`#personalizedgift` van la tin hieu R&D); ha ve chu thuong, gop khoang trang.
    """
    raw = " ".join(p for p in parts if p)
    raw = unicodedata.normalize("NFKD", raw)
    raw = _URL_RE.sub(" ", raw)
    raw = _EMOJI_RE.sub(" ", raw)
    raw = _HASHTAG_RE.sub(r"\1", raw)
    raw = raw.lower()
    raw = _NON_TEXT_RE.sub(" ", raw)
    return _MULTISPACE_RE.sub(" ", raw).strip()


def is_latin_text(text: str, min_ratio: float = 0.6) -> bool:
    """Loai pin khong phai chu Latin - corpus R&D huong thi truong US/EU."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    latin = sum(1 for c in letters if "a" <= c.lower() <= "z")
    return latin / len(letters) >= min_ratio


def title_fingerprint(text: str) -> str:
    """
    Van tay de bat pin trung noi dung nhung khac pin_id (seller spam lai cung mot listing).
    Dung tap token da sap xep nen doi thu tu tu van ra cung van tay.
    """
    tokens = sorted(set(t for t in clean_text(text).split() if t not in STOPWORDS and len(t) > 2))
    return "|".join(tokens[:12])


def tokenize(text: str) -> List[str]:
    return [t for t in clean_text(text).split() if len(t) > 1]


def extract_ngrams(text: str, max_n: int = 3) -> List[Tuple[str, int]]:
    """
    Sinh 1-gram den 3-gram co y nghia.

    Luat loc: gram phai co it nhat mot tu khong phai stopword, khong duoc bat dau
    hoac ket thuc bang stopword (tranh "for ornament", "ornament and"), va khong
    duoc toan chu so.
    """
    tokens = tokenize(text)
    out: List[Tuple[str, int]] = []
    for n in range(1, max_n + 1):
        for i in range(len(tokens) - n + 1):
            gram = tokens[i:i + n]
            if gram[0] in STOPWORDS or gram[-1] in STOPWORDS:
                continue
            if all(t in STOPWORDS for t in gram):
                continue
            if all(t.isdigit() for t in gram):
                continue
            if n == 1 and (len(gram[0]) < 4 or gram[0].isdigit()):
                continue
            out.append((" ".join(gram), n))
    return out


def lexicon_hits(term: str) -> Dict[str, List[str]]:
    """Cho biet gram cham vao nhung nhom tu vung POD nao - dung de giai thich ket qua."""
    tokens = set(term.split())
    return {
        group: sorted(tokens & words)
        for group, words in POD_LEXICON.items()
        if tokens & words
    }


def lexicon_weight(term: str) -> float:
    """
    He so uu tien cho gram co y nghia thuong mai.
    Gram vua co ten san pham vua co tin hieu ca nhan hoa la gram dang tien nhat.
    """
    hits = lexicon_hits(term)
    weight = 1.0
    if "product" in hits:
        weight += 0.35
    if "personalization" in hits:
        weight += 0.25
    if "occasion" in hits:
        weight += 0.20
    if "material" in hits:
        weight += 0.15
    if "style" in hits:
        weight += 0.10
    return weight


def looks_like_spam(pin: Dict[str, Any]) -> bool:
    """Bo pin rac: khong co chu, chi toan hashtag, hoac tieu de qua ngan."""
    text = " ".join(filter(None, [pin.get("title"), pin.get("description"), pin.get("alt_text")]))
    if not text or len(text.strip()) < 8:
        return True
    cleaned = clean_text(text)
    if len(cleaned) < 8:
        return True
    tokens = cleaned.split()
    if len(tokens) < 2:
        return True
    if all(t in STOPWORDS for t in tokens):
        return True
    return False
