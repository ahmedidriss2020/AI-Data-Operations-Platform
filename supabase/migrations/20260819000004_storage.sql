-- =============================================================================
-- Storage buckets, mirroring the layout in PRD section 3:
--
--   /raw/      the untouched customer workbook, exactly as it arrived
--   /parquet/  cleaned dataset versions (written from Week 2)
--   /exports/  generated exports and reports (Week 7)
--
-- All three are private. Section 13 requires raw uploads to be separated from
-- processed data with configurable retention, which is why raw is its own
-- bucket rather than a prefix -- retention and hard deletion can then be set
-- per bucket without touching derived data.
--
-- Object key layout:
--   {org_id}/{workspace_id}/{YYYY-MM}/{upload_id}__{original_filename}
--
-- Org-scoped first segment so a leaked key discloses nothing about the client,
-- and so the storage policy can read the tenant straight out of the path.
-- =============================================================================

-- Cast that yields null instead of raising on a malformed path segment. Without
-- it, a request for "raw/not-a-uuid/..." fails the policy with a cast error
-- rather than a clean denial.
create or replace function try_uuid(p_text text)
returns uuid
language plpgsql
immutable
as $fn$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$fn$;

grant execute on function try_uuid(text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'raw', 'raw', false, 52428800,
    array[
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
      'application/vnd.ms-excel',                                          -- .xls
      'text/csv',
      'application/csv',
      'text/plain'                                                         -- some browsers label .csv this way
    ]
  ),
  ('parquet', 'parquet', false, 1073741824, null),
  ('exports', 'exports', false, 1073741824, null)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Object policies.
--
-- Read only, and only for members of the organization named in the first path
-- segment. There is deliberately no INSERT policy for authenticated users:
-- browsers upload with a signed upload URL minted server-side by the service
-- role after it has checked membership, so the token itself is the
-- authorization. And no UPDATE/DELETE policy at all -- raw files are as
-- immutable as the rows that describe them.
-- -----------------------------------------------------------------------------

create policy storage_read_own_org
  on storage.objects for select to authenticated
  using (
    bucket_id in ('raw', 'parquet', 'exports')
    and is_org_member(try_uuid((storage.foldername(name))[1]))
    and has_workspace_access(try_uuid((storage.foldername(name))[2]))
  );
