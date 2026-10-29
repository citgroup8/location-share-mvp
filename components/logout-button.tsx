'use client';

import { useState } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function LogOutButton() {
  const { signOut } = useClerk();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Could not log out. Please try again.');
      if (isSignedIn) {
        await signOut({ redirectUrl: '/sign-in' });
      } else {
        router.replace('/sign-in');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not log out. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-black text-red-600 disabled:opacity-60" onClick={() => void handleLogout()} disabled={loading}>
        {loading ? 'Logging out...' : 'Log out'}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
