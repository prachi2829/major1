"""Unit tests for the Real Statistical Engine, Algorithmic Budget Optimizer, and Live Market Search."""

import pytest
from app.statistics import standard_normal_cdf, two_proportion_z_test, evaluate_ab_significance
from app.budget_optimizer import calculate_algorithmic_budget
from app.market_search import search_live_market


def test_normal_cdf_and_z_test():
    # z = 0 -> CDF is 0.5
    assert abs(standard_normal_cdf(0.0) - 0.5) < 1e-6
    # z = 1.96 -> two-tailed p-value is approx 0.05
    z, p = two_proportion_z_test(50, 1000, 75, 1000)
    assert z > 0
    assert p < 0.05


def test_ab_significance_inconclusive_low_sample():
    var_a = {"id": "var_a", "name": "A", "impressions": 50, "clicks": 2, "conversions": 0}
    var_b = {"id": "var_b", "name": "B", "impressions": 50, "clicks": 8, "conversions": 1}
    eval_res = evaluate_ab_significance(var_a, var_b, min_sample_size=100)
    assert eval_res["status"] == "inconclusive"
    assert eval_res["winner_variant_id"] is None
    assert "Insufficient sample size" in eval_res["statistical_explanation"]


def test_ab_significance_inconclusive_high_p_value():
    # 5 vs 6 clicks in 1000 impressions is random noise
    var_a = {"id": "var_a", "name": "A", "impressions": 1000, "clicks": 50, "conversions": 5}
    var_b = {"id": "var_b", "name": "B", "impressions": 1000, "clicks": 52, "conversions": 5}
    eval_res = evaluate_ab_significance(var_a, var_b, min_sample_size=100, alpha=0.05)
    assert eval_res["status"] == "inconclusive"
    assert eval_res["winner_variant_id"] is None
    assert eval_res["p_value"] > 0.05
    assert "within random variation" in eval_res["statistical_explanation"]


def test_ab_significance_statistically_significant():
    # 540 vs 860 clicks in 10000 impressions is overwhelmingly significant
    var_a = {"id": "var_a", "name": "A", "impressions": 10000, "clicks": 540, "conversions": 50}
    var_b = {"id": "var_b", "name": "B", "impressions": 10000, "clicks": 860, "conversions": 94}
    eval_res = evaluate_ab_significance(var_a, var_b, min_sample_size=100, alpha=0.05)
    assert eval_res["status"] == "statistically_significant"
    assert eval_res["winner_variant_id"] == "var_b"
    assert eval_res["p_value"] < 0.001
    assert eval_res["is_significant"] is True
    assert "Statistically Significant Winner" in eval_res["statistical_explanation"]


def test_algorithmic_budget_optimizer():
    platforms = ["instagram", "linkedin"]
    metrics = {
        "instagram": {"impressions": 10000, "clicks": 800, "conversions": 80},  # CVR = 10%
        "linkedin": {"impressions": 10000, "clicks": 200, "conversions": 5},    # CVR = 2.5%
    }
    budget = calculate_algorithmic_budget(platforms, metrics, total_budget=100000.0, floor_pct=0.15)
    assert budget["total_budget"] == 100000.0
    assert budget["calculation_method"] == "algorithmic_historical_efficiency"
    assert "No money moves" in budget["disclaimer"] or "no money moves" in budget["disclaimer"]

    allocs = {a["platform"]: a for a in budget["allocations"]}
    # Instagram performed significantly better, so it must receive higher allocation
    assert allocs["instagram"]["recommended_allocation"] > allocs["linkedin"]["recommended_allocation"]
    # LinkedIn must preserve at least 15% safety floor (₹15,000)
    assert allocs["linkedin"]["recommended_allocation"] >= 15000.0


def test_market_search_fallback():
    res = search_live_market("nonexistent_rare_query_xyz_12345", timeout=1.0)
    assert "data_source" in res
    assert res["data_source"] in ["live_web_search", "ai_hypothesis"]
    assert "disclaimer" in res
