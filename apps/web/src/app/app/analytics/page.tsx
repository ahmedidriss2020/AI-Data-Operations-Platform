'use client';

import { useState } from 'react';
import { Card, KpiCard, PageHeader, StatusBadge } from '@/components/ui';

type ChartMetric = {
  label: string;
  value: string;
  change: string;
  positive: boolean;
};

const METRICS: ChartMetric[] = [
  { label: 'Gross Revenue', value: '£184,920.00', change: '+12.4% MoM', positive: true },
  { label: 'Net Operating Margin', value: '34.2%', change: '+2.1% MoM', positive: true },
  { label: 'Anomalous Transactions', value: '£4,219.50', change: '31 rows flagged', positive: false },
  { label: 'DuckDB Query Latency', value: '42ms', change: 'Parquet Direct', positive: true },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'trends' | 'reconciliation' | 'distribution'>('trends');
  const [executingAgent, setExecutingAgent] = useState(false);
  const [agentOutput, setAgentOutput] = useState<string | null>(null);

  function triggerHermesAnalytics() {
    setExecutingAgent(true);
    setAgentOutput(null);

    setTimeout(() => {
      setExecutingAgent(false);
      setAgentOutput(
        'Hermes Agent (Hostinger 24/7 VPS):\n' +
        '✓ Direct DuckDB Parquet scan executed in 38ms\n' +
        '✓ Identified 3 revenue drivers: (1) Enterprise plan renewals (+£14.2k), (2) Reduced supplier fees (-£2.1k)\n' +
        '✓ Outlier Warning: Row #4,212 contains £4,219.50 unmapped vendor transaction'
      );
    }, 1500);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Professional Data Analytics & Financial Intelligence"
        subtitle="Powered by 24/7 Hermes Agent on Hostinger VPS · Direct DuckDB queries on immutable Parquet datasets."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        }
      />

      {/* KPI Cards Bar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((m, idx) => (
          <KpiCard
            key={idx}
            label={m.label}
            value={m.value}
            trend={{ value: m.change, positive: m.positive }}
          />
        ))}
      </div>

      {/* Analytics Tabs & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          {(['trends', 'reconciliation', 'distribution'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab === 'trends' && 'Financial Trends & Variance'}
              {tab === 'reconciliation' && 'Ledger Reconciliation'}
              {tab === 'distribution' && 'Column Distribution Drift'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={triggerHermesAnalytics}
          disabled={executingAgent}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all cursor-pointer disabled:opacity-50"
        >
          <span className="h-2 w-2 rounded-full bg-slate-950 animate-pulse" />
          {executingAgent ? 'Hermes Executing DuckDB Query...' : 'Run Hermes VPS Financial Analysis'}
        </button>
      </div>

      {/* Agent Execution Console Output */}
      {agentOutput && (
        <Card variant="gradient" className="space-y-2 border-emerald-500/40">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
            <span>Hermes Agent Response (Hostinger VPS)</span>
            <StatusBadge status="active" />
          </div>
          <pre className="font-mono text-xs text-slate-200 whitespace-pre-wrap bg-slate-950 p-3 rounded-xl border border-slate-800">
            {agentOutput}
          </pre>
        </Card>
      )}

      {/* Analytics Visual Chart Placeholder */}
      <Card variant="elevated" className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-100">
              {activeTab === 'trends' && 'Monthly Revenue & Margin Variance Breakdown'}
              {activeTab === 'reconciliation' && 'Bank vs Ledger Multi-Source Reconciliation'}
              {activeTab === 'distribution' && 'Column Null & Cardinality Distribution Drift'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Dataset Version: <code className="font-mono text-emerald-400">dataset_v14.parquet</code></p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-mono text-slate-300 border border-slate-700">
            Polars/DuckDB Engine
          </span>
        </div>

        {/* Visual Simulated Chart Bars */}
        <div className="space-y-4">
          <div className="grid grid-cols-6 gap-3 items-end h-48 pt-6 pb-2 border-b border-slate-800">
            {[
              { month: 'Mar', val: 45, label: '£45k' },
              { month: 'Apr', val: 62, label: '£62k' },
              { month: 'May', val: 58, label: '£58k' },
              { month: 'Jun', val: 78, label: '£78k' },
              { month: 'Jul', val: 94, label: '£94k' },
              { month: 'Aug', val: 112, label: '£112k' },
            ].map((bar, i) => (
              <div key={i} className="flex flex-col items-center gap-2 h-full justify-end group cursor-pointer">
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-400 transition-colors">{bar.label}</span>
                <div
                  className="w-full rounded-t-lg transition-all duration-300 group-hover:brightness-125"
                  style={{
                    height: `${bar.val}%`,
                    background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                  }}
                />
                <span className="text-xs font-semibold text-slate-400">{bar.month}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
            <span>Query Engine: DuckDB Parquet Reader</span>
            <span>Execution Latency: <strong className="text-emerald-400">42ms</strong></span>
          </div>
        </div>
      </Card>
    </div>
  );
}
