import type { ReactNode } from 'react';

/**
 * The small set of presentational primitives the Week 1 shell needs. Hand-
 * rolled Tailwind rather than a component library: seven screens do not justify
 * the dependency, and the visual language here is deliberately plain -- the
 * product's credibility comes from traceable numbers, not from chrome.
 */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-black/10 bg-white p-5 dark:border-white/15 dark:bg-white/5 ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm opacity-70">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs opacity-60">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none placeholder:opacity-50 focus:border-black/40 dark:border-white/20 dark:focus:border-white/50';

export const buttonClass =
  'inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10';

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
      {children}
    </p>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-black/15 p-8 text-center dark:border-white/20">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm opacity-70">{body}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  stored: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  failed: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? 'bg-black/10 dark:bg-white/10'
      }`}
    >
      {status}
    </span>
  );
}
