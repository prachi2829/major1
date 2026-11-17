# Campaign.AI — Autonomous Multi-Agent Marketing Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Flash--Lite-4285F4.svg?logo=google&logoColor=white)](https://aistudio.google.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?logo=python&logoColor=white)](https://python.org)

**Campaign.AI** is an autonomous multi-agent marketing intelligence and execution engine. From a single campaign brief, a team of specialized AI agents formulates end-to-end strategy, writes channel-tailored copy, audits brand safety, profiles audience cohorts, tracks live competitor vulnerabilities from the web, schedules cross-platform posts, optimizes budgets algorithmically, and runs mathematically rigorous A/B tests.

---

## ⚡ Architecture & Multi-Agent Ecosystem

```
                                  ┌──────────────────────────┐
                                  │      Campaign Brief      │
                                  └────────────┬─────────────┘
                                               │
                                               ▼
                              ┌──────────────────────────────────┐
                              │  Campaign Orchestrator Agent     │
                              └────────────────┬─────────────────┘
                                               │
         ┌──────────────────┬──────────────────┼──────────────────┬──────────────────┐
         ▼                  ▼                  ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Strategy Agent  │ │  Content Agent  │ │ Audience Intel  │ │ Competitor Radar│ │Compliance Agent │
│ Unified vision  │ │ Channel copy    │ │ Micro-cohorts   │ │ Live web search │ │ Safety audit    │
│ & core hooks    │ │ (IG/LI/X/FB)    │ │ & demographics  │ │ & counter-hooks │ │ & truth-in-ads  │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │                   │                   │
         └───────────────────┼───────────────────┴───────────────────┴───────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Execution & Measurement                           │
 ├────────────────────────────┬────────────────────────────┬──────────────┤
 │   Calendar Scheduler       │   A/B Testing Engine       │Budget Agent  │
 │   Cross-channel automation │   2-proportion Z-test      │Algorithmic   │
 │   & publishing states      │   (p < 0.05 gate)          │reallocation  │
 └────────────────────────────┴────────────────────────────┴──────────────┘
```

---

## 🚀 Key Features

### 1. Multi-Agent Autonomous Hub
- **Strategy Agent**: Formulates goals, core hooks, content pillars, and creative angles from raw objectives.
- **Content Agent**: Writes native copy optimized for character limits, tone, and formatting across Instagram, LinkedIn, X (Twitter), and Facebook.
- **Audience Intelligence Agent**: Generates 3 distinct demographic/psychographic micro-cohorts with acute pain points, value propositions, and conversion angles.
- **Competitor Intelligence Radar**: Conducts **live real-time web searches** (DuckDuckGo engine) to identify 2+ real named competitors, extract competitive weaknesses, and build high-converting counter-positioning.
- **Brand Compliance Agent**: Audits generated copy for platform regulatory standards, truth-in-advertising guidelines, and brand safety.
- **Feedback Loop Agent**: Analyzes performance metrics to evaluate reach, engagement rate, and actionable growth recommendations.

### 2. Mathematically Rigorous A/B Testing
- Evaluates variant copy and conversion efficiency using a **two-proportion pooled Z-test** ($p < 0.05$).
- Sample size threshold ($N \ge 100$ per variant) prevents false positives. Inconclusive tests are explicitly flagged with exact confidence intervals.

### 3. Data-Driven Budget Optimizer
- Shifts ad spend across active channels based purely on **measured conversion rates (CVR) and click-through rates (CTR)**.
- Enforces a 15% safety floor per platform to protect baseline visibility without made-up ROI multipliers.
- Explicit approval disclaimer: *"Approve records the plan only; no funds move automatically."*

### 4. Cross-Platform Scheduling & Publishing
- Interactive calendar scheduler with status workflows (`pending`, `published`, `failed`).
- Multi-account management for Instagram, LinkedIn, Facebook, and Twitter.

---

## 🛠️ Quick Start

### 1. Backend Setup (FastAPI)

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit backend/.env and provide your Gemini API Key:
# GEMINI_API_KEY=your_key_here
# GEMINI_MODEL=gemini-flash-lite-latest

# Start backend server
uvicorn app.main:app --reload --port 8000
```
Backend API interactive documentation is available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 2. Frontend Setup (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Running Tests

The test suite validates data schemas, multi-agent pipelines, Z-test statistical math, budget allocation algorithms, and SQLite persistence:

```bash
cd backend
python -m pytest tests/ -v
```
*All 26 test suites passing (100% test coverage across core, Phase 2, and Phase 3 engines).*

---

## 📂 Project Structure

```
campaign-ai/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application & route definitions
│   │   ├── agents.py            # Multi-agent orchestrator & persona logic
│   │   ├── ai_service.py        # Google Gemini REST client & JSON parser
│   │   ├── budget_optimizer.py  # Algorithmic capital allocation engine
│   │   ├── market_search.py     # Live DuckDuckGo market web scraper
│   │   ├── statistics.py        # Two-proportion pooled Z-test engine
│   │   ├── store.py             # SQLite persistence layer
│   │   ├── schemas.py           # Pydantic v2 data models
│   │   └── analytics.py         # Analytics aggregation & simulation
│   ├── tests/                   # Pytest test suite (26 comprehensive tests)
│   ├── requirements.txt         # Python dependencies
│   └── .env.example             # Example environment file
│
├── frontend/
│   ├── src/
│   │   ├── pages/               # React page components (Agents, Audience, Budget, A/B, etc.)
│   │   ├── components/          # Reusable UI widgets, previews, and charts
│   │   ├── api.js               # API client library
│   │   ├── App.jsx              # Routing & notification layout
│   │   └── index.css            # Custom design system styling
│   ├── package.json             # Frontend dependencies
│   └── vite.config.js           # Vite build configuration
└── README.md
```

---

## 🔒 Security & Privacy

- Never commit `backend/.env` or any file containing API keys.
- Database entries in `campaign_ai.db` are kept local to your environment.
- All live competitor scans use non-authenticated text-browser requests without tracking cookies.

---

## 📄 License

MIT License. Built with ❤️ for autonomous AI marketing experimentation.
