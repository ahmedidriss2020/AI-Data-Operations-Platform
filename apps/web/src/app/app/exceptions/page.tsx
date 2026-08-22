'use client';

import { useState } from 'react';
import { Card, KpiCard, PageHeader, StatusBadge } from '@/components/ui';

type ExceptionItem = {
  id: string;
  type: string;
  description: string;
  materiality: number;
  affectedRows: number;
  evidence: string;
  tier: 'Review' | 'Block';
  status: 'Pending' | 'Approved' | 'Rejected';
};

const INITIAL_EXCEPTIONS: ExceptionItem[] = [
  {
    id: 'exc_1',
    type: 'Ambiguous Vendor Match',
    description: 'Supplier string "ACME INDUSTRIAL LTD" matches "Acme Corp (412)" with 88% confidence',
    materiality: 4219.50,
    affectedRows: 31,
    evidence: 'Mapping table vm_412 exact target is Acme UK Ltd. Variance: +£4,219.50',
    tier: 'Review',
    status: 'Pending',
  },
  {
    id: 'exc_2',
    type: 'New Product Code Detected',
    description: 'Unmapped SKU "PROD-9982-X" detected in August sales workbook',
    materiality: 892.00,
    affectedRows: 17,
    evidence: 'Category inference: Electronics. Default tax code 20% proposed.',
    tier: 'Review',
    status: 'Pending',
  },
  {
    id: 'exc_3',
    type: 'Post-Run Invariant Failure',
    description: 'Row count 14,890 exceeds 3-month trailing average (12,100) by +23%',
    materiality: 15400.00,
    affectedRows: 2790,
    evidence: 'Canary check fail: trailing_avg_tolerance: 5%. Run halted.',
    tier: 'Block',
    status: 'Pending',
  },
];

export default function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<ExceptionItem[]>(INITIAL_EXCEPTIONS);
  const [selectedItem, setSelectedItem] = useState<ExceptionItem | null>(null);

  function resolveException(id: string, status: 'Approved' | 'Rejected') {
    setExceptions(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    setSelectedItem(null);
  }

  const pendingItems = exceptions.filter(e => e.status === 'Pending');
  const totalMateriality = pendingItems.reduce((acc, curr) => acc + curr.materiality, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Materiality Exception Queue"
        subtitle="Exceptions ranked by financial impact (£), not row count. Approve or reject changes in grouped batches."
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        }
      />

      {/* KPI Overview Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Pending Exceptions"
          value={pendingItems.length}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }
        />
        <KpiCard
          label="Total Materiality (£)"
          value={`£${totalMateriality.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
          trend={{ value: 'Ranked by GBP Impact', positive: true }}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
        <KpiCard
          label="Invariant Status"
          value={exceptions.some(e => e.tier === 'Block' && e.status === 'Pending') ? '1 Blocked' : 'Passed'}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          }
        />
      </div>

      {/* Exception Queue List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Materiality Exception Queue (Ranked by Financial Impact)
          </h3>
        </div>

        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-slate-800/80">
            {exceptions.map((item) => (
              <li
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="group flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-slate-800/50 cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-2 border ${
                      item.tier === 'Block'
                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    </svg>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {item.type}
                      </p>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                        {item.affectedRows} rows
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-slate-100">
                      £{item.materiality.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GBP Materiality</p>
                  </div>

                  {item.status === 'Pending' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); resolveException(item.id, 'Approved'); }}
                        className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500 hover:text-slate-950 transition-all cursor-pointer"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); resolveException(item.id, 'Rejected'); }}
                        className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 border border-red-500/40 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <StatusBadge status={item.status === 'Approved' ? 'active' : 'failed'} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Provenance Inspection Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md az-animate-fade">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl az-animate-scale">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">{selectedItem.type} Details</h3>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-400">Financial Impact:</span>
                <p className="mt-1 text-lg font-extrabold text-emerald-400">
                  £{selectedItem.materiality.toLocaleString('en-GB', { minimumFractionDigits: 2 })} ({selectedItem.affectedRows} rows)
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-400">Evidence & Invariant Check:</span>
                <p className="mt-1 font-mono text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {selectedItem.evidence}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => resolveException(selectedItem.id, 'Rejected')}
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
              >
                Reject & Re-route
              </button>
              <button
                type="button"
                onClick={() => resolveException(selectedItem.id, 'Approved')}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Approve & Write Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
