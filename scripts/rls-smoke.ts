/**
 * Cross-tenant isolation and immutability checks.
 *
 * Two accounting firms sharing one database is the entire risk model of this
 * product. PRD section 13 states the requirement; this script is the thing that
 * proves it holds, and it is meant to be run on every schema change. If it goes
 * red, nothing else about the release matters.
 *
 * It also verifies the append-only guarantees from section 3, using the
 * service-role key -- the most privileged client in the system. If the triggers
 * hold against that, they hold against everything.
 *
 * Usage: npm run test:isolation   (requires `supabase start`)
 */

import { randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

loadEnv({ path: 'apps/web/.env.local', quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
  console.error('Missing Supabase env. Run `supabase start` and fill apps/web/.env.local.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

/** A signed-in client for a freshly created user. */
async function createUserClient(label: string) {
  const email = `${label}-${randomUUID().slice(0, 8)}@example.test`;
  const password = `pw-${randomUUID()}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw new Error(`Could not create ${label}: ${createError.message}`);

  const client = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Could not sign in ${label}: ${signInError.message}`);

  return { client, userId: created.user!.id, email };
}

/** Sets up a firm with one client workspace, one dataset and one stored file. */
async function seedTenant(client: SupabaseClient, userId: string, name: string) {
  const { data: org, error: orgError } = await client.rpc('create_organization', {
    p_name: name,
    p_slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomUUID().slice(0, 6)}`,
  });
  if (orgError) throw new Error(`create_organization failed for ${name}: ${orgError.message}`);

  const { data: workspace, error: wsError } = await client.rpc('create_workspace', {
    p_org_id: org.id,
    p_name: `${name} client`,
    p_client_name: `${name} Ltd`,
  });
  if (wsError) throw new Error(`create_workspace failed for ${name}: ${wsError.message}`);

  const { data: dataset } = await admin
    .from('datasets')
    .insert({ workspace_id: workspace.id, name: 'Monthly sales', created_by: userId })
    .select('id')
    .single();

  const uploadId = randomUUID();
  const storagePath = `${org.id}/${workspace.id}/2026-08/${uploadId}__sales.csv`;

  await admin.storage
    .from('raw')
    .upload(storagePath, new Blob(['date,net_sales\n2026-08-01,100\n']), {
      contentType: 'text/csv',
    });

  await admin.from('raw_uploads').insert({
    id: uploadId,
    workspace_id: workspace.id,
    dataset_id: dataset!.id,
    storage_path: storagePath,
    original_filename: 'sales.csv',
    mime_type: 'text/csv',
    byte_size: 31,
    status: 'pending',
    uploaded_by: userId,
  });

  const { data: version } = await admin
    .from('dataset_versions')
    .insert({
      dataset_id: dataset!.id,
      version_no: 0,
      kind: 'raw',
      raw_upload_id: uploadId,
      created_by: userId,
    })
    .select('id')
    .single();

  await admin.rpc('write_audit', {
    p_org_id: org.id,
    p_workspace_id: workspace.id,
    p_action: 'upload.stored',
    p_entity_type: 'raw_upload',
    p_entity_id: uploadId,
    p_metadata: { original_filename: 'sales.csv' },
  });

  return {
    orgId: org.id as string,
    workspaceId: workspace.id as string,
    datasetId: dataset!.id as string,
    uploadId,
    versionId: version!.id as string,
    storagePath,
  };
}

async function main() {
  console.log('\nCross-tenant isolation\n');

  const alpha = await createUserClient('alpha');
  const beta = await createUserClient('beta');

  const alphaData = await seedTenant(alpha.client, alpha.userId, 'Alpha Accounting');
  await seedTenant(beta.client, beta.userId, 'Beta Bookkeeping');

  // --- Beta must not see any of Alpha's rows -------------------------------

  const { data: orgs } = await beta.client.from('organizations').select('id').eq('id', alphaData.orgId);
  check("Beta cannot read Alpha's organization", (orgs ?? []).length === 0);

  const { data: workspaces } = await beta.client
    .from('workspaces')
    .select('id')
    .eq('id', alphaData.workspaceId);
  check("Beta cannot read Alpha's workspace", (workspaces ?? []).length === 0);

  const { data: datasets } = await beta.client
    .from('datasets')
    .select('id')
    .eq('id', alphaData.datasetId);
  check("Beta cannot read Alpha's dataset", (datasets ?? []).length === 0);

  const { data: uploads } = await beta.client
    .from('raw_uploads')
    .select('id')
    .eq('id', alphaData.uploadId);
  check("Beta cannot read Alpha's upload", (uploads ?? []).length === 0);

  const { data: versions } = await beta.client
    .from('dataset_versions')
    .select('id')
    .eq('id', alphaData.versionId);
  check("Beta cannot read Alpha's dataset version", (versions ?? []).length === 0);

  const { data: audits } = await beta.client
    .from('audit_logs')
    .select('id')
    .eq('org_id', alphaData.orgId);
  check("Beta cannot read Alpha's audit log", (audits ?? []).length === 0);

  const { data: members } = await beta.client
    .from('organization_members')
    .select('user_id')
    .eq('org_id', alphaData.orgId);
  check("Beta cannot read Alpha's membership list", (members ?? []).length === 0);

  // A tenant must still see its own data, or the policies are merely broken
  // rather than strict.
  const { data: ownWorkspaces } = await beta.client.from('workspaces').select('id');
  check('Beta can read its own workspace', (ownWorkspaces ?? []).length === 1);

  // --- Beta must not write into Alpha's tenant -----------------------------

  const { error: crossCreate } = await beta.client.rpc('create_workspace', {
    p_org_id: alphaData.orgId,
    p_name: 'Intruder',
  });
  check("Beta cannot create a workspace in Alpha's org", crossCreate !== null, crossCreate?.message);

  const { error: directInsert } = await beta.client
    .from('workspaces')
    .insert({ org_id: alphaData.orgId, name: 'Intruder', created_by: beta.userId });
  check('Beta cannot insert a workspace directly', directInsert !== null, directInsert?.message);

  const { error: auditForge } = await beta.client.rpc('write_audit', {
    p_org_id: alphaData.orgId,
    p_workspace_id: null,
    p_action: 'forged',
    p_entity_type: 'organization',
    p_entity_id: alphaData.orgId,
  });
  check('Beta cannot forge an audit entry', auditForge !== null, auditForge?.message);

  // --- Storage --------------------------------------------------------------

  const { error: crossDownload } = await beta.client.storage
    .from('raw')
    .download(alphaData.storagePath);
  check("Beta cannot download Alpha's raw file", crossDownload !== null, crossDownload?.message);

  const { error: crossSign } = await beta.client.storage
    .from('raw')
    .createSignedUrl(alphaData.storagePath, 60);
  check("Beta cannot sign a URL for Alpha's raw file", crossSign !== null, crossSign?.message);

  const { error: crossUpload } = await beta.client.storage
    .from('raw')
    .upload(`${alphaData.orgId}/${alphaData.workspaceId}/2026-08/${randomUUID()}__x.csv`, new Blob(['x']));
  check("Beta cannot upload into Alpha's prefix", crossUpload !== null, crossUpload?.message);

  // --- Anonymous ------------------------------------------------------------

  const anon = createClient(SUPABASE_URL!, PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: anonOrgs } = await anon.from('organizations').select('id');
  check('Anonymous callers see no organizations', (anonOrgs ?? []).length === 0);

  const { data: anonUploads } = await anon.from('raw_uploads').select('id');
  check('Anonymous callers see no uploads', (anonUploads ?? []).length === 0);

  // --- Immutability, checked with the service role --------------------------

  console.log('\nImmutability (service role, RLS bypassed)\n');

  const { error: versionUpdate } = await admin
    .from('dataset_versions')
    .update({ row_count: 999 })
    .eq('id', alphaData.versionId);
  check('dataset_versions cannot be updated', versionUpdate !== null, versionUpdate?.message);

  const { error: versionDelete } = await admin
    .from('dataset_versions')
    .delete()
    .eq('id', alphaData.versionId);
  check('dataset_versions cannot be deleted', versionDelete !== null, versionDelete?.message);

  const { data: auditRow } = await admin
    .from('audit_logs')
    .select('id')
    .eq('org_id', alphaData.orgId)
    .limit(1)
    .single();

  const { error: auditUpdate } = await admin
    .from('audit_logs')
    .update({ action: 'rewritten' })
    .eq('id', auditRow!.id);
  check('audit_logs cannot be updated', auditUpdate !== null, auditUpdate?.message);

  const { error: auditDelete } = await admin.from('audit_logs').delete().eq('id', auditRow!.id);
  check('audit_logs cannot be deleted', auditDelete !== null, auditDelete?.message);

  const { error: uploadDelete } = await admin
    .from('raw_uploads')
    .delete()
    .eq('id', alphaData.uploadId);
  check('raw_uploads cannot be deleted', uploadDelete !== null, uploadDelete?.message);

  // The one legitimate transition: pending -> stored.
  const { error: completeError } = await admin
    .from('raw_uploads')
    .update({ status: 'stored', completed_at: new Date().toISOString() })
    .eq('id', alphaData.uploadId);
  check('raw_uploads pending -> stored is allowed', completeError === null, completeError?.message);

  // ...and only once.
  const { error: secondUpdate } = await admin
    .from('raw_uploads')
    .update({ original_filename: 'tampered.csv' })
    .eq('id', alphaData.uploadId);
  check('a stored raw_upload cannot be rewritten', secondUpdate !== null, secondUpdate?.message);

  // --- Lineage constraints --------------------------------------------------

  console.log('\nLineage\n');

  const { error: duplicateVersion } = await admin.from('dataset_versions').insert({
    dataset_id: alphaData.datasetId,
    version_no: 0,
    kind: 'raw',
    created_by: alpha.userId,
  });
  check('a version number cannot be reused', duplicateVersion !== null, duplicateVersion?.message);

  const { error: orphanVersion } = await admin.from('dataset_versions').insert({
    dataset_id: alphaData.datasetId,
    version_no: 1,
    kind: 'cleaned',
    parent_version_id: null,
    created_by: alpha.userId,
  });
  check('a non-zero version needs a parent', orphanVersion !== null, orphanVersion?.message);

  const { error: childVersion } = await admin.from('dataset_versions').insert({
    dataset_id: alphaData.datasetId,
    version_no: 1,
    kind: 'cleaned',
    parent_version_id: alphaData.versionId,
    parquet_path: 'parquet/example.parquet',
    created_by: alpha.userId,
  });
  check('a child version with a parent is allowed', childVersion === null, childVersion?.message);

  // --- Result ---------------------------------------------------------------

  console.log(`\n${passed} passed, ${failures.length} failed\n`);

  if (failures.length > 0) {
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
