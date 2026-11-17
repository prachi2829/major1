"""Tests for Phase 2 & Phase 3 Autonomous Marketing Intelligence endpoints."""

import os
import pytest
from fastapi.testclient import TestClient

os.environ["CAMPAIGN_DB"] = ":memory:"

from app.main import app
from app.store import store

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_db():
    store.clear()
    yield

def test_scheduling_and_social_accounts():
    # 1. Connect social account
    acc = client.post("/social-accounts", json={
        "platform": "twitter",
        "account_name": "Test Brand",
        "credentials": {
            "api_key": "test_key",
            "api_secret": "test_secret"
        }
    }).json()
    assert acc["platform"] == "twitter"
    assert acc["connected"] is True

    # List accounts
    accs = client.get("/social-accounts").json()
    assert len(accs) >= 1

    # Verify publishing connections
    verify = client.get("/publishing/verify").json()
    assert "twitter" in verify

    # 2. Create campaign and schedule post
    camp = client.post("/campaigns", json={
        "name": "Scheduler Test",
        "product": "AI Suite",
        "objective": "Engagement",
        "audience": "Developers",
        "tone": "Bold",
        "platforms": ["twitter"]
    }).json()
    cid = camp["id"]

    # Schedule post
    post = client.post(f"/campaigns/{cid}/schedule", json={
        "campaign_id": cid,
        "platform": "twitter",
        "scheduled_at": "2026-12-01T12:00:00Z",
        "content": {"body": "Scheduled test tweet", "hashtags": ["#AI"]}
    }).json()
    assert post["status"] == "pending"
    assert post["platform"] == "twitter"

    # List schedules
    schs = client.get("/schedule").json()
    assert len(schs) >= 1

    # Cancel schedule
    del_res = client.delete(f"/schedule/{post['id']}")
    assert del_res.status_code == 204

def test_live_analytics_event_ingestion():
    # Create campaign
    camp = client.post("/campaigns", json={
        "name": "Live Event Test",
        "product": "Product X",
        "objective": "Conversions",
        "audience": "Marketers",
        "tone": "Engaging",
        "platforms": ["instagram"]
    }).json()
    cid = camp["id"]

    # Ingest event
    res = client.post("/analytics/events", json={
        "campaign_id": cid,
        "platform": "instagram",
        "event_type": "click",
        "count": 5
    }).json()
    assert res["status"] == "recorded"
    assert res["count"] == 5

def test_phase3_agents_and_orchestration(monkeypatch):
    # Mock generate_json so tests don't require external live Gemini network calls
    from app import agents
    def mock_json(prompt):
        return {
            "campaign_goal": "Goal",
            "core_message": "Core",
            "content_pillars": ["P1", "P2"],
            "messaging_approach": "Approach",
            "call_to_action": "CTA",
            "campaign_direction": "Direction",
            "segments": [{"segment_name": "S1", "demographics": "D1", "pain_points": [], "value_proposition": "V1", "recommended_angle": "A1", "suggested_platforms": ["twitter"]}],
            "summary": "Summary",
            "market_position": "Disruptor",
            "competitor_angles": [{"competitor_type": "Legacy", "weakness": "Slow", "counter_hook": "Fast"}],
            "white_space_opportunities": ["Automated cycles"],
            "recommended_differentiation": "Better",
            "total_budget": 50000,
            "currency": "₹",
            "allocations": [{"platform": "twitter", "current_allocation": 25000, "recommended_allocation": 25000, "expected_roi_multiplier": 3.0, "rationale": "High CTR"}],
            "executive_summary": "Reallocate",
            "passed": True,
            "compliance_score": 98,
            "flagged_issues": [],
            "suggestions": ["Great copy"],
            "variants": [
                {"id": "var_a", "name": "Variant A", "hypothesis": "H1", "content": {"body": "A"}, "impressions": 10000, "clicks": 540, "conversions": 50, "ctr": 5.4, "conversion_rate": 9.2},
                {"id": "var_b", "name": "Variant B", "hypothesis": "H2", "content": {"body": "B"}, "impressions": 10000, "clicks": 860, "conversions": 94, "ctr": 8.6, "conversion_rate": 10.9}
            ],
            "winner_variant_id": "var_b",
            "ai_recommendation": "Variant B wins",
            "score": 90,
            "strengths": ["Strong messaging"],
            "weaknesses": ["Could improve CTR"],
            "recommendations": ["Scale high performing channels"]
        }
    monkeypatch.setattr(agents, "generate_json", mock_json)

    # 1. Create campaign
    camp = client.post("/campaigns", json={
        "name": "Phase 3 Test Campaign",
        "product": "Autonomous AI",
        "objective": "Growth",
        "audience": "Founders",
        "tone": "Visionary",
        "platforms": ["twitter"]
    }).json()
    cid = camp["id"]

    # 2. Audience intelligence
    aud = client.post(f"/campaigns/{cid}/audience").json()
    assert "segments" in aud
    assert len(aud["segments"]) >= 1

    # 3. Competitor intelligence
    comp = client.post(f"/campaigns/{cid}/competitors").json()
    assert comp["market_position"] == "Disruptor"

    # 4. Budget optimization
    bud = client.post(f"/campaigns/{cid}/budget?total_budget=50000").json()
    assert "allocations" in bud

    # 5. A/B testing
    ab = client.post(f"/campaigns/{cid}/ab-test?test_name=Feature%20vs%20Urgency").json()
    assert ab["winner_variant_id"] == "var_b"

    # 6. Full Autonomous Orchestration cycle
    orch = client.post(f"/campaigns/{cid}/orchestrate").json()
    assert orch["campaign_id"] == cid
    assert "audience" in orch
    assert "budget" in orch
    assert "feedback" in orch

    # 7. Agent activity stream
    activities = client.get("/agents/activity").json()
    assert len(activities) > 0
