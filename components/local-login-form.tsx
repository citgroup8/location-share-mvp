'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readApiResponse } from '@/lib/api-response';

export default function LocalLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error ?? 'Could not sign in');
      }
      router.replace('/dashboard');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell flex min-h-screen items-center justify-center p-6">
      <div className="auth-card w-full max-w-md rounded-[30px] border border-black/10 bg-white p-8 shadow-snap">
        <div className="mb-6 text-center">
          <div className="auth-brand-mark mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-snapchat-yellow text-2xl font-black">
            ✦
          </div>
          <h1 className="mt-4 text-3xl font-black">Demo account sign in</h1>
          <p className="mt-2 text-sm text-black/60">
            Sign in with a local Hidden Gem account.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            className="auth-input w-full rounded-full border border-black/10 bg-[#F3F3F3] px-4 py-3 outline-none"
            type="email"
            autoComplete="username"
            placeholder="Email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="auth-input w-full rounded-full border border-black/10 bg-[#F3F3F3] px-4 py-3 outline-none"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
          <button
            className="auth-primary w-full rounded-full bg-snapchat-yellow px-4 py-3 font-black disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-black/60">
          Use a Clerk account instead?{' '}
          <a href="/sign-in" className="font-black text-black">
            Continue to Clerk sign in
          </a>
        </p>
      </div>
    </main>
  );
}
