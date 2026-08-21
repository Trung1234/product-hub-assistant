"""Compatibility export for SPEC-001's requested module name."""

from src.pinterest_ingestion.keyword_mapper import KeywordMapper, map_keyword
from src.pinterest_ingestion.models import MappingResult

__all__ = ["KeywordMapper", "MappingResult", "map_keyword"]
