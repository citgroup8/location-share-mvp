'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readApiResponse } from '@/lib/api-response';

type Summary = { friends: number; requests: number; conversations: number };

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/friends/list'),
      fetch('/api/friends/requests/pending'),
      fetch('/api/messages/conversations')
    ])
      .then(async ([friendsResponse, requestsResponse, messagesResponse]) => {
        const [friends, requests, messages] = await Promise.all([
          readApiResponse(friendsResponse),
          readApiResponse(requestsResponse),
          readApiResponse(messagesResponse)
        ]);
        const failed = [friendsResponse, requestsResponse, messagesResponse].find((response) => !response.ok);
        if (failed) throw new Error(friends.error || requests.error || messages.error || 'Could not load dashboard');
        setSummary({
          friends: friends.friends.length,
          requests: requests.requests.length,
          conversations: messages.conversations.length
        });
      })
      .catch((cause: Error) => setError(cause.message));
  }, []);

  const cards = [
    { label: 'Friends', value: summary?.friends, href: '/friends' },
    { label: 'Pending requests', value: summary?.requests, href: '/requests' },
    { label: 'Conversations', value: summary?.conversations, href: '/chat' }
  ];

  return (
    <main className="p-6">
      <h1 className="mb-5 text-3xl font-black">Dashboard</h1>
      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-[28px] border border-black/10 bg-white p-5 shadow-snap">
            <div className="text-xs uppercase tracking-[0.18em] text-black/60">{card.label}</div>
            <div className="mt-3 text-4xl font-black">{card.value ?? '...'}</div>
          </Link>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/map" className="rounded-full bg-snapchat-yellow px-5 py-3 font-black">Open live map</Link>
        <Link href="/gems" className="rounded-full bg-white px-5 py-3 font-black">Discover Gems</Link>
        <Link href="/spots" className="rounded-full bg-white px-5 py-3 font-black">Private Spots</Link>
      </div>
    </main>
  );
}
