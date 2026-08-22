import type { ReactNode } from 'react';

/* ==========================================================================
   AnalyzeIt — Component Library
   
   Premium, branded primitives for the AnalyzeIt platform.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Logo
   -------------------------------------------------------------------------- */

export function Logo({ size = 'md', showText = true }: { size?: 'sm' | 'md' | 'lg'; showText?: boolean }) {
  const dims = { sm: 28, md: 36, lg: 48 }[size];
  const textClass = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl' }[size];

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative flex items-center justify-center rounded-xl"
        style={{
          width: dims,
          height: dims,
          background: 'var(--az-gradient-brand)',
          boxShadow: '0 2px 8px rgba(99,102,241,.3)',
        }}
      >
        <svg
          width={dims * 0.55}
          height={dims * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
          <line x1="12" y1="22" x2="12" y2="6.81" />
          <path d="M3.27 6.96 12 12.01l8.73-5.05" />
        </svg>
      </div>
      {showText && (
        <span className={`${textClass} font-bold tracking-tight`} style={{ color: 'var(--az-text)' }}>
          Analyze<span style={{ color: 'var(--az-primary-500)' }}>It</span>
        </span>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Card
   -------------------------------------------------------------------------- */

export function Card({
  children,
  className = '',
  variant = 'default',
  hover = false,
  padding = 'md',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'elevated' | 'gradient';
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}) {
  const paddingClass = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' }[padding];

  const variantStyles: Record<string, string> = {
    default: '',
    glass: 'az-glass',
    elevated: '',
    gradient: '',
  };

  const variantInline: Record<string, React.CSSProperties> = {
    default: {
      background: 'var(--az-bg-card)',
      border: '1px solid var(--az-border)',
      borderRadius: 'var(--az-radius-lg)',
      boxShadow: 'var(--az-shadow-sm)',
    },
    glass: { borderRadius: 'var(--az-radius-lg)' },
    elevated: {
      background: 'var(--az-bg-elevated)',
      border: '1px solid var(--az-border)',
      borderRadius: 'var(--az-radius-lg)',
      boxShadow: 'var(--az-shadow-md)',
    },
    gradient: {
      background: 'var(--az-bg-card)',
      border: '1px solid var(--az-border)',
      borderRadius: 'var(--az-radius-lg)',
      boxShadow: 'var(--az-shadow-sm)',
      backgroundImage: 'var(--az-gradient-card)',
    },
  };

  return (
    <div
      className={`${paddingClass} ${variantStyles[variant]} ${
        hover
          ? 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer'
          : ''
      } ${className}`}
      style={{
        ...variantInline[variant],
        ...(hover ? { transition: 'all var(--az-transition-smooth)' } : {}),
      }}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Page Header
   -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 az-animate-in">
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="flex items-center justify-center rounded-xl"
            style={{
              width: 44,
              height: 44,
              background: 'var(--az-gradient-card)',
              border: '1px solid var(--az-border)',
              color: 'var(--az-primary-500)',
            }}
          >
            {icon}
          </div>
        )}
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--az-text)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm" style={{ color: 'var(--az-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions}
    </div>
  );
}

/* --------------------------------------------------------------------------
   KPI Card
   -------------------------------------------------------------------------- */

export function KpiCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div
      className="flex items-start gap-3 p-4 az-animate-in"
      style={{
        background: 'var(--az-bg-card)',
        border: '1px solid var(--az-border)',
        borderRadius: 'var(--az-radius-lg)',
        boxShadow: 'var(--az-shadow-sm)',
      }}
    >
      {icon && (
        <div
          className="flex shrink-0 items-center justify-center rounded-lg"
          style={{
            width: 40,
            height: 40,
            background: 'var(--az-gradient-card)',
            color: 'var(--az-primary-500)',
          }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--az-text-subtle)' }}>
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight" style={{ color: 'var(--az-text)' }}>
          {value}
        </p>
        {trend && (
          <p
            className="mt-0.5 text-xs font-medium"
            style={{ color: trend.positive ? 'var(--az-success-500)' : 'var(--az-danger-500)' }}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Form Field
   -------------------------------------------------------------------------- */

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
      <span
        className="mb-1.5 block text-sm font-semibold"
        style={{ color: 'var(--az-text)' }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          className="mt-1.5 block text-xs"
          style={{ color: 'var(--az-text-subtle)' }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

/* --------------------------------------------------------------------------
   Shared Styles (class strings)
   -------------------------------------------------------------------------- */

export const inputClass = [
  'w-full rounded-lg px-3.5 py-2.5 text-sm outline-none placeholder:opacity-50',
  'transition-all duration-200',
].join(' ');

export const inputStyle: React.CSSProperties = {
  background: 'var(--az-bg-input)',
  border: '1.5px solid var(--az-border)',
  borderRadius: 'var(--az-radius-md)',
  color: 'var(--az-text)',
};

export const inputFocusHandler = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'var(--az-primary-400)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,.12)';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = 'var(--az-border)';
    e.currentTarget.style.boxShadow = 'none';
  },
};

export const buttonClass = [
  'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5',
  'text-sm font-semibold text-white',
  'transition-all duration-200',
  'hover:shadow-lg hover:-translate-y-0.5',
  'active:translate-y-0 active:shadow-md',
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none',
].join(' ');

export const buttonStyle: React.CSSProperties = {
  background: 'var(--az-gradient-brand)',
  borderRadius: 'var(--az-radius-md)',
  boxShadow: '0 2px 8px rgba(99,102,241,.25)',
};

export const secondaryButtonClass = [
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
  'text-sm font-semibold',
  'transition-all duration-200',
  'hover:shadow-sm',
  'disabled:opacity-50',
].join(' ');

export const secondaryButtonStyle: React.CSSProperties = {
  background: 'var(--az-bg-card)',
  border: '1.5px solid var(--az-border)',
  borderRadius: 'var(--az-radius-md)',
  color: 'var(--az-text)',
};

/* --------------------------------------------------------------------------
   Error Text
   -------------------------------------------------------------------------- */

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      className="flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm"
      style={{
        background: 'rgba(239,68,68,.08)',
        border: '1px solid rgba(239,68,68,.2)',
        borderRadius: 'var(--az-radius-md)',
        color: 'var(--az-danger-500)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      {children}
    </p>
  );
}

/* --------------------------------------------------------------------------
   Empty State
   -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center py-12 text-center az-animate-in"
      style={{
        background: 'var(--az-bg-card)',
        border: '2px dashed var(--az-border)',
        borderRadius: 'var(--az-radius-xl)',
      }}
    >
      {icon ? (
        <div
          className="mb-4 flex items-center justify-center rounded-2xl"
          style={{
            width: 56,
            height: 56,
            background: 'var(--az-gradient-card)',
            color: 'var(--az-primary-400)',
          }}
        >
          {icon}
        </div>
      ) : (
        <div
          className="mb-4 flex items-center justify-center rounded-2xl"
          style={{
            width: 56,
            height: 56,
            background: 'var(--az-gradient-card)',
            color: 'var(--az-primary-400)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M12 8v8" />
            <path d="M8 12h8" />
          </svg>
        </div>
      )}
      <p className="text-base font-semibold" style={{ color: 'var(--az-text)' }}>
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm" style={{ color: 'var(--az-text-muted)' }}>
        {body}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Status Badge
   -------------------------------------------------------------------------- */

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  stored: {
    bg: 'rgba(16,185,129,.1)',
    text: 'var(--az-success-500)',
    dot: 'var(--az-success-400)',
  },
  pending: {
    bg: 'rgba(245,158,11,.1)',
    text: 'var(--az-warning-500)',
    dot: 'var(--az-warning-400)',
  },
  failed: {
    bg: 'rgba(239,68,68,.1)',
    text: 'var(--az-danger-500)',
    dot: 'var(--az-danger-400)',
  },
  active: {
    bg: 'rgba(16,185,129,.1)',
    text: 'var(--az-success-500)',
    dot: 'var(--az-success-400)',
  },
};

const DEFAULT_STATUS = {
  bg: 'rgba(100,116,139,.1)',
  text: 'var(--az-text-muted)',
  dot: 'var(--az-text-subtle)',
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? DEFAULT_STATUS;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        background: config.bg,
        color: config.text,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: config.dot,
          ...(status === 'pending' ? { animation: 'az-pulse-soft 2s ease-in-out infinite' } : {}),
        }}
      />
      {status}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Spinner
   -------------------------------------------------------------------------- */

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: 'az-spin .6s linear infinite' }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity=".3" />
      <path d="M12 2v4" />
    </svg>
  );
}

/* --------------------------------------------------------------------------
   Nav Item (for sidebar)
   -------------------------------------------------------------------------- */

export function NavItem({
  href,
  label,
  icon,
  active = false,
  children,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  children?: ReactNode;
}) {
  // Using <a> so this works server-side; Next.js Link can wrap this externally
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200"
      style={{
        background: active ? 'var(--az-gradient-card)' : 'transparent',
        color: active ? 'var(--az-primary-600)' : 'var(--az-text-muted)',
        ...(active ? { border: '1px solid rgba(99,102,241,.15)' } : { border: '1px solid transparent' }),
      }}
    >
      <span className="flex shrink-0 items-center" style={{ color: active ? 'var(--az-primary-500)' : 'var(--az-text-subtle)' }}>
        {icon}
      </span>
      {label}
      {children}
    </a>
  );
}

/* --------------------------------------------------------------------------
   Progress Bar
   -------------------------------------------------------------------------- */

export function ProgressBar({ progress, label }: { progress: number; label?: string }) {
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span style={{ color: 'var(--az-text-muted)' }}>{label}</span>
          <span className="font-medium" style={{ color: 'var(--az-primary-500)' }}>
            {Math.round(progress)}%
          </span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--az-border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: 'var(--az-gradient-brand)',
            boxShadow: '0 0 8px rgba(99,102,241,.3)',
          }}
        />
      </div>
    </div>
  );
}
