'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AuthForm } from '@/components/auth-form';
import { Card, Logo } from '@/components/ui';

type DemoStep = {
  id: number;
  title: string;
  badge: string;
  description: string;
  stat: string;
};

const DEMO_STEPS: DemoStep[] = [
  {
    id: 1,
    title: 'Raw Excel/CSV Ingestion',
    badge: 'Step 1: Upload',
    description: 'Messy monthly client exports (merged cells, subtotal rows, bad dates) are fingerprinted with SHA-256 and saved to immutable storage.',
    stat: '100% Raw Lineage',
  },
  {
    id: 2,
    title: 'Hermes 24/7 Agent Execution',
    badge: 'Step 2: Clean & Engine',
    description: 'Hermes executes Python, Polars, and DuckDB arithmetic on Hostinger VPS in 38ms—never using LLM for math.',
    stat: '38ms DuckDB Query',
  },
  {
    id: 3,
    title: 'Recipe Replay & Exception Queue',
    badge: 'Step 3: Auto-Pilot',
    description: 'Next month, the dataset auto-matches the recipe. Only deviations ranked by GBP (£) financial impact need sign-off.',
    stat: '99.1% Automated',
  },
];

export default function LoginPage() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const currentStep = DEMO_STEPS[activeStep];

  return (
    <div className="flex min-h-screen w-full" style={{ background: 'var(--az-bg)' }}>
      {/* Brand Hero Side Panel with High Quality Interactive Workflow Demo */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          background: 'var(--az-gradient-hero)',
          color: 'white',
        }}
      >
        <div className="relative z-10 flex items-center justify-between">
          <Logo size="lg" />
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
            24/7 Hermes VPS Active
          </span>
        </div>

        <div className="relative z-10 my-auto max-w-xl space-y-6 az-animate-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Financial Data Operations Copilot
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
            Learn a client&apos;s recurring workflow once.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
              Replay it forever.
            </span>
          </h2>

          {/* Interactive Workflow Explainer Stepper */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              {DEMO_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setActiveStep(idx)}
                  className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition-all cursor-pointer ${
                    activeStep === idx
                      ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 scale-105'
                      : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  {s.badge}
                </button>
              ))}
            </div>

            {/* Step Card Details */}
            <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl space-y-3 az-animate-fade">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-slate-100">{currentStep.title}</h3>
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                  {currentStep.stat}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {currentStep.description}
              </p>
            </div>
          </div>

          {/* Interactive UI Preview Showcase Card */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/80 p-2 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/40 hover:shadow-emerald-500/10">
            <div className="relative h-56 w-full overflow-hidden rounded-xl">
              <Image
                src="/hero-preview.jpg"
                alt="AnalyzeIt Financial Data Analytics Dashboard Mockup"
                fill
                priority
                className="object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400">
              <span>Interactive Workflow Engine</span>
              <span className="text-emerald-400 font-bold">100% Financial Provenance</span>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-500">© {new Date().getFullYear()} AnalyzeIt Copilot. Every material change signed off with auditability.</p>
      </div>

      {/* Form Panel */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16" style={{ background: 'var(--az-bg)' }}>
        <div className="mx-auto w-full max-w-sm az-animate-in space-y-6">
          <div className="lg:hidden">
            <Logo size="md" />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
              Welcome back
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Sign in to manage your practice firm workspaces
            </p>
          </div>

          <Card variant="elevated" padding="lg">
            <AuthForm mode="login" />
          </Card>
        </div>
      </div>
    </div>
  );
}
