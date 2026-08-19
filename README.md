# AI Data Operations Platform

A workflow-learning data-operations copilot for accounting practices. The product learns a
client's recurring data workflow once, turns it into a versioned executable recipe, and from then
on surfaces only the exceptions. See [`AI_Data_Operations_PRD_v2.md`](./AI_Data_Operations_PRD_v2.md)
for the full specification.

**Current state: Phase 1 (Week 1) complete — the foundation.** A firm can sign up, create client
workspaces, upload a real messy workbook to private storage, and see every action in an immutable
audit log. Parsing, cleaning, recipes and AI arrive in Weeks 2–8.

## Layout

```
apps/web/           Next.js 16 App Router application
services/parser/    Python workbook parser (Week 2)
supabase/           config + SQL migrations
scripts/            test suites and fixture generation
fixtures/messy/     deliberately messy workbooks (PRD section 6)
```

## Running it

Requires Node 22+, Docker Desktop, and Python 3 (for the fixture generator only).

```bash
npm install                 # root tooling
npm --prefix apps/web install

npm run db:start            # local Supabase stack, applies all migrations
npm run dev                 # http://127.0.0.1:3100
```

`npm run db:start` prints the local keys. They are already in `apps/web/.env.local`; if you reset
the stack and they change, copy them across from that output.

The local stack runs on ports `544xx` rather than the Supabase defaults, so it can coexist with
another project's stack on the same machine.

## Tests

```bash
npm run test:isolation      # cross-tenant isolation + append-only guarantees
npm run test:e2e            # full upload flow against the running dev server
```

`test:isolation` is the one that matters most. Two accounting firms sharing one database is the
entire risk model of this product (PRD section 13), and this suite is what proves the separation
holds. It also verifies the append-only triggers using the service-role key — the most privileged
client in the system. **If it goes red, nothing else about a release matters.**

`test:e2e` needs the dev server running. It drives the real HTTP routes rather than the database,
so it covers the session handling, the authorization checks in the route handlers and the signed
upload URL.

## What Phase 1 built

| Area | Detail |
|---|---|
| **Tenancy** | Organizations (firms) → client workspaces. Workspaces are the unit the pricing model meters (section 14). |
| **Isolation** | Supabase RLS *plus* independent server-side authorization on every path (section 13). Neither is trusted alone. |
| **Immutability** | `dataset_versions` and `audit_logs` are append-only, enforced by database triggers rather than application code. `raw_uploads` permits exactly one `pending → stored` transition and nothing else. |
| **Storage** | Private `raw` / `parquet` / `exports` buckets, keyed `{org_id}/{workspace_id}/{YYYY-MM}/{upload_id}__{filename}`. |
| **Uploads** | Browser → storage directly via a signed upload URL; the Next.js server never handles the bytes. |
| **Audit** | Every action written in the same transaction as the change that caused it. |

### Design decisions worth knowing

**Writes go through `SECURITY DEFINER` RPCs, not direct inserts.** `create_organization` and
`create_workspace` write the entity and its audit row in one transaction. If application code did
that in two statements, any crash or early return between them would leave an action with no audit
record — and section 13 asks for an immutable trail, not a mostly-complete one.

**Authenticated users hold `SELECT` and nothing else.** There is no `INSERT`/`UPDATE`/`DELETE`
policy on any table, and absence of a policy is a deny. A stolen publishable key reads nothing it
should not and writes nothing at all.

**The service role is fenced.** It bypasses RLS, so `adminFor()` in `apps/web/src/lib/authz.ts`
takes an already-proven access context as its argument. The ordering — check first, construct the
privileged client second — is then visible at every call site instead of relying on memory.

**Version 0 exists from the first upload.** Cleaning never mutates; it writes a new version with a
parent pointer (section 3). Week 2's Parquet output already has a v0 to descend from.

## Next: Week 2

Messy workbook parser, schema and type inference, Parquet writes, and the eval harness scaffold.
`fixtures/messy/acme-sales-2026-08.xlsx` is already there to build against — it carries the full
list of section 6 pathologies (header off row 1, merged cells, subtotal and blank rows, mixed date
conventions, parentheses negatives, numbers as text, a trailing total row, footnotes, and a second
sheet). Regenerate it with `npm run fixtures`.
