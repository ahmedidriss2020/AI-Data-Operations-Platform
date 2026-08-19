/**
 * End-to-end pass over the running application: sign in, create a firm and a
 * client workspace, upload the messy fixture through the real upload routes,
 * and confirm the file, its lineage row and its audit entry all exist.
 *
 * It drives the actual Next.js server over HTTP rather than calling the
 * database directly, because the things most likely to break -- the proxy's
 * session refresh, the authorization checks in the route handlers, the signed
 * upload URL -- only exist on that path.
 *
 * Sessions are handed to the server as a forged @supabase/ssr cookie: sign in
 * against GoTrue, then serialise the session the way the library does. That is
 * far quicker than driving a browser and covers the same server code.
 *
 * Usage: npm run test:e2e     (requires `supabase start` and `npm run dev`)
 */

import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv({ path: 'apps/web/.env.local', quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:3100';
const FIXTURE = 'fixtures/messy/acme-sales-2026-08.xlsx';

/** @supabase/ssr splits an oversized cookie at this width. */
const MAX_CHUNK_SIZE = 3180;

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

/** Cookie name is derived from the first label of the API host. */
function cookieBaseName(): string {
  return `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
}

function sessionCookie(session: unknown): string {
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const base = cookieBaseName();

  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += MAX_CHUNK_SIZE) {
    chunks.push(encoded.slice(i, i + MAX_CHUNK_SIZE));
  }

  return chunks.map((chunk, index) => `${base}.${index}=${chunk}`).join('; ');
}

async function signUpUser(label: string) {
  const email = `${label}-${randomUUID().slice(0, 8)}@example.test`;
  const password = `pw-${randomUUID()}`;

  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser failed: ${error.message}`);

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: PUBLISHABLE_KEY },
    body: JSON.stringify({ email, password }),
  });

  const session = await response.json();
  if (!response.ok) throw new Error(`sign-in failed: ${JSON.stringify(session)}`);

  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  return { email, cookie: sessionCookie(session), client, userId: session.user.id as string };
}

const get = (path: string, cookie?: string) =>
  fetch(`${APP_URL}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });

const postJson = (path: string, body: unknown, cookie?: string) =>
  fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
    redirect: 'manual',
  });

async function main() {
  console.log('\nRoute guards\n');

  const anonRoot = await get('/');
  check('/ redirects an anonymous visitor', anonRoot.status === 307, `status ${anonRoot.status}`);
  check(
    '/ sends them to /login',
    (anonRoot.headers.get('location') ?? '').includes('/login'),
    anonRoot.headers.get('location') ?? '',
  );

  const anonApp = await get('/app');
  check('/app is closed to anonymous visitors', anonApp.status === 307, `status ${anonApp.status}`);

  const anonSign = await postJson('/api/uploads/sign', {
    workspaceId: randomUUID(),
    filename: 'x.xlsx',
    byteSize: 10,
  });
  check(
    'the upload API rejects anonymous callers',
    anonSign.status === 401 || anonSign.status === 307,
    `status ${anonSign.status}`,
  );

  const alpha = await signUpUser('alpha');
  const beta = await signUpUser('beta');

  const newUserApp = await get('/app', alpha.cookie);
  check(
    'a user with no firm is sent to onboarding',
    newUserApp.status === 307 && (newUserApp.headers.get('location') ?? '').includes('/onboarding'),
    `${newUserApp.status} ${newUserApp.headers.get('location') ?? ''}`,
  );

  console.log('\nOnboarding\n');

  // Same RPCs the server actions call.
  const { data: org, error: orgError } = await alpha.client.rpc('create_organization', {
    p_name: 'Test Accounting LLP',
    p_slug: `test-accounting-${randomUUID().slice(0, 6)}`,
  });
  check('a firm can be created', orgError === null, orgError?.message);

  const { data: workspace, error: wsError } = await alpha.client.rpc('create_workspace', {
    p_org_id: org.id,
    p_name: 'ACME Ltd',
    p_client_name: 'ACME Trading Ltd',
  });
  check('a client workspace can be created', wsError === null, wsError?.message);

  // Beta is onboarded too, so the cross-tenant checks below exercise a real
  // rival firm rather than a user who simply has no organization yet.
  const { data: betaOrg } = await beta.client.rpc('create_organization', {
    p_name: 'Rival Bookkeeping',
    p_slug: `rival-bookkeeping-${randomUUID().slice(0, 6)}`,
  });
  await beta.client.rpc('create_workspace', {
    p_org_id: betaOrg.id,
    p_name: 'Rival client',
  });

  const appPage = await get('/app', alpha.cookie);
  const appHtml = await appPage.text();
  check('/app renders for an onboarded user', appPage.status === 200, `status ${appPage.status}`);
  check('the workspace appears on /app', appHtml.includes('ACME Ltd'));

  console.log('\nUpload\n');

  // Beta must not be able to upload into Alpha's workspace, even though the
  // route holds the service-role key.
  const crossTenant = await postJson(
    '/api/uploads/sign',
    { workspaceId: workspace.id, filename: 'intruder.xlsx', byteSize: 100, datasetName: 'x' },
    beta.cookie,
  );
  check(
    "another firm cannot upload into this workspace",
    crossTenant.status === 404,
    `status ${crossTenant.status}`,
  );

  const rejected = await postJson(
    '/api/uploads/sign',
    { workspaceId: workspace.id, filename: 'notes.txt', byteSize: 100, datasetName: 'x' },
    alpha.cookie,
  );
  check('unsupported file types are rejected', rejected.status === 400, `status ${rejected.status}`);

  const bytes = readFileSync(FIXTURE);
  const filename = 'ACME Sales — August 2026 (final).xlsx';

  const signResponse = await postJson(
    '/api/uploads/sign',
    {
      workspaceId: workspace.id,
      filename,
      byteSize: bytes.byteLength,
      datasetName: 'Monthly sales export',
    },
    alpha.cookie,
  );
  const signed = await signResponse.json();
  check('the upload is signed', signResponse.status === 200, JSON.stringify(signed));
  check(
    'the storage path is org- and workspace-scoped',
    typeof signed.storagePath === 'string' &&
      signed.storagePath.startsWith(`${org.id}/${workspace.id}/`),
    signed.storagePath,
  );
  check(
    'the awkward filename is sanitised in the key',
    typeof signed.storagePath === 'string' && /^[\w./-]+$/.test(signed.storagePath),
    signed.storagePath,
  );

  // Mirrors the browser: the type must be on the blob, because the storage
  // client ignores its contentType option for Blob bodies.
  const { error: uploadError } = await alpha.client.storage
    .from(signed.bucket)
    .uploadToSignedUrl(
      signed.storagePath,
      signed.token,
      new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
  check('the file uploads to storage', uploadError === null, uploadError?.message);

  const sha256 = createHash('sha256').update(bytes).digest('hex');

  const completeResponse = await postJson(
    '/api/uploads/complete',
    { uploadId: signed.uploadId, workspaceId: workspace.id, sha256 },
    alpha.cookie,
  );
  const completed = await completeResponse.json();
  check('the upload is finalised', completeResponse.status === 200, JSON.stringify(completed));
  check('it is recorded as stored', completed.status === 'stored', JSON.stringify(completed));
  check(
    'the byte size matches the file on disk',
    completed.byteSize === bytes.byteLength,
    `${completed.byteSize} vs ${bytes.byteLength}`,
  );
  check('a v0 dataset version was opened', typeof completed.datasetVersionId === 'string');

  console.log('\nPersistence\n');

  const { data: object } = await admin.storage
    .from('raw')
    .list(signed.storagePath.split('/').slice(0, -1).join('/'));
  check(
    'the object exists in the raw bucket',
    (object ?? []).some((entry) => signed.storagePath.endsWith(entry.name)),
  );

  const { data: uploadRow } = await admin
    .from('raw_uploads')
    .select('status, original_filename, sha256, byte_size')
    .eq('id', signed.uploadId)
    .single();
  check('raw_uploads records the original filename verbatim', uploadRow!.original_filename === filename);
  check('raw_uploads records the sha256', uploadRow!.sha256 === sha256);

  const { data: version } = await admin
    .from('dataset_versions')
    .select('version_no, kind, parent_version_id, raw_upload_id')
    .eq('id', completed.datasetVersionId)
    .single();
  check('the lineage chain starts at v0', version!.version_no === 0 && version!.kind === 'raw');
  check('v0 has no parent', version!.parent_version_id === null);
  check('v0 points at the upload', version!.raw_upload_id === signed.uploadId);

  console.log('\nUI\n');

  const workspacePage = await get(`/app/workspaces/${workspace.id}`, alpha.cookie);
  const workspaceHtml = await workspacePage.text();
  check('the workspace page renders', workspacePage.status === 200, `status ${workspacePage.status}`);
  check('it lists the uploaded file', workspaceHtml.includes('ACME Sales'));
  check('it shows the stored status', workspaceHtml.includes('stored'));

  const betaView = await get(`/app/workspaces/${workspace.id}`, beta.cookie);
  check(
    'another firm gets a 404 for this workspace',
    betaView.status === 404,
    `status ${betaView.status}`,
  );

  const betaAudit = await get('/app/audit', beta.cookie);
  const betaAuditHtml = await betaAudit.text();
  check(
    "another firm's audit log shows none of this activity",
    !betaAuditHtml.includes('upload.stored') && !betaAuditHtml.includes('ACME'),
  );

  const auditPage = await get('/app/audit', alpha.cookie);
  const auditHtml = await auditPage.text();
  check('the audit log renders', auditPage.status === 200, `status ${auditPage.status}`);
  for (const action of ['organization.created', 'workspace.created', 'dataset.created', 'upload.stored']) {
    check(`the audit log contains ${action}`, auditHtml.includes(action));
  }

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
