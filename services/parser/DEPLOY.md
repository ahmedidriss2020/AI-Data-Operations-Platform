# Deploying the AnalyzeIt Parser (Step B — full data analysis)

The parser (`services/parser`) is the compute brain: it parses messy XLSX
(openpyxl), runs DuckDB SQL and Polars over uploaded statements, and serves the
chat's data-grounded tools. It **cannot** run on Vercel (native deps + in-memory
state), so it is hosted as its own container. Once it is live, set
`HERMES_AGENT_ENDPOINT` in Vercel and chat auto-upgrades from conversational to
full analysis — no code change.

This was validated locally from a clean install (fresh venv → requirements.txt →
uvicorn on an injected `$PORT` → `/health` + a real chat reply), so a container
build will behave the same.

## Option 1 — Render (recommended, free tier, Docker blueprint)

1. Push this repo (already done). It contains `render.yaml` + `services/parser/Dockerfile`.
2. Go to https://dashboard.render.com → **New** → **Blueprint**.
3. Connect the GitHub repo `yahyeameer/AI-Data-Operations-Platform`. Render reads
   `render.yaml` and creates the `analyzit-parser` web service.
4. When prompted, fill the secret env vars (the `sync:false` ones):
   - `OPENROUTER_API_KEY` = your OpenRouter key
   - `HERMES_API_SECRET`  = a strong shared secret you choose (`openssl rand -hex 24`)
   - `TOOL_LAYER_SECRET`  = same value as Vercel's `TOOL_LAYER_SECRET`
   - `SUPABASE_SECRET_KEY` = the `sb_secret_...` service-role key
   (`OPENROUTER_BASE_URL`, `MODEL_PRIMARY`, `MODEL_SECONDARY`, `SUPABASE_URL` are
   already set in `render.yaml`.)
5. Deploy. When it's live, copy the service URL, e.g.
   `https://analyzit-parser.onrender.com`.
6. Verify: open `<url>/health` — you should see `{"status":"healthy",...}`.

## Option 2 — Railway

1. https://railway.app → **New Project** → **Deploy from GitHub repo**.
2. Select the repo; set **Root Directory** to `services/parser` (Railway detects
   the Dockerfile).
3. Add the same env vars as above (Variables tab). Railway injects `$PORT`; the
   Dockerfile already binds to it.
4. Deploy, then **Settings → Networking → Generate Domain** for a public HTTPS URL.
5. Verify `<url>/health`.

## Wire Vercel to the hosted parser

In Vercel → your project → **Settings → Environment Variables** (Production +
Preview), add:

- `HERMES_AGENT_ENDPOINT` = the parser URL from above (no trailing slash)
- `HERMES_API_SECRET`     = the SAME value you set on the parser

Then **Redeploy** (env changes need a redeploy). Now `isHermesConfigured()` is
true and chat routes to the parser for full DuckDB/Polars analysis. Confirm on
`/api/hermes/health` (authenticated): `reachable:true`, and a chat turn that asks
for a figure now returns a computed number instead of asking for an upload.

## Free-tier note
Render/Railway free instances sleep after idle and cold-start in ~30–60s, so the
first chat after a quiet period is slow. Fine for pilot; upgrade to an
always-on instance before onboarding paying firms.
