"""Real OAuth connections and live publishing for Instagram, Facebook, LinkedIn and X.

Tokens are encrypted at rest with Fernet. This app currently has no user-login system,
so connected accounts belong to one shared Campaign.AI workspace (single-tenant mode).
Do not expose this deployment as a multi-user SaaS until account ownership is tied to
an authenticated application user.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse

router = APIRouter(prefix="/oauth", tags=["Social OAuth"])
PLATFORMS = {"instagram", "facebook", "linkedin", "twitter"}
META_VERSION = os.getenv("META_GRAPH_VERSION", "v27.0")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
DB_PATH = os.getenv("SOCIAL_OAUTH_DB", str(Path(__file__).resolve().parents[1] / "social_oauth.db"))
SESSION_COOKIE = "campaign_ai_guest"
SESSION_TTL = 60 * 60 * 24 * 30


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
      CREATE TABLE IF NOT EXISTS guest_sessions (
        session_id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY, platform TEXT NOT NULL, intent TEXT NOT NULL,
        verifier TEXT, created_at INTEGER NOT NULL, session_id TEXT
      );
      CREATE TABLE IF NOT EXISTS publish_events (
        id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, platform TEXT NOT NULL,
        account_id TEXT, status TEXT NOT NULL, post_id TEXT, post_url TEXT,
        error TEXT, created_at TEXT NOT NULL, session_id TEXT
      );
    """)
    tables = {row["name"] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "oauth_accounts" in tables:
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(oauth_accounts)")}
        if "session_id" not in cols:
            conn.execute("DROP TABLE oauth_accounts")
    conn.execute("""
      CREATE TABLE IF NOT EXISTS oauth_accounts (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL, platform TEXT NOT NULL,
        account_id TEXT NOT NULL, account_name TEXT NOT NULL, encrypted_tokens TEXT NOT NULL,
        expires_at INTEGER, metadata TEXT NOT NULL DEFAULT '{}', connected_at TEXT NOT NULL,
        UNIQUE(session_id, platform, account_id)
      )
    """)
    state_cols = {row["name"] for row in conn.execute("PRAGMA table_info(oauth_states)")}
    if "session_id" not in state_cols:
        conn.execute("ALTER TABLE oauth_states ADD COLUMN session_id TEXT")
    event_cols = {row["name"] for row in conn.execute("PRAGMA table_info(publish_events)")}
    if "session_id" not in event_cols:
        conn.execute("ALTER TABLE publish_events ADD COLUMN session_id TEXT")
    conn.commit()
    return conn


def get_guest_session(request: Request, response: Response) -> str:
    raw = request.cookies.get(SESSION_COOKIE)
    now = int(time.time())
    conn = _db()
    row = conn.execute("SELECT session_id, expires_at FROM guest_sessions WHERE token_hash=?",
                       (hashlib.sha256(raw.encode()).hexdigest(),)).fetchone() if raw else None
    if row and row["expires_at"] > now:
        conn.execute("UPDATE guest_sessions SET expires_at=? WHERE session_id=?", (now + SESSION_TTL, row["session_id"]))
        conn.commit()
        conn.close()
        return row["session_id"]
    token = secrets.token_urlsafe(48)
    session_id = secrets.token_hex(16)
    conn.execute("INSERT INTO guest_sessions VALUES (?, ?, ?, ?)",
                 (session_id, hashlib.sha256(token.encode()).hexdigest(), now, now + SESSION_TTL))
    conn.commit()
    conn.close()
    response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_TTL, httponly=True,
                        secure=BACKEND_URL.startswith("https://"), samesite="lax", path="/")
    return session_id


def _cipher() -> Fernet:
    key = os.getenv("SOCIAL_TOKEN_ENCRYPTION_KEY", "").strip()
    if not key:
        raise HTTPException(503, "Social OAuth is not configured: set SOCIAL_TOKEN_ENCRYPTION_KEY on the backend.")
    try:
        return Fernet(key.encode())
    except Exception as exc:
        raise HTTPException(503, "SOCIAL_TOKEN_ENCRYPTION_KEY must be a valid Fernet key.") from exc


def _encrypt(payload: dict[str, Any]) -> str:
    return _cipher().encrypt(json.dumps(payload).encode()).decode()


def _decrypt(value: str) -> dict[str, Any]:
    try:
        return json.loads(_cipher().decrypt(value.encode()).decode())
    except (InvalidToken, ValueError) as exc:
        raise HTTPException(503, "Stored social credentials cannot be decrypted. Check SOCIAL_TOKEN_ENCRYPTION_KEY.") from exc


def _client(platform: str) -> tuple[str, str, str]:
    config = {
        "meta": (os.getenv("META_APP_ID", ""), os.getenv("META_APP_SECRET", ""), f"{BACKEND_URL}/oauth/meta/callback"),
        "linkedin": (os.getenv("LINKEDIN_CLIENT_ID", ""), os.getenv("LINKEDIN_CLIENT_SECRET", ""), f"{BACKEND_URL}/oauth/linkedin/callback"),
        "twitter": (os.getenv("X_CLIENT_ID", ""), os.getenv("X_CLIENT_SECRET", ""), f"{BACKEND_URL}/oauth/twitter/callback"),
    }
    return config[platform]


def _save_state(platform: str, intent: str, session_id: str, verifier: str | None = None) -> str:
    state = secrets.token_urlsafe(32)
    conn = _db()
    conn.execute("DELETE FROM oauth_states WHERE created_at < ?", (int(time.time()) - 900,))
    conn.execute("INSERT INTO oauth_states(state, platform, intent, verifier, created_at, session_id) VALUES (?, ?, ?, ?, ?, ?)",
                 (state, platform, intent, verifier, int(time.time()), session_id))
    conn.commit()
    conn.close()
    return state


def _consume_state(state: str, platform: str) -> tuple[str, str | None, str]:
    conn = _db()
    row = conn.execute("SELECT * FROM oauth_states WHERE state=?", (state,)).fetchone()
    if row:
        conn.execute("DELETE FROM oauth_states WHERE state=?", (state,))
        conn.commit()
    conn.close()
    if not row or row["platform"] != platform or int(time.time()) - row["created_at"] > 900 or not row["session_id"]:
        raise HTTPException(400, "OAuth state is invalid or expired. Please connect again.")
    return row["intent"], row["verifier"], row["session_id"]


def _store_account(session_id: str, platform: str, account_id: str, name: str, tokens: dict[str, Any], metadata: dict[str, Any] | None = None) -> None:
    conn = _db()
    now = datetime.now(timezone.utc).isoformat()
    expires_at = int(time.time()) + int(tokens.get("expires_in", 0)) if tokens.get("expires_in") else None
    conn.execute("""
      INSERT INTO oauth_accounts(id, session_id, platform, account_id, account_name, encrypted_tokens, expires_at, metadata, connected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, platform, account_id) DO UPDATE SET
        account_name=excluded.account_name, encrypted_tokens=excluded.encrypted_tokens,
        expires_at=excluded.expires_at, metadata=excluded.metadata, connected_at=excluded.connected_at
    """, (secrets.token_hex(12), session_id, platform, account_id, name, _encrypt(tokens), expires_at, json.dumps(metadata or {}), now))
    conn.commit()
    conn.close()


def list_accounts(session_id: str) -> list[dict[str, Any]]:
    conn = _db()
    rows = conn.execute("SELECT id, platform, account_id, account_name, connected_at, expires_at FROM oauth_accounts WHERE session_id=? ORDER BY connected_at DESC", (session_id,)).fetchall()
    conn.close()
    return [dict(row) | {"connected": True, "auth_method": "oauth"} for row in rows]


def delete_account(session_id: str, account_id: str) -> bool:
    conn = _db()
    cur = conn.execute("DELETE FROM oauth_accounts WHERE session_id=? AND id=?", (session_id, account_id))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def _account(session_id: str, platform: str, account_id: str | None = None) -> sqlite3.Row:
    conn = _db()
    if account_id:
        row = conn.execute("SELECT * FROM oauth_accounts WHERE session_id=? AND platform=? AND id=?", (session_id, platform, account_id)).fetchone()
    else:
        row = conn.execute("SELECT * FROM oauth_accounts WHERE session_id=? AND platform=? ORDER BY connected_at DESC LIMIT 1", (session_id, platform)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(409, f"No {platform} account is connected in this browser session. Connect it from Social Accounts first.")
    return row


async def _post_token(url: str, data: dict[str, Any], auth: tuple[str, str] | None = None) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=25) as client:
        response = await client.post(url, data=data, auth=auth)
    if response.is_error:
        raise HTTPException(502, f"OAuth token exchange failed ({response.status_code}): {response.text[:500]}")
    return response.json()


@router.get("/config")
async def oauth_config():
    return {
        "configured": {
            "meta": bool(os.getenv("META_APP_ID") and os.getenv("META_APP_SECRET")),
            "linkedin": bool(os.getenv("LINKEDIN_CLIENT_ID") and os.getenv("LINKEDIN_CLIENT_SECRET")),
            "twitter": bool(os.getenv("X_CLIENT_ID") and os.getenv("X_CLIENT_SECRET")),
            "encryption": bool(os.getenv("SOCIAL_TOKEN_ENCRYPTION_KEY")),
        },
        "redirect_uris": {
            "meta": f"{BACKEND_URL}/oauth/meta/callback",
            "linkedin": f"{BACKEND_URL}/oauth/linkedin/callback",
            "twitter": f"{BACKEND_URL}/oauth/twitter/callback",
        },
        "note": "Instagram and Facebook use the same Meta authorization. Only Professional Instagram accounts linked to a Facebook Page can be published through this integration.",
    }


@router.get("/session")
async def oauth_session(request: Request, response: Response):
    get_guest_session(request, response)
    return {"session_ready": True, "expires_in_days": 30}


@router.get("/accounts")
async def oauth_accounts(request: Request, response: Response):
    return list_accounts(get_guest_session(request, response))


@router.get("/{platform}/start")
async def oauth_start(platform: str, request: Request, response: Response, intent: str | None = Query(default=None)):
    platform = platform.lower()
    if platform not in PLATFORMS:
        raise HTTPException(404, "Unsupported social platform")
    provider = "meta" if platform in {"instagram", "facebook"} else platform
    client_id, client_secret, redirect_uri = _client(provider)
    if not client_id or not client_secret:
        raise HTTPException(503, f"Set the {provider.upper()} OAuth client ID and secret in the backend environment first.")
    _cipher()  # fail before redirect if encryption has not been configured
    session_id = get_guest_session(request, response)
    state = _save_state(provider, platform, session_id)
    if provider == "meta":
        params = {
            "client_id": client_id, "redirect_uri": redirect_uri, "state": state,
            "response_type": "code",
            "scope": "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish",
        }
        url = f"https://www.facebook.com/{META_VERSION}/dialog/oauth?{urlencode(params)}"
    elif provider == "linkedin":
        params = {
            "response_type": "code", "client_id": client_id, "redirect_uri": redirect_uri,
            "state": state, "scope": "openid profile w_member_social",
        }
        url = f"https://www.linkedin.com/oauth/v2/authorization?{urlencode(params)}"
    else:
        verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        conn = _db()
        conn.execute("UPDATE oauth_states SET verifier=? WHERE state=?", (verifier, state))
        conn.commit()
        conn.close()
        params = {
            "response_type": "code", "client_id": client_id, "redirect_uri": redirect_uri,
            "scope": "tweet.read tweet.write users.read offline.access",
            "state": state, "code_challenge": challenge, "code_challenge_method": "S256",
        }
        url = f"https://twitter.com/i/oauth2/authorize?{urlencode(params)}"
    return RedirectResponse(url, status_code=302)


@router.get("/meta/callback")
async def meta_callback(code: str | None = None, state: str | None = None, error: str | None = None, error_description: str | None = None):
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/social?oauth_error={urlencode({'message': error_description or error})[8:]}")
    if not code or not state:
        raise HTTPException(400, "Missing Meta authorization code or state")
    intent, _, session_id = _consume_state(state, "meta")
    app_id, app_secret, redirect_uri = _client("meta")
    token = await _post_token(f"https://graph.facebook.com/{META_VERSION}/oauth/access_token", {
        "client_id": app_id, "client_secret": app_secret, "redirect_uri": redirect_uri, "code": code,
    })
    # Exchange for a long-lived user token before discovering Page-scoped tokens.
    long_token = await _post_token(f"https://graph.facebook.com/{META_VERSION}/oauth/access_token", {
        "grant_type": "fb_exchange_token", "client_id": app_id, "client_secret": app_secret,
        "fb_exchange_token": token["access_token"],
    })
    user_token = long_token["access_token"]
    async with httpx.AsyncClient(timeout=25) as client:
        response = await client.get(f"https://graph.facebook.com/{META_VERSION}/me/accounts", params={
            "fields": "id,name,access_token,instagram_business_account", "access_token": user_token,
        })
    if response.is_error:
        raise HTTPException(502, f"Could not retrieve managed Meta Pages: {response.text[:400]}")
    pages = response.json().get("data", [])
    saved = 0
    for page in pages:
        page_token = {"access_token": page["access_token"], "token_type": "bearer"}
        if intent == "facebook":
            _store_account(session_id, "facebook", page["id"], page["name"], page_token, {"page_id": page["id"]})
            saved += 1
        if intent == "instagram" and page.get("instagram_business_account", {}).get("id"):
            ig_id = page["instagram_business_account"]["id"]
            _store_account(session_id, "instagram", ig_id, f"{page['name']} · Instagram", page_token, {"ig_user_id": ig_id, "page_id": page["id"]})
            saved += 1
    if not saved:
        reason = "No Facebook Pages were found for this account." if not pages else "No linked Instagram Professional account was found on your managed Pages."
        return RedirectResponse(f"{FRONTEND_URL}/social?oauth_error={urlencode({'message': reason})[8:]}")
    return RedirectResponse(f"{FRONTEND_URL}/social?connected={intent}&count={saved}")


@router.get("/linkedin/callback")
async def linkedin_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/social?oauth_error={error}")
    if not code or not state:
        raise HTTPException(400, "Missing LinkedIn authorization code or state")
    _, _, session_id = _consume_state(state, "linkedin")
    client_id, client_secret, redirect_uri = _client("linkedin")
    tokens = await _post_token("https://www.linkedin.com/oauth/v2/accessToken", {
        "grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri,
        "client_id": client_id, "client_secret": client_secret,
    })
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get("https://api.linkedin.com/v2/userinfo", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    if response.is_error:
        raise HTTPException(502, f"LinkedIn profile lookup failed: {response.text[:400]}")
    profile = response.json()
    person_id = profile["sub"]
    name = " ".join(filter(None, [profile.get("given_name"), profile.get("family_name")])) or profile.get("name") or "LinkedIn member"
    _store_account(session_id, "linkedin", person_id, name, tokens, {"author_urn": f"urn:li:person:{person_id}"})
    return RedirectResponse(f"{FRONTEND_URL}/social?connected=linkedin")


@router.get("/twitter/callback")
async def twitter_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        return RedirectResponse(f"{FRONTEND_URL}/social?oauth_error={error}")
    if not code or not state:
        raise HTTPException(400, "Missing X authorization code or state")
    _, verifier, session_id = _consume_state(state, "twitter")
    if not verifier:
        raise HTTPException(400, "Missing PKCE verifier. Please connect X again.")
    client_id, client_secret, redirect_uri = _client("twitter")
    tokens = await _post_token("https://api.x.com/2/oauth2/token", {
        "grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri,
        "code_verifier": verifier,
    }, auth=(client_id, client_secret))
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get("https://api.x.com/2/users/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    if response.is_error:
        raise HTTPException(502, f"X profile lookup failed: {response.text[:400]}")
    profile = response.json().get("data", {})
    _store_account(session_id, "twitter", profile["id"], f"@{profile.get('username', profile['id'])}", tokens, {"username": profile.get("username")})
    return RedirectResponse(f"{FRONTEND_URL}/social?connected=twitter")


async def _refresh_if_needed(session_id: str, row: sqlite3.Row, tokens: dict[str, Any]) -> dict[str, Any]:
    if not row["expires_at"] or row["expires_at"] > int(time.time()) + 180:
        return tokens
    platform = row["platform"]
    if platform == "twitter" and tokens.get("refresh_token"):
        client_id, client_secret, _ = _client("twitter")
        refreshed = await _post_token("https://api.x.com/2/oauth2/token", {
            "grant_type": "refresh_token", "refresh_token": tokens["refresh_token"],
        }, auth=(client_id, client_secret))
        tokens.update(refreshed)
        _store_account(session_id, platform, row["account_id"], row["account_name"], tokens, json.loads(row["metadata"]))
        return tokens
    if platform == "linkedin" and tokens.get("refresh_token"):
        client_id, client_secret, _ = _client("linkedin")
        refreshed = await _post_token("https://www.linkedin.com/oauth/v2/accessToken", {
            "grant_type": "refresh_token", "refresh_token": tokens["refresh_token"],
            "client_id": client_id, "client_secret": client_secret,
        })
        tokens.update(refreshed)
        _store_account(session_id, platform, row["account_id"], row["account_name"], tokens, json.loads(row["metadata"]))
        return tokens
    raise HTTPException(409, f"The {platform} access token has expired. Disconnect and reconnect the account.")


def _record_event(session_id: str, campaign_id: str, platform: str, account_id: str | None, result: dict[str, Any]) -> None:
    conn = _db()
    conn.execute(
        "INSERT INTO publish_events(id, campaign_id, platform, account_id, status, post_id, post_url, error, created_at, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (secrets.token_hex(12), campaign_id, platform, account_id,
         "published" if result.get("success") else "failed", result.get("post_id"),
         result.get("url"), result.get("error"), datetime.now(timezone.utc).isoformat(), session_id),
    )
    conn.commit()
    conn.close()


async def publish_to_platform(session_id: str, platform: str, content: dict[str, Any], campaign_id: str, media_url: str | None = None, account_id: str | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {"platform": platform, "success": False, "post_id": None, "url": None, "error": None}
    row = None
    try:
        row = _account(session_id, platform, account_id)
        tokens = await _refresh_if_needed(session_id, row, _decrypt(row["encrypted_tokens"]))
        token = tokens["access_token"]
        body = content.get("body", "").strip()
        hashtags = content.get("hashtags") or []
        caption = body + (("\n\n" + " ".join(hashtags)) if hashtags else "")
        async with httpx.AsyncClient(timeout=45) as client:
            if platform == "twitter":
                response = await client.post("https://api.x.com/2/tweets", json={"text": caption[:280]}, headers={"Authorization": f"Bearer {token}"})
                data = response.json() if response.content else {}
                if response.is_error:
                    raise RuntimeError(f"X API {response.status_code}: {data}")
                post_id = data.get("data", {}).get("id")
                username = json.loads(row["metadata"]).get("username")
                result.update(success=True, post_id=post_id, url=f"https://x.com/{username}/status/{post_id}" if username else f"https://x.com/i/status/{post_id}")
            elif platform == "linkedin":
                author = json.loads(row["metadata"])["author_urn"]
                response = await client.post("https://api.linkedin.com/rest/posts", json={
                    "author": author, "commentary": caption, "visibility": "PUBLIC",
                    "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
                    "lifecycleState": "PUBLISHED",
                }, headers={
                    "Authorization": f"Bearer {token}", "LinkedIn-Version": os.getenv("LINKEDIN_API_VERSION", "202610"),
                    "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json",
                })
                if response.is_error:
                    raise RuntimeError(f"LinkedIn API {response.status_code}: {response.text[:500]}")
                post_id = response.headers.get("x-restli-id", "")
                result.update(success=True, post_id=post_id, url=f"https://www.linkedin.com/feed/update/{post_id}" if post_id else None)
            elif platform == "facebook":
                page_id = json.loads(row["metadata"])["page_id"]
                response = await client.post(f"https://graph.facebook.com/{META_VERSION}/{page_id}/feed", data={"message": caption, "access_token": token})
                data = response.json()
                if response.is_error or data.get("error"):
                    raise RuntimeError(f"Meta API: {data.get('error', {}).get('message', response.text[:500])}")
                post_id = data.get("id")
                result.update(success=True, post_id=post_id, url=f"https://www.facebook.com/{post_id}")
            elif platform == "instagram":
                if not media_url or not media_url.startswith("https://"):
                    raise ValueError("Instagram image posts require a publicly accessible HTTPS image URL. Add one before publishing.")
                ig_id = json.loads(row["metadata"])["ig_user_id"]
                create = await client.post(f"https://graph.facebook.com/{META_VERSION}/{ig_id}/media", data={
                    "image_url": media_url, "caption": caption, "access_token": token,
                })
                container = create.json()
                if create.is_error or container.get("error"):
                    raise RuntimeError(f"Instagram media creation failed: {container.get('error', {}).get('message', create.text[:500])}")
                publish = await client.post(f"https://graph.facebook.com/{META_VERSION}/{ig_id}/media_publish", data={
                    "creation_id": container["id"], "access_token": token,
                })
                published = publish.json()
                if publish.is_error or published.get("error"):
                    raise RuntimeError(f"Instagram publish failed: {published.get('error', {}).get('message', publish.text[:500])}")
                post_id = published.get("id")
                permalink = await client.get(f"https://graph.facebook.com/{META_VERSION}/{post_id}", params={"fields": "permalink", "access_token": token})
                result.update(success=True, post_id=post_id, url=permalink.json().get("permalink") if not permalink.is_error else None)
        _record_event(session_id, campaign_id, platform, row["id"] if row else None, result)
        return result
    except Exception as exc:
        result["error"] = str(exc)
        _record_event(session_id, campaign_id, platform, row["id"] if row else None, result)
        return result


@router.get("/publishing/history")
async def publishing_history(request: Request, response: Response, campaign_id: str | None = None):
    session_id = get_guest_session(request, response)
    conn = _db()
    if campaign_id:
        rows = conn.execute("SELECT * FROM publish_events WHERE session_id=? AND campaign_id=? ORDER BY created_at DESC", (session_id, campaign_id)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM publish_events WHERE session_id=? ORDER BY created_at DESC LIMIT 100", (session_id,)).fetchall()
    conn.close()
    return [dict(row) for row in rows]
