from __future__ import annotations

import json
import logging
from collections.abc import Callable, Iterable, Mapping
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from .models import MappingResult


LOGGER = logging.getLogger(__name__)
REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SEED_PATH = REPOSITORY_ROOT / "config" / "seed_keywords.yaml"
HIGH_CONFIDENCE_THRESHOLD = 0.80

PRODUCT_TYPE_METADATA: dict[str, dict[str, str | None]] = {
    "ORNAMENT": {"category": "Home Decor", "material": None},
    "DRINKWARE": {"category": "Drinkware", "material": None},
    "HOME_DECOR": {"category": "Home Decor", "material": None},
    "ACCESSORIES": {"category": "Accessories", "material": None},
    "APPAREL": {"category": "Apparel", "material": None},
}

MATERIAL_TERMS = {
    "acrylic": "Acrylic",
    "ceramic": "Ceramic",
    "canvas": "Canvas",
    "leather": "Leather",
    "metal": "Metal",
    "steel": "Stainless Steel",
    "wood": "Wood",
}


class SeedConfigurationError(ValueError):
    pass


class KeywordMapper:
    """Map known seeds deterministically and delegate discovery only if configured.

    The optional ``llm_mapper`` receives a keyword and must return either a
    MappingResult or a dictionary with the MappingResult fields. Low-confidence
    responses are deliberately converted to UNMAPPED.
    """

    def __init__(
        self,
        seed_path: str | Path = DEFAULT_SEED_PATH,
        *,
        llm_mapper: Callable[[str], MappingResult | Mapping[str, Any]] | None = None,
        confidence_threshold: float = HIGH_CONFIDENCE_THRESHOLD,
    ) -> None:
        if not 0.0 <= confidence_threshold <= 1.0:
            raise ValueError("confidence_threshold must be between 0 and 1")
        self.seed_path = Path(seed_path)
        self.seeds_by_product_type = load_seed_keywords(self.seed_path)
        self._seed_index = _build_seed_index(self.seeds_by_product_type)
        self._llm_mapper = llm_mapper
        self._confidence_threshold = confidence_threshold

    def map_keyword(self, keyword: str) -> MappingResult:
        normalized_keyword = _normalize_keyword(keyword)
        if not normalized_keyword:
            return _unmapped()

        product_type = self._seed_index.get(normalized_keyword)
        if product_type:
            return self.mapping_for_seed(product_type, keyword)

        if self._llm_mapper is None:
            return _unmapped()

        try:
            candidate = _coerce_mapping_result(self._llm_mapper(keyword))
        except Exception as exc:
            LOGGER.warning("LLM_MAPPING_ERROR keyword=%r error=%s", keyword, exc)
            return _unmapped()
        if (
            candidate.canonical_product_type == "UNMAPPED"
            or candidate.confidence < self._confidence_threshold
        ):
            return _unmapped()
        return MappingResult(
            canonical_product_type=candidate.canonical_product_type,
            category=candidate.category,
            material=candidate.material,
            confidence=candidate.confidence,
            method="llm",
        )

    def mapping_for_seed(self, canonical_product_type: str, keyword: str = "") -> MappingResult:
        product_type = canonical_product_type.strip().upper()
        if product_type not in self.seeds_by_product_type:
            raise SeedConfigurationError(f"Unknown seed product type: {canonical_product_type}")
        metadata = PRODUCT_TYPE_METADATA.get(product_type, {})
        return MappingResult(
            canonical_product_type=product_type,
            category=metadata.get("category"),
            material=_infer_material(keyword) or metadata.get("material"),
            confidence=1.0,
            method="seed",
        )

    def warn_for_missing_seeds(self, taxonomy_product_types: Iterable[str]) -> list[str]:
        configured = set(self.seeds_by_product_type)
        missing = sorted(
            {
                product_type.strip().upper()
                for product_type in taxonomy_product_types
                if product_type.strip() and product_type.strip().upper() not in configured
            }
        )
        for product_type in missing:
            LOGGER.warning("MISSING_SEED: %s", product_type)
        return missing


@lru_cache(maxsize=1)
def _default_mapper() -> KeywordMapper:
    return KeywordMapper()


def map_keyword(keyword: str) -> MappingResult:
    """Convenience interface required by SPEC-001."""

    return _default_mapper().map_keyword(keyword)


def load_seed_keywords(path: str | Path = DEFAULT_SEED_PATH) -> dict[str, list[str]]:
    seed_path = Path(path)
    if not seed_path.exists():
        raise SeedConfigurationError(f"Seed keyword file does not exist: {seed_path}")
    try:
        raw = yaml.safe_load(seed_path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise SeedConfigurationError(f"Invalid YAML in {seed_path}: {exc}") from exc
    if not isinstance(raw, Mapping) or not raw:
        raise SeedConfigurationError("Seed keyword YAML must be a non-empty object")

    parsed: dict[str, list[str]] = {}
    for product_type, keywords in raw.items():
        canonical = str(product_type).strip().upper()
        if not canonical or not isinstance(keywords, list) or not keywords:
            raise SeedConfigurationError(
                f"{product_type!r} must contain a non-empty list of seed keywords"
            )
        clean_keywords = [str(keyword).strip() for keyword in keywords if str(keyword).strip()]
        if not clean_keywords:
            raise SeedConfigurationError(f"{canonical} has no valid seed keywords")
        parsed[canonical] = clean_keywords
    _build_seed_index(parsed)  # Also validates cross-type duplicates.
    return parsed


def canonical_types_from_catalog(path: str | Path) -> set[str]:
    """Project the current granular Printway catalog into SPEC-001 family codes."""

    catalog_path = Path(path)
    try:
        rows = json.loads(catalog_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SeedConfigurationError(f"Cannot read taxonomy catalog {catalog_path}: {exc}") from exc
    if not isinstance(rows, list):
        raise SeedConfigurationError("Taxonomy catalog must be a JSON array")
    return {_catalog_family(row) for row in rows if isinstance(row, Mapping)}


def _catalog_family(row: Mapping[str, Any]) -> str:
    text = " ".join(
        str(row.get(field, "")) for field in ("product_type", "category", "description")
    ).lower()
    if "ornament" in text:
        return "ORNAMENT"
    if any(term in text for term in ("drinkware", "tumbler", "mug")):
        return "DRINKWARE"
    if any(term in text for term in ("apparel", "shirt", "hoodie")):
        return "APPAREL"
    if any(term in text for term in ("accessories", "keychain", "necklace", "journal")):
        return "ACCESSORIES"
    return "HOME_DECOR"


def _build_seed_index(seeds: Mapping[str, list[str]]) -> dict[str, str]:
    index: dict[str, str] = {}
    for product_type, keywords in seeds.items():
        for keyword in keywords:
            normalized = _normalize_keyword(keyword)
            existing = index.get(normalized)
            if existing and existing != product_type:
                raise SeedConfigurationError(
                    f"Seed keyword {keyword!r} is assigned to both {existing} and {product_type}"
                )
            index[normalized] = product_type
    return index


def _coerce_mapping_result(value: MappingResult | Mapping[str, Any]) -> MappingResult:
    if isinstance(value, MappingResult):
        result = value
    elif isinstance(value, Mapping):
        result = MappingResult(
            canonical_product_type=str(value.get("canonical_product_type", "UNMAPPED")),
            category=value.get("category"),
            material=value.get("material"),
            confidence=float(value.get("confidence", 0.0)),
            method="llm",
        )
    else:
        raise TypeError("llm_mapper must return MappingResult or a mapping")
    if not 0.0 <= result.confidence <= 1.0:
        raise ValueError("LLM mapping confidence must be between 0 and 1")
    return result


def _infer_material(keyword: str) -> str | None:
    normalized = _normalize_keyword(keyword)
    for term, material in MATERIAL_TERMS.items():
        if term in normalized:
            return material
    return None


def _normalize_keyword(keyword: str) -> str:
    return " ".join(str(keyword).casefold().split())


def _unmapped() -> MappingResult:
    return MappingResult(
        canonical_product_type="UNMAPPED",
        category=None,
        material=None,
        confidence=0.0,
        method="unmapped",
    )
