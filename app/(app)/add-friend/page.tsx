'use client';

import { useState } from 'react';
import { readApiResponse } from '@/lib/api-response';

type User = { id: string; username: string; displayName: string | null; isOnline: boolean };

export default function AddFriendPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState('');
  const [sent, setSent] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function handleSearch(value: string) {
    setQuery(value);
    setError('');
    setNotice('');
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(value)}`);
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Search failed');
      setResults(data.users);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function sendFriendRequest(userId: string) {
    setSendingId(userId);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: userId })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not send request');
      setSent((previous) => new Set(previous).add(userId));
      setNotice('Friend request sent.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send request');
    } finally {
      setSendingId('');
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-2 md:px-0">
      <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-snap">
        <h1 className="text-3xl font-black">Find Friends</h1>
        <p className="mt-2 text-sm text-black/60">Search by username to send a friend request.</p>
        <input
          className="mt-5 w-full rounded-full border border-black/10 bg-[#F3F3F3] px-4 py-3 outline-none"
          placeholder="Search usernames (2+ characters)"
          value={query}
          onChange={(event) => void handleSearch(event.target.value)}
        />
      </div>
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-2xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
      {loading && <p className="rounded-2xl bg-white p-4 text-sm text-black/60">Searching...</p>}
      {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
        <p className="rounded-2xl bg-white p-4 text-sm text-black/60">No matching users found.</p>
      )}
      <div className="space-y-3">
        {results.map((user) => (
          <div key={user.id} className="flex items-center justify-between rounded-[28px] border border-black/10 bg-white p-4 shadow-snap">
            <div>
              <div className="font-black">{user.displayName || user.username}</div>
              <div className="text-sm text-black/60">@{user.username} · {user.isOnline ? 'online' : 'offline'}</div>
            </div>
            <button
              className="rounded-full bg-snapchat-yellow px-4 py-2 font-black disabled:opacity-60"
              onClick={() => void sendFriendRequest(user.id)}
              disabled={sent.has(user.id) || sendingId === user.id}
            >
              {sent.has(user.id) ? 'Sent' : sendingId === user.id ? 'Sending...' : 'Add'}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
