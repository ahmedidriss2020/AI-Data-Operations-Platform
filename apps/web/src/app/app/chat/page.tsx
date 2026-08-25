import Link from 'next/link';

import { HermesChat } from '@/components/hermes-chat';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { requireCurrentOrg } from '@/lib/authz';
import { isHermesConfigured } from '@/lib/hermes';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = { title: 'Hermes Copilot · AnalyzeIt' };

/**
 * Chat is workspace-scoped, not org-scoped: an answer about "last month's
 * revenue" is meaningless without knowing whose books are being asked about,
 * and scoping at the page level means the tool layer receives one workspace id
 * to authorize rather than a set to disambiguate.
 */
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { org } = await requireCurrentOrg();
  const params = await searchParams;
  const supabase = await createServerSupabase();

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id, name, client_name')
    .eq('org_id', org.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load workspaces: ${error.message}`);

  const list = workspaces ?? [];
  const requested = typeof params.workspace === 'string' ? params.workspace : null;
  const active = list.find((workspace) => workspace.id === requested) ?? list[0] ?? null;

  const header = (
    <PageHeader
      title="Hermes Copilot"
      subtitle="Ask questions about a client's data. Hermes runs tools and explains; the numbers come from your data, not from the model."
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      }
    />
  );

  if (list.length === 0) {
    return (
      <div className="space-y-8">
        {header}
        <EmptyState
          title="No client workspaces yet"
          body="Create a workspace and upload a file before asking Hermes about it."
        />
        <p className="text-center">
          <Link href="/app" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
            Go to Client Workspaces →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {!isHermesConfigured() && (
        <Card className="border-amber-500/30">
          <p className="text-sm font-semibold text-amber-300">Hermes is not connected yet</p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            This deployment has no agent endpoint configured, so questions cannot be answered.
            An administrator needs to set <code className="text-slate-300">HERMES_AGENT_ENDPOINT</code> and{' '}
            <code className="text-slate-300">HERMES_API_SECRET</code> on the server — see{' '}
            <code className="text-slate-300">HERMES_DASHBOARD_INTEGRATION.md</code>.
          </p>
        </Card>
      )}

      {/* Workspace selector. Links rather than a client-side control so the
          chosen client is in the URL -- shareable, and correct after a reload. */}
      {list.length > 1 && (
        <div className="flex flex-wrap gap-2">
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

      {active && <HermesChat workspaceId={active.id} workspaceName={active.client_name ?? active.name} />}
    </div>
  );
}
