'use client';

import { useState, useEffect } from 'react';
import { readApiResponse } from '@/lib/api-response';

interface PendingRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadRequests() {
      try {
        const response = await fetch('/api/friends/requests/pending');
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error ?? 'Could not load requests');
        setRequests(data.requests);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load requests');
      } finally {
        setLoading(false);
      }
    }

    void loadRequests();
  }, []);

  async function handleAccept(requestId: string) {
    try {
      const response = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not accept request');
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not accept request');
    }
  }

  async function handleDecline(requestId: string) {
    try {
      const response = await fetch(`/api/friends/requests/${requestId}`, { method: 'DELETE' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not decline request');
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not decline request');
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-2 md:px-0">
      <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-snap">
        <h1 className="text-3xl font-black">Friend Requests</h1>
      </div>
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-[28px] border border-black/10 bg-white p-4 text-sm text-black/60 shadow-snap">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="rounded-[28px] border border-black/10 bg-white p-4 text-sm text-black/60 shadow-snap">No pending requests.</div>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="flex items-center justify-between rounded-[28px] border border-black/10 bg-white p-4 shadow-snap">
              <div>
                <div className="font-black">{request.senderName}</div>
                <div className="text-sm text-black/60">@{request.senderUsername}</div>
              </div>

              <div className="flex gap-2">
                <button className="rounded-full bg-snapchat-yellow px-4 py-2 text-sm font-black" onClick={() => handleAccept(request.id)}>
                  Accept
                </button>
                <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black" onClick={() => handleDecline(request.id)}>
                  Decline
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
