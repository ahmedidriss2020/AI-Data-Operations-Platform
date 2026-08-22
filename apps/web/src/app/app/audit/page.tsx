import { Card, EmptyState, PageHeader } from '@/components/ui';
import { requireCurrentOrg } from '@/lib/authz';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata = { title: 'Audit Trail · AnalyzeIt' };

export default async function AuditPage() {
  const { org } = await requireCurrentOrg();
  const supabase = await createServerSupabase();

  const [{ data: entries, error }, { data: workspaces }] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, workspace_id, actor_user_id, metadata, created_at')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('workspaces').select('id, name').eq('org_id', org.id),
  ]);

  if (error) throw new Error(`Could not load the audit log: ${error.message}`);

  const workspaceNames = new Map((workspaces ?? []).map((w) => [w.id, w.name]));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit Trail & Lineage"
        subtitle="Immutable append-only ledger of every data operation, recipe execution, and user action."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        }
      />

      {!entries || entries.length === 0 ? (
        <EmptyState
          title="No audit activity recorded"
          body="All user actions, file uploads, and recipe replay events will be logged here immutably."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[50rem] text-left text-sm">
              <thead
                className="border-b text-xs font-bold uppercase tracking-wider"
                style={{
                  borderColor: 'var(--az-border)',
                  background: 'var(--az-bg-subtle)',
                  color: 'var(--az-text-subtle)',
                }}
              >
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Action Event</th>
                  <th className="px-5 py-3.5">Workspace</th>
                  <th className="px-5 py-3.5">Metadata & Details</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--az-border)' }}>
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-[var(--az-bg-subtle)]">
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs font-medium" style={{ color: 'var(--az-text-muted)' }}>
                      {new Date(entry.created_at).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold"
                        style={{
                          background: 'rgba(99,102,241,.1)',
                          color: 'var(--az-primary-600)',
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--az-primary-500)' }} />
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold" style={{ color: 'var(--az-text)' }}>
                      {entry.workspace_id ? workspaceNames.get(entry.workspace_id) ?? '—' : 'Firm Root'}
                    </td>
                    <td className="px-5 py-3.5">
                      <code
                        className="rounded px-2 py-1 text-xs font-mono"
                        style={{
                          background: 'var(--az-bg-subtle)',
                          color: 'var(--az-text-muted)',
                        }}
                      >
                        {summarise(entry.metadata)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function summarise(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return '—';

  const record = metadata as Record<string, unknown>;
  const interesting = ['name', 'original_filename', 'client_name', 'slug', 'byte_size', 'reason'];

  const parts = interesting
    .filter((key) => record[key] !== undefined && record[key] !== null)
    .map((key) => `${key}: "${String(record[key])}"`);

  return parts.length > 0 ? parts.join(' · ') : '—';
}
