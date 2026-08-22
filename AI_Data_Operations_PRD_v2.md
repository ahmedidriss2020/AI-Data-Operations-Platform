# AI Data Operations Platform — PRD v2

**Product Requirements Document · Technical Specification · MVP Roadmap**

| | |
|---|---|
| **Primary customer** | Accounting firms, bookkeepers, small retailers |
| **Initial market** | UK pilot customer (single vertical first) |
| **Core value** | Learn a client's recurring data workflow once, then execute it every month with only exceptions surfaced |
| **AI layer** | Hermes Agent orchestration + OpenAI / Kimi (interchangeable) |
| **Stack** | Next.js + Supabase + Python/FastAPI + DuckDB/Polars |
| **Status** | Pilot-ready specification |

> **Product principle:** The AI proposes, explains and *learns the workflow*. Deterministic tools calculate and transform. The human approves material changes and can trace every number back to its source rows.

---

## 1. What changed from v1, and why

v1 described an AI that cleans spreadsheets. That is a feature, not a product — it is one-shot, it is commoditising fast, and it gets slower per file the more thorough it becomes.

The product is actually **an agent that learns a client's recurring data workflow and turns it into an executable, versioned recipe.** Every month the same client sends the same messy file in the same broken way. The value is not cleaning it once; it is never having to clean it manually again.

Three structural changes follow:

1. **Recipes are the core object.** Not datasets, not jobs. Recipes accumulate, and accumulated recipes are the moat — a competitor can clone the cleaning engine in a quarter but cannot clone eighteen months of a firm's approved client workflows.
2. **Storage separates from state.** Data lives as Parquet in object storage and is queried with DuckDB. Postgres holds metadata, lineage and workflow state only.
3. **One vertical at MVP.** Build whichever the UK pilot actually is. The other mode ships after the workflow is reliable.

---

## 2. Product architecture

```
                 CLIENT WORKSPACE
                       │
                       ▼
                 Upload / Email-in
                       │
                       ▼
              Messy Workbook Parser
                       │
                       ▼
                 Dataset Version
                 raw → v1 → v2
                       │
              ┌────────┴────────┐
              ▼                 ▼
        Existing Recipe?     New Dataset
              │                 │
              ▼                 ▼
        Replay Recipe      AI Profiling
              │                 │
              └────────┬────────┘
                       ▼
                Deviation Engine
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
          Auto-fix   Review    Reject
             │         │
             └────┬────┘
                  ▼
            Post-run Invariants
              (canary checks)
                  │
                  ▼
             Clean Version
                  │
       ┌──────────┼──────────┐
       ▼          ▼          ▼
   Analytics   Reconcile   Reports
       │
       ▼
 "What changed this month?"
```

Post-run invariants are new and non-negotiable — see §5.3. A recipe that executes perfectly against a file that has silently changed meaning is the single most dangerous failure mode in this product.

### The loop

| | |
|---|---|
| **Month 1** | Upload → AI profiles and proposes → accountant approves → recipe saved |
| **Month 2** | Upload → recipe replays → only deviations need attention |
| **Month 3+** | Upload → near-fully automatic → accountant reviews materiality-ranked exceptions |

---

## 3. Data & storage architecture

```
Supabase Storage
│
├── /raw/
│    └── client_123/
│         ├── 2026-07.xlsx
│         └── 2026-08.xlsx
│
├── /parquet/
│    └── client_123/
│         ├── dataset_v1.parquet
│         └── dataset_v2.parquet
│
└── /exports/

Supabase Postgres  (metadata + state + lineage only)
│
├── organizations
├── workspaces
├── datasets
├── dataset_versions
├── cleaning_recipes
├── recipe_versions
├── recipe_steps
├── recipe_runs
├── deviations
├── proposed_changes
├── validation_results
├── analysis_runs
├── charts
├── reports
└── audit_logs
```

- **DuckDB** — analytical engine, reads Parquet directly
- **Postgres** — metadata, workflow state, lineage, audit
- **Supabase Storage** — the actual data

Dataset versions are **immutable**. Cleaning never mutates in place; it writes a new version with a parent pointer. This gives the audit trail almost for free, makes version diffing possible, and makes rollback trivial.

### Key tables

**`dataset_versions`**
`id, dataset_id, parent_version_id, version_no, parquet_path, row_count, column_hash, produced_by_run_id, created_at`

**`cleaning_recipes`**
`id, workspace_id, name, source_signature, current_version_id, template_origin_id, created_by, created_at`

**`recipe_versions`**
`id, recipe_id, version_no, steps_json, invariants_json, created_by, change_note, created_at`

**`recipe_runs`**
`id, recipe_version_id, dataset_version_in, dataset_version_out, rows_processed, rows_matched, auto_corrections, deviations_count, automation_rate, invariant_status, status, started_at, finished_at`

**`deviations`**
`id, run_id, type, severity, materiality_gbp, affected_rows, evidence_json, resolution, resolved_by, resolved_at`

`recipe_runs` pins a **recipe_version**, never a recipe. Editing a recipe must never retroactively change what a historical run claims to have done — that is an audit-integrity requirement, not a nicety.

`source_signature` is a fuzzy fingerprint of the incoming file (column names, header position, sheet layout) used to auto-match an upload to its recipe.

---

## 4. Recipes as a first-class product object

A recipe is a user-visible, editable, versioned list of steps. Users must be able to read it, reorder it, disable a step, and dry-run it before committing.

```
Recipe: ACME Monthly Sales Cleanup            v7 · 14 runs
 1. Detect header row
 2. Remove subtotal rows
 3. Normalize dates → ISO
 4. Convert negative parentheses → negative numbers
 5. Normalize currency
 6. Trim whitespace
 7. Normalize vendor names        [uses mapping table: 412 entries]
 8. Remove exact duplicates
 9. Validate required columns
10. Compare against previous month
```

### Run summary

```
Recipe Run #14                          ACME · August 2026
12,842 rows processed
✓ 12,701 matched recipe
✓    93 deterministic corrections
⚠    31 ambiguous vendor matches        £4,219 affected
⚠    17 new product codes               £  892 affected
⚠     1 new column detected             —
✓ Invariants passed (5/5)
Automation: 99.1%
```

### Step schema

```json
{
  "id": "step_07",
  "op": "normalize_vendor_names",
  "params": { "column": "supplier", "mapping_table_id": "vm_88", "fuzzy_threshold": 0.92 },
  "on_ambiguous": "review",
  "confidence_tier": "review",
  "learned_from_run": "run_003",
  "enabled": true
}
```

Steps are pure functions over a dataset version. That makes them replayable, testable, and diffable.

### Mapping tables

Vendor normalization, account-code mapping and product-code mapping should be **shared, growable tables scoped to the workspace**, not parameters frozen inside a step. Every human resolution of an ambiguous match writes back to the mapping table, so next month it resolves automatically. This is where the automation rate actually climbs from 85% to 99%.

### Template library

Recipes can be published as templates (`template_origin_id`) at firm level or globally. Ship the MVP with seeded templates for the common exports — Sage, Xero, QuickBooks, Square, Shopify, Lightspeed — so **month 1 starts at ~60% automated rather than 0%**. Cold start is otherwise the weakest moment in the whole product, and it is the moment the pilot forms its opinion.

---

## 5. The deviation engine

### 5.1 Confidence tiers

Approving 400 changes one by one is slower than doing it in Excel. Every step declares a tier:

| Tier | Behaviour | Examples |
|---|---|---|
| **Auto** | Applied silently, logged, reversible | Date format, whitespace, currency symbols, parentheses negatives |
| **Review** | Queued for human decision | Duplicate candidates, fuzzy vendor matches, missing account codes, new columns |
| **Block** | Run halts | Required column absent, totals mismatch beyond tolerance, invariant failure |

Thresholds are configurable per workspace. Firms with different risk appetites need different defaults, and the ability to tighten them after an incident.

### 5.2 Materiality ranking

Rank the review queue by **financial impact, not by row count.** One £40,000 unmatched transaction outranks 200 whitespace anomalies. Accountants already think in materiality; a queue sorted by count will be abandoned by run 3.

Also group aggressively: *"Normalize 312 dates DD/MM/YY → ISO"* is one approval with an expandable detail view, not 312.

### 5.3 Post-run invariants (the silent-failure guard)

A recipe matching 100% of rows is not evidence of correctness. If a client's export changes meaning while keeping its shape — a column repurposed, a date convention flipped, a subtotal row now looking like a transaction — the recipe will happily process it and produce a confidently wrong number.

Every recipe therefore carries invariants that run *after* execution and can fail a run that had zero deviations:

- Row count within *n*% of trailing 3-month average
- Revenue/total within tolerance of prior period, or flagged
- Column-level distribution drift (nulls, cardinality, min/max, mean)
- No date outside expected reporting period
- Sum of parts reconciles to stated totals where a totals row exists

Failing invariants block the run and demand human sign-off. This is the difference between an automation tool and a liability.

### 5.4 Measuring automation honestly

"99.1% automated" is a compelling metric and a gameable one — a recipe that auto-applies wrong transformations scores 100%. Always pair it with:

- **Post-acceptance correction rate** — how often users fix something the recipe already "handled"
- **Exceptions caught** — deviations that turned out to be real problems
- **Invariant failure rate**

A recipe with 99% automation and a rising correction rate is a broken recipe, and the product should say so.

---

## 6. Messy workbook parsing (P0, not an assumption)

Real accountant spreadsheets are not clean CSVs. This is where pilots die, so it is an explicit deliverable:

- Header row not on row 1; multi-row headers
- Merged cells
- Embedded subtotal and blank separator rows
- Multiple tables on one sheet; multiple sheets per file
- Footnotes and disclaimer text below the data
- Numbers as text; parentheses negatives; thousands separators; mixed currency symbols
- Trailing total rows that must not be treated as transactions
- Dates as Excel serials, as text, in mixed DD/MM and MM/DD conventions within the same column

Parser output is a structured *interpretation* — table boundaries, header location, type inference — with confidence, which the user confirms once and which then becomes recipe steps 1–2.

---

## 7. Provenance: "Where did this number come from?"

Every number in the product is clickable.

```
Revenue: £84,392

Source
├── 4,291 transactions
├── dataset_v23
└── sales_cleaned.parquet

Calculation
    SUM(net_sales)

Cleaning
├── 17 currency conversions
├──  3 duplicate removals
└──  8 rejected rows

Previous month
    £79,104

Change
    +£5,288 (+6.7%)

[View source rows]  [View SQL]  [View recipe]
```

This is the trust feature. The AI being impressive is worth less than an accountant being able to say *"show me exactly where this came from"* and getting an answer in under a second. Implementation requirement: `analysis_runs` stores the executed SQL, the dataset version, and the row-id set behind every displayed figure.

---

## 8. AI architecture

Hermes orchestrates 24/7 continuously (hosted on Hostinger VPS via PM2 / Docker daemon); OpenAI and Kimi are interchangeable reasoning models routed by task, cost and quality; Python/Polars/DuckDB does all arithmetic. The LLM is never the source of a financial number.

### 8.1 24/7 Hostinger Deployment & Dashboard Integration Bridge

Hermes is deployed as a long-running FastAPI microservice on Hostinger VPS (`/var/www/hermes-agent`). The Next.js dashboard interacts with Hermes over an authenticated REST API bridge (`HERMES_AGENT_ENDPOINT` + `HERMES_API_SECRET`).

- **Continuous Operation**: Managed by PM2 auto-restart daemon with system boot persistence.
- **Health & Status**: Real-time heartbeat widget embedded in AnalyzeIt dashboard layout (`/health` endpoint returning uptime, queue backlog, and active workers).
- **Execution Workflow**: When a new workbook lands in Supabase storage, the dashboard notifies Hermes to execute `parse_workbook`, match `source_signature`, replay `recipe_version`, evaluate post-run invariants, and stream materiality-ranked exceptions back to Postgres.

### Context discipline

**Never send raw rows to the model.** Send schema, profile statistics, and a small redacted sample. This is cheaper, faster, and structurally solves most of the "minimize sensitive data sent to external APIs" requirement rather than solving it by policy.

### Where AI is used, and where it is not

| Use AI for | Use deterministic code for |
|---|---|
| Interpreting messy structure | Executing transformations |
| Proposing mappings and rules | Arithmetic and aggregation |
| Explaining anomalies in prose | Detecting anomalies |
| Natural-language → structured query | Running the query |
| Drafting the monthly narrative | Every number inside it |

### Eval harness (build in week 2, not week 8)

Maintain 20–30 golden messy files with known-correct outputs. Run on every prompt change, model change or router change. Without this, "interchangeable OpenAI/Kimi" is a claim you cannot safely act on — you will never dare switch models in production.

---

## 9. Tool contract

```
parse_workbook(file_id)                          → structure interpretation + confidence
profile_dataset(dataset_version_id)
inspect_schema(dataset_version_id)
match_recipe(dataset_version_id)                 → recipe candidates by source_signature
apply_recipe(dataset_version_id, recipe_version_id, dry_run)
diff_versions(version_a, version_b)
detect_duplicates(dataset_version_id, keys)
detect_anomalies(dataset_version_id, metric)
normalize_values(dataset_version_id, column, rules)
validate_dataset(dataset_version_id, rule_set)
check_invariants(run_id)
reconcile_sources(source_a, source_b, matching_rules)
query_dataset(dataset_version_id, structured_query)
compare_periods(dataset_version_id, metric, period_a, period_b)
explain_number(analysis_run_id, value_ref)       → full provenance tree
generate_chart(dataset_version_id, chart_spec)
generate_report(dataset_version_id, report_type)
```

Every tool returns structured JSON: `status`, `result`, `evidence`, `warnings`, `execution_metadata`. Every mutating tool supports `dry_run`, returning the diff it *would* produce.

---

## 10. Vertical strategy

Build one mode for the pilot. After the workflow is reliable, the second mode is mostly configuration over the same engine.

```
              CORE DATA ENGINE
     (parser · recipes · deviations · provenance)
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
   ACCOUNTING MODE         RETAIL MODE
          │                     │
   Reconciliation          Sales analytics
   Ledger cleaning         Product analytics
   Client reporting        Inventory signals
   Financial QA            Margin analysis
```

---

## 11. MVP acceptance criteria

Rewritten around the loop rather than around features:

1. User creates an organization and a client workspace
2. User uploads a genuinely messy real XLSX and the parser correctly identifies header row, table bounds and types
3. System profiles the dataset and proposes cleaning with explanations and evidence
4. User approves changes in **grouped, materiality-ranked batches**
5. Approved sequence is saved as a recipe (v1)
6. **A second month's file auto-matches the recipe and replays it**
7. Deviations are surfaced separately from auto-applied fixes
8. Post-run invariants execute and can block a run
9. A human resolution of an ambiguous match writes back to the mapping table and does not recur next month
10. Any displayed number can be traced to source rows, SQL and recipe version in one click
11. Dataset versions are immutable with a complete lineage chain
12. Cleaned data exports; reports generate
13. Natural-language questions return tool-executed answers with provenance
14. All actions appear in the audit log

Criterion 6 and criterion 9 are the product. If those two work, everything else is a matter of polish.

---

## 12. Build roadmap (8 weeks, single vertical)

| Week | Deliverable |
|---|---|
| 1 | Next.js + Supabase foundation, auth, organizations, client workspaces, upload, raw storage |
| 2 | **Messy workbook parser**, schema/type inference, Parquet write, immutable dataset versions, eval harness scaffold |
| 3 | Polars/DuckDB cleaning steps, validation rules, grouped + materiality-ranked approval UI |
| 4 | **Recipe capture from approved session, recipe replay, deviation engine, mapping tables with write-back** |
| 5 | Hermes integration, OpenAI/Kimi routing, structured tool calling, profiling and explanation |
| 6 | Vertical workflows for the pilot's actual mode (reconciliation *or* retail analytics) + KPI/charts |
| 7 | Provenance drill-down, post-run invariants, reports, audit trail, security hardening |
| 8 | UK pilot, monitoring, seeded template library, documentation, launch |

Week 4 is the highest-risk week and the reason to build it early. Weeks 5–6 in the original plan were each a whole product; collapsing to one vertical is what makes this schedule real.

---

## 13. Security & trust

- Tenant isolation via Supabase RLS plus server-side authorization on every path
- Encryption in transit and at rest
- **No customer data used for model training** without explicit contractual permission — state this in-product, not just in the MSA
- Raw uploads separated from processed data; configurable retention and hard deletion
- Immutable audit trail: uploads, recipe edits, approvals, auto-applied fixes, exports, agent actions
- Human approval required for material financial changes; approvals recorded with user, timestamp and recipe version
- Redaction/minimization on everything sent to external model APIs (structurally enforced by §8 context discipline)
- Full provenance on every number
- **Positioning is legally load-bearing:** copilot, not autonomous accountant. The accountant signs off. Say so in the UI, the contract and the marketing.

---

## 14. Pricing

Per-seat pricing misaligns with how firms create value — a firm's economics scale with clients, not with logins.

| Plan | Price | Target |
|---|---|---|
| Starter | £39/month · 1 workspace | Individual shop or bookkeeper |
| Professional | £99/month · 5 workspaces | Bookkeeper / small practice |
| Firm | £249/month · 15 workspaces, then £15/additional workspace | Accounting practice |
| Custom | Quote | Integrations, volume, white-label |

Then price expansion per **active client workspace** (~£15–25/month). Firms already budget per client, and it grows with delivered value without punishing team size.

This remains a hypothesis. The pilot exists to measure: hours saved per client per month, datasets processed, error caught rate, and stated willingness to pay before plans are locked.

---

## 15. Pilot plan & metrics

1. Use the UK customer as design partner. Do not chase format coverage.
2. Collect 3–10 real recurring datasets they process manually today.
3. **Record every manual step, in order.** That transcript is the first recipe.
4. Convert repeated steps into deterministic tools; use AI only for interpretation, mapping and explanation.
5. Run in parallel with their manual process for two cycles before trusting output.
6. Onboard customers 2 and 3 only once the loop is reliable.

### North star

> **Automation rate per recurring workflow, at a post-acceptance correction rate below 1%.**

Automation without that second clause is a vanity metric.

### Supporting metrics

| Metric | Why |
|---|---|
| Time per recurring workflow, before vs after | The sellable number |
| Recipes created / actively replaying | Retention proxy |
| Mapping-table growth per workspace | Compounding value proxy |
| Deviations that were real problems | Value of the review queue |
| Invariant failures caught | Value of the safety layer |
| Post-acceptance corrections | Silent-error detector |

---

## 16. Open risks

| Risk | Mitigation |
|---|---|
| Silent recipe drift produces confident wrong numbers | Post-run invariants (§5.3); correction-rate monitoring |
| Cold start feels like ordinary AI cleaning | Seeded template library; make month 1 good standalone |
| Review-queue fatigue by run 3 | Materiality ranking, grouping, auto-tier tuning |
| Parser fails on genuinely pathological files | Manual structure override that still becomes recipe steps |
| Model swap silently degrades quality | Eval harness gating every change |
| Firm-level liability concerns block adoption | Copilot positioning, sign-off records, exportable audit trail |
| Large datasets outgrow single-node DuckDB | Parquet partitioning by period; engine is swappable behind the tool contract |

---

## Bottom line

Build the first version as a **workflow-learning data-operations copilot**, not an autonomous accountant. The recipe loop, the deviation engine and one-click provenance are the product; the analytics are the visible surface on top of it.

If one messy recurring monthly workflow becomes a reliable ten-minute workflow — and the accountant can prove where every number came from — you have something sellable.
