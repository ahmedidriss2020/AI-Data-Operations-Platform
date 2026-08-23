'use client';

import { useEffect, useState } from 'react';

type Health = {
  configured: boolean;
  reachable: boolean;
  uptime?: string;
  queueDepth?: number;
  detail?: string;
};

/**
 * The sidebar agent indicator.
 *
 * This replaces a hardcoded "Active" badge. A status light that is always green
 * is worse than no status light: it trains the operator to trust it, and then
 * it is wrong at the exact moment it matters. Every state below is a real
 * answer from /api/hermes/health.
 */
export function AgentStatus({ pollMs = 30_000 }: { pollMs?: number }) {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch('/api/hermes/health', { cache: 'no-store' });
        if (!response.ok) throw new Error();
        const body = (await response.json()) as Health;
        if (!cancelled) setHealth(body);
      } catch {
        if (!cancelled) setHealth({ configured: true, reachable: false, detail: 'Unreachable' });
      }
    }

    poll();
    const timer = setInterval(poll, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pollMs]);

  const state = !health
    ? { label: 'Checking…', tone: 'neutral' as const, detail: '' }
    : !health.configured
      ? { label: 'Not connected', tone: 'neutral' as const, detail: 'No endpoint set' }
      : health.reachable
        ? {
            label: 'Online',
            tone: 'good' as const,
            detail:
              typeof health.queueDepth === 'number' && health.queueDepth > 0
                ? `${health.queueDepth} queued`
                : (health.uptime ?? ''),
          }
        : { label: 'Offline', tone: 'bad' as const, detail: health.detail ?? '' };

  const palette = {
    good: { border: 'rgba(16,185,129,.3)', bg: 'rgba(16,185,129,.10)', fg: '#34d399', dot: '#34d399' },
    bad: { border: 'rgba(239,68,68,.3)', bg: 'rgba(239,68,68,.10)', fg: '#f87171', dot: '#f87171' },
    neutral: { border: 'var(--az-border)', bg: 'rgba(148,163,184,.08)', fg: '#94a3b8', dot: '#94a3b8' },
  }[state.tone];

  return (
    <div
      className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold"
      style={{ borderColor: palette.border, background: palette.bg, color: palette.fg }}
      title={state.detail || undefined}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${state.tone === 'good' ? 'animate-pulse' : ''}`}
          style={{ background: palette.dot }}
        />
        <span>Hermes Agent</span>
      </div>
      <span className="text-[10px] uppercase tracking-wider">{state.label}</span>
    </div>
  );
}
