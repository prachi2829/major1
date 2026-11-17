"""Algorithmic Budget Optimizer.

Strictly follows data-driven rules:
- Derived directly from measured channel analytics (impressions, clicks, conversions).
- Proportional allocation with minimum safety floor (no channel starvation).
- NO made-up or synthetic ROI multipliers.
- 'Approve' explicitly records the plan to the database only; no money moves without ad network authorization.
"""

from __future__ import annotations

from typing import Any, Dict, List


def calculate_algorithmic_budget(
    platforms: List[str],
    metrics_by_platform: Dict[str, Dict[str, Any]],
    total_budget: float = 100000.0,
    floor_pct: float = 0.15,
) -> Dict[str, Any]:
    """
    Computes algorithmic capital allocation across active platforms:
    - Efficiency score E_p = CVR_p * CTR_p
    - Allocates safety floor (e.g. 15% per channel)
    - Allocates remainder in direct proportion to measured conversion efficiency.
    """
    if not platforms:
        platforms = ["instagram", "linkedin"]

    k = len(platforms)
    if k == 0:
        return {
            "total_budget": total_budget,
            "currency": "₹",
            "allocations": [],
            "executive_summary": "No active platforms configured.",
            "calculation_method": "algorithmic_historical_efficiency",
            "disclaimer": "'Approve' records the plan only, and no money moves.",
            "approved": False,
        }

    plat_stats: Dict[str, Dict[str, Any]] = {}
    has_any_data = False
    for p in platforms:
        m = metrics_by_platform.get(p.lower(), {})
        imp = max(int(m.get("impressions", 0)), 0)
        clk = max(int(m.get("clicks", 0)), 0)
        conv = max(int(m.get("conversions", 0)), 0)

        ctr = (clk / imp) if imp > 0 else 0.0
        cvr = (conv / clk) if clk > 0 else 0.0
        efficiency = (ctr * cvr * 1000.0) if (imp > 0 and clk > 0) else 0.0
        if imp > 0:
            has_any_data = True

        plat_stats[p] = {
            "impressions": imp,
            "clicks": clk,
            "conversions": conv,
            "ctr_pct": round(ctr * 100.0, 2),
            "cvr_pct": round(cvr * 100.0, 2),
            "efficiency": efficiency,
        }

    equal_alloc = round(total_budget / k, 2)
    allocations = []

    if not has_any_data:
        for p in platforms:
            allocations.append({
                "platform": p,
                "current_allocation": equal_alloc,
                "recommended_allocation": equal_alloc,
                "conversion_rate": 0.0,
                "ctr": 0.0,
                "efficiency_score": 1.0,
                "expected_roi_multiplier": 1.0,
                "rationale": (
                    f"Baseline allocation of ₹{equal_alloc:,.0f} ({(100.0 / k):.1f}%). "
                    f"No historical campaign data yet; allocated equally for initial channel discovery."
                ),
            })
        summary = (
            "Baseline exploratory budget applied equally across channels. "
            "Numbers will dynamically shift as live ad impressions and conversions are recorded."
        )
    else:
        total_efficiency = sum(s["efficiency"] for s in plat_stats.values())
        if total_efficiency <= 0:
            total_efficiency = float(k)
            for s in plat_stats.values():
                s["efficiency"] = 1.0

        floor_amount = total_budget * floor_pct
        variable_budget = max(0.0, total_budget - (floor_amount * k))

        for p in platforms:
            st = plat_stats[p]
            share = st["efficiency"] / total_efficiency
            recommended = round(floor_amount + (variable_budget * share), 2)
            current = equal_alloc
            diff = recommended - current

            cvr_val = st["cvr_pct"]
            ctr_val = st["ctr_pct"]
            eff_score = round(st["efficiency"], 2)

            if diff > 0:
                rationale = (
                    f"Measured {cvr_val}% conversion rate with {ctr_val}% CTR. "
                    f"Algorithm shifted +₹{abs(diff):,.0f} (+{(diff / total_budget * 100.0):.1f}% share) "
                    f"to maximize conversions."
                )
            elif diff < 0:
                rationale = (
                    f"Lower relative conversion rate ({cvr_val}% vs top-performing channels). "
                    f"Algorithm shifted -₹{abs(diff):,.0f} toward higher-yielding platforms while keeping a {floor_pct * 100:.0f}% safety floor."
                )
            else:
                rationale = f"Maintained allocation at ₹{recommended:,.0f} based on steady conversion performance."

            # Calculate relative performance multiplier directly from data (not fictional)
            relative_multiplier = round(max(0.5, (st["efficiency"] / (total_efficiency / k))), 2)

            allocations.append({
                "platform": p,
                "current_allocation": current,
                "recommended_allocation": recommended,
                "conversion_rate": cvr_val,
                "ctr": ctr_val,
                "efficiency_score": eff_score,
                "expected_roi_multiplier": relative_multiplier,
                "rationale": rationale,
            })

        top_channel = max(allocations, key=lambda a: a["recommended_allocation"])
        top_share = (top_channel["recommended_allocation"] / total_budget) * 100.0
        summary = (
            f"Algorithmic reallocation completed: {top_channel['platform'].title()} receives "
            f"{top_share:.0f}% of budget based on measured {top_channel['conversion_rate']}% conversion rate. "
            f"Safety floor of {floor_pct * 100:.0f}% preserved on all channels."
        )

    return {
        "campaign_id": "",
        "total_budget": total_budget,
        "currency": "₹",
        "allocations": allocations,
        "executive_summary": summary,
        "calculation_method": "algorithmic_historical_efficiency",
        "disclaimer": "'Approve' records the plan only, and no money moves.",
        "approved": False,
    }
