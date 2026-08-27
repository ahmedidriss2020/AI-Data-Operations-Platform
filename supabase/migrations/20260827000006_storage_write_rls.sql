-- =============================================================================
-- Migration: 20260827000006_storage_write_rls.sql
-- Allow authenticated organization members to insert and update storage objects
-- within their authorized organization and workspace prefixes.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = 'storage.objects'::regclass AND polname = 'storage_insert_own_org'
  ) THEN
    CREATE POLICY storage_insert_own_org
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id IN ('raw', 'parquet', 'exports', 'cleaned')
        AND is_org_member(try_uuid((storage.foldername(name))[1]))
        AND has_workspace_access(try_uuid((storage.foldername(name))[2]))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = 'storage.objects'::regclass AND polname = 'storage_update_own_org'
  ) THEN
    CREATE POLICY storage_update_own_org
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id IN ('raw', 'parquet', 'exports', 'cleaned')
        AND is_org_member(try_uuid((storage.foldername(name))[1]))
        AND has_workspace_access(try_uuid((storage.foldername(name))[2]))
      );
  END IF;
END $$;
