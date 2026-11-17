# HANDOFF — Campaign.AI (give this to any AI/dev to continue)

## What exists (all working)
- `backend/` FastAPI app, 13 passing pytest tests. Agents: StrategyAgent, ContentAgent, Orchestrator in `app/agents.py`. Gemini REST client in `app/ai_service.py` (raises `GeminiError`; API returns the message as `detail`; NO fallback by design; loads `backend/.env`). SQLite store in `app/store.py` (same interface as the old in-memory one; `CAMPAIGN_DB` env var; tests use `:memory:` via `tests/conftest.py`). Analytics simulator in `app/analytics.py` (deterministic, labeled simulated).
- `frontend/` React 18 + Vite + react-router. Pages: Analytics (overview + per-campaign KPIs, SVG line/bar charts), Landing (editorial design, animated interactive pipeline diagram), Create (validated form), Dashboard, Workspace (strategy → content → live edit w/ debounced PATCH → approve → OAuth-backed publish with per-platform results). `npm run build` passes.
- Design language (inspired by earthswinweb.vercel.app): warm paper background with dot grid, Fraunces serif headings with italic accent words, JetBrains Mono eyebrows, numbered steps, interactive block diagram with animated data dots, status list, spec table. All CSS in `frontend/src/styles.css` (CSS variables at top).

## Not built / verify
- Real Gemini calls untested with a live key (mocked in tests). Model default `gemini-2.5-flash` via env `GEMINI_MODEL`.
- Browser click-through (Playwright + system Chrome, Gemini stubbed) passes with zero page errors. Still do a visual pass at phone widths.
- Fixed bug: a `useEffect` returning `window.scrollTo()` crashed the app on navigation (blank page).
- The user's ORIGINAL code at localhost:5173 was not accessible; this is a fresh rebuild from their written spec. If their old code has extra pieces, merge selectively.
- Real OAuth publishing is implemented on `main`: encrypted token storage, Meta OAuth for Facebook Pages / Instagram Professional accounts, LinkedIn member OAuth, X OAuth 2.0 PKCE, real publish calls, publish history, and scheduled publishing through the same adapters. Setup guide: `backend/OAUTH_SETUP.md`.
- Live provider posting has not been end-to-end tested because it requires real developer apps, approved scopes, callback URLs, credentials, and authorized social accounts. Tests should mock network calls.
- This repo has no end-user auth/tenant isolation: connected social accounts are shared by this single workspace. Do not deploy as a multi-tenant service without user ownership and endpoint authorization.

## Suggested next tasks
1. Run both servers, click through the full flow, fix any visual issues.
2. Remaining: add application authentication and per-user account ownership; add LinkedIn organization posting; expand Instagram beyond public-image feed posts; add end-to-end provider sandbox tests and production hardening.
3. Replace simulated metrics with manual entry or real API ingestion; keep the `metrics` table shape.
4. Add frontend tests (Vitest + Testing Library) for Create validation and Workspace edit flow.

## Contracts to keep stable
`Strategy {campaign_goal, core_message, content_pillars[], messaging_approach, call_to_action, campaign_direction, source}`
`PlatformContent {platform, headline, body, hashtags[], call_to_action, status: draft|approved|published, edited, published_at, source}`
Status gates: content needs strategy; publish needs approved; published is locked; editing resets approval.


## Anonymous guest social sessions
- Branch `feat/guest-session-social-isolation` adds anonymous browser sessions with HttpOnly/SameSite cookies, server-side hashed session tokens, 30-day rolling expiry, OAuth-state binding, and per-session account/token/publishing-history isolation.
- Social publishing and scheduled posts use the owning guest session. Clearing browser cookies ends access to that session.
- Campaign records and some other app data remain in the shared campaign store; this is not yet full multi-tenant privacy. Scope campaigns, schedules, analytics, and all related endpoints before positioning the entire app as a private multi-user SaaS.
