-- =============================================================================
-- Migration: 20260827000007_user_write_rls.sql
-- Allow authenticated organization members to insert and update datasets,
-- raw_uploads, and dataset_versions within their authorized workspaces.
-- =============================================================================

GRANT INSERT, UPDATE ON datasets, raw_uploads, dataset_versions TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = 'dataset_versions'::regclass AND polname = 'dataset_versions_insert_members'
  ) THEN
    CREATE POLICY dataset_versions_insert_members
      ON dataset_versions FOR INSERT TO authenticated
      WITH CHECK (has_workspace_access(workspace_of_dataset(dataset_id)));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid = 'raw_uploads'::regclass AND polname = 'raw_uploads_update_members'
  ) THEN
    CREATE POLICY raw_uploads_update_members
      ON raw_uploads FOR UPDATE TO authenticated
      USING (has_workspace_access(workspace_id));
  END IF;
END $$;
