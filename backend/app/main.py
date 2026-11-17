"""FastAPI backend for Campaign.AI (Core, Phase 2, and Phase 3 Autonomous Marketing Intelligence)."""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import ai_service
from .agents import (
    generate_all_content,
    generate_content_for_platform,
    generate_strategy,
    run_ab_testing_agent,
    run_audience_agent,
    run_autonomous_orchestrator,
    run_budget_agent,
    run_compliance_agent,
    run_competitor_agent,
)
from .analytics import build_report, simulate
from .feedback import run_feedback_agent
from .publishing import publisher
from .scheduler import start_scheduler, stop_scheduler
from .schemas import (
    ABTestRead,
    AgentActivityLog,
    AnalyticsReport,
    AudienceIntelligenceResponse,
    BudgetOptimizationResponse,
    Campaign,
    CampaignCreate,
    FeedbackResponse,
    PlatformContent,
    PublishRequest,
    ScheduleCreate,
    SchedulePatch,
    ScheduleRead,
    SocialAccountCreate,
    SocialAccountRead,
)
from .store import store


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler(interval_seconds=15)
    yield
    stop_scheduler()


app = FastAPI(title="Campaign.AI", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Root & Health ───────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "service": "Campaign.AI Backend API",
        "status": "online",
        "version": app.version,
        "docs_url": "/docs",
        "health_url": "/health",
        "model": ai_service.model_name(),
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "mode": ai_service.mode(),
        "model": ai_service.model_name(),
        "version": app.version,
    }


# ── Core Campaign CRUD ──────────────────────────────────────────────
@app.post("/campaigns", response_model=Campaign, status_code=201)
@app.post("/api/campaigns", response_model=Campaign, status_code=201)
async def create_campaign(body: CampaignCreate):
    return store.create(body)


@app.get("/campaigns", response_model=List[Campaign])
@app.get("/api/campaigns", response_model=List[Campaign])
async def list_campaigns():
    return store.list()


@app.get("/campaigns/{cid}", response_model=Campaign)
@app.get("/api/campaigns/{cid}", response_model=Campaign)
async def get_campaign(cid: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    return c


@app.delete("/campaigns/{cid}", status_code=204)
@app.delete("/api/campaigns/{cid}", status_code=204)
async def delete_campaign(cid: str):
    ok = store.delete(cid)
    if not ok:
        raise HTTPException(404, "Campaign not found")


# ── Strategy Generation ─────────────────────────────────────────────
@app.post("/campaigns/{cid}/strategy", response_model=Campaign)
@app.post("/api/campaigns/{cid}/strategy", response_model=Campaign)
async def generate_strategy_endpoint(cid: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")

    try:
        strat = generate_strategy(c)
    except ai_service.GeminiError as exc:
        raise HTTPException(exc.status_code, exc.message)

    c.strategy = strat
    c.status = "strategy_ready"
    return store.update(c)


# ── Content Generation ──────────────────────────────────────────────
@app.post("/campaigns/{cid}/content", response_model=Campaign)
@app.post("/api/campaigns/{cid}/content", response_model=Campaign)
async def generate_content_endpoint(cid: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    if not c.strategy:
        raise HTTPException(409, "Generate a strategy first")

    try:
        posts = generate_all_content(c, c.strategy)
    except ai_service.GeminiError as exc:
        raise HTTPException(exc.status_code, exc.message)

    c.content = posts
    c.status = "content_ready"
    return store.update(c)


@app.post("/campaigns/{cid}/content/{platform}/regenerate", response_model=PlatformContent)
@app.post("/api/campaigns/{cid}/content/{platform}/regenerate", response_model=PlatformContent)
async def regenerate_platform_content(cid: str, platform: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    plat_key = platform.lower().strip()
    if plat_key not in c.input.platforms:
        raise HTTPException(404, f"Platform '{platform}' is not part of this campaign")
    if not c.strategy:
        raise HTTPException(409, "Generate a strategy first")

    try:
        post = generate_content_for_platform(c, plat_key, c.strategy)
    except ai_service.GeminiError as exc:
        raise HTTPException(exc.status_code, exc.message)

    c.content[plat_key] = post
    store.update(c)
    return post


class ContentEditPayload(BaseModel):
    headline: Optional[str] = None
    body: Optional[str] = None
    hashtags: Optional[List[str]] = None
    call_to_action: Optional[str] = None


@app.patch("/campaigns/{cid}/content/{platform}", response_model=PlatformContent)
@app.patch("/api/campaigns/{cid}/content/{platform}", response_model=PlatformContent)
async def edit_platform_content(cid: str, platform: str, patch: ContentEditPayload):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    plat_key = platform.lower().strip()
    if plat_key not in c.content:
        raise HTTPException(404, f"No content generated for '{platform}' yet")

    current_post = c.content[plat_key]
    if current_post.status == "published":
        raise HTTPException(409, "Cannot edit published content")

    data = patch.model_dump(exclude_unset=True)
    if "hashtags" in data and data["hashtags"] is not None:
        data["hashtags"] = [f"#{t.lstrip('#')}" for t in data["hashtags"] if t]
    for k, v in data.items():
        setattr(current_post, k, v)

    current_post.edited = True
    current_post.status = "draft"  # editing resets approval
    c.content[plat_key] = current_post
    store.update(c)
    return current_post


@app.post("/campaigns/{cid}/content/{platform}/approve", response_model=PlatformContent)
@app.post("/api/campaigns/{cid}/content/{platform}/approve", response_model=PlatformContent)
async def approve_platform_content(cid: str, platform: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    plat_key = platform.lower().strip()
    if plat_key not in c.content:
        raise HTTPException(404, f"No content generated for '{platform}' yet")

    post = c.content[plat_key]
    post.status = "approved"
    c.content[plat_key] = post
    store.update(c)
    store.log_agent_activity("Compliance Agent", f"Approved post for {plat_key} on '{c.input.name}'", "completed")
    return post


# ── Publishing Flow ─────────────────────────────────────────────────
@app.post("/campaigns/{cid}/publish", response_model=Campaign)
@app.post("/api/campaigns/{cid}/publish", response_model=Campaign)
async def publish_campaign(cid: str, body: PublishRequest = Body(default_factory=PublishRequest)):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")

    target_platforms = [p.lower().strip() for p in (body.platforms or c.input.platforms)]
    eligible = [p for p in target_platforms if c.content.get(p) and c.content[p].status == "approved"]

    if not eligible:
        raise HTTPException(409, "No approved posts available to publish")

    now = datetime.now(timezone.utc).isoformat()
    for p in eligible:
        post = c.content[p]
        post.status = "published"
        post.published_at = now
        c.content[p] = post

    # If all campaign platforms are now published, update overall status
    if all(c.content.get(p) and c.content[p].status == "published" for p in c.input.platforms):
        c.status = "published"

    store.update(c)
    store.log_agent_activity("Publishing Agent", f"Published {len(eligible)} platforms for '{c.input.name}'", "completed")
    return c


# ── Analytics ───────────────────────────────────────────────────────
@app.post("/campaigns/{cid}/analytics/simulate", response_model=AnalyticsReport)
@app.post("/api/campaigns/{cid}/analytics/simulate", response_model=AnalyticsReport)
async def simulate_analytics_endpoint(cid: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")

    published_platforms = [p for p, post in c.content.items() if post.status == "published"]
    if not published_platforms:
        raise HTTPException(409, "Publish at least one platform before viewing analytics")

    rows = simulate(cid, published_platforms)
    store.save_metrics(cid, rows)
    return build_report(cid, rows, simulated=True)


class AnalyticsEvent(BaseModel):
    campaign_id: str
    platform: str
    event_type: str = "click"  # click / impression / engagement / conversion
    count: int = 1


@app.post("/analytics/events", status_code=201)
@app.post("/api/analytics/events", status_code=201)
async def record_analytics_event(body: AnalyticsEvent):
    c = store.get(body.campaign_id)
    if not c:
        raise HTTPException(404, "Campaign not found")
    store.record_live_event(body.campaign_id, body.platform, body.event_type, body.count)
    return {
        "status": "recorded",
        "campaign_id": body.campaign_id,
        "platform": body.platform,
        "event_type": body.event_type,
        "count": body.count,
    }


@app.get("/campaigns/{cid}/analytics", response_model=AnalyticsReport)
@app.get("/api/campaigns/{cid}/analytics", response_model=AnalyticsReport)
async def get_analytics_endpoint(cid: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")

    rows = store.get_metrics(cid)
    if not rows:
        published_platforms = [p for p, post in c.content.items() if post.status == "published"]
        if published_platforms:
            rows = simulate(cid, published_platforms)
            store.save_metrics(cid, rows)
    return build_report(cid, rows, simulated=True)


@app.get("/analytics/overview")
@app.get("/api/analytics/overview")
async def get_analytics_overview():
    rows = store.all_metrics()
    cids = sorted(list({r["campaign_id"] for r in rows}))
    out = []
    for cid in cids:
        c_rows = store.get_metrics(cid)
        rep = build_report(cid, c_rows)
        out.append(rep)
    return out


# ── Scheduling Endpoints (Phase 2b) ─────────────────────────────────
@app.post("/campaigns/{cid}/schedule", response_model=ScheduleRead, status_code=201)
@app.post("/api/campaigns/{cid}/schedule", response_model=ScheduleRead, status_code=201)
async def schedule_campaign_post(cid: str, body: ScheduleCreate):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    body.campaign_id = cid
    if not body.content and c.content.get(body.platform.lower()):
        body.content = c.content[body.platform.lower()].model_dump()
    return store.create_schedule(body)


@app.get("/campaigns/{cid}/schedule", response_model=List[ScheduleRead])
@app.get("/api/campaigns/{cid}/schedule", response_model=List[ScheduleRead])
async def list_campaign_schedule(cid: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    return store.list_campaign_schedules(cid)


@app.get("/schedule", response_model=List[ScheduleRead])
@app.get("/api/schedule", response_model=List[ScheduleRead])
async def list_all_schedules():
    return store.list_schedules()


@app.patch("/schedule/{sid}", response_model=ScheduleRead)
@app.patch("/api/schedule/{sid}", response_model=ScheduleRead)
async def update_schedule(sid: str, body: SchedulePatch):
    updated = store.update_schedule(sid, body.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(404, "Scheduled item not found")
    return updated


@app.delete("/schedule/{sid}", status_code=204)
@app.delete("/api/schedule/{sid}", status_code=204)
async def cancel_schedule(sid: str):
    ok = store.delete_schedule(sid)
    if not ok:
        raise HTTPException(404, "Scheduled item not found")


# ── Social Accounts Endpoints ───────────────────────────────────────
@app.get("/social-accounts", response_model=List[SocialAccountRead])
@app.get("/api/social-accounts", response_model=List[SocialAccountRead])
async def list_social_accounts():
    return store.list_social_accounts()


@app.post("/social-accounts", response_model=SocialAccountRead, status_code=201)
@app.post("/api/social-accounts", response_model=SocialAccountRead, status_code=201)
async def connect_social_account(body: SocialAccountCreate):
    return store.create_social_account(body.platform, body.account_name, body.credentials)


@app.delete("/social-accounts/{aid}", status_code=204)
@app.delete("/api/social-accounts/{aid}", status_code=204)
async def disconnect_social_account(aid: str):
    ok = store.delete_social_account(aid)
    if not ok:
        raise HTTPException(404, "Social account not found")


@app.get("/publishing/verify")
@app.get("/api/publishing/verify")
async def verify_platform_connections_endpoint():
    return await publisher.verify_platform_connections()


# ── AI Feedback Loop ────────────────────────────────────────────────
@app.post("/campaigns/{cid}/feedback", response_model=FeedbackResponse)
@app.post("/api/campaigns/{cid}/feedback", response_model=FeedbackResponse)
async def generate_feedback_endpoint(cid: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")

    metrics = store.get_metrics(cid)
    if not metrics:
        metrics = simulate(cid, c.input.platforms)
        store.save_metrics(cid, metrics)
    report = build_report(cid, metrics)

    feedback = run_feedback_agent(c, report.model_dump())
    feedback["campaign_id"] = cid
    return feedback


@app.get("/campaigns/{cid}/feedback")
@app.get("/api/campaigns/{cid}/feedback")
async def get_feedback_history(cid: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    return store.get_campaign_feedback(cid)


# ── Phase 3 Autonomous Features ─────────────────────────────────────
@app.get("/campaigns/{cid}/audience", response_model=AudienceIntelligenceResponse)
@app.get("/api/campaigns/{cid}/audience", response_model=AudienceIntelligenceResponse)
@app.post("/campaigns/{cid}/audience", response_model=AudienceIntelligenceResponse)
@app.post("/api/campaigns/{cid}/audience", response_model=AudienceIntelligenceResponse)
async def audience_intelligence_endpoint(cid: str, refresh: bool = False):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")

    if not refresh:
        cached = store.get_audience(cid)
        if cached:
            return cached

    data = run_audience_agent(c)
    data["campaign_id"] = cid
    store.save_audience(cid, data)
    return data


@app.post("/campaigns/{cid}/competitors")
@app.post("/api/campaigns/{cid}/competitors")
async def competitor_intelligence_endpoint(cid: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    return run_competitor_agent(c)


@app.post("/campaigns/{cid}/budget", response_model=BudgetOptimizationResponse)
@app.post("/api/campaigns/{cid}/budget", response_model=BudgetOptimizationResponse)
async def budget_optimization_endpoint(cid: str, total_budget: float = Query(100000.0)):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    metrics = store.get_metrics(cid)
    if not metrics:
        metrics = simulate(cid, c.input.platforms)
        store.save_metrics(cid, metrics)
    report = build_report(cid, metrics)
    data = run_budget_agent(c, report.model_dump(), total_budget)
    data["campaign_id"] = cid
    return data


@app.post("/campaigns/{cid}/compliance")
@app.post("/api/campaigns/{cid}/compliance")
async def compliance_audit_endpoint(cid: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    content_dict = {p: item.model_dump() for p, item in c.content.items()}
    return run_compliance_agent(content_dict)


@app.post("/campaigns/{cid}/ab-test", response_model=ABTestRead, status_code=201)
@app.post("/api/campaigns/{cid}/ab-test", response_model=ABTestRead, status_code=201)
async def create_ab_test_endpoint(cid: str, test_name: str = Query("Emotional vs Discount")):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    test_data = run_ab_testing_agent(c, test_name)
    created = store.create_ab_test(
        cid,
        test_name,
        "CTR",
        test_data.get("variants", []),
    )
    store.update_ab_test(
        created["id"],
        {
            "status": test_data.get("status", "running"),
            "winner_variant_id": test_data.get("winner_variant_id"),
            "ai_recommendation": test_data.get("statistical_explanation") or test_data.get("ai_recommendation"),
        },
    )
    res = store.get_ab_test(created["id"])
    if res:
        res["is_significant"] = test_data.get("is_significant", False)
        res["p_value"] = test_data.get("p_value")
        res["z_score"] = test_data.get("z_score")
        res["confidence_level"] = test_data.get("confidence_level")
        res["statistical_explanation"] = test_data.get("statistical_explanation")
    return res


@app.get("/campaigns/{cid}/ab-tests", response_model=List[ABTestRead])
@app.get("/api/campaigns/{cid}/ab-tests", response_model=List[ABTestRead])
async def list_campaign_ab_tests(cid: str):
    c = store.get(cid)
    if not c:
        raise HTTPException(404, "Campaign not found")
    return store.list_campaign_ab_tests(cid)


@app.post("/campaigns/{cid}/orchestrate")
@app.post("/api/campaigns/{cid}/orchestrate")
async def orchestrate_autonomous_cycle(cid: str):
    return run_autonomous_orchestrator(cid)


@app.get("/agents/activity", response_model=List[AgentActivityLog])
@app.get("/api/agents/activity", response_model=List[AgentActivityLog])
async def list_agent_activity_logs(limit: int = Query(40, le=100)):
    return store.list_agent_activities(limit)
