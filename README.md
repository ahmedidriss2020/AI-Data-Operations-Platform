# AnalyzeIt — AI Data Operations Platform

A workflow-learning data-operations copilot for accounting practices. AnalyzeIt learns a client's recurring data workflow once, turns it into a versioned executable recipe, and from then on surfaces only the exceptions. See [`AI_Data_Operations_PRD_v2.md`](./AI_Data_Operations_PRD_v2.md) for the full product specification.

**Current State**: Full UI/UX Pro Max OLED Dark rebrand complete (`AnalyzeIt`). Database migrated to remote Supabase project `ai data operation seystem`. 24/7 Hermes agent Hostinger integration spec completed in [`HERMES_HOSTINGER_DEPLOYMENT.md`](./HERMES_HOSTINGER_DEPLOYMENT.md).

---

## 🏗️ Architecture

```
 ┌──────────────────────────────────────┐                     ┌──────────────────────────────────────┐
 │       Hostinger VPS (24/7)           │                     │        AnalyzeIt Dashboard (Next.js)  │
 │                                      │   HTTP / Webhooks   │                                      │
 │   • Hermes Agent (FastAPI / Python)  │ ──────────────────> │   • Next.js App (apps/web)           │
 │   • PM2 Daemon / Systemd Service     │ <────────────────── │   • Supabase Postgres DB             │
 │   • DuckDB / Polars Execution        │  Tool Contract Calls│   • Supabase Storage (Raw / Parquet) │
 └──────────────────────────────────────┘                     └──────────────────────────────────────┘
```

```
apps/web/           Next.js 16 App Router application (AnalyzeIt Dashboard UI)
services/parser/    Python workbook parser service
supabase/           Supabase config + SQL migrations
scripts/            Test suites and fixture generation
fixtures/messy/     Deliberately messy workbooks (PRD section 6)
```

---

## ⚡ Quick Start

Requires Node 22+, Docker Desktop (optional if connecting to remote Supabase), and Python 3.

```bash
# 1. Install dependencies
npm install
npm --prefix apps/web install

# 2. Configure Environment (.env.local in apps/web)
NEXT_PUBLIC_SUPABASE_URL=https://jweclsvkndyvltchnbcl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_JY2wD5RWkxDH2TCjvhOlVw_ybsoGf2r
HERMES_AGENT_ENDPOINT=http://YOUR_HOSTINGER_VPS_IP:8000
HERMES_API_SECRET=<set-in-.env.local-only>

# 3. Start AnalyzeIt Dashboard
npm run dev                 # http://127.0.0.1:3100
```

---

## 🤖 24/7 Hermes Agent Hosting (Hostinger VPS)

Hermes Agent runs continuously on a Hostinger VPS to process messy client workbooks autonomously. See [`HERMES_HOSTINGER_DEPLOYMENT.md`](./HERMES_HOSTINGER_DEPLOYMENT.md) for full setup instructions:

```bash
# Hostinger VPS Quick Commands
pm2 start "venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000" --name "hermes-agent"
pm2 logs hermes-agent
```

---

## 🧪 Tests & Quality Controls

```bash
npm run test:isolation      # Cross-tenant isolation + append-only database triggers
npm run test:e2e            # Full upload & API authorization flow test
```

---

## 🎨 UI/UX Features (UI Pro Max Upgrade)

- **OLED Dark Mode**: Deep slate surfaces (`#020617`), high contrast typography, and emerald indicator glows (`#10b981`).
- **Interactive Dropzone**: Drag-and-drop workbook upload with SHA-256 fingerprinting and progress bars.
- **Sidebar Shell**: Practice firm selector, workspace navigation, and active role badges.
- **KPI Metrics Overview**: Workspaces, active recipes, automation rate %, and immutable lineage indicators.
