import { AuthForm } from '@/components/auth-form';
import { Card } from '@/components/ui';

export const metadata = { title: 'Sign in · AI Data Operations' };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 text-sm opacity-70">Data operations for accounting practices.</p>
      <Card>
        <AuthForm mode="login" />
      </Card>
    </main>
  );
}
