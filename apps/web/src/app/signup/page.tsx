import Image from 'next/image';
import { AuthForm } from '@/components/auth-form';
import { Card, Logo } from '@/components/ui';

export const metadata = { title: 'Create Account · AnalyzeIt' };

export default function SignupPage() {
  return (
    <div className="flex min-h-screen w-full" style={{ background: 'var(--az-bg)' }}>
      {/* Brand Hero Side Panel */}
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
            Enterprise Grade Security
          </span>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6 az-animate-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Accounting Practice Setup
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
            Automate monthly client data operations{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
              with 100% auditability.
            </span>
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">
            Join accounting firms using AnalyzeIt to eliminate manual CSV/Excel cleaning while maintaining immutable line-item lineage.
          </p>

          <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/80 p-2 shadow-2xl backdrop-blur-xl">
            <div className="relative h-48 w-full overflow-hidden rounded-xl">
              <Image
                src="/hero-preview.jpg"
                alt="AnalyzeIt Financial Data Analytics Preview"
                fill
                priority
                className="object-cover"
              />
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-500">© {new Date().getFullYear()} AnalyzeIt Copilot. All rights reserved.</p>
      </div>

      {/* Form Panel */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16" style={{ background: 'var(--az-bg)' }}>
        <div className="mx-auto w-full max-w-sm az-animate-in space-y-6">
          <div className="lg:hidden">
            <Logo size="md" />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
              Create an account
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Set up your practice firm and client workspaces in minutes
            </p>
          </div>

          <Card variant="elevated" padding="lg">
            <AuthForm mode="signup" />
          </Card>
        </div>
      </div>
    </div>
  );
}
