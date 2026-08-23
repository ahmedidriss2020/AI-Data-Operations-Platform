-- =============================================================================
-- Recipes, deviations, mappings and analysis provenance.
--
-- These are the tables the controlled tool layer (PRD v3 section 7) reads and
-- writes. The foundation migration deliberately stopped at the dataset version
-- chain; this one adds the objects that make the recipe loop -- the product's
-- actual moat (section 1) -- storable rather than notional.
--
-- Three PRD constraints are enforced here rather than in application code,
-- because application code is the layer that gets bypassed:
--   * section 8   a run pins a recipe *version*, never a recipe, so editing a
--                 recipe cannot retroactively change what a historical run
--                 claims to have done.
--   * section 10  a deviation's materiality is money, and the review queue
--                 sorts on it. Nullable would let a row escape the ranking.
--   * section 10  every displayed number traces to source rows, SQL and
--                 dataset version -- so analysis_runs stores all three.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- Section 10's confidence tiers. 'block' halts the run; it is not a severity.
create type confidence_tier as enum ('auto', 'review', 'block');

create type recipe_run_status as enum ('running', 'succeeded', 'blocked', 'failed');

-- 'pending' is the honest state before invariants have been evaluated. A run
-- that has not checked its invariants must never read as passing.
create type invariant_status as enum ('pending', 'passed', 'failed');

create type deviation_resolution as enum ('unresolved', 'accepted', 'rejected', 'corrected');

-- -----------------------------------------------------------------------------
-- Recipes. A recipe belongs to a workspace and usually to one dataset -- the
-- recurring thing whose shape it knows how to clean.
--
-- source_signature is duplicated from datasets on purpose: section 9 allows a
-- recipe to be published as a template and adopted by another workspace, at
-- which point it needs a signature of its own to match against.
-- -----------------------------------------------------------------------------

create table cleaning_recipes (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces (id) on delete cascade,
  dataset_id         uuid references datasets (id) on delete set null,
  name               text not null check (length(btrim(name)) between 1 and 200),
  source_signature   text,
  template_origin_id uuid references cleaning_recipes (id) on delete set null,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index cleaning_recipes_workspace_idx on cleaning_recipes (workspace_id);
create index cleaning_recipes_signature_idx on cleaning_recipes (workspace_id, source_signature)
  where source_signature is not null;

-- -----------------------------------------------------------------------------
-- Recipe versions. Immutable once written: a step list that can change under a
-- completed run destroys the audit claim in section 8.
--
-- steps_json is the ordered step list; invariants_json is the post-run check
-- set (section 10) that can fail a run which had zero deviations.
-- -----------------------------------------------------------------------------

create table recipe_versions (
  id              uuid primary key default gen_random_uuid(),
  recipe_id       uuid not null references cleaning_recipes (id) on delete cascade,
  version_no      integer not null check (version_no >= 1),
  steps_json      jsonb not null default '[]'::jsonb,
  invariants_json jsonb not null default '[]'::jsonb,
  change_note     text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (recipe_id, version_no)
);

create index recipe_versions_recipe_idx on recipe_versions (recipe_id, version_no desc);

-- -----------------------------------------------------------------------------
-- Runs. dataset_version_in is what the run read; dataset_version_out is the new
-- immutable version it produced, null until it succeeds.
--
-- automation_rate is stored rather than derived because section 16 tracks it
-- over time, and recomputing a historical rate from today's definition would
-- silently rewrite the past.
-- -----------------------------------------------------------------------------

create table recipe_runs (
  id                  uuid primary key default gen_random_uuid(),
  recipe_version_id   uuid not null references recipe_versions (id) on delete restrict,
  dataset_version_in  uuid not null references dataset_versions (id) on delete restrict,
  dataset_version_out uuid references dataset_versions (id) on delete set null,
  status              recipe_run_status not null default 'running',
  invariant_status    invariant_status not null default 'pending',
  rows_processed      bigint check (rows_processed >= 0),
  rows_matched        bigint check (rows_matched >= 0),
  auto_corrections    integer not null default 0 check (auto_corrections >= 0),
  deviations_count    integer not null default 0 check (deviations_count >= 0),
  automation_rate     numeric(5, 2) check (automation_rate between 0 and 100),
  started_by          uuid references auth.users (id) on delete set null,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  -- A finished run must say how it finished.
  constraint recipe_runs_finished_ck
    check (finished_at is null or status <> 'running')
);

create index recipe_runs_version_idx on recipe_runs (recipe_version_id, started_at desc);
create index recipe_runs_in_idx on recipe_runs (dataset_version_in);

-- -----------------------------------------------------------------------------
-- Deviations: the exception queue (section 10).
--
-- materiality_gbp is not null and defaults to 0 because the queue ranks by
-- financial impact. A null would sort unpredictably and let a material
-- exception hide below 200 whitespace anomalies -- the precise failure the
-- ranking exists to prevent.
-- -----------------------------------------------------------------------------

create table deviations (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references recipe_runs (id) on delete cascade,
  type            text not null,
  severity        confidence_tier not null default 'review',
  materiality_gbp numeric(14, 2) not null default 0,
  affected_rows   integer not null default 0 check (affected_rows >= 0),
  evidence_json   jsonb not null default '{}'::jsonb,
  resolution      deviation_resolution not null default 'unresolved',
  resolved_by     uuid references auth.users (id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  constraint deviations_resolved_ck
    check ((resolution = 'unresolved' and resolved_at is null)
        or (resolution <> 'unresolved' and resolved_at is not null))
);

-- The review queue's own ordering: unresolved first, by money descending.
create index deviations_queue_idx
  on deviations (run_id, materiality_gbp desc)
  where resolution = 'unresolved';

-- -----------------------------------------------------------------------------
-- Mapping entries (section 9).
--
-- This is where automation actually climbs from 85% to 99%: every human
-- resolution of an ambiguous match writes back here, so next month it resolves
-- without asking. Scoped to the workspace, never shared across tenants -- the
-- same counterparty can mean different things for two clients.
-- -----------------------------------------------------------------------------

create table mapping_entries (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces (id) on delete cascade,
  kind           text not null,
  lookup_key     text not null check (length(btrim(lookup_key)) > 0),
  mapped_value   text not null,
  metadata       jsonb not null default '{}'::jsonb,
  -- Which run taught us this, when it came from a human resolution.
  learned_from_run_id uuid references recipe_runs (id) on delete set null,
  confirmed_by   uuid references auth.users (id) on delete set null,
  hit_count      integer not null default 0 check (hit_count >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- One answer per key per kind per workspace. Re-resolving updates in place
  -- rather than accumulating contradictory entries.
  unique (workspace_id, kind, lookup_key)
);

create index mapping_entries_lookup_idx on mapping_entries (workspace_id, kind);

-- -----------------------------------------------------------------------------
-- Analysis runs: the provenance record behind every displayed number
-- (section 10). Storing the executed SQL and the row-id set is what makes
-- "where did this come from?" answerable in one click rather than by
-- re-deriving the query and hoping it matches.
-- -----------------------------------------------------------------------------

create table analysis_runs (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references workspaces (id) on delete cascade,
  dataset_version_id uuid references dataset_versions (id) on delete set null,
  question           text,
  sql_executed       text,
  result_json        jsonb not null default '{}'::jsonb,
  source_row_ids     jsonb not null default '[]'::jsonb,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index analysis_runs_workspace_idx on analysis_runs (workspace_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Immutability triggers.
--
-- Section 8 says a run pins a recipe version so history cannot be rewritten.
-- A constraint cannot express "this row may never change", so a trigger does.
-- -----------------------------------------------------------------------------

create or replace function forbid_update()
returns trigger
language plpgsql
as $fn$
begin
  raise exception '% rows are immutable', tg_table_name
    using errcode = 'restrict_violation';
end;
$fn$;

create trigger recipe_versions_immutable
  before update on recipe_versions
  for each row execute function forbid_update();

-- -----------------------------------------------------------------------------
-- Scope helpers, mirroring workspace_of_dataset in the RLS migration.
-- -----------------------------------------------------------------------------

create or replace function workspace_of_recipe(p_recipe_id uuid)
returns uuid language sql stable security definer
set search_path = public, pg_temp
as $fn$ select r.workspace_id from cleaning_recipes r where r.id = p_recipe_id; $fn$;

create or replace function workspace_of_recipe_version(p_version_id uuid)
returns uuid language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select r.workspace_id
  from recipe_versions v
  join cleaning_recipes r on r.id = v.recipe_id
  where v.id = p_version_id;
$fn$;

create or replace function workspace_of_run(p_run_id uuid)
returns uuid language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select r.workspace_id
  from recipe_runs run
  join recipe_versions v on v.id = run.recipe_version_id
  join cleaning_recipes r on r.id = v.recipe_id
  where run.id = p_run_id;
$fn$;

-- -----------------------------------------------------------------------------
-- RLS. Same shape as the foundation tables: members may SELECT inside their own
-- organization, nobody gets a write policy, and every write goes through the
-- service role holding a proven scope.
-- -----------------------------------------------------------------------------

alter table cleaning_recipes enable row level security;
alter table recipe_versions  enable row level security;
alter table recipe_runs      enable row level security;
alter table deviations       enable row level security;
alter table mapping_entries  enable row level security;
alter table analysis_runs    enable row level security;

alter table cleaning_recipes force row level security;
alter table recipe_versions  force row level security;
alter table recipe_runs      force row level security;
alter table deviations       force row level security;
alter table mapping_entries  force row level security;
alter table analysis_runs    force row level security;

create policy cleaning_recipes_select_members
  on cleaning_recipes for select to authenticated
  using (has_workspace_access(workspace_id));

create policy recipe_versions_select_members
  on recipe_versions for select to authenticated
  using (has_workspace_access(workspace_of_recipe(recipe_id)));

create policy recipe_runs_select_members
  on recipe_runs for select to authenticated
  using (has_workspace_access(workspace_of_recipe_version(recipe_version_id)));

create policy deviations_select_members
  on deviations for select to authenticated
  using (has_workspace_access(workspace_of_run(run_id)));

create policy mapping_entries_select_members
  on mapping_entries for select to authenticated
  using (has_workspace_access(workspace_id));

create policy analysis_runs_select_members
  on analysis_runs for select to authenticated
  using (has_workspace_access(workspace_id));

-- -----------------------------------------------------------------------------
-- Privileges. SELECT to authenticated; everything to the service role.
-- -----------------------------------------------------------------------------

grant select on
  cleaning_recipes, recipe_versions, recipe_runs,
  deviations, mapping_entries, analysis_runs
  to authenticated;

grant all on
  cleaning_recipes, recipe_versions, recipe_runs,
  deviations, mapping_entries, analysis_runs
  to service_role;

grant execute on function
  workspace_of_recipe(uuid),
  workspace_of_recipe_version(uuid),
  workspace_of_run(uuid)
  to authenticated, service_role;
