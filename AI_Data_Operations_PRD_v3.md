# AnalyzeIt — Updated PRD (v3)

**AI Data Operations Platform · UK-first accounting SaaS · 23 August 2026**

A workflow-learning data-operations copilot for accounting practices. AnalyzeIt learns a client's recurring data workflow once, turns it into a versioned executable recipe, and surfaces only material exceptions.

| | |
|---|---|
| **Product** | AnalyzeIt |
| **Primary customer** | UK accounting firms, bookkeepers and small practices |
| **Initial commercial target** | UK → selected Europe → Canada → US |
| **Core value** | Automate recurring financial-data operations while keeping accountants in control |
| **AI runtime** | Hermes Agent on Hostinger |
| **Reasoning** | Kimi K3 API, with model abstraction for future providers |
| **Data / compute** | Supabase + Supabase Storage + DuckDB + Polars |
| **Future AI runtime** | DeepSeek Harness, introduced later behind an abstraction layer after production validation |
| **Frontend** | Next.js / AnalyzeIt dashboard |
| **Status** | MVP / pilot-ready architecture |

> Supersedes `AI_Data_Operations_PRD_v2.md`. The core data engine, recipe loop and deviation model carry over unchanged; what changes is the agent runtime strategy, the reasoning provider, dashboard separation and the controlled tool boundary.

---

## 1. Product vision

AnalyzeIt is **not an autonomous accountant**. It is a workflow-learning data-operations copilot. The AI interprets messy structures, proposes mappings and explanations, and orchestrates tools. Deterministic software performs calculations and transformations. Accountants approve material changes.

The product's moat is the **recipe loop**: Month 1 teaches the system a client's workflow; Month 2 replays the approved recipe; Month 3+ surfaces only deviations and material exceptions. Recipes, mapping tables, provenance and correction history compound over time.

---

## 2. Updated architecture

```
                        ACCOUNTANT
                            │
                            ▼
              ┌──────────────────────────┐
              │  AnalyzeIt UI (Next.js)  │
              │  Chat · Data · Recipes   │
              │  Exception review        │
              └──────────────────────────┘
                            │ HTTPS
                            ▼
              ┌──────────────────────────┐
              │   AnalyzeIt Backend      │
              │   Auth · tenant policy   │
              │   Controlled tool layer  │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │   Hermes Agent           │
              │   Hostinger · 24/7       │
              └──────────────────────────┘
                            │  Kimi K3 API
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
           Parser        DuckDB        Polars
              └─────────────┼─────────────┘
                            ▼
                        Supabase
                 DB + Storage + Audit

        FUTURE, NOT MVP: Agent Gateway / Router
                   ┌───────────────┐
                Hermes      DeepSeek Harness
```

---

## 3. Hermes + Hostinger strategy

Use Hostinger's managed Hermes deployment as the **infrastructure control plane**. The operator manages Hermes configuration, skills, agents, logs and swarm experiments from the Hostinger Hermes dashboard.

AnalyzeIt **does not embed the Hermes management dashboard for customers.** AnalyzeIt exposes only its own customer-facing AI chat and business workflows, calling Hermes through a server-side authenticated API bridge.

Hermes remains the production agent runtime for the MVP. DeepSeek Harness is intentionally deferred because it is a preview technology and does not yet need to be a production dependency.

---

## 4. Dashboard separation

| Dashboard | Purpose | Audience |
|---|---|---|
| **Hostinger Hermes dashboard** | AI infrastructure / admin console — skills, agent configuration, experiments, swarm agents, logs, runtime settings | Operator only |
| **AnalyzeIt dashboard** | Customer product — chat, uploads, recipes, exception review, reports, provenance, approvals | Accountants |

Accountants must **never** receive Hermes admin credentials, model keys, system prompts or infrastructure controls.

---

## 5. Core customer workflow

```
Upload workbook / CSV
        ↓
Messy-workbook parser
        ↓
   Dataset version
        ↓
Existing recipe? ──Yes──→ Replay recipe
        │ No                    │
        ▼                       │
AI profiling + proposal         │
        └───────────┬───────────┘
                    ▼
            Deviation engine
         ┌──────────┼──────────┐
         ▼          ▼          ▼
       Auto      Review      Block
         └────┬─────┘
              ▼
      Post-run invariants
              ↓
        Clean version
              ↓
 Analytics / Reconcile / Reports
              ↓
    Provenance + audit trail
```

---

## 6. AI responsibility model

| Actor | Responsibility |
|---|---|
| **AI / Hermes** | Interpret messy structure, propose mappings, explain anomalies, translate natural language into structured tool calls, draft narratives, select workflow steps |
| **Deterministic code** | Execute transformations, arithmetic, aggregation, validation, anomaly detection, SQL/DuckDB queries, file generation |
| **Human** | Approve material changes, resolve ambiguous matches, review blocked runs, sign off on financial outputs |

**Rule: the LLM is never the source of a financial number.**

---

## 7. Controlled tool layer

Hermes **must not receive unrestricted Supabase access.** It calls a controlled AnalyzeIt tool layer. Every mutating operation supports `dry_run` and returns structured `evidence`, `warnings` and `execution_metadata`.

Initial tools:

```
parse_workbook      profile_dataset     inspect_schema      match_recipe
apply_recipe        diff_versions       detect_duplicates   detect_anomalies
normalize_values    validate_dataset    check_invariants    reconcile_sources
query_dataset       compare_periods     explain_number      generate_chart
generate_report
```

---

## 8. Supabase & data architecture

Supabase Postgres stores metadata, workflow state, lineage and audit logs. Supabase Storage stores raw uploads, Parquet datasets and exports. DuckDB queries Parquet directly; Polars performs deterministic transformations.

Dataset versions are **immutable**. Cleaning creates a new version with a parent pointer. Recipe runs pin a specific recipe version so historical runs remain auditable.

**Tenant isolation is mandatory:** every operation is authorized against organization → workspace → client before data is exposed to an agent or tool.

---

## 9. Recipe system

Recipes are first-class, user-visible, editable and versioned. Accountants can reorder, disable and dry-run steps. Human resolutions update workspace-scoped mapping tables so repeated ambiguities disappear over time.

Example recipe:

```
detect header → remove subtotals → normalize dates → normalize currency
→ trim values → normalize vendors → remove exact duplicates
→ validate required columns → compare periods
```

---

## 10. Safety & trust

**Confidence tiers** — `Auto` for reversible low-risk formatting; `Review` for ambiguous or financially meaningful changes; `Block` for missing required columns, material reconciliation failures or invariant failures.

**Materiality ranking** — prioritize the financial impact of exceptions rather than row count.

**Post-run invariants** — row-count drift, financial-total tolerance, column distribution drift, reporting-period checks, stated-total reconciliation.

**Provenance** — every displayed number traces to source rows, dataset version, SQL and recipe version.

**Privacy** — send the model schema, profile statistics and small redacted samples rather than raw customer rows wherever possible.

---

## 11. Hermes API integration

Recommended flow:

```
browser → AnalyzeIt server/API → authenticated Hermes API → Hermes tools → Supabase / DuckDB / Polars
```

Never expose the Hermes secret or the Kimi API key to the browser. Keep Hermes behind a secure domain / reverse proxy or Hostinger's managed access layer.

The frontend should know only the AnalyzeIt API contract, never Hermes internals. This allows future replacement or addition of another agent runtime without redesigning the customer UI.

---

## 12. Future DeepSeek Harness upgrade

DeepSeek Harness is **not part of the MVP production path.** Once AnalyzeIt has real customers and production workflows, create a benchmark from anonymized difficult tasks and compare Hermes versus DeepSeek Harness on accuracy, cost, latency, tool failures and post-acceptance corrections.

```
        AnalyzeIt Agent Abstraction
                 ┌──────┴──────┐
              Hermes    DeepSeek Harness
                 └──────┬──────┘
             Shared Tool Contract
                        │
         Supabase / DuckDB / Polars
```

The customer should not know or care which runtime handled a task. This makes DeepSeek a **replaceable execution engine rather than a product dependency.**

---

## 13. MVP acceptance criteria

1. Organization and client workspace creation works
2. A genuinely messy XLSX is parsed correctly
3. AI proposes cleaning with evidence
4. Changes are grouped and materiality-ranked
5. Approved steps become Recipe v1
6. The second month's file auto-matches and replays the recipe
7. Deviations are separated from automatic fixes
8. Post-run invariants can block a run
9. Human resolutions update mapping tables
10. Every displayed number has one-click provenance
11. Dataset versions are immutable
12. Cleaned exports and reports are generated
13. Natural-language questions produce tool-executed, provenance-backed answers
14. All actions appear in the audit log

---

## 14. Commercial strategy

**Initial focus:** UK accounting firms and bookkeepers. Position AnalyzeIt as an AI data-operations layer that works *alongside* existing accounting systems rather than replacing Xero, QuickBooks, Sage or similar platforms.

**Expansion path:** UK → selected European markets → Canada → United States. Local tax, reporting and integration adapters should be added country-by-country while preserving the shared core data engine.

**Pilot strategy:** start with the five accountants already willing to pay. Capture 3–10 recurring datasets per design partner, document every manual step, run in parallel with the existing process for two cycles, and only then expand acquisition.

| Plan | Indicative price | Target |
|---|---|---|
| Starter | £39/mo | Individual bookkeeper / small shop |
| Professional | £99/mo | Small practice |
| Firm | £249/mo + additional workspace | Accounting practice |
| Custom | Quote | Integrations, volume, white-label |

Pricing remains a hypothesis. Validate willingness to pay against hours saved, recurring workflows, client volume, error detection and retention.

---

## 15. 12-month execution roadmap

| Months | Focus | Target |
|---|---|---|
| **0–2** | Hostinger Hermes deployment, Kimi integration, Supabase tool layer, messy workbook parser, recipe capture | First 5 paying accountants |
| **3–4** | Stabilize recurring workflows, provenance, invariant checks, audit trail, onboarding | 10–20 paying practices |
| **5–6** | Case studies, UK outbound sales, seeded templates, workflow analytics | 20–35 practices |
| **7–9** | Reliability, integrations, team workflows; build DeepSeek Harness evaluation benchmark (Hermes stays production-first) | — |
| **10–12** | Selective DeepSeek integration **only if** it materially improves production tasks | 50–100 practices (ambitious range) |

---

## 16. North Star metrics

**Primary:** automation rate per recurring workflow, with post-acceptance correction rate **below 1%**.

**Supporting:** time saved per workflow · active recipe replay rate · mapping-table growth · real problems caught by deviations · invariant failures caught · post-acceptance corrections · monthly retention · customer expansion.

**Business goal:** prove that AnalyzeIt can turn a recurring multi-hour accounting data workflow into a reliable, reviewable process measured in minutes.

---

## 17. Security & compliance principles

- Supabase RLS plus server-side authorization
- Encryption in transit and at rest
- Configurable retention and deletion
- Immutable audit trail
- Human approval for material financial changes
- Redaction / minimization for external model APIs
- No customer data used for model training without explicit permission

Product positioning is **legally important**: AnalyzeIt is a copilot, not an autonomous accountant. The accountant remains responsible for sign-off.

---

## 18. Final product thesis

Build the boringly reliable core before adding more agents. **Hermes is enough for the current stage.**

The real product is not the model, the swarm, or the dashboard. It is the **compounding workflow memory**: recipes + mappings + deviations + provenance + approvals. Once five accountants rely on that loop every month, the business has evidence. DeepSeek Harness can then be introduced surgically where production evidence says it belongs.

---

*Source baseline: AnalyzeIt repository and PRD v2, updated with the agreed Hermes-first Hostinger strategy, customer/admin dashboard separation, controlled Supabase tool layer, Kimi K3 reasoning path, and deferred DeepSeek Harness architecture.*
