"""Compatibility export for SPEC-001's requested module name."""

from src.pinterest_ingestion.models import TrendRecord
from src.pinterest_ingestion.pinterest_client import PinterestClient, fetch_trends

__all__ = ["PinterestClient", "TrendRecord", "fetch_trends"]
