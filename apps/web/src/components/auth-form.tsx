'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

import { createBrowserSupabase } from '@/lib/supabase/client';
import { ErrorText, Field, Spinner, buttonClass, buttonStyle, inputClass, inputFocusHandler, inputStyle } from '@/components/ui';

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

    router.replace('/app');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} method="post" className="space-y-4">
      <Field label="Work email">
        <input
          className={inputClass}
          style={inputStyle}
          {...inputFocusHandler}
          type="email"
          name="email"
          placeholder="name@firm.com"
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
          style={inputStyle}
          {...inputFocusHandler}
          type="password"
          name="password"
          placeholder="••••••••"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <ErrorText>{error}</ErrorText>

      <button className={`${buttonClass} w-full`} style={buttonStyle} type="submit" disabled={pending}>
        {pending ? (
          <>
            <Spinner size={18} />
            <span>Processing...</span>
          </>
        ) : isSignup ? (
          'Create Account'
        ) : (
          'Sign In'
        )}
      </button>

      <p className="pt-2 text-center text-xs font-medium" style={{ color: 'var(--az-text-muted)' }}>
        {isSignup ? 'Already have an account? ' : 'No account yet? '}
        <Link className="font-semibold transition-colors hover:underline" style={{ color: 'var(--az-primary-600)' }} href={isSignup ? '/login' : '/signup'}>
          {isSignup ? 'Sign in' : 'Create one'}
        </Link>
      </p>
    </form>
  );
}
