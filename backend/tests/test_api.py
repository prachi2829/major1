import os

import httpx
import pytest
from fastapi.testclient import TestClient

from app import ai_service
from app.main import app
from app.store import store

client = TestClient(app)

PAYLOAD = {
    "name": "FitLife Launch", "product": "Fitness application", "objective": "Increase downloads",
    "audience": "College students", "tone": "Energetic and friendly",
    "platforms": ["instagram", "linkedin"], "description": "An app for easy daily workouts",
}

STRATEGY = {"campaign_goal": "g", "core_message": "m", "content_pillars": ["a", "b", "c"],
            "messaging_approach": "x", "call_to_action": "y", "campaign_direction": "z"}


def fake_gemini(prompt, timeout=60.0):
    if "strategist" in prompt:
        return STRATEGY
    plat = "instagram" if "instagram post" in prompt else "linkedin"
    return {"headline": "H", "body": f"Body for {plat}", "hashtags": ["t1", "#t2"], "call_to_action": "go"}


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    store.clear()
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    import app.agents as agents
    monkeypatch.setattr(agents, "generate_json", fake_gemini)
    yield


def _create():
    return client.post("/campaigns", json=PAYLOAD).json()


def test_health():
    r = client.get("/health").json()
    assert r["mode"] == "gemini" and r["model"]


def test_validation():
    assert client.post("/campaigns", json=dict(PAYLOAD, platforms=["myspace"])).status_code == 422
    assert client.post("/campaigns", json=dict(PAYLOAD, platforms=[])).status_code == 422


def test_full_pipeline():
    cid = _create()["id"]
    assert client.post(f"/campaigns/{cid}/content").status_code == 409  # needs strategy first
    s = client.post(f"/campaigns/{cid}/strategy").json()
    assert s["status"] == "strategy_ready" and s["strategy"]["source"] == "gemini"
    c = client.post(f"/campaigns/{cid}/content").json()
    assert set(c["content"]) == {"instagram", "linkedin"}
    assert c["content"]["instagram"]["body"] == "Body for instagram"
    assert c["content"]["instagram"]["hashtags"] == ["#t1", "#t2"]


def test_edit_approve_publish_flow():
    cid = _create()["id"]
    client.post(f"/campaigns/{cid}/strategy")
    client.post(f"/campaigns/{cid}/content")
    assert client.post(f"/campaigns/{cid}/publish").status_code == 409
    e = client.patch(f"/campaigns/{cid}/content/instagram", json={"body": "Your college fitness journey starts today!"})
    assert e.json()["edited"] is True
    client.post(f"/campaigns/{cid}/content/instagram/approve")
    p = client.post(f"/campaigns/{cid}/publish", json={"platforms": ["instagram"]}).json()
    assert p["content"]["instagram"]["status"] == "published" and p["status"] != "published"
    assert client.patch(f"/campaigns/{cid}/content/instagram", json={"body": "x"}).status_code == 409
    client.post(f"/campaigns/{cid}/content/linkedin/approve")
    assert client.post(f"/campaigns/{cid}/publish").json()["status"] == "published"


def test_edit_resets_approval():
    cid = _create()["id"]
    client.post(f"/campaigns/{cid}/strategy")
    client.post(f"/campaigns/{cid}/content")
    client.post(f"/campaigns/{cid}/content/linkedin/approve")
    r = client.patch(f"/campaigns/{cid}/content/linkedin", json={"hashtags": ["Hello", "#World"]}).json()
    assert r["status"] == "draft" and r["hashtags"] == ["#Hello", "#World"]


def test_regenerate_delete_404():
    cid = _create()["id"]
    client.post(f"/campaigns/{cid}/strategy")
    client.post(f"/campaigns/{cid}/content")
    assert client.post(f"/campaigns/{cid}/content/instagram/regenerate").status_code == 200
    assert client.post(f"/campaigns/{cid}/content/twitter/regenerate").status_code == 404
    assert client.delete(f"/campaigns/{cid}").status_code == 204
    assert client.get(f"/campaigns/{cid}").status_code == 404


# ---- failure behaviour: there is NO fallback, errors must be reported clearly

def test_missing_key_returns_503_with_message(monkeypatch):
    import app.agents as agents
    monkeypatch.undo()  # use the real generate_json
    monkeypatch.setenv("GEMINI_API_KEY", "")
    cid = _create()["id"]
    r = client.post(f"/campaigns/{cid}/strategy")
    assert r.status_code == 503 and "GEMINI_API_KEY" in r.json()["detail"]
    assert client.get(f"/campaigns/{cid}").json()["strategy"] is None  # nothing fabricated


def test_gemini_error_is_surfaced_not_hidden(monkeypatch):
    import app.agents as agents

    def boom(prompt, timeout=60.0):
        raise ai_service.GeminiError("Gemini rejected the API key", 502)

    monkeypatch.setattr(agents, "generate_json", boom)
    cid = _create()["id"]
    r = client.post(f"/campaigns/{cid}/strategy")
    assert r.status_code == 502 and "API key" in r.json()["detail"]


def _fake_post(status, body):
    def post(url, headers=None, json=None, timeout=None):
        return httpx.Response(status, json=body, request=httpx.Request("POST", url))
    return post


def test_http_layer_success_and_error_mapping(monkeypatch):
    ok = {"candidates": [{"content": {"parts": [{"text": '```json\n{"a": 1}\n```'}]}}]}
    monkeypatch.setattr(ai_service.httpx, "post", _fake_post(200, ok))
    assert ai_service.generate_json("p") == {"a": 1}

    monkeypatch.setattr(ai_service.httpx, "post", _fake_post(404, {"error": {"message": "nope"}}))
    with pytest.raises(ai_service.GeminiError) as e:
        ai_service.generate_json("p")
    assert "GEMINI_MODEL" in e.value.message

    monkeypatch.setattr(ai_service.httpx, "post", _fake_post(403, {"error": {"message": "bad key"}}))
    with pytest.raises(ai_service.GeminiError) as e:
        ai_service.generate_json("p")
    assert "API key" in e.value.message

    monkeypatch.setattr(ai_service.httpx, "post", _fake_post(200, {"candidates": [{"content": {"parts": [{"text": "not json"}]}}]}))
    with pytest.raises(ai_service.GeminiError):
        ai_service.generate_json("p")


# ---------------------------------------------------------------- Phase 2
def _published_campaign():
    cid = _create()["id"]
    client.post(f"/campaigns/{cid}/strategy")
    client.post(f"/campaigns/{cid}/content")
    client.post(f"/campaigns/{cid}/content/instagram/approve")
    client.post(f"/campaigns/{cid}/publish", json={"platforms": ["instagram"]})
    return cid


def test_analytics_requires_published_content():
    cid = _create()["id"]
    assert client.post(f"/campaigns/{cid}/analytics/simulate").status_code == 409
    rep = client.get(f"/campaigns/{cid}/analytics").json()
    assert rep["has_data"] is False and rep["simulated"] is True


def test_analytics_simulated_deterministic_and_labeled():
    cid = _published_campaign()
    a = client.post(f"/campaigns/{cid}/analytics/simulate").json()
    assert a["has_data"] and a["simulated"] is True
    assert [p["platform"] for p in a["platforms"]] == ["instagram"]  # only published platforms
    assert len(a["daily"]) == 14
    t = a["totals"]
    assert t["impressions"] >= t["clicks"] >= t["conversions"] > 0
    assert 0 < t["ctr"] < 0.1
    b = client.post(f"/campaigns/{cid}/analytics/simulate").json()
    assert a["totals"] == b["totals"]  # same campaign -> same demo numbers
    assert client.get(f"/campaigns/{cid}/analytics").json()["totals"] == a["totals"]


def test_analytics_overview_and_delete_cascades():
    cid = _published_campaign()
    client.post(f"/campaigns/{cid}/analytics/simulate")
    ov = client.get("/analytics/overview").json()
    assert len(ov) == 1 and ov[0]["campaign_id"] == cid and ov[0]["has_data"]
    client.delete(f"/campaigns/{cid}")
    assert client.get("/analytics/overview").json() == []
    assert store.get_metrics(cid) == []  # metrics removed with campaign


def test_sqlite_persists_across_connections(tmp_path):
    from app.store import SQLiteStore
    db = str(tmp_path / "x.db")
    s1 = SQLiteStore(db)
    c = s1.create(__import__("app.schemas", fromlist=["CampaignCreate"]).CampaignCreate(**PAYLOAD))
    s2 = SQLiteStore(db)  # "restart": brand-new connection to the same file
    assert s2.get(c.id) is not None and s2.get(c.id).input.name == "FitLife Launch"
