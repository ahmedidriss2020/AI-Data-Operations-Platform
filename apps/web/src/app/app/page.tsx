import Link from 'next/link';

import { CreateWorkspaceForm } from '@/components/create-workspace-form';
import { Card, EmptyState, KpiCard, PageHeader, StatusBadge } from '@/components/ui';
import { requireCurrentOrg } from '@/lib/authz';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = { title: 'Client Workspaces · AnalyzeIt' };

export default async function AppHomePage() {
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
        subtitle="Manage client data pipelines, versioned recipes, and automated monthly executions."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        }
        actions={canCreate ? <CreateWorkspaceForm orgId={org.id} /> : null}
      />

      {/* KPI Highlights Bar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active Workspaces"
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
          label="Active Recipes"
          value={workspaces.length > 0 ? `${workspaces.length} v1` : '0'}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          }
        />
        <KpiCard
          label="Avg Automation"
          value="99.1%"
          trend={{ value: "+4.2% vs last month", positive: true }}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
        <KpiCard
          label="Audit Lineage"
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
          title="No client workspaces configured"
          body={
            canCreate
              ? 'Create your first workspace for a client whose monthly exports you process manually. AnalyzeIt will learn and automate the cleaning recipe.'
              : 'An owner or admin of this firm needs to create the first workspace.'
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--az-text-subtle)' }}>
              Workspaces ({workspaces.length})
            </h2>
          </div>

          <ul className="az-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <li key={workspace.id} className="az-animate-in">
                <Link href={`/app/workspaces/${workspace.id}`} className="block">
                  <Card hover variant="gradient" className="group relative overflow-hidden">
                    {/* Top Accent Strip */}
                    <div
                      className="absolute left-0 top-0 h-1 w-full"
                      style={{ background: 'var(--az-gradient-brand)' }}
                    />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold transition-colors group-hover:text-[var(--az-primary-600)]" style={{ color: 'var(--az-text)' }}>
                          {workspace.name}
                        </p>
                        {workspace.client_name ? (
                          <p className="mt-0.5 truncate text-xs font-medium" style={{ color: 'var(--az-text-muted)' }}>
                            {workspace.client_name}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-xs italic" style={{ color: 'var(--az-text-subtle)' }}>
                            No client details
                          </p>
                        )}
                      </div>
                      <StatusBadge status={workspace.status} />
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t pt-3 text-xs" style={{ borderColor: 'var(--az-border)' }}>
                      <span style={{ color: 'var(--az-text-subtle)' }}>
                        Created {new Date(workspace.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="flex items-center gap-1 font-semibold group-hover:translate-x-0.5 transition-transform" style={{ color: 'var(--az-primary-500)' }}>
                        View Workspace
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
