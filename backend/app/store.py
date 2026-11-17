"""SQLite persistence layer supporting core campaigns, metrics, schedules, accounts, and agents."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from .schemas import (
    Campaign,
    CampaignCreate,
    CampaignInput,
    DailyMetric,
    PlatformContent,
    ScheduleCreate,
    SchedulePatch,
    Strategy,
)

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "campaign_ai.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS campaigns (
    id          TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL,
    data        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metrics (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id  TEXT NOT NULL,
    platform     TEXT NOT NULL,
    day          TEXT NOT NULL,
    impressions  INTEGER NOT NULL,
    clicks       INTEGER NOT NULL,
    engagements  INTEGER NOT NULL,
    conversions  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
    id            TEXT PRIMARY KEY,
    campaign_id   TEXT NOT NULL,
    platform      TEXT NOT NULL,
    scheduled_at  TEXT NOT NULL,
    content       TEXT DEFAULT 'null',
    status        TEXT DEFAULT 'pending',
    published_at  TEXT,
    error         TEXT,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_accounts (
    id            TEXT PRIMARY KEY,
    platform      TEXT NOT NULL,
    account_name  TEXT NOT NULL,
    credentials   TEXT DEFAULT '{}',
    connected     INTEGER DEFAULT 1,
    connected_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback_history (
    id           TEXT PRIMARY KEY,
    campaign_id  TEXT NOT NULL,
    feedback     TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ab_tests (
    id                 TEXT PRIMARY KEY,
    campaign_id        TEXT NOT NULL,
    test_name          TEXT NOT NULL,
    metric_goal        TEXT DEFAULT 'CTR',
    variants           TEXT NOT NULL,
    status             TEXT DEFAULT 'running',
    winner_variant_id  TEXT,
    ai_recommendation  TEXT,
    created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_activities (
    id          TEXT PRIMARY KEY,
    agent_name  TEXT NOT NULL,
    action      TEXT NOT NULL,
    status      TEXT NOT NULL,
    details     TEXT NOT NULL,
    timestamp   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_audiences (
    campaign_id  TEXT PRIMARY KEY,
    data         TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
"""


class SQLiteStore:
    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or os.getenv("CAMPAIGN_DB", str(DEFAULT_DB_PATH))
        self._shared_mem: sqlite3.Connection | None = None
        if self.db_path == ":memory:":
            self._shared_mem = sqlite3.connect(":memory:", check_same_thread=False)
            self._shared_mem.row_factory = sqlite3.Row
            self._shared_mem.executescript(SCHEMA_SQL)
            self._shared_mem.commit()
        else:
            self._init_db()

    def _connect(self) -> sqlite3.Connection:
        if self._shared_mem is not None:
            return self._shared_mem
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.executescript(SCHEMA_SQL)
        return conn

    def _init_db(self) -> None:
        conn = self._connect()
        conn.executescript(SCHEMA_SQL)
        conn.commit()

        # Seed default social accounts if none
        cur = conn.execute("SELECT COUNT(*) AS c FROM social_accounts")
        if cur.fetchone()["c"] == 0:
            now = datetime.now(timezone.utc).isoformat()
            defaults = [
                ("instagram", "@campaign_brand_ai"),
                ("linkedin", "CampaignAI Global"),
                ("facebook", "Campaign.AI Official"),
                ("twitter", "@campaign_ai_hq"),
            ]
            for plat, handle in defaults:
                aid = f"acc_{plat[:3]}_{uuid.uuid4().hex[:6]}"
                conn.execute(
                    "INSERT INTO social_accounts VALUES (?, ?, ?, '{}', 1, ?)",
                    (aid, plat, handle, now),
                )
            conn.commit()
        conn.close()

    def clear(self) -> None:
        """Clears all table contents (used in test fixtures)."""
        conn = self._connect()
        conn.executescript(SCHEMA_SQL)
        for tbl in ["campaigns", "metrics", "scheduled_posts", "social_accounts", "feedback_history", "ab_tests", "agent_activities", "campaign_audiences"]:
            try:
                conn.execute(f"DELETE FROM {tbl}")
            except Exception:
                pass
        self._seed_social_defaults(conn)
        conn.commit()
        if self._shared_mem is None:
            conn.close()

    def _seed_social_defaults(self, conn: sqlite3.Connection) -> None:
        cur = conn.execute("SELECT COUNT(*) AS c FROM social_accounts")
        if cur.fetchone()["c"] == 0:
            now = datetime.now(timezone.utc).isoformat()
            defaults = [
                ("instagram", "@campaign_brand_ai"),
                ("linkedin", "CampaignAI Global"),
                ("facebook", "Campaign.AI Official"),
                ("twitter", "@campaign_ai_hq"),
            ]
            for plat, handle in defaults:
                aid = f"acc_{plat[:3]}_{uuid.uuid4().hex[:6]}"
                conn.execute(
                    "INSERT INTO social_accounts VALUES (?, ?, ?, '{}', 1, ?)",
                    (aid, plat, handle, now),
                )

    # ── Core Campaign CRUD ──────────────────────────────────────────
    def create(self, inp: CampaignCreate) -> Campaign:
        cid = uuid.uuid4().hex[:8]
        now = datetime.now(timezone.utc).isoformat()
        campaign = Campaign(
            id=cid,
            created_at=now,
            updated_at=now,
            status="draft",
            input=CampaignInput(**inp.model_dump()),
            strategy=None,
            content={},
        )
        conn = self._connect()
        conn.execute(
            "INSERT INTO campaigns (id, created_at, data) VALUES (?, ?, ?)",
            (cid, now, campaign.model_dump_json()),
        )
        conn.commit()
        if self._shared_mem is None:
            conn.close()
        self.log_agent_activity("Campaign Orchestrator", f"Created campaign '{campaign.input.name}'", "completed", f"ID: {cid}")
        return campaign

    def get(self, cid: str) -> Optional[Campaign]:
        conn = self._connect()
        cur = conn.execute("SELECT data FROM campaigns WHERE id=?", (cid,))
        row = cur.fetchone()
        if self._shared_mem is None:
            conn.close()
        if not row:
            return None
        return Campaign.model_validate_json(row["data"])

    def list(self) -> List[Campaign]:
        conn = self._connect()
        cur = conn.execute("SELECT data FROM campaigns ORDER BY created_at DESC")
        rows = cur.fetchall()
        if self._shared_mem is None:
            conn.close()
        return [Campaign.model_validate_json(r["data"]) for r in rows]

    def update(self, campaign: Campaign) -> Campaign:
        campaign.updated_at = datetime.now(timezone.utc).isoformat()
        conn = self._connect()
        conn.execute(
            "UPDATE campaigns SET data=? WHERE id=?",
            (campaign.model_dump_json(), campaign.id),
        )
        conn.commit()
        if self._shared_mem is None:
            conn.close()
        return campaign

    def delete(self, cid: str) -> bool:
        conn = self._connect()
        cur = conn.execute("DELETE FROM campaigns WHERE id=?", (cid,))
        conn.execute("DELETE FROM metrics WHERE campaign_id=?", (cid,))
        conn.execute("DELETE FROM scheduled_posts WHERE campaign_id=?", (cid,))
        conn.execute("DELETE FROM feedback_history WHERE campaign_id=?", (cid,))
        conn.execute("DELETE FROM ab_tests WHERE campaign_id=?", (cid,))
        conn.execute("DELETE FROM campaign_audiences WHERE campaign_id=?", (cid,))
        conn.commit()
        cnt = cur.rowcount
        if self._shared_mem is None:
            conn.close()
        return cnt > 0

    # ── Analytics Metrics ───────────────────────────────────────────
    def record_live_event(self, cid: str, platform: str, event_type: str, count: int = 1) -> None:
        plat = platform.lower().strip()
        today = datetime.now(timezone.utc).date().isoformat()
        conn = self._connect()
        cur = conn.execute("SELECT impressions FROM metrics WHERE campaign_id=? AND platform=? AND day=?", (cid, plat, today))
        row = cur.fetchone()
        col = {"click": "clicks", "impression": "impressions", "engagement": "engagements", "conversion": "conversions"}.get(event_type, "impressions")
        if row:
            conn.execute(f"UPDATE metrics SET {col} = {col} + ? WHERE campaign_id=? AND platform=? AND day=?", (count, cid, plat, today))
        else:
            imp = count if event_type == "impression" else 1
            clk = count if event_type == "click" else 0
            eng = count if event_type == "engagement" else 0
            cnv = count if event_type == "conversion" else 0
            conn.execute(
                "INSERT INTO metrics (campaign_id, platform, day, impressions, clicks, engagements, conversions) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (cid, plat, today, imp, clk, eng, cnv),
            )
        conn.commit()
        if self._shared_mem is None:
            conn.close()
        self.log_agent_activity("Analytics Agent", f"Live {event_type} on {plat} (+{count})", "completed", f"Campaign {cid}")

    def save_metrics(self, cid: str, metrics: List[DailyMetric]) -> None:
        conn = self._connect()
        conn.execute("DELETE FROM metrics WHERE campaign_id=?", (cid,))
        for m in metrics:
            conn.execute(
                """INSERT INTO metrics (campaign_id, platform, day, impressions, clicks, engagements, conversions)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (cid, m.platform, m.day, m.impressions, m.clicks, m.engagements, m.conversions),
            )
        conn.commit()
        if self._shared_mem is None:
            conn.close()

    def get_metrics(self, cid: str) -> List[DailyMetric]:
        conn = self._connect()
        cur = conn.execute(
            "SELECT platform, day, impressions, clicks, engagements, conversions FROM metrics WHERE campaign_id=? ORDER BY day ASC",
            (cid,),
        )
        rows = cur.fetchall()
        if self._shared_mem is None:
            conn.close()
        return [DailyMetric(**dict(r)) for r in rows]

    def all_metrics(self) -> List[dict]:
        conn = self._connect()
        cur = conn.execute(
            """SELECT campaign_id, platform, sum(impressions) as impressions, sum(clicks) as clicks,
                      sum(engagements) as engagements, sum(conversions) as conversions
               FROM metrics GROUP BY campaign_id, platform"""
        )
        rows = [dict(r) for r in cur.fetchall()]
        if self._shared_mem is None:
            conn.close()
        return rows

    # ── Scheduling ──────────────────────────────────────────────────
    def create_schedule(self, data: ScheduleCreate) -> dict[str, Any]:
        sid = f"sch_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        content_json = json.dumps(data.content) if data.content else "null"
        conn = self._connect()
        conn.execute(
            """INSERT INTO scheduled_posts
               (id, campaign_id, platform, scheduled_at, content, status, published_at, error, created_at)
               VALUES (?, ?, ?, ?, ?, 'pending', null, null, ?)""",
            (sid, data.campaign_id, data.platform, data.scheduled_at, content_json, now),
        )
        conn.commit()
        if self._shared_mem is None:
            conn.close()
        self.log_agent_activity("Campaign Scheduler", f"Scheduled post on {data.platform}", "completed", f"Time: {data.scheduled_at}")
        return self.get_schedule(sid)

    def get_schedule(self, sid: str) -> Optional[dict[str, Any]]:
        conn = self._connect()
        cur = conn.execute("SELECT * FROM scheduled_posts WHERE id=?", (sid,))
        row = cur.fetchone()
        if self._shared_mem is None:
            conn.close()
        if not row:
            return None
        d = dict(row)
        if d.get("content"):
            try:
                d["content"] = json.loads(d["content"])
            except Exception:
                pass
        return d

    def list_schedules(self) -> List[dict[str, Any]]:
        conn = self._connect()
        cur = conn.execute("SELECT * FROM scheduled_posts ORDER BY scheduled_at ASC")
        rows = [dict(r) for r in cur.fetchall()]
        if self._shared_mem is None:
            conn.close()
        for r in rows:
            if r.get("content"):
                try:
                    r["content"] = json.loads(r["content"])
                except Exception:
                    pass
        return rows

    def list_campaign_schedules(self, cid: str) -> List[dict[str, Any]]:
        conn = self._connect()
        cur = conn.execute("SELECT * FROM scheduled_posts WHERE campaign_id=? ORDER BY scheduled_at ASC", (cid,))
        rows = [dict(r) for r in cur.fetchall()]
        if self._shared_mem is None:
            conn.close()
        for r in rows:
            if r.get("content"):
                try:
                    r["content"] = json.loads(r["content"])
                except Exception:
                    pass
        return rows

    def list_due_schedules(self, iso_now: str) -> List[dict[str, Any]]:
        conn = self._connect()
        cur = conn.execute(
            "SELECT * FROM scheduled_posts WHERE status='pending' AND scheduled_at <= ? ORDER BY scheduled_at ASC",
            (iso_now,),
        )
        rows = [dict(r) for r in cur.fetchall()]
        if self._shared_mem is None:
            conn.close()
        for r in rows:
            if r.get("content"):
                try:
                    r["content"] = json.loads(r["content"])
                except Exception:
                    pass
        return rows

    def update_schedule(self, sid: str, patch_data: dict[str, Any]) -> Optional[dict[str, Any]]:
        fields = dict(patch_data)
        if "content" in fields and isinstance(fields["content"], (dict, list)):
            fields["content"] = json.dumps(fields["content"])
        if not fields:
            return self.get_schedule(sid)
        set_clause = ", ".join(f"{k}=?" for k in fields)
        vals = list(fields.values()) + [sid]
        conn = self._connect()
        conn.execute(f"UPDATE scheduled_posts SET {set_clause} WHERE id=?", vals)
        conn.commit()
        if self._shared_mem is None:
            conn.close()
        return self.get_schedule(sid)

    def delete_schedule(self, sid: str) -> bool:
        conn = self._connect()
        cur = conn.execute("DELETE FROM scheduled_posts WHERE id=?", (sid,))
        conn.commit()
        cnt = cur.rowcount
        if self._shared_mem is None:
            conn.close()
        return cnt > 0

    # ── Social Accounts ─────────────────────────────────────────────
    def create_social_account(self, platform: str, account_name: str, credentials: dict[str, Any]) -> dict[str, Any]:
        aid = f"acc_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        conn = self._connect()
        conn.execute(
            "INSERT INTO social_accounts VALUES (?, ?, ?, ?, 1, ?)",
            (aid, platform, account_name, json.dumps(credentials), now),
        )
        conn.commit()
        if self._shared_mem is None:
            conn.close()
        return {"id": aid, "platform": platform, "account_name": account_name, "connected": True, "connected_at": now}

    def list_social_accounts(self) -> List[dict[str, Any]]:
        conn = self._connect()
        cur = conn.execute("SELECT id, platform, account_name, connected, connected_at FROM social_accounts")
        rows = [dict(r) for r in cur.fetchall()]
        if self._shared_mem is None:
            conn.close()
        for r in rows:
            r["connected"] = bool(r["connected"])
        return rows

    def delete_social_account(self, aid: str) -> bool:
        conn = self._connect()
        cur = conn.execute("DELETE FROM social_accounts WHERE id=?", (aid,))
        conn.commit()
        cnt = cur.rowcount
        if self._shared_mem is None:
            conn.close()
        return cnt > 0

    # ── Feedback History ────────────────────────────────────────────
    def save_feedback(self, cid: str, feedback: dict[str, Any]) -> str:
        fid = f"fb_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        conn = self._connect()
        conn.execute(
            "INSERT INTO feedback_history VALUES (?, ?, ?, ?)",
            (fid, cid, json.dumps(feedback), now),
        )
        conn.commit()
        if self._shared_mem is None:
            conn.close()
        self.log_agent_activity("Optimization Agent", f"Evaluated campaign {cid} (Score: {feedback.get('score')}/100)", "completed")
        return fid

    def get_campaign_feedback(self, cid: str) -> List[dict[str, Any]]:
        conn = self._connect()
        cur = conn.execute("SELECT * FROM feedback_history WHERE campaign_id=? ORDER BY created_at DESC", (cid,))
        rows = [dict(r) for r in cur.fetchall()]
        if self._shared_mem is None:
            conn.close()
        results = []
        for r in rows:
            d = json.loads(r["feedback"])
            d["id"] = r["id"]
            d["campaign_id"] = r["campaign_id"]
            d["created_at"] = r["created_at"]
            results.append(d)
        return results

    # ── A/B Testing ─────────────────────────────────────────────────
    def create_ab_test(self, cid: str, test_name: str, metric_goal: str, variants: list[dict[str, Any]]) -> dict[str, Any]:
        tid = f"ab_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        conn = self._connect()
        conn.execute(
            "INSERT INTO ab_tests VALUES (?, ?, ?, ?, ?, 'running', null, null, ?)",
            (tid, cid, test_name, metric_goal, json.dumps(variants), now),
        )
        conn.commit()
        if self._shared_mem is None:
            conn.close()
        self.log_agent_activity("A/B Testing Agent", f"Launched split test '{test_name}'", "running", f"Variants: {len(variants)}")
        return self.get_ab_test(tid)

    def get_ab_test(self, tid: str) -> Optional[dict[str, Any]]:
        conn = self._connect()
        cur = conn.execute("SELECT * FROM ab_tests WHERE id=?", (tid,))
        row = cur.fetchone()
        if self._shared_mem is None:
            conn.close()
        if not row:
            return None
        d = dict(row)
        d["variants"] = json.loads(d["variants"]) if d.get("variants") else []
        return d

    def list_campaign_ab_tests(self, cid: str) -> List[dict[str, Any]]:
        conn = self._connect()
        cur = conn.execute("SELECT * FROM ab_tests WHERE campaign_id=? ORDER BY created_at DESC", (cid,))
        rows = [dict(r) for r in cur.fetchall()]
        if self._shared_mem is None:
            conn.close()
        res = []
        for r in rows:
            d = dict(r)
            d["variants"] = json.loads(d["variants"]) if d.get("variants") else []
            res.append(d)
        return res

    def update_ab_test(self, tid: str, updates: dict[str, Any]) -> Optional[dict[str, Any]]:
        fields = dict(updates)
        if "variants" in fields and isinstance(fields["variants"], list):
            fields["variants"] = json.dumps(fields["variants"])
        set_clause = ", ".join(f"{k}=?" for k in fields)
        vals = list(fields.values()) + [tid]
        conn = self._connect()
        conn.execute(f"UPDATE ab_tests SET {set_clause} WHERE id=?", vals)
        conn.commit()
        if self._shared_mem is None:
            conn.close()
    # ── Audience Intelligence Persistence ───────────────────────────
    def save_audience(self, cid: str, data: dict[str, Any]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        conn = self._connect()
        conn.execute(
            "INSERT OR REPLACE INTO campaign_audiences (campaign_id, data, updated_at) VALUES (?, ?, ?)",
            (cid, json.dumps(data), now),
        )
        conn.commit()
        if self._shared_mem is None:
            conn.close()

    def get_audience(self, cid: str) -> Optional[dict[str, Any]]:
        conn = self._connect()
        cur = conn.execute("SELECT data FROM campaign_audiences WHERE campaign_id=?", (cid,))
        row = cur.fetchone()
        if self._shared_mem is None:
            conn.close()
        if not row:
            return None
        try:
            return json.loads(row["data"])
        except Exception:
            return None

    # ── Agent Activity Logging ──────────────────────────────────────
    def log_agent_activity(self, agent_name: str, action: str, status: str, details: str = "") -> None:
        lid = f"log_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        try:
            conn = self._connect()
            conn.execute("INSERT INTO agent_activities VALUES (?, ?, ?, ?, ?, ?)", (lid, agent_name, action, status, details, now))
            conn.commit()
            if self._shared_mem is None:
                conn.close()
        except Exception:
            pass

    def list_agent_activities(self, limit: int = 40) -> List[dict[str, Any]]:
        conn = self._connect()
        cur = conn.execute("SELECT * FROM agent_activities ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = [dict(r) for r in cur.fetchall()]
        if self._shared_mem is None:
            conn.close()
        return rows


store = SQLiteStore()
DB = store
