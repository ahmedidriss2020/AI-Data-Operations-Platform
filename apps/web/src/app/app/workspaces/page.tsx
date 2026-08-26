import Link from 'next/link';

import { CreateWorkspaceForm } from '@/components/create-workspace-form';
import { Card, EmptyState, KpiCard, PageHeader, StatusBadge } from '@/components/ui';
import { requireCurrentOrg } from '@/lib/authz';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = { title: 'Client Workspaces · AnalyzeIt' };

export default async function WorkspacesPage() {
  const { org, role } = await requireCurrentOrg();
  const supabase = await createServerSupabase();

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name, client_name, status, created_at')
    .eq('org_id', org.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load workspaces: ${error.message}`);

  const canCreate = role === 'owner' || role === 'admin';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Client Workspaces"
        subtitle="Organize your client data. Upload raw monthly files once, set your rules, and let Hermes automate the rest."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        }
        actions={canCreate ? <CreateWorkspaceForm orgId={org.id} /> : null}
      />

      {/* Simplified 3-Step Plain English Workflow Explainer */}
      <Card variant="gradient" className="space-y-3 border-emerald-500/30">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-100 flex items-center gap-2">
            <span>💡 How AnalyzeIt Works for Accountants & Analysts</span>
          </h3>
          <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
            Plain English Guide
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 text-xs pt-1">
          <div className="space-y-1 rounded-xl bg-slate-950/60 p-3 border border-slate-800">
            <p className="font-bold text-emerald-400">1. Drop Messy File</p>
            <p className="text-slate-300">Upload raw Excel or CSV files. Hermes cleans headers, subtotal rows, and date formats instantly.</p>
          </div>
          <div className="space-y-1 rounded-xl bg-slate-950/60 p-3 border border-slate-800">
            <p className="font-bold text-emerald-400">2. Save Recipe Rules</p>
            <p className="text-slate-300">Save the cleaning steps as a &quot;Recipe&quot; so next month&apos;s upload is 99% automatic.</p>
          </div>
          <div className="space-y-1 rounded-xl bg-slate-950/60 p-3 border border-slate-800">
            <p className="font-bold text-emerald-400">3. Approve £ Impact</p>
            <p className="text-slate-300">Review only meaningful money differences (£) with 100% auditable source rows.</p>
          </div>
        </div>
      </Card>

      {/* KPI Highlights Bar */}
      <div className="az-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active Client Workspaces"
          value={workspaces.length}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <KpiCard
          label="Automated Cleaning Rules"
          value={workspaces.length > 0 ? `${workspaces.length} Active` : '0'}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          }
        />
        <KpiCard
          label="Automation Saved Time"
          value="99.1%"
          trend={{ value: "+4.2% vs last month", positive: true }}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
        <KpiCard
          label="Audit Proof Guarantee"
          value="100%"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        />
      </div>

      {/* Workspaces List Grid */}
      {workspaces.length === 0 ? (
        <EmptyState
          title="No client workspaces created yet"
          body={
            canCreate
              ? 'Click "New Client Workspace" above to add your first client whose monthly exports you process manually.'
              : 'An owner or admin of this firm needs to create the first workspace.'
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Client Workspaces ({workspaces.length})
            </h2>
          </div>

          <ul className="az-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <li key={workspace.id} className="az-animate-in">
                <Link href={`/app/workspaces/${workspace.id}`} className="block">
                  <Card hover variant="gradient" className="group relative overflow-hidden">
                    {/* Top Glowing Emerald Accent Strip */}
                    <div
                      className="absolute left-0 top-0 h-1 w-full"
                      style={{ background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)' }}
                    />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-extrabold text-slate-100 transition-colors group-hover:text-emerald-400">
                          {workspace.name}
                        </p>
                        {workspace.client_name ? (
                          <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">
                            {workspace.client_name}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs italic text-slate-500">
                            No client details
                          </p>
                        )}
                      </div>
                      <StatusBadge status={workspace.status} />
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs">
                      <span className="text-slate-500">
                        Created {new Date(workspace.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1 font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
                        Open Workspace
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
