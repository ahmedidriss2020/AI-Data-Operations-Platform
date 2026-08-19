'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

import { createBrowserSupabase } from '@/lib/supabase/client';
import { ErrorText, Field, buttonClass, inputClass } from '@/components/ui';

/**
 * Email + password auth against Supabase, run from the browser so the session
 * cookie is established by the Supabase client itself and the proxy can then
 * refresh it on every subsequent request.
 */
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignup = mode === 'signup';

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabase();

    const { error: authError } = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setPending(false);
      return;
    }

    // A brand-new user has no organization yet; /app sends them to onboarding.
    router.replace('/app');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Work email">
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field
        label="Password"
        hint={isSignup ? 'At least 6 characters.' : undefined}
      >
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <ErrorText>{error}</ErrorText>

      <button className={`${buttonClass} w-full`} type="submit" disabled={pending}>
        {pending ? 'Working…' : isSignup ? 'Create account' : 'Sign in'}
      </button>

      <p className="text-center text-sm opacity-70">
        {isSignup ? 'Already have an account? ' : 'No account yet? '}
        <Link className="underline" href={isSignup ? '/login' : '/signup'}>
          {isSignup ? 'Sign in' : 'Create one'}
        </Link>
      </p>
    </form>
  );
}
