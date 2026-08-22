import { notFound } from 'next/navigation';

import { UploadPanel } from '@/components/upload-panel';
import { Card, EmptyState, KpiCard, PageHeader, StatusBadge } from '@/components/ui';
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
  const totalStorageBytes = (uploads ?? []).reduce((acc, u) => acc + (u.byte_size || 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title={workspace.name}
        subtitle={workspace.client_name ? `Client: ${workspace.client_name}` : 'Client Workspace Pipeline'}
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        }
      />

      {/* KPI Overview Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total Uploads"
          value={uploads?.length ?? 0}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          }
        />
        <KpiCard
          label="Recurring Datasets"
          value={datasets?.length ?? 0}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          }
        />
        <KpiCard
          label="Raw Storage Used"
          value={formatBytes(totalStorageBytes)}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          }
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Upload Client Export
          </h2>
          <Card variant="gradient">
            <UploadPanel workspaceId={workspace.id} datasets={datasets ?? []} />
          </Card>
          <p className="text-xs text-slate-500">
            🔒 Raw uploads are stored immutably with SHA-256 signatures. Recipe transformations generate new lineage versions without mutating source files.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Upload History & Datasets
          </h2>

          {!uploads || uploads.length === 0 ? (
            <EmptyState
              title="No uploads recorded yet"
              body="Upload your client's raw monthly workbook to initiate fingerprinting and version logging."
            />
          ) : (
            <Card padding="none" className="overflow-hidden">
              <ul className="divide-y border-slate-800/80">
                {uploads.map((upload) => (
                  <li key={upload.id} className="flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-800/50 cursor-pointer">
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-2"
                        style={{
                          background: 'rgba(16,185,129,.12)',
                          color: '#34d399',
                          border: '1px solid rgba(16,185,129,.3)',
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-100">
                          {upload.original_filename}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          <span className="font-semibold text-emerald-400">
                            {upload.dataset_id ? datasetNames.get(upload.dataset_id) ?? 'Dataset' : 'Unassigned'}
                          </span>
                          {' · '}
                          {new Date(upload.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {' · '}
                          {formatBytes(upload.byte_size)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={upload.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
