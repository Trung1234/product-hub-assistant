"""Compatibility export for SPEC-001's requested module name."""

from src.pinterest_ingestion.demand_score import calculate_demand_score, normalize_growth

__all__ = ["calculate_demand_score", "normalize_growth"]
