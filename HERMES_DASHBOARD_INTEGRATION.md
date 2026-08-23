# Connecting the Hostinger Hermes Agent to the AnalyzeIt Dashboard

How the managed Hermes Agent on Hostinger is wired to the AnalyzeIt dashboard,
per PRD v3 §§3, 4, 7 and 11.

---

## 1. The shape of the connection

```
browser ──► AnalyzeIt route handler ──► Hermes (Hostinger) ──► controlled tool layer
             (proves access)             (reasons, calls tools)   (authorizes, executes)
                                                                        │
                                                            Supabase / DuckDB / Polars
```

The browser never talks to Hermes. It talks to `/api/hermes/*` on your own
Next.js app, which proves the caller's workspace access *before* forwarding
anything. Three consequences worth stating plainly:

- **The Hermes secret and the OpenRouter key never leave the server.**
  `apps/web/src/lib/hermes.ts` imports `server-only`, so importing it from a
  client component is a build error rather than a silent secret leak.
- **The workspace id from the browser is a claim, not a fact,** until
  `requireWorkspaceAccess` has run. That check is the tenant boundary.
- **Hermes gets no direct Supabase access** (§7). It calls the controlled tool
  layer, which re-authorizes org → workspace → client on every operation.

---

## 2. Configure the agent (Hostinger side)

In **hPanel → AI automation apps → Hermes Agent**:

1. Note the app's public URL, or the CLI-exposed port if you front it yourself.
2. Set an API secret that Hermes will require on inbound calls. Generate a
   fresh one — never reuse a value that has appeared in a repo or a chat:

   ```bash
   openssl rand -hex 32
   ```

3. Expose (or confirm) these endpoints on the agent:

   | Method | Path | Purpose |
   |---|---|---|
   | `GET`  | `/health` | Liveness for the sidebar indicator |
   | `POST` | `/api/v1/chat` | One chat turn, workspace-scoped |
   | `POST` | `/api/v1/tools/{tool}` | One tool from the §7 contract |

**Reasoning provider.** The Hostinger AI-provider panel offers a fixed list
(nexos.ai, OpenAI, Anthropic, Gemini) with no custom base-URL field, so
OpenRouter cannot be selected there. Per PRD v3 §11.1 the OpenRouter call is
made by the AnalyzeIt backend / tool layer, which owns `OPENROUTER_API_KEY`
and the routing. Hermes stays an orchestration runtime.

---

## 3. Configure the dashboard (AnalyzeIt side)

In `apps/web/.env.local` (and in your host's environment settings):

```env
HERMES_AGENT_ENDPOINT=https://your-hermes-app-url
HERMES_API_SECRET=<the secret from step 2 — server-side only>

OPENROUTER_API_KEY=<server-side only>
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
MODEL_PRIMARY=google/gemini-3.7-flash
MODEL_SECONDARY=moonshotai/kimi-k3
MODEL_BATCH=google/gemini-3.7-flash:batch
```

None of these carry the `NEXT_PUBLIC_` prefix, and none of them ever should —
that prefix is what inlines a value into the browser bundle.

---

## 4. Verify

```bash
# 1. The agent is up (from your machine, not the browser)
curl -H "Authorization: Bearer $HERMES_API_SECRET" https://your-hermes-app-url/health
# → {"status":"healthy","uptime":"...","queue_depth":0,"active_workers":1}

# 2. The dashboard can see it — sign in first, then:
#    the sidebar badge under the nav should read "Hermes Agent · Online"

# 3. End to end
#    /app/chat → pick a workspace → ask a question
```

If the badge reads **Not connected**, the endpoint or secret is unset. If it
reads **Offline**, the values are set but the agent did not answer — check
`pm2 logs` on the Hostinger side, or the app's Logs tab.

---

## 5. What the dashboard exposes, and what it must not

PRD v3 §4 separates the two consoles, and the split is a product requirement,
not a preference:

| Surface | Shows | Audience |
|---|---|---|
| **Hostinger Hermes dashboard** | Skills, agent config, experiments, swarm agents, runtime logs, model keys | Operator only |
| **AnalyzeIt dashboard** | Chat, uploads, recipes, exception review, reports, provenance, approvals | Accountants |

The chat page renders the agent's prose and its warnings — never tool payloads,
model names, endpoints or system prompts. Accountants must never receive Hermes
admin credentials or infrastructure controls.

---

## 6. What is wired, and what is not

**Wired:**

- `lib/hermes.ts` — authenticated bridge with timeouts, a typed
  `status`/`result`/`evidence`/`warnings`/`execution_metadata` envelope, and
  `dry_run` defaulting to `true` on every tool call
- `GET /api/hermes/health` — real liveness, feeding the sidebar indicator
- `POST /api/hermes/chat` — workspace-scoped chat turn, audited via `write_audit`
- `/app/chat` — the accountant-facing chat page

- The controlled tool layer (§7) at `POST /api/tools/{tool}`, with scoped
  delegation tokens, `dry_run` defaulting to true, evidence, and an audit row
  per call. `GET /api/tools/{anything}` lists the registered tools.

**Not yet wired** — these need the compute layer to exist:

- Twelve of the tools return an explicit `not_implemented` status naming what
  they need (the Python parser, or DuckDB/Polars). They are registered with
  their real signatures so the agent discovers the true contract and is told
  honestly that the answer is unavailable — rather than receiving a 404 that
  reads like a bug, or invented numbers, which in this product is the worst
  failure mode there is.
- Parse-on-upload. The upload path records the file, its fingerprint, its
  dataset version and the accountant's cleaning instructions; it does not yet
  invoke `parse_workbook`.

---

## 7. How a tool call is authorized

Two credentials, proving two different things:

```
Authorization: Bearer <TOOL_LAYER_SECRET>   the caller is our agent
X-AnalyzeIt-Scope: <scope token>            on whose behalf, for which workspace
```

The second is the one that carries the tenant boundary. The bearer secret alone
would let anything holding it name any workspace in the request body and read
it — so **the workspace is never read from the body.** It is derived from the
signed scope token, which the chat route mints only after
`requireWorkspaceAccess` has proven that specific human may reach that specific
workspace.

The consequence worth stating plainly: an agent that has been prompt-injected
into asking for another firm's data gets its own scope back, not the one it
asked for. It cannot widen its reach, because its reach is not something it
sends. Tokens expire in 15 minutes, since they travel through a runtime we do
not control.

`npm run test:tool-layer` exercises this boundary — forged signatures, tampered
workspace claims, expiry, and tokens from another deployment.

**`dry_run` defaults to `true`.** A caller that forgets the flag gets a preview,
not an unreviewed change to a client's financial data. Read-only tools report
`dry_run: false`, because calling a read "dry" would imply a withheld side
effect that does not exist.
