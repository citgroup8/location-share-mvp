'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { readApiResponse } from '@/lib/api-response';

export default function VerifyOtpForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Code verification failed');
      router.push('/map');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Code verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setResending(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not resend the code');
      setNotice('A new verification code has been sent.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resend the code');
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="auth-shell flex min-h-screen items-center justify-center p-6">
      <div className="auth-card w-full max-w-md rounded-[30px] border border-black/10 bg-white p-8 shadow-snap">
        <div className="mb-6 text-center">
          <div className="auth-brand-mark mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-snapchat-yellow text-2xl font-black">✦</div>
          <h1 className="mt-4 text-3xl font-black">Check your email</h1>
          <p className="mt-2 text-sm text-black/60">Enter the six-digit code sent to {email || 'your email'}.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            className="auth-input w-full rounded-full border border-black/10 bg-[#F3F3F3] px-4 py-3 text-center text-xl tracking-[0.35em] outline-none"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            required
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          {error ? <div className="text-sm font-medium text-red-600">{error}</div> : null}
          {notice ? <div className="text-sm font-medium text-green-700">{notice}</div> : null}
          <button className="auth-primary w-full rounded-full bg-snapchat-yellow px-4 py-3 font-black disabled:opacity-60" disabled={loading || !email}>
            {loading ? 'Verifying...' : 'Verify email'}
          </button>
        </form>

        <button
          className="mt-4 w-full text-sm font-bold text-black/65 disabled:opacity-50"
          disabled={resending || !email}
          onClick={resendCode}
          type="button"
        >
          {resending ? 'Sending...' : 'Resend code'}
        </button>
        <div className="mt-5 text-center text-sm text-black/60">
          Wrong email? <a href="/signin" className="font-black text-black">Go back</a>
        </div>
      </div>
    </main>
  );
}
