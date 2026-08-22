import { AuthForm } from '@/components/auth-form';
import { Card, Logo } from '@/components/ui';

export const metadata = { title: 'Create Account · AnalyzeIt' };

export default function SignupPage() {
  return (
    <div className="flex min-h-screen w-full">
      {/* Brand Hero Side Panel */}
      <div
        className="hidden w-1/2 flex-col justify-between p-12 lg:flex"
        style={{
          background: 'var(--az-gradient-hero)',
          color: 'white',
        }}
      >
        <Logo size="lg" />
        <div className="max-w-md space-y-4 az-animate-in">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wider uppercase backdrop-blur-md">
            Get Started
          </span>
          <h2 className="text-4xl font-extrabold tracking-tight">
            Automate monthly client data operations safely.
          </h2>
          <p className="text-base opacity-80">
            Join accounting firms using AnalyzeIt to eliminate manual CSV/Excel cleaning while keeping complete financial auditability.
          </p>
        </div>
        <p className="text-xs opacity-60">© {new Date().getFullYear()} AnalyzeIt Inc. All rights reserved.</p>
      </div>

      {/* Form Panel */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16" style={{ background: 'var(--az-bg)' }}>
        <div className="mx-auto w-full max-w-sm az-animate-in">
          <div className="mb-8 lg:hidden">
            <Logo size="md" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--az-text)' }}>
            Create an account
          </h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--az-text-muted)' }}>
            Set up your firm and client workspaces in minutes
          </p>
          <Card variant="elevated" padding="lg">
            <AuthForm mode="signup" />
          </Card>
        </div>
      </div>
    </div>
  );
}
