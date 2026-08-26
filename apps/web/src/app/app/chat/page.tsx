import Link from 'next/link';

import { AnalyzerIntro } from '@/components/analyzer-intro';
import { CreateWorkspaceForm } from '@/components/create-workspace-form';
import { HermesChat } from '@/components/hermes-chat';
import { StatementUpload } from '@/components/statement-upload';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { requireCurrentOrg } from '@/lib/authz';
import { isHermesConfigured } from '@/lib/hermes';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = { title: 'AI Bank Statement Analyzer · AnalyzeIt' };

/**
 * The analyzer is workspace-scoped, not org-scoped: an answer about "last
 * month's spending" is meaningless without knowing whose statement is being
 * asked about, and scoping at the page level means the tool layer receives one
 * workspace id to authorize rather than a set to disambiguate.
 *
 * This page is now the whole product surface, so it also carries the two things
 * that used to live on the workspace screens -- creating a client and uploading
 * a statement -- because nothing else in the navigation leads there.
 */
export default async function AnalyzerPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { org, role } = await requireCurrentOrg();
  const params = await searchParams;
  const supabase = await createServerSupabase();

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name, client_name')
    .eq('org_id', org.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load clients: ${error.message}`);

  const list = workspaces ?? [];
  const requested = typeof params.workspace === 'string' ? params.workspace : null;
  const active = list.find((workspace) => workspace.id === requested) ?? list[0] ?? null;
  const canCreate = role === 'owner' || role === 'admin';

  // Datasets and the statement count belong to the selected client only, so
  // neither is fetched until there is a client to fetch them for.
  let datasets: { id: string; name: string }[] = [];
  let statementCount = 0;

  if (active) {
    const [datasetResult, uploadResult] = await Promise.all([
      supabase
        .from('datasets')
        .select('id, name')
        .eq('workspace_id', active.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('raw_uploads')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', active.id),
    ]);

    datasets = datasetResult.data ?? [];
    statementCount = uploadResult.count ?? 0;
  }

  const header = (
    <PageHeader
      title="AI Bank Statement Analyzer"
      subtitle="Upload a client's bank statement and ask about it in plain English. The figures are computed from your rows, not written by the model."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="7" y1="9" x2="13" y2="9" />
          <line x1="7" y1="13" x2="11" y2="13" />
        </svg>
      }
      actions={canCreate ? <CreateWorkspaceForm orgId={org.id} /> : null}
    />
  );

  if (list.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <AnalyzerIntro />
        <EmptyState
          title="No client set up yet"
          body={
            canCreate
              ? 'Create a client above, then upload their bank statement to start asking questions about it.'
              : 'An owner or admin of this firm needs to create the first client before statements can be analyzed.'
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <AnalyzerIntro />

      {!isHermesConfigured() && (
        <Card className="border-amber-500/30">
          <p className="text-sm font-semibold text-amber-300">The analyzer is not connected yet</p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            This deployment has no agent endpoint configured, so questions cannot be answered.
            Statements can still be uploaded. An administrator needs to set{' '}
            <code className="text-slate-300">HERMES_AGENT_ENDPOINT</code> and{' '}
            <code className="text-slate-300">HERMES_API_SECRET</code> on the server — see{' '}
            <code className="text-slate-300">HERMES_DASHBOARD_INTEGRATION.md</code>.
          </p>
        </Card>
      )}

      {/* Client selector. Links rather than a client-side control so the chosen
          client is in the URL -- shareable, and correct after a reload. */}
      {list.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Client
          </span>
          {list.map((workspace) => {
            const selected = workspace.id === active?.id;
            return (
              <Link
                key={workspace.id}
                href={`/app/chat?workspace=${workspace.id}`}
                className="rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors"
                style={
                  selected
                    ? { borderColor: 'rgba(16,185,129,.4)', background: 'rgba(16,185,129,.14)', color: '#34d399' }
                    : { borderColor: 'var(--az-border)', color: '#94a3b8' }
                }
              >
                {workspace.name}
              </Link>
            );
          })}
        </div>
      )}

      {active && (
        <>
          <StatementUpload
            workspaceId={active.id}
            workspaceName={active.client_name ?? active.name}
            datasets={datasets}
            statementCount={statementCount}
          />
          <HermesChat
            workspaceId={active.id}
            workspaceName={active.client_name ?? active.name}
            datasets={datasets}
            statementCount={statementCount}
          />
        </>
      )}
    </div>
  );
}
