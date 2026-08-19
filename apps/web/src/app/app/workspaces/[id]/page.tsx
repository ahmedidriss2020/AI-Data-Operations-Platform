import { notFound } from 'next/navigation';

import { UploadPanel } from '@/components/upload-panel';
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui';
import { requireCurrentOrg } from '@/lib/authz';
import { createServerSupabase } from '@/lib/supabase/server';
import { formatBytes } from '@/lib/storage';

export default async function WorkspacePage({ params }: PageProps<'/app/workspaces/[id]'>) {
  const { id } = await params;
  const { org } = await requireCurrentOrg();
  const supabase = await createServerSupabase();

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, client_name, org_id')
    .eq('id', id)
    .maybeSingle();

  // RLS already hides other tenants' workspaces, so a miss here is a 404 rather
  // than a 403 -- the API should not confirm that someone else's id is real.
  if (!workspace || workspace.org_id !== org.id) notFound();

  const [{ data: datasets }, { data: uploads }] = await Promise.all([
    supabase
      .from('datasets')
      .select('id, name')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('raw_uploads')
      .select('id, original_filename, byte_size, status, created_at, sha256, dataset_id')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const datasetNames = new Map((datasets ?? []).map((d) => [d.id, d.name]));

  return (
    <>
      <PageHeader
        title={workspace.name}
        subtitle={workspace.client_name ?? 'Client workspace'}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-60">
            Upload a file
          </h2>
          <Card>
            <UploadPanel workspaceId={workspace.id} datasets={datasets ?? []} />
          </Card>
          <p className="mt-3 text-xs opacity-60">
            Files are stored exactly as they arrived. Nothing is modified in place — cleaning writes
            a new version and leaves the original intact.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide opacity-60">
            Uploads
          </h2>

          {!uploads || uploads.length === 0 ? (
            <EmptyState
              title="Nothing uploaded yet"
              body="Upload the file this client sends you every month. Parsing and cleaning arrive in the next phase; for now it is stored, attributed and auditable."
            />
          ) : (
            <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
              {uploads.map((upload) => (
                <li key={upload.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{upload.original_filename}</p>
                    <p className="text-xs opacity-60">
                      {upload.dataset_id ? datasetNames.get(upload.dataset_id) ?? 'Unknown dataset' : 'No dataset'}
                      {' · '}
                      {new Date(upload.created_at).toLocaleString('en-GB')}
                      {' · '}
                      {formatBytes(upload.byte_size)}
                    </p>
                  </div>
                  <StatusBadge status={upload.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
