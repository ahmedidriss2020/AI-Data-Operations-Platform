import { redirect } from 'next/navigation';

import { CreateOrgForm } from '@/components/create-org-form';
import { Card, Logo } from '@/components/ui';
import { listMyOrganizations, requireUser } from '@/lib/authz';

export const metadata = { title: 'Firm Setup · AnalyzeIt' };

export default async function OnboardingPage() {
  await requireUser();

  const orgs = await listMyOrganizations();
  if (orgs.length > 0) redirect('/app');

  return (
    <div className="flex min-h-screen w-full flex-col justify-center py-12" style={{ background: 'var(--az-bg)' }}>
      <main className="mx-auto w-full max-w-md px-6 az-animate-in">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        
        <div className="mb-6 text-center space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--az-text)' }}>
            Set up your Accounting Practice
          </h1>
          <p className="text-sm" style={{ color: 'var(--az-text-muted)' }}>
            Your firm acts as the parent organization for isolated client workspaces.
          </p>
        </div>

        <Card variant="elevated" padding="lg">
          <CreateOrgForm />
        </Card>
      </main>
    </div>
  );
}
