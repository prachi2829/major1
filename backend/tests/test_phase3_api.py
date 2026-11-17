"""Test suite for Phase 2b and Phase 3 Autonomous Marketing Intelligence endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import store

client = TestClient(app)

PAYLOAD = {
    "name": "Phase3 Test Campaign",
    "product": "Autonomous Marketing Engine",
    "objective": "Scale global signups",
    "audience": "Growth marketers and founders",
    "tone": "Bold, authoritative, data-driven",
    "platforms": ["instagram", "linkedin"],
    "description": "Autonomous multi-agent campaign optimizer",
}


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    store.clear()
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    import app.agents as agents

    def fake_gemini(prompt, timeout=60.0):
        if "strategist" in prompt:
            return {
                "campaign_goal": "Scale to 10k users",
                "core_message": "Automate marketing workflows",
                "content_pillars": ["Speed", "Autonomy", "ROI"],
                "messaging_approach": "Direct",
                "call_to_action": "Start free trial",
                "campaign_direction": "Autonomous Intelligence",
            }
        plat = "instagram" if "instagram post" in prompt else "linkedin"
        return {"headline": "H", "body": f"Body for {plat}", "hashtags": ["growth", "ai"], "call_to_action": "start"}

    monkeypatch.setattr(agents, "generate_json", fake_gemini)
    yield


def _setup_published_campaign():
    c = client.post("/campaigns", json=PAYLOAD).json()
    cid = c["id"]
    client.post(f"/campaigns/{cid}/strategy")
    client.post(f"/campaigns/{cid}/content")
    client.post(f"/campaigns/{cid}/content/instagram/approve")
    client.post(f"/campaigns/{cid}/content/linkedin/approve")
    client.post(f"/campaigns/{cid}/publish")
    return cid


def test_scheduling_lifecycle():
    cid = _setup_published_campaign()

    # 1. Schedule a post
    post_data = {
        "campaign_id": cid,
        "platform": "instagram",
        "scheduled_at": "2026-12-01T10:00:00Z",
        "content": {"body": "Scheduled post content", "hashtags": ["#AI"]},
    }
    r = client.post(f"/campaigns/{cid}/schedule", json=post_data)
    assert r.status_code == 201
    sch = r.json()
    assert sch["campaign_id"] == cid
    assert sch["platform"] == "instagram"
    assert sch["status"] == "pending"
    sid = sch["id"]

    # 2. List schedules
    r_all = client.get("/schedule").json()
    assert any(s["id"] == sid for s in r_all)

    # 3. Patch schedule
    r_patch = client.patch(f"/schedule/{sid}", json={"status": "published"})
    assert r_patch.status_code == 200
    assert r_patch.json()["status"] == "published"

    # 4. Delete schedule
    r_del = client.delete(f"/schedule/{sid}")
    assert r_del.status_code == 204


def test_social_accounts_management():
    # List initial seeded accounts
    accounts = client.get("/social-accounts").json()
    assert len(accounts) >= 4

    # Connect new account
    new_acc = {
        "platform": "twitter",
        "account_name": "@growth_hacker",
        "credentials": {"token": "secret_123"},
    }
    r = client.post("/social-accounts", json=new_acc)
    assert r.status_code == 201
    aid = r.json()["id"]

    # Disconnect
    assert client.delete(f"/social-accounts/{aid}").status_code == 204


def test_ai_feedback_loop():
    cid = _setup_published_campaign()

    # Request feedback
    r = client.post(f"/campaigns/{cid}/feedback")
    assert r.status_code == 200
    fb = r.json()
    assert "score" in fb
    assert "overall_rating" in fb
    assert len(fb["strengths"]) > 0
    assert len(fb["recommendations"]) > 0

    # Retrieve history
    history = client.get(f"/campaigns/{cid}/feedback").json()
    assert len(history) >= 1
    assert history[0]["score"] == fb["score"]


def test_phase3_intelligence_agents():
    cid = _setup_published_campaign()

    # Audience Agent
    aud = client.post(f"/campaigns/{cid}/audience").json()
    assert "segments" in aud
    assert len(aud["segments"]) > 0

    # Competitor Agent
    comp = client.post(f"/campaigns/{cid}/competitors").json()
    assert "market_position" in comp

    # Budget Agent
    bud = client.post(f"/campaigns/{cid}/budget?total_budget=150000").json()
    assert bud["total_budget"] == 150000.0
    assert len(bud["allocations"]) > 0

    # Compliance Agent
    comp_audit = client.post(f"/campaigns/{cid}/compliance").json()
    assert "passed" in comp_audit

    # A/B Testing Agent
    ab = client.post(f"/campaigns/{cid}/ab-test?test_name=HeadlineTest").json()
    assert ab["test_name"] == "HeadlineTest"
    assert ab["status"] in ["statistically_significant", "inconclusive", "running"]

    # List A/B tests
    ab_list = client.get(f"/campaigns/{cid}/ab-tests").json()
    assert len(ab_list) == 1

    # Full Autonomous Orchestrator Cycle
    orch = client.post(f"/campaigns/{cid}/orchestrate").json()
    assert orch["campaign_id"] == cid
    assert "feedback" in orch
    assert "audience" in orch
    assert "budget" in orch

    # Agent Activity Logging
    logs = client.get("/agents/activity").json()
    assert len(logs) > 0
    assert any(log["agent_name"] == "Campaign Orchestrator" for log in logs)
