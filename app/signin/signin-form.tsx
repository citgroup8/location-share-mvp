'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readApiResponse } from '@/lib/api-response';

export default function SignInForm({ initialError }: { initialError: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not send a verification code');
      router.push(`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send a verification code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell flex min-h-screen items-center justify-center p-6">
      <div className="auth-card w-full max-w-md rounded-[30px] border border-black/10 bg-white p-8 shadow-snap">
        <div className="mb-6 text-center">
          <div className="auth-brand-mark mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-snapchat-yellow text-2xl font-black">✦</div>
          <h1 className="mt-4 text-3xl font-black">Welcome back</h1>
          <p className="mt-2 text-sm text-black/60">Sign in with Google or an email code</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            className="auth-input w-full rounded-full border border-black/10 bg-[#F3F3F3] px-4 py-3 outline-none"
            placeholder="Email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error ? <div className="text-sm font-medium text-red-600">{error}</div> : null}
          <button className="auth-primary w-full rounded-full bg-snapchat-yellow px-4 py-3 font-black disabled:opacity-60" disabled={loading}>
            {loading ? 'Sending code...' : 'Continue with email'}
          </button>
        </form>

        <div className="my-4 text-center text-xs font-semibold uppercase tracking-wider text-black/40">or</div>
        <a
          className="block w-full rounded-full border border-black/10 px-4 py-3 text-center font-bold"
          href="/api/auth/google"
        >
          Continue with Google
        </a>

        <div className="mt-5 text-center text-sm text-black/60">
          No account yet? <a href="/signup" className="font-black text-black">Create one</a>
        </div>
      </div>
    </main>
  );
}
