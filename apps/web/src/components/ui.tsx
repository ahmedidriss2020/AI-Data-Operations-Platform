import type { ReactNode } from 'react';

import { CountUp, Spotlight } from '@/components/motion';

/* ==========================================================================
   AnalyzeIt — UI/UX Pro Max Component Library
   
   OLED Dark Theme Primitives with Emerald Accent Micro-interactions.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Logo
   -------------------------------------------------------------------------- */

export function Logo({ size = 'md', showText = true }: { size?: 'sm' | 'md' | 'lg'; showText?: boolean }) {
  const dims = { sm: 30, md: 38, lg: 52 }[size];
  const textClass = { sm: 'text-base', md: 'text-xl', lg: 'text-2xl' }[size];

  return (
    <div className="flex items-center gap-3 group cursor-pointer">
      <div
        className="relative flex items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]"
        style={{
          width: dims,
          height: dims,
          background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
          boxShadow: '0 0 15px rgba(16,185,129,.3)',
        }}
      >
        <svg
          width={dims * 0.55}
          height={dims * 0.55}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.4"
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
        <span className={`${textClass} font-extrabold tracking-tight text-slate-100`}>
          Analyze<span className="text-emerald-400">It</span>
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
        hover ? 'az-card-interactive' : ''
      } ${className}`}
      style={variantInline[variant]}
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
      <div className="flex items-center gap-3.5">
        {icon && (
          <div
            className="flex items-center justify-center rounded-xl p-2.5 transition-transform duration-300 hover:scale-110"
            style={{
              background: 'rgba(16,185,129,.12)',
              border: '1px solid rgba(16,185,129,.3)',
              color: 'var(--az-accent-400)',
              boxShadow: '0 0 15px rgba(16,185,129,.15)',
            }}
          >
            {icon}
          </div>
        )}
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-slate-100"
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-slate-400">
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
  const numeric = typeof value === 'number';

  return (
    <Spotlight
      className="flex items-start gap-3.5 p-4.5"
      style={{
        background: 'var(--az-bg-card)',
        border: '1px solid var(--az-border)',
        borderRadius: 'var(--az-radius-lg)',
        boxShadow: 'var(--az-shadow-sm)',
      }}
    >
      {icon && (
        <div
          className="flex shrink-0 items-center justify-center rounded-xl p-2.5 transition-transform duration-300"
          style={{
            background: 'rgba(16,185,129,.1)',
            color: 'var(--az-accent-400)',
            border: '1px solid rgba(16,185,129,.2)',
            boxShadow: 'var(--az-shadow-glow-sm)',
          }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        {/* Tabular figures so a column of KPIs lines up on the decimal. */}
        <p className="az-tabular mt-1 text-2xl font-extrabold tracking-tight text-slate-100">
          {numeric ? <CountUp value={value as number} /> : value}
        </p>
        {trend && (
          <p
            className="mt-1 flex items-center gap-1 text-xs font-bold"
            style={{ color: trend.positive ? 'var(--az-success-400)' : 'var(--az-danger-400)' }}
          >
            {/* SVG rather than a text arrow: scales with the type and keeps
                its weight at small sizes. */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ transform: trend.positive ? 'none' : 'rotate(180deg)' }}
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <span>{trend.value}</span>
            <span className="sr-only">{trend.positive ? 'increase' : 'decrease'}</span>
          </p>
        )}
      </div>
    </Spotlight>
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
        className="mb-1.5 block text-sm font-semibold text-slate-200"
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          className="mt-1.5 block text-xs text-slate-400"
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
  'w-full rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-slate-500',
  'transition-all duration-200',
].join(' ');

export const inputStyle: React.CSSProperties = {
  background: 'var(--az-bg-input)',
  border: '1px solid var(--az-border)',
  color: 'var(--az-text)',
};

export const inputFocusHandler = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'var(--az-accent-400)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(34,197,94,.18)';
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = 'var(--az-border)';
    e.currentTarget.style.boxShadow = 'none';
  },
};

export const buttonClass = [
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5',
  'text-sm font-bold text-slate-950',
  'transition-all duration-200',
  'hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:-translate-y-0.5',
  'active:translate-y-0 active:shadow-md cursor-pointer',
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none',
  'az-sheen az-pressable',
].join(' ');

export const buttonStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  boxShadow: '0 2px 10px rgba(16,185,129,.3)',
};

export const secondaryButtonClass = [
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5',
  'text-sm font-semibold text-slate-200 cursor-pointer',
  'transition-all duration-200 hover:bg-slate-800 hover:border-slate-600',
  'disabled:opacity-50',
].join(' ');

export const secondaryButtonStyle: React.CSSProperties = {
  background: 'var(--az-bg-card)',
  border: '1px solid var(--az-border)',
};

/* --------------------------------------------------------------------------
   Error Text
   -------------------------------------------------------------------------- */

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium"
      style={{
        background: 'rgba(239,68,68,.12)',
        border: '1px solid rgba(239,68,68,.3)',
        color: '#f87171',
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
          className="mb-4 flex items-center justify-center rounded-2xl p-3.5"
          style={{
            background: 'rgba(16,185,129,.12)',
            color: 'var(--az-accent-400)',
          }}
        >
          {icon}
        </div>
      ) : (
        <div
          className="mb-4 flex items-center justify-center rounded-2xl p-3.5"
          style={{
            background: 'rgba(16,185,129,.12)',
            color: 'var(--az-accent-400)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M12 8v8" />
            <path d="M8 12h8" />
          </svg>
        </div>
      )}
      <p className="text-base font-bold text-slate-100">
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-400">
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
    bg: 'rgba(16,185,129,.15)',
    text: '#34d399',
    dot: '#10b981',
  },
  pending: {
    bg: 'rgba(245,158,11,.15)',
    text: '#fbbf24',
    dot: '#f59e0b',
  },
  failed: {
    bg: 'rgba(239,68,68,.15)',
    text: '#f87171',
    dot: '#ef4444',
  },
  active: {
    bg: 'rgba(16,185,129,.15)',
    text: '#34d399',
    dot: '#10b981',
  },
};

const DEFAULT_STATUS = {
  bg: 'rgba(148,163,184,.15)',
  text: '#cbd5e1',
  dot: '#94a3b8',
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? DEFAULT_STATUS;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
      style={{
        background: config.bg,
        color: config.text,
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: config.dot,
          boxShadow: `0 0 8px ${config.dot}`,
          ...(status === 'pending'
            ? { animation: 'az-ping 2.4s var(--az-ease-out) infinite' }
            : {}),
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
   Nav Item
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
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer hover:bg-slate-800/80 hover:text-slate-100"
      style={{
        background: active ? 'rgba(16,185,129,.12)' : 'transparent',
        color: active ? '#34d399' : 'var(--az-text-muted)',
        border: active ? '1px solid rgba(16,185,129,.3)' : '1px solid transparent',
        boxShadow: active ? '0 0 15px rgba(16,185,129,.1)' : 'none',
      }}
    >
      <span className="flex shrink-0 items-center transition-transform group-hover:scale-110" style={{ color: active ? '#34d399' : 'var(--az-text-subtle)' }}>
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
  const clamped = Math.min(100, Math.max(0, progress));
  // The shimmer reads as "still working"; stop it once the bar is full.
  const done = clamped >= 100;

  return (
    <div className="w-full">
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
          <span className="text-slate-400">{label}</span>
          <span className="az-tabular text-emerald-400">
            {Math.round(clamped)}%
          </span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div
          className={`h-full rounded-full ${done ? '' : 'az-shimmer'}`}
          style={{
            width: `${clamped}%`,
            background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
            boxShadow: '0 0 12px rgba(16,185,129,.5)',
            transition: 'width var(--az-dur-slow) var(--az-ease-out)',
          }}
        />
      </div>
    </div>
  );
}
