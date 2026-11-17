"""Phase 2 analytics.

The numbers are SIMULATED. Real Instagram/LinkedIn/X/Facebook analytics need developer accounts,
OAuth and platform approval, which are out of scope for this MVP. The simulator is deterministic
(seeded by campaign id + platform), so the same campaign always produces the same demo numbers,
and every API response and screen is labeled `simulated`.
"""
from __future__ import annotations

import math
import random
from datetime import date, timedelta
from typing import Dict, List, Optional

from .schemas import AnalyticsReport, DailyMetric, PlatformStats

DAYS = 14

# rough, plausible reach/engagement shape per platform (demo only)
PROFILE = {
    "instagram": dict(base=2600, ctr=(0.018, 0.032), eng=(0.05, 0.09), conv=(0.03, 0.06)),
    "facebook": dict(base=1800, ctr=(0.012, 0.022), eng=(0.03, 0.06), conv=(0.02, 0.05)),
    "linkedin": dict(base=1200, ctr=(0.02, 0.04), eng=(0.025, 0.05), conv=(0.05, 0.09)),
    "twitter": dict(base=1500, ctr=(0.008, 0.018), eng=(0.02, 0.045), conv=(0.015, 0.04)),
}


def simulate(campaign_id: str, platforms: List[str], end: Optional[date] = None) -> List[DailyMetric]:
    end = end or date.today()
    out: List[DailyMetric] = []
    for p in platforms:
        prof = PROFILE.get(p, PROFILE["facebook"])
        rng = random.Random(f"{campaign_id}:{p}")
        scale = rng.uniform(0.7, 1.4)
        ctr = rng.uniform(*prof["ctr"])
        eng = rng.uniform(*prof["eng"])
        conv = rng.uniform(*prof["conv"])
        for i in range(DAYS):
            day = end - timedelta(days=DAYS - 1 - i)
            # launch spike that decays, plus a gentle weekly rhythm and noise
            decay = 0.45 + 1.1 * math.exp(-i / 4.0)
            weekly = 1.0 + 0.12 * math.sin(i * 2 * math.pi / 7)
            imp = int(prof["base"] * scale * decay * weekly * rng.uniform(0.88, 1.12))
            clicks = int(imp * ctr * rng.uniform(0.85, 1.15))
            engagements = int(imp * eng * rng.uniform(0.85, 1.15))
            conversions = int(clicks * conv * rng.uniform(0.8, 1.2))
            out.append(DailyMetric(platform=p, day=day.isoformat(), impressions=imp, clicks=clicks,
                                   engagements=engagements, conversions=conversions))
    return out


def _stats(platform: str, rows: List[DailyMetric]) -> PlatformStats:
    imp = sum(r.impressions for r in rows)
    clk = sum(r.clicks for r in rows)
    eng = sum(r.engagements for r in rows)
    cnv = sum(r.conversions for r in rows)
    return PlatformStats(
        platform=platform, impressions=imp, clicks=clk, engagements=eng, conversions=cnv,
        ctr=round(clk / imp, 4) if imp else 0.0,
        engagement_rate=round(eng / imp, 4) if imp else 0.0,
        conversion_rate=round(cnv / clk, 4) if clk else 0.0,
    )


def build_report(campaign_id: str, rows: List[DailyMetric], simulated: bool = True) -> AnalyticsReport:
    if not rows:
        return AnalyticsReport(campaign_id=campaign_id, has_data=False, simulated=simulated)
    by_platform: Dict[str, List[DailyMetric]] = {}
    for r in rows:
        by_platform.setdefault(r.platform, []).append(r)
    stats = [_stats(p, rs) for p, rs in by_platform.items()]
    best = max(stats, key=lambda s: s.conversions).platform if stats else None
    return AnalyticsReport(
        campaign_id=campaign_id, has_data=True, simulated=simulated,
        totals=_stats("all", rows), platforms=stats, daily=rows, best_platform=best,
    )
