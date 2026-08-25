import Link from 'next/link';
import { requireCurrentOrg } from '@/lib/authz';
import { AgentStatus } from '@/components/agent-status';
import { Logo, NavItem } from '@/components/ui';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
            <Link href="/app" className="inline-block">
              <Logo size="md" />
            </Link>
          </div>

          {/* Org Selector Card */}
          <div
            className="flex items-center gap-3 rounded-xl p-3 border transition-colors hover:border-emerald-500/30 cursor-pointer"
            style={{
              background: 'var(--az-gradient-card)',
              borderColor: 'var(--az-border)',
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-extrabold text-slate-950 shadow-md"
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' }}
            >
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Practice Firm
              </p>
              <p className="truncate text-sm font-bold text-slate-100">
                {org.name}
              </p>
            </div>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border border-emerald-500/30"
              style={{
                background: 'rgba(16,185,129,.12)',
                color: '#34d399',
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
              href="/app/chat"
              label="Hermes Copilot"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              }
            />
            <NavItem
              href="/app/analytics"
              label="Data Analytics"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              }
            />
            <NavItem
              href="/app/recipes"
              label="Recipe Builder"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              }
            />
            <NavItem
              href="/app/exceptions"
              label="Exception Queue"
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              }
            />
            <NavItem
              href="/app/audit"
              label="Audit Trail & Lineage"
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
          {/* Live agent status -- polls /api/hermes/health. */}
          <AgentStatus />

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
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
          className="border-t px-6 py-4 text-center text-xs text-slate-500"
          style={{
            borderColor: 'var(--az-border)',
          }}
        >
          AnalyzeIt Copilot · Every material change is signed off by a person with 100% financial row-level auditability.
        </footer>
      </div>
    </div>
  );
}
