import Image from 'next/image';
import { AuthForm } from '@/components/auth-form';
import { Card, Logo } from '@/components/ui';

export const metadata = { title: 'Sign in · AnalyzeIt' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full">
      {/* Brand Hero Side Panel with High Quality Visual Showcase */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{
          background: 'var(--az-gradient-hero)',
          color: 'white',
        }}
      >
        <div className="relative z-10">
          <Logo size="lg" />
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6 az-animate-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Financial Data Operations Copilot
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
            Learn a client&apos;s recurring workflow once. <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">Replay it forever.</span>
          </h2>

          <p className="text-sm leading-relaxed text-slate-300">
            AnalyzeIt turns messy monthly accounting exports into immutable versioned recipes with 100% financial row-level provenance and materiality-ranked exception queues.
          </p>

          {/* Interactive UI Preview Showcase Card */}
          <div className="relative mt-6 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/80 p-2 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/40 hover:shadow-emerald-500/10">
            <div className="relative h-64 w-full overflow-hidden rounded-xl">
              <Image
                src="/hero-preview.jpg"
                alt="AnalyzeIt Financial Data Analytics Dashboard Mockup"
                fill
                priority
                className="object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-400">
              <span>Live Analytics Pipeline Preview</span>
              <span className="text-emerald-400 font-bold">100% Auditable</span>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-500">© {new Date().getFullYear()} AnalyzeIt Inc. All rights reserved.</p>
      </div>

      {/* Form Panel */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16" style={{ background: 'var(--az-bg)' }}>
        <div className="mx-auto w-full max-w-sm az-animate-in">
          <div className="mb-8 lg:hidden">
            <Logo size="md" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--az-text)' }}>
            Welcome back
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--az-text-muted)' }}>
            Sign in to access your practice workspaces
          </p>
          <Card variant="elevated" padding="lg">
            <AuthForm mode="login" />
          </Card>
        </div>
      </div>
    </div>
  );
}
