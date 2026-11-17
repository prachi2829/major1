"""Pydantic models for Campaign.AI (Core, Phase 2, and Phase 3 Autonomous Marketing Intelligence)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator

ALLOWED_PLATFORMS = {"instagram", "linkedin", "twitter", "facebook"}


# ── Core Campaign Schemas ───────────────────────────────────────────
class CampaignInput(BaseModel):
    name: str = Field(..., min_length=1)
    product: str = Field(..., min_length=1)
    objective: str = Field(..., min_length=1)
    audience: str = Field(..., min_length=1)
    tone: str = Field(..., min_length=1)
    platforms: List[str] = Field(..., min_length=1)
    description: str = ""

    @field_validator("platforms")
    @classmethod
    def validate_platforms(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("At least one platform is required")
        cleaned = [p.lower().strip() for p in v]
        for p in cleaned:
            if p not in ALLOWED_PLATFORMS:
                raise ValueError(f"Unsupported platform '{p}'. Allowed: {sorted(ALLOWED_PLATFORMS)}")
        return cleaned


class CampaignCreate(CampaignInput):
    pass


class Strategy(BaseModel):
    campaign_goal: str
    core_message: str
    content_pillars: List[str]
    messaging_approach: str
    call_to_action: str
    campaign_direction: str
    source: str = "gemini"


class PlatformContent(BaseModel):
    platform: str
    headline: Optional[str] = ""
    body: str = ""
    hashtags: List[str] = Field(default_factory=list)
    call_to_action: Optional[str] = ""
    status: Literal["draft", "approved", "published"] = "draft"
    edited: bool = False
    published_at: Optional[str] = None
    source: str = "gemini"

    @field_validator("headline", "call_to_action", mode="before")
    @classmethod
    def allow_none_str(cls, v: Any) -> str:
        return v if v is not None else ""

    @field_validator("hashtags", mode="before")
    @classmethod
    def format_hashtags(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            v = v.split()
        if not isinstance(v, list):
            return []
        cleaned = []
        for tag in v:
            tag_str = str(tag).strip()
            if not tag_str:
                continue
            if not tag_str.startswith("#"):
                tag_str = "#" + tag_str
            cleaned.append(tag_str)
        return cleaned


class Campaign(BaseModel):
    id: str
    created_at: str
    updated_at: str
    status: Literal["draft", "strategy_ready", "content_ready", "published"] = "draft"
    input: CampaignInput
    strategy: Optional[Strategy] = None
    content: Dict[str, PlatformContent] = Field(default_factory=dict)


# ── Analytics Schemas (Phase 2) ─────────────────────────────────────
class DailyMetric(BaseModel):
    platform: str
    day: str
    impressions: int
    clicks: int
    engagements: int
    conversions: int


class PlatformStats(BaseModel):
    platform: str
    impressions: int
    clicks: int
    engagements: int
    conversions: int
    ctr: float
    engagement_rate: float
    conversion_rate: float


class AnalyticsReport(BaseModel):
    campaign_id: str
    has_data: bool
    simulated: bool = True
    totals: Optional[PlatformStats] = None
    platforms: List[PlatformStats] = Field(default_factory=list)
    daily: List[DailyMetric] = Field(default_factory=list)
    best_platform: Optional[str] = None


# ── Scheduling Schemas (Phase 2b) ──────────────────────────────────
class ScheduleCreate(BaseModel):
    campaign_id: str
    platform: str
    scheduled_at: str
    content: Optional[Dict[str, Any]] = None


class SchedulePatch(BaseModel):
    scheduled_at: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class ScheduleRead(BaseModel):
    id: str
    campaign_id: str
    platform: str
    scheduled_at: str
    content: Optional[Dict[str, Any]] = None
    status: str = "pending"  # pending / publishing / published / failed / cancelled
    published_at: Optional[str] = None
    error: Optional[str] = None
    created_at: str


# ── Publishing Schemas (Phase 2b) ──────────────────────────────────
class PublishRequest(BaseModel):
    platforms: Optional[List[str]] = None


class PublishResultSchema(BaseModel):
    platform: str
    success: bool
    post_id: Optional[str] = None
    url: Optional[str] = None
    error: Optional[str] = None


class PublishResponse(BaseModel):
    campaign_id: str
    results: List[PublishResultSchema]
    status: str = "published"
    content: Dict[str, PlatformContent] = Field(default_factory=dict)


# ── Social Accounts Schemas ─────────────────────────────────────────
class SocialAccountCreate(BaseModel):
    platform: str
    account_name: str
    credentials: Dict[str, Any] = Field(default_factory=dict)


class SocialAccountRead(BaseModel):
    id: str
    platform: str
    account_name: str
    connected: bool
    connected_at: Optional[str] = None


# ── AI Feedback & Optimization Schemas ─────────────────────────────
class RecommendationItem(BaseModel):
    area: str
    priority: str
    suggestion: str


class FeedbackResponse(BaseModel):
    campaign_id: str
    overall_rating: str
    score: int
    strengths: List[str]
    weaknesses: List[str]
    recommendations: List[RecommendationItem]
    improved_strategy: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None


# ── Phase 3: A/B Testing ───────────────────────────────────────────
class ABVariant(BaseModel):
    id: str
    name: str
    hypothesis: str
    content: Dict[str, Any]
    impressions: int = 0
    clicks: int = 0
    conversions: int = 0
    ctr: float = 0.0
    conversion_rate: float = 0.0


class ABTestCreate(BaseModel):
    campaign_id: str
    test_name: str
    metric_goal: str = "CTR"
    variants: List[Dict[str, Any]] = Field(default_factory=list)


class ABTestRead(BaseModel):
    id: str
    campaign_id: str
    test_name: str
    metric_goal: str
    variants: List[ABVariant]
    status: str = "running"
    winner_variant_id: Optional[str] = None
    is_significant: Optional[bool] = False
    p_value: Optional[float] = None
    z_score: Optional[float] = None
    confidence_level: Optional[float] = None
    statistical_explanation: Optional[str] = None
    ai_recommendation: Optional[str] = None
    created_at: str


# ── Phase 3: Audience Intelligence ─────────────────────────────────
class AudienceSegment(BaseModel):
    segment_name: str
    demographics: str
    pain_points: List[str]
    value_proposition: str
    recommended_angle: str
    suggested_platforms: List[str]


class AudienceIntelligenceResponse(BaseModel):
    campaign_id: str
    segments: List[AudienceSegment]
    summary: str
    data_source: Optional[str] = "gemini"


# ── Phase 3: Competitor Intelligence ───────────────────────────────
class CompetitorAngle(BaseModel):
    competitor_type: str
    named_competitors: Optional[List[str]] = Field(default_factory=list)
    weakness: str
    counter_hook: str


class CompetitorResponse(BaseModel):
    campaign_id: Optional[str] = None
    market_position: str
    competitor_angles: List[CompetitorAngle]
    white_space_opportunities: List[str]
    recommended_differentiation: str
    data_source: str = "ai_hypothesis"
    disclaimer: str = "Gemini has no live market data, so it will give clearly labeled 'AI hypotheses' about types of competitors, not named companies."


# ── Phase 3: Budget Optimization ───────────────────────────────────
class PlatformBudget(BaseModel):
    platform: str
    current_allocation: float
    recommended_allocation: float
    expected_roi_multiplier: Optional[float] = 1.0
    conversion_rate: Optional[float] = 0.0
    ctr: Optional[float] = 0.0
    efficiency_score: Optional[float] = 0.0
    rationale: str


class BudgetOptimizationResponse(BaseModel):
    campaign_id: str
    total_budget: float
    currency: str = "₹"
    allocations: List[PlatformBudget]
    executive_summary: str
    calculation_method: str = "algorithmic_historical_efficiency"
    disclaimer: str = "'Approve' records the plan only, and no money moves."
    approved: bool = False


# ── Phase 3: Agent Orchestrator & Activity ────────────────────────
class AgentActivityLog(BaseModel):
    id: str
    agent_name: str
    action: str
    status: str
    details: str
    timestamp: str
