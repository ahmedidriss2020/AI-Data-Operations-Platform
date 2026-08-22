'use client';

import { useState } from 'react';
import { Card, PageHeader, StatusBadge } from '@/components/ui';

type Step = {
  id: string;
  name: string;
  operation: string;
  params: string;
  enabled: boolean;
  tier: 'Auto' | 'Review' | 'Block';
};

const INITIAL_STEPS: Step[] = [
  { id: 'step_1', name: 'Detect Header Row', operation: 'detect_header', params: 'range: row 1-5, confidence: 99%', enabled: true, tier: 'Auto' },
  { id: 'step_2', name: 'Remove Subtotal & Blank Rows', operation: 'filter_rows', params: 'keywords: ["subtotal", "total"], drop_empty: true', enabled: true, tier: 'Auto' },
  { id: 'step_3', name: 'Normalize Date Formats', operation: 'normalize_dates', params: 'target_format: ISO-8601 (YYYY-MM-DD)', enabled: true, tier: 'Auto' },
  { id: 'step_4', name: 'Convert Parentheses Negatives', operation: 'parse_currency', params: 'rule: (100.00) -> -100.00', enabled: true, tier: 'Auto' },
  { id: 'step_5', name: 'Normalize Supplier Names', operation: 'fuzzy_mapping', params: 'mapping_table: vm_412, threshold: 0.92', enabled: true, tier: 'Review' },
  { id: 'step_6', name: 'Check Post-Run Invariants', operation: 'check_invariants', params: 'trailing_avg_tolerance: 5%, period_bounds: true', enabled: true, tier: 'Block' },
];

export default function RecipesPage() {
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [selectedStep, setSelectedStep] = useState<Step | null>(INITIAL_STEPS[4]);
  const [activeVersion, setActiveVersion] = useState('v7 (Current Active)');

  function toggleStep(id: string) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Recipe Builder & Executable Pipeline"
        subtitle="Versioned step sequences captured from approved cleaning sessions and replayed automatically."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        }
      />

      {/* Recipe Header Meta Card */}
      <Card variant="gradient" className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-slate-100">ACME Monthly Sales & Reconciliation Recipe</h2>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
              {activeVersion}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Source Signature: <code className="font-mono text-slate-300">sig_acme_xl_v7 (Matched 14 monthly runs)</code>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 transition-all hover:bg-slate-700 hover:border-slate-500 cursor-pointer"
          >
            Dry Run Recipe
          </button>
          <button
            type="button"
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all hover:scale-105 cursor-pointer"
          >
            Save Version (v8)
          </button>
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* Step Sequence Editor */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Executable Step Sequence ({steps.filter(s => s.enabled).length}/{steps.length} active)
            </h3>
            <span className="text-xs text-slate-500">Drag steps to reorder</span>
          </div>

          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                onClick={() => setSelectedStep(step)}
                className={`group flex items-center justify-between rounded-xl border p-4 transition-all duration-200 cursor-pointer ${
                  selectedStep?.id === step.id
                    ? 'border-emerald-500/50 bg-slate-800/90 shadow-lg shadow-emerald-500/5'
                    : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40'
                } ${!step.enabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-emerald-400 border border-slate-700">
                    {idx + 1}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                      {step.name}
                    </p>
                    <p className="truncate text-xs font-mono text-slate-400 mt-0.5">
                      {step.operation}({step.params})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      step.tier === 'Auto'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : step.tier === 'Review'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    {step.tier}
                  </span>

                  <input
                    type="checkbox"
                    checked={step.enabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleStep(step.id);
                    }}
                    className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Step Inspector Panel */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Step Parameters & Mapping Table
          </h3>

          {selectedStep ? (
            <Card variant="elevated" className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-slate-100">{selectedStep.name}</h4>
                <StatusBadge status={selectedStep.enabled ? 'active' : 'disabled'} />
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-400">Operation ID:</span>
                  <p className="mt-1 font-mono text-emerald-400 bg-slate-950 p-2 rounded-lg border border-slate-800">
                    {selectedStep.operation}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-slate-400">Configured Parameters:</span>
                  <p className="mt-1 font-mono text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-800">
                    {selectedStep.params}
                  </p>
                </div>

                <div>
                  <span className="font-semibold text-slate-400">Confidence Tier:</span>
                  <p className="mt-1 text-slate-300">
                    {selectedStep.tier === 'Auto' && 'Applied silently and logged in provenance.'}
                    {selectedStep.tier === 'Review' && 'Surfaced to Materiality Queue if ambiguous.'}
                    {selectedStep.tier === 'Block' && 'Halts run execution immediately on mismatch.'}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
        </section>
      </div>
    </div>
  );
}
