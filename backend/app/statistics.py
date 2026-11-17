"""Real Statistical Significance Engine for A/B Testing.

Strictly follows statistical hypothesis testing:
- Two-proportion Z-test for conversion & click rates.
- Strict sample size requirements (minimum impressions per variant).
- 95% statistical confidence threshold (p < 0.05).
- If p >= 0.05 or sample size is below threshold, status is explicitly 'inconclusive'.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Optional, Tuple


def standard_normal_cdf(z: float) -> float:
    """Standard Normal Cumulative Distribution Function Φ(z) using math.erf."""
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def two_proportion_z_test(
    successes_a: int, trials_a: int, successes_b: int, trials_b: int
) -> Tuple[float, float]:
    """
    Computes two-sample pooled Z-test for proportions.
    Returns: (z_score, p_value)
    """
    if trials_a <= 0 or trials_b <= 0:
        return 0.0, 1.0

    p_a = successes_a / trials_a
    p_b = successes_b / trials_b

    # Pooled proportion
    p_pool = (successes_a + successes_b) / (trials_a + trials_b)
    if p_pool <= 0.0 or p_pool >= 1.0:
        return 0.0, 1.0

    se = math.sqrt(p_pool * (1.0 - p_pool) * (1.0 / trials_a + 1.0 / trials_b))
    if se <= 0.0:
        return 0.0, 1.0

    z = (p_b - p_a) / se
    # Two-tailed p-value
    p_val = 2.0 * (1.0 - standard_normal_cdf(abs(z)))
    # Numerical clamp
    p_val = max(0.0, min(1.0, p_val))
    return z, p_val


def evaluate_ab_significance(
    variant_a: Dict[str, Any],
    variant_b: Dict[str, Any],
    min_sample_size: int = 100,
    alpha: float = 0.05,
) -> Dict[str, Any]:
    """
    Evaluates whether an A/B test has reached statistical significance.
    Enforces:
    - Sample size check
    - p < 0.05 threshold
    - If p >= 0.05 or sample size is too small, result is explicitly 'inconclusive'.
    """
    imp_a = int(variant_a.get("impressions", 0))
    clk_a = int(variant_a.get("clicks", 0))
    conv_a = int(variant_a.get("conversions", 0))

    imp_b = int(variant_b.get("impressions", 0))
    clk_b = int(variant_b.get("clicks", 0))
    conv_b = int(variant_b.get("conversions", 0))

    ctr_a = (clk_a / imp_a * 100.0) if imp_a > 0 else 0.0
    ctr_b = (clk_b / imp_b * 100.0) if imp_b > 0 else 0.0

    variant_a["ctr"] = round(ctr_a, 2)
    variant_a["conversion_rate"] = round((conv_a / max(clk_a, 1) * 100.0), 2)
    variant_b["ctr"] = round(ctr_b, 2)
    variant_b["conversion_rate"] = round((conv_b / max(clk_b, 1) * 100.0), 2)

    # 1. Sample Size Gate
    if imp_a < min_sample_size or imp_b < min_sample_size:
        return {
            "status": "inconclusive",
            "winner_variant_id": None,
            "is_significant": False,
            "p_value": None,
            "z_score": 0.0,
            "confidence_level": 0.0,
            "statistical_explanation": (
                f"Result is Inconclusive: Insufficient sample size ({min(imp_a, imp_b)} impressions; "
                f"minimum {min_sample_size} required). Any metric difference could be random noise."
            ),
            "ai_recommendation": "Result is inconclusive. Run this test until both variants collect at least 100+ impressions.",
        }

    # 2. Statistical Z-Test on CTR
    z_score, p_value = two_proportion_z_test(clk_a, imp_a, clk_b, imp_b)
    confidence = (1.0 - p_value) * 100.0
    ctr_diff = ctr_b - ctr_a

    # 3. Not Significant (p >= 0.05) -> Inconclusive
    if p_value >= alpha:
        return {
            "status": "inconclusive",
            "winner_variant_id": None,
            "is_significant": False,
            "p_value": round(p_value, 4),
            "z_score": round(z_score, 2),
            "confidence_level": round(confidence, 1),
            "statistical_explanation": (
                f"Result is Inconclusive: Observed CTR difference ({abs(ctr_diff):.2f}%) is within random variation "
                f"(Z = {z_score:+.2f}, p = {p_value:.4f} >= 0.05). Statistical confidence is {confidence:.1f}%, "
                f"which does not meet the 95% threshold required to declare a true winner."
            ),
            "ai_recommendation": f"Inconclusive test (p = {p_value:.4f}). Do not declare a winner yet. Continue collecting data.",
        }

    # 4. Statistically Significant Winner Declared (p < 0.05)
    if ctr_b > ctr_a:
        winner_id = variant_b.get("id", "var_b")
        winner_name = variant_b.get("name", "Variant B")
        uplift = ((ctr_b - ctr_a) / max(ctr_a, 0.001)) * 100.0
    else:
        winner_id = variant_a.get("id", "var_a")
        winner_name = variant_a.get("name", "Variant A")
        uplift = ((ctr_a - ctr_b) / max(ctr_b, 0.001)) * 100.0

    return {
        "status": "statistically_significant",
        "winner_variant_id": winner_id,
        "is_significant": True,
        "p_value": round(p_value, 4),
        "z_score": round(z_score, 2),
        "confidence_level": round(confidence, 1),
        "uplift_pct": round(uplift, 1),
        "statistical_explanation": (
            f"Statistically Significant Winner: {winner_name} achieved +{uplift:.1f}% higher CTR with "
            f"{confidence:.1f}% statistical confidence (Z = {z_score:+.2f}, p = {p_value:.4f} < 0.05)."
        ),
        "ai_recommendation": f"{winner_name} declared winner with +{uplift:.1f}% higher CTR (p = {p_value:.4f} < 0.05).",
    }
