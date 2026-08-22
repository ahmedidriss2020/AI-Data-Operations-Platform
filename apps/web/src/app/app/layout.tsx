import Link from 'next/link';
import { requireCurrentOrg } from '@/lib/authz';
import { Logo, NavItem } from '@/components/ui';

export default async function AppLayout({ children }: LayoutProps<'/app'>) {
  const { org, role } = await requireCurrentOrg();

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row" style={{ background: 'var(--az-bg)' }}>
      {/* Sidebar Navigation */}
      <aside
        className="flex w-full shrink-0 flex-col justify-between border-b p-4 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r lg:p-6"
        style={{
          background: 'var(--az-bg-sidebar)',
          borderColor: 'var(--az-border)',
        }}
      >
        <div className="space-y-6">
          {/* Logo & Brand Header */}
          <div className="flex items-center justify-between">
            <Link href="/app" className="inline-block transition-transform hover:scale-105">
              <Logo size="md" />
            </Link>
          </div>

          {/* Org Selector Card */}
          <div
            className="flex items-center gap-3 rounded-xl p-3"
            style={{
              background: 'var(--az-gradient-card)',
              border: '1px solid var(--az-border)',
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-white shadow-sm"
              style={{ background: 'var(--az-gradient-brand)' }}
            >
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--az-text-subtle)' }}>
                Firm
              </p>
              <p className="truncate text-sm font-bold" style={{ color: 'var(--az-text)' }}>
                {org.name}
              </p>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{
                background: 'rgba(99,102,241,.12)',
                color: 'var(--az-primary-600)',
              }}
            >
              {role}
            </span>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1.5">
            <NavItem
              href="/app"
              label="Client Workspaces"
              active={true}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              }
            />
            <NavItem
              href="/app/audit"
              label="Audit Log"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              }
            />
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="mt-8 space-y-4 border-t pt-4" style={{ borderColor: 'var(--az-border)' }}>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-red-500/10 hover:text-red-500"
              style={{ color: 'var(--az-text-muted)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>

        <footer
          className="border-t px-6 py-4 text-center text-xs"
          style={{
            borderColor: 'var(--az-border)',
            color: 'var(--az-text-subtle)',
          }}
        >
          A copilot, not an autonomous accountant. Every material change is reviewed and signed off by a person, and every number can be traced to its source rows.
        </footer>
      </div>
    </div>
  );
}
