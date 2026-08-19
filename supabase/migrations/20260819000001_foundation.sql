-- =============================================================================
-- Phase 1 / Week 1 foundation schema.
--
-- Scope: organizations, client workspaces, raw uploads, the immutable dataset
-- version chain and the audit log. Recipes, deviations and analysis land in
-- later weeks (PRD section 3 lists the full table set).
--
-- Two PRD constraints are enforced here in the database rather than in
-- application code, because application code is the layer that gets bypassed:
--   * section 3  dataset versions are immutable; cleaning writes a new version.
--   * section 13 immutable audit trail.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

create type org_role as enum ('owner', 'admin', 'member');
create type workspace_status as enum ('active', 'archived');
create type upload_status as enum ('pending', 'stored', 'failed');
create type dataset_version_kind as enum ('raw', 'cleaned');

-- -----------------------------------------------------------------------------
-- Tenancy: an organization is an accounting firm; a workspace is one of its
-- clients. Pricing (section 14) meters active workspaces, so the boundary
-- matters commercially as well as for isolation.
-- -----------------------------------------------------------------------------

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 200),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  created_by  uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table organization_members (
  org_id     uuid not null references organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index organization_members_user_idx on organization_members (user_id);

create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 200),
  client_name text,
  status      workspace_status not null default 'active',
  created_by  uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now()
);

create index workspaces_org_idx on workspaces (org_id, status);

-- -----------------------------------------------------------------------------
-- Datasets: a dataset is the recurring thing ("ACME monthly sales"), not a
-- single file. source_signature (section 3) is populated in Week 2 once the
-- parser can fingerprint an incoming workbook; it is what auto-matches an
-- upload to its recipe.
-- -----------------------------------------------------------------------------

create table datasets (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces (id) on delete cascade,
  name             text not null check (length(btrim(name)) between 1 and 200),
  source_signature text,
  created_by       uuid not null references auth.users (id) on delete restrict,
  created_at       timestamptz not null default now()
);

create index datasets_workspace_idx on datasets (workspace_id);
create index datasets_signature_idx on datasets (workspace_id, source_signature)
  where source_signature is not null;

-- -----------------------------------------------------------------------------
-- Raw uploads. The bytes land in Supabase Storage; this table is the metadata
-- and the attribution. A row is inserted 'pending' before the browser uploads
-- and flipped to 'stored' on completion, so an abandoned upload stays visible
-- rather than silently absent.
-- -----------------------------------------------------------------------------

create table raw_uploads (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references workspaces (id) on delete cascade,
  dataset_id        uuid references datasets (id) on delete set null,
  storage_path      text not null unique,
  original_filename text not null,
  mime_type         text,
  byte_size         bigint check (byte_size >= 0),
  sha256            text check (sha256 ~ '^[0-9a-f]{64}$'),
  status            upload_status not null default 'pending',
  uploaded_by       uuid not null references auth.users (id) on delete restrict,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index raw_uploads_workspace_idx on raw_uploads (workspace_id, created_at desc);
create index raw_uploads_sha_idx on raw_uploads (workspace_id, sha256) where sha256 is not null;

-- -----------------------------------------------------------------------------
-- The immutable version chain (section 3). Week 1 only ever writes the v0 raw
-- record, but the lineage shape exists from the first row so Week 2's Parquet
-- writes have a parent to point at.
--
-- produced_by_run_id is intentionally an unconstrained uuid: recipe_runs does
-- not exist until Week 4, and adding the FK later is cheaper than reshaping the
-- table.
-- -----------------------------------------------------------------------------

create table dataset_versions (
  id                 uuid primary key default gen_random_uuid(),
  dataset_id         uuid not null references datasets (id) on delete cascade,
  parent_version_id  uuid references dataset_versions (id) on delete restrict,
  version_no         integer not null check (version_no >= 0),
  kind               dataset_version_kind not null default 'raw',
  raw_upload_id      uuid references raw_uploads (id) on delete restrict,
  parquet_path       text,
  row_count          bigint check (row_count >= 0),
  column_hash        text,
  produced_by_run_id uuid,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (dataset_id, version_no),
  -- v0 is the raw upload; every later version must descend from something.
  constraint dataset_versions_lineage_ck
    check ((version_no = 0 and parent_version_id is null)
        or (version_no > 0 and parent_version_id is not null))
);

create index dataset_versions_dataset_idx on dataset_versions (dataset_id, version_no desc);
create index dataset_versions_parent_idx on dataset_versions (parent_version_id);

-- -----------------------------------------------------------------------------
-- Audit log (section 13). Append-only, written in the same transaction as the
-- action it records.
-- -----------------------------------------------------------------------------

create table audit_logs (
  id             bigint generated always as identity primary key,
  org_id         uuid not null references organizations (id) on delete cascade,
  workspace_id   uuid references workspaces (id) on delete set null,
  actor_user_id  uuid references auth.users (id) on delete set null,
  action         text not null,
  entity_type    text not null,
  entity_id      text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index audit_logs_org_idx on audit_logs (org_id, created_at desc);
create index audit_logs_workspace_idx on audit_logs (workspace_id, created_at desc)
  where workspace_id is not null;

-- -----------------------------------------------------------------------------
-- Immutability enforcement.
--
-- raw_uploads is the one exception: it has a legitimate pending -> stored
-- transition. Everything else about it is frozen, and a completed row can never
-- be rewritten or deleted.
-- -----------------------------------------------------------------------------

create or replace function reject_mutation()
returns trigger
language plpgsql
as $fn$
begin
  raise exception 'Table % is append-only: rows may not be %', tg_table_name, lower(tg_op)
    using errcode = 'restrict_violation';
end;
$fn$;

create trigger dataset_versions_immutable
  before update or delete on dataset_versions
  for each row execute function reject_mutation();

create trigger audit_logs_immutable
  before update or delete on audit_logs
  for each row execute function reject_mutation();

create or replace function raw_uploads_guard()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'raw_uploads is append-only: rows may not be deleted'
      using errcode = 'restrict_violation';
  end if;

  if old.status <> 'pending' then
    raise exception 'raw_upload % is already %; completed uploads are immutable',
      old.id, old.status
      using errcode = 'restrict_violation';
  end if;

  if new.id <> old.id
     or new.workspace_id <> old.workspace_id
     or new.storage_path <> old.storage_path
     or new.original_filename <> old.original_filename
     or new.uploaded_by <> old.uploaded_by
     or new.created_at <> old.created_at then
    raise exception 'raw_upload % identity columns are immutable', old.id
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$fn$;

create trigger raw_uploads_guard
  before update or delete on raw_uploads
  for each row execute function raw_uploads_guard();
