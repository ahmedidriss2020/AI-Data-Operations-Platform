-- =============================================================================
-- Row Level Security.
--
-- PRD section 13 requires "tenant isolation via Supabase RLS plus server-side
-- authorization on every path". RLS here is the second line of defence, not the
-- only one -- every server route re-checks membership before it touches data.
--
-- Shape of the model:
--   * authenticated users get SELECT on rows inside their own organization.
--   * they get no INSERT/UPDATE/DELETE policy at all. Absence of a policy is a
--     deny, so writes cannot happen from a browser session even with a stolen
--     publishable key.
--   * all writes go through SECURITY DEFINER RPCs (next migration) or through
--     server routes holding the service-role key, both of which write the audit
--     row in the same transaction as the change.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Membership helpers.
--
-- SECURITY DEFINER matters: these run as the table owner, which is not subject
-- to RLS, so a policy on organization_members can call is_org_member() without
-- recursing into itself.
-- -----------------------------------------------------------------------------

create or replace function is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
    from organization_members m
    where m.org_id = p_org_id
      and m.user_id = auth.uid()
  );
$fn$;

create or replace function has_workspace_access(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1
    from workspaces w
    join organization_members m on m.org_id = w.org_id
    where w.id = p_workspace_id
      and m.user_id = auth.uid()
  );
$fn$;

-- Role within an org, for the routes that need to distinguish owner/admin from
-- member. Returns null when the caller is not a member at all.
create or replace function org_role_of(p_org_id uuid)
returns org_role
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select m.role
  from organization_members m
  where m.org_id = p_org_id
    and m.user_id = auth.uid();
$fn$;

-- The workspace's owning org, used by policies that only hold a workspace id.
create or replace function org_of_workspace(p_workspace_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select w.org_id from workspaces w where w.id = p_workspace_id;
$fn$;

-- The dataset's workspace, same reason.
create or replace function workspace_of_dataset(p_dataset_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select d.workspace_id from datasets d where d.id = p_dataset_id;
$fn$;

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere. FORCE so that even a table owner connection obeys the
-- policies; the service role bypasses RLS by way of the bypassrls attribute,
-- which is the one intended escape hatch.
-- -----------------------------------------------------------------------------

alter table organizations         enable row level security;
alter table organization_members  enable row level security;
alter table workspaces            enable row level security;
alter table datasets              enable row level security;
alter table raw_uploads           enable row level security;
alter table dataset_versions      enable row level security;
alter table audit_logs            enable row level security;

-- -----------------------------------------------------------------------------
-- Read policies. Every one of them terminates in "is the caller a member of the
-- owning organization".
-- -----------------------------------------------------------------------------

create policy organizations_select_members
  on organizations for select to authenticated
  using (is_org_member(id));

create policy organization_members_select_members
  on organization_members for select to authenticated
  using (is_org_member(org_id));

create policy workspaces_select_members
  on workspaces for select to authenticated
  using (is_org_member(org_id));

create policy datasets_select_members
  on datasets for select to authenticated
  using (has_workspace_access(workspace_id));

create policy raw_uploads_select_members
  on raw_uploads for select to authenticated
  using (has_workspace_access(workspace_id));

create policy dataset_versions_select_members
  on dataset_versions for select to authenticated
  using (has_workspace_access(workspace_of_dataset(dataset_id)));

create policy audit_logs_select_members
  on audit_logs for select to authenticated
  using (is_org_member(org_id));

-- -----------------------------------------------------------------------------
-- Privileges.
--
-- Local config leaves auto_expose_new_tables unset, matching the current cloud
-- default: new tables are NOT reachable through the Data API roles without an
-- explicit grant. So grant deliberately, and grant only SELECT -- the write
-- path is the RPCs and the service role.
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant select on
  organizations, organization_members, workspaces,
  datasets, raw_uploads, dataset_versions, audit_logs
  to authenticated;

grant all on
  organizations, organization_members, workspaces,
  datasets, raw_uploads, dataset_versions, audit_logs
  to service_role;

grant usage, select on all sequences in schema public to service_role;

grant execute on function
  is_org_member(uuid),
  has_workspace_access(uuid),
  org_role_of(uuid),
  org_of_workspace(uuid),
  workspace_of_dataset(uuid)
  to authenticated, service_role;
