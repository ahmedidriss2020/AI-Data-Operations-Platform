-- =============================================================================
-- Write path.
--
-- Every mutation that a signed-in user can trigger goes through one of these
-- SECURITY DEFINER functions. The reason is PRD section 13: "immutable audit
-- trail ... uploads, recipe edits, approvals, auto-applied fixes, exports".
-- If the entity insert and its audit row are separate statements issued by
-- application code, then any bug, crash or early return between them produces
-- an action with no audit record. Here they share a transaction by
-- construction, so that state is unreachable.
--
-- Each function re-checks membership itself. It does not inherit the caller's
-- RLS, because SECURITY DEFINER deliberately steps outside it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Audit writer. Not granted to authenticated: a user must never be able to
-- write a free-text audit entry, only to cause one.
-- -----------------------------------------------------------------------------

create or replace function write_audit(
  p_org_id       uuid,
  p_workspace_id uuid,
  p_action       text,
  p_entity_type  text,
  p_entity_id    text,
  p_metadata     jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id bigint;
begin
  insert into audit_logs (org_id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata)
  values (p_org_id, p_workspace_id, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$fn$;

revoke all on function write_audit(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function write_audit(uuid, uuid, text, text, text, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- Organization creation. The creator becomes owner in the same transaction;
-- an organization with no members would be permanently unreachable, since
-- every read policy terminates in a membership check.
-- -----------------------------------------------------------------------------

create or replace function create_organization(p_name text, p_slug text)
returns organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_user uuid := auth.uid();
  v_org  organizations;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  insert into organizations (name, slug, created_by)
  values (btrim(p_name), lower(btrim(p_slug)), v_user)
  returning * into v_org;

  insert into organization_members (org_id, user_id, role)
  values (v_org.id, v_user, 'owner');

  perform write_audit(
    v_org.id, null, 'organization.created', 'organization', v_org.id::text,
    jsonb_build_object('name', v_org.name, 'slug', v_org.slug)
  );

  return v_org;
end;
$fn$;

-- -----------------------------------------------------------------------------
-- Client workspace creation. Owners and admins only -- a workspace is the unit
-- the product bills on (section 14), so it is not a member-level action.
-- -----------------------------------------------------------------------------

create or replace function create_workspace(
  p_org_id      uuid,
  p_name        text,
  p_client_name text default null
)
returns workspaces
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_role org_role := org_role_of(p_org_id);
  v_ws   workspaces;
begin
  if v_role is null then
    raise exception 'not a member of organization %', p_org_id using errcode = 'insufficient_privilege';
  end if;

  if v_role not in ('owner', 'admin') then
    raise exception 'role % may not create workspaces', v_role using errcode = 'insufficient_privilege';
  end if;

  insert into workspaces (org_id, name, client_name, created_by)
  values (p_org_id, btrim(p_name), nullif(btrim(coalesce(p_client_name, '')), ''), auth.uid())
  returning * into v_ws;

  perform write_audit(
    p_org_id, v_ws.id, 'workspace.created', 'workspace', v_ws.id::text,
    jsonb_build_object('name', v_ws.name, 'client_name', v_ws.client_name)
  );

  return v_ws;
end;
$fn$;

grant execute on function create_organization(text, text) to authenticated;
grant execute on function create_workspace(uuid, text, text) to authenticated;
