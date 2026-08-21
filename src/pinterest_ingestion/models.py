from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


TrendType = Literal["growing", "monthly", "yearly", "seasonal"]
MappingMethod = Literal["seed", "llm", "unmapped"]


@dataclass(frozen=True)
class TrendRecord:
    keyword: str
    pct_growth_wow: float | None
    pct_growth_mom: float | None
    pct_growth_yoy: float | None
    time_series: dict[str, int]
    region: str
    trend_type: str
    retrieved_at: str


@dataclass(frozen=True)
class MappingResult:
    canonical_product_type: str
    category: str | None
    material: str | None
    confidence: float
    method: MappingMethod


@dataclass(frozen=True)
class DemandScoreResult:
    score: float
    breakdown: dict[str, dict[str, float | None]]
    missing_components: list[str]
    confidence: float
