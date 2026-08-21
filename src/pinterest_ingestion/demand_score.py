from __future__ import annotations

import math
from collections.abc import Mapping

from .models import DemandScoreResult


COMPONENT_WEIGHTS: Mapping[str, float] = {
    "current_interest": 0.35,
    "yoy_growth": 0.25,
    "mom_growth": 0.20,
    "seasonality_fit": 0.20,
}

# Linear growth normalization. Values at or below -100% score 0; values at
# or above +200% score 100. Pinterest's 10001 sentinel (>10,000%) is thus
# safely treated as saturated instead of as a precise observation.
GROWTH_FLOOR_PERCENT = -100.0
GROWTH_CEILING_PERCENT = 200.0


def normalize_growth(growth_percent: float) -> float:
    value = _finite_number("growth_percent", growth_percent)
    clamped = min(max(value, GROWTH_FLOOR_PERCENT), GROWTH_CEILING_PERCENT)
    span = GROWTH_CEILING_PERCENT - GROWTH_FLOOR_PERCENT
    return round((clamped - GROWTH_FLOOR_PERCENT) / span * 100.0, 6)


def calculate_demand_score(
    *,
    current_interest: float | None,
    pct_growth_yoy: float | None,
    pct_growth_mom: float | None,
    seasonality_fit: float | None,
) -> DemandScoreResult | None:
    """Calculate an explainable 0-100 score with missing-weight redistribution.

    SPEC-001 explicitly requires no score when *all* growth evidence is absent.
    Numeric zero remains valid evidence and is never treated as missing.
    ``seasonality_fit`` is supplied by the caller because SPEC-001 does not yet
    define the launch window from which it should be derived.
    """

    if pct_growth_yoy is None and pct_growth_mom is None:
        return None

    source_raw: dict[str, float | None] = {
        "current_interest": _optional_index("current_interest", current_interest),
        "yoy_growth": _optional_number("pct_growth_yoy", pct_growth_yoy),
        "mom_growth": _optional_number("pct_growth_mom", pct_growth_mom),
        "seasonality_fit": _optional_index("seasonality_fit", seasonality_fit),
    }
    normalized: dict[str, float | None] = {
        "current_interest": source_raw["current_interest"],
        "yoy_growth": (
            normalize_growth(source_raw["yoy_growth"])
            if source_raw["yoy_growth"] is not None
            else None
        ),
        "mom_growth": (
            normalize_growth(source_raw["mom_growth"])
            if source_raw["mom_growth"] is not None
            else None
        ),
        "seasonality_fit": source_raw["seasonality_fit"],
    }

    available = [name for name, value in normalized.items() if value is not None]
    missing = [name for name, value in normalized.items() if value is None]
    available_weight = sum(COMPONENT_WEIGHTS[name] for name in available)
    if available_weight <= 0:
        return None

    unrounded_weighted: dict[str, float] = {}
    breakdown: dict[str, dict[str, float | None]] = {}
    for name in COMPONENT_WEIGHTS:
        if normalized[name] is None:
            breakdown[name] = {
                "source_raw": source_raw[name],
                "raw": None,
                "effective_weight": 0.0,
                "weighted": 0.0,
            }
            continue
        effective_weight = COMPONENT_WEIGHTS[name] / available_weight
        weighted = float(normalized[name]) * effective_weight
        unrounded_weighted[name] = weighted
        breakdown[name] = {
            "source_raw": source_raw[name],
            "raw": round(float(normalized[name]), 4),
            "effective_weight": round(effective_weight, 6),
            "weighted": round(weighted, 2),
        }

    score = round(sum(unrounded_weighted.values()), 2)
    # Make the displayed breakdown add up to the displayed score exactly.
    displayed_sum = round(sum(float(breakdown[name]["weighted"] or 0.0) for name in available), 2)
    residual = round(score - displayed_sum, 2)
    if residual:
        last_name = available[-1]
        breakdown[last_name]["weighted"] = round(
            float(breakdown[last_name]["weighted"] or 0.0) + residual, 2
        )

    return DemandScoreResult(
        score=min(100.0, max(0.0, score)),
        breakdown=breakdown,
        missing_components=missing,
        confidence=round(available_weight, 2),
    )


def _finite_number(name: str, value: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be numeric") from exc
    if not math.isfinite(number):
        raise ValueError(f"{name} must be finite")
    return number


def _optional_number(name: str, value: float | None) -> float | None:
    return None if value is None else _finite_number(name, value)


def _optional_index(name: str, value: float | None) -> float | None:
    if value is None:
        return None
    number = _finite_number(name, value)
    if not 0.0 <= number <= 100.0:
        raise ValueError(f"{name} must be between 0 and 100")
    return number
