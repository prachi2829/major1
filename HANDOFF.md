# HANDOFF — Campaign.AI (give this to any AI/dev to continue)

## What exists (all working)
- `backend/` FastAPI app, 13 passing pytest tests. Agents: StrategyAgent, ContentAgent, Orchestrator in `app/agents.py`. Gemini REST client in `app/ai_service.py` (raises `GeminiError`; API returns the message as `detail`; NO fallback by design; loads `backend/.env`). SQLite store in `app/store.py` (same interface as the old in-memory one; `CAMPAIGN_DB` env var; tests use `:memory:` via `tests/conftest.py`). Analytics simulator in `app/analytics.py` (deterministic, labeled simulated).
- `frontend/` React 18 + Vite + react-router. Pages: Analytics (overview + per-campaign KPIs, SVG line/bar charts), Landing (editorial design, animated interactive pipeline diagram), Create (validated form), Dashboard, Workspace (strategy → content → live edit w/ debounced PATCH → approve → simulated publish). `npm run build` passes.
- Design language (inspired by earthswinweb.vercel.app): warm paper background with dot grid, Fraunces serif headings with italic accent words, JetBrains Mono eyebrows, numbered steps, interactive block diagram with animated data dots, status list, spec table. All CSS in `frontend/src/styles.css` (CSS variables at top).

## Not built / verify
- Real Gemini calls untested with a live key (mocked in tests). Model default `gemini-2.5-flash` via env `GEMINI_MODEL`.
- Browser click-through (Playwright + system Chrome, Gemini stubbed) passes with zero page errors. Still do a visual pass at phone widths.
- Fixed bug: a `useEffect` returning `window.scrollTo()` crashed the app on navigation (blank page).
- The user's ORIGINAL code at localhost:5173 was not accessible; this is a fresh rebuild from their written spec. If their old code has extra pieces, merge selectively.
- Publishing is simulated by design. Real platform APIs = Phase 2.

## Suggested next tasks
1. Run both servers, click through the full flow, fix any visual issues.
2. Remaining Phase 2: scheduling (APScheduler job publishing approved posts when due), AI feedback loop (send metrics report to Gemini, show suggestions), real platform APIs, auth.
3. Replace simulated metrics with manual entry or real API ingestion; keep the `metrics` table shape.
4. Add frontend tests (Vitest + Testing Library) for Create validation and Workspace edit flow.

## Contracts to keep stable
`Strategy {campaign_goal, core_message, content_pillars[], messaging_approach, call_to_action, campaign_direction, source}`
`PlatformContent {platform, headline, body, hashtags[], call_to_action, status: draft|approved|published, edited, published_at, source}`
Status gates: content needs strategy; publish needs approved; published is locked; editing resets approval.
