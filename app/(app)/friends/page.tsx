'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { readApiResponse } from '@/lib/api-response';
import { subscribeRealtime } from '@/lib/realtime-client';

type Friend = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  status: string;
  lastSeenAt: string | null;
};

type ReportReason = 'spam' | 'harassment' | 'impersonation' | 'inappropriate_content' | 'other';

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('other');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    let active = true;
    const loadFriends = async () => {
      try {
        const response = await fetch('/api/friends/list');
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error ?? 'Could not load friends');
        if (active) {
          setFriends(data.friends);
          setError('');
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load friends');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadFriends();
    const interval = window.setInterval(() => void loadFriends(), 60000);
    const unsubscribe = subscribeRealtime((update) => {
      if (update.friendsChanged) void loadFriends();
    });
    return () => {
      active = false;
      window.clearInterval(interval);
      unsubscribe();
    };
  }, []);

  function openFriendProfile(friend: Friend) {
    setSelectedFriend(friend);
    setActionError('');
    setActionNotice('');
    setReporting(false);
    setConfirmingBlock(false);
    setReportReason('other');
    setReportDetails('');
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFriend) return;
    setActionBusy(true);
    setActionError('');
    setActionNotice('');
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(selectedFriend.id)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason, details: reportDetails })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not submit report');
      setActionNotice('Report submitted. Thank you for helping keep the community safe.');
      setReporting(false);
      setReportDetails('');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not submit report');
    } finally {
      setActionBusy(false);
    }
  }

  async function blockFriend() {
    if (!selectedFriend) return;
    setActionBusy(true);
    setActionError('');
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(selectedFriend.id)}/block`, { method: 'POST' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not block user');
      setFriends((current) => current.filter((friend) => friend.id !== selectedFriend.id));
      setSelectedFriend(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not block user');
      setConfirmingBlock(false);
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <main className="space-y-6 px-2 md:px-0">
      <div className="rounded-[28px] border border-black/10 bg-white p-5 shadow-snap">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/60">People</div>
            <h1 className="mt-2 text-3xl font-black">Friends</h1>
          </div>
          <Link href="/add-friend" className="rounded-full bg-snapchat-yellow px-4 py-2 text-sm font-black">Add friend</Link>
        </div>
        <div className="mt-4 flex gap-3 text-sm font-bold">
          <Link href="/requests" className="text-black/60 underline">Friend requests</Link>
          <Link href="/chat" className="text-black/60 underline">Open chat</Link>
        </div>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-[28px] border border-black/10 bg-white p-6 text-sm text-black/60 shadow-snap">Loading friends...</div>
        ) : !friends.length && !error ? (
          <div className="rounded-[28px] border border-black/10 bg-white p-6 text-sm text-black/60 shadow-snap">
            No friends yet. Send a friend request to get started.
          </div>
        ) : friends.map((friend) => (
          <div key={friend.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-black/10 bg-white p-4 shadow-snap">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-orange-400 text-lg font-black">
                {friend.profileImageUrl ? <Image src={friend.profileImageUrl} alt="" fill unoptimized className="object-cover" /> : (friend.displayName || friend.username).slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="text-lg font-black">{friend.displayName || friend.username}</div>
                <div className="flex items-center gap-2 text-sm text-black/60">
                  <span className={`h-2 w-2 rounded-full ${friend.status === 'online' ? 'bg-emerald-500' : 'bg-black/25'}`} />
                  @{friend.username} · {friend.status}
                </div>
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button type="button" onClick={() => openFriendProfile(friend)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-black">View bio</button>
              <Link href={`/chat?friend=${encodeURIComponent(friend.id)}`} className="rounded-full bg-snapchat-yellow px-4 py-2 text-sm font-black">Message</Link>
            </div>
          </div>
        ))}
      </div>

      {selectedFriend && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-5"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedFriend(null); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="friend-profile-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-6 shadow-2xl sm:rounded-[28px]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-orange-400 text-2xl font-black">
                  {selectedFriend.profileImageUrl ? <Image src={selectedFriend.profileImageUrl} alt="" fill unoptimized className="object-cover" /> : (selectedFriend.displayName || selectedFriend.username).slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h2 id="friend-profile-title" className="text-2xl font-black">{selectedFriend.displayName || selectedFriend.username}</h2>
                  <p className="text-sm text-black/60">@{selectedFriend.username}</p>
                </div>
              </div>
              <button type="button" aria-label="Close profile" onClick={() => setSelectedFriend(null)} className="rounded-full border border-black/10 px-3 py-1 font-bold">Close</button>
            </div>

            <div className="mt-6 border-y border-black/10 py-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-black/50">Bio</div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-black/80">{selectedFriend.bio?.trim() || 'No bio added yet.'}</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-black/60">
                <span className={`h-2.5 w-2.5 rounded-full ${selectedFriend.status === 'online' ? 'bg-emerald-500' : 'bg-black/25'}`} />
                <span>{selectedFriend.status === 'online' ? 'Online now' : selectedFriend.lastSeenAt ? `Last active ${new Date(selectedFriend.lastSeenAt).toLocaleString()}` : 'Offline'}</span>
              </div>
            </div>

            {actionError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
            {actionNotice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{actionNotice}</p>}

            {reporting && (
              <form onSubmit={submitReport} className="mt-5 space-y-3">
                <label className="block text-sm font-bold" htmlFor="report-reason">Reason</label>
                <select id="report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value as ReportReason)} className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm">
                  <option value="spam">Spam</option>
                  <option value="harassment">Harassment</option>
                  <option value="impersonation">Impersonation</option>
                  <option value="inappropriate_content">Inappropriate content</option>
                  <option value="other">Other</option>
                </select>
                <label className="block text-sm font-bold" htmlFor="report-details">Details (optional)</label>
                <textarea id="report-details" value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={1000} rows={3} className="w-full rounded-xl border border-black/15 px-3 py-2 text-sm" />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setReporting(false)} className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold">Cancel</button>
                  <button type="submit" disabled={actionBusy} className="rounded-full bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{actionBusy ? 'Sending...' : 'Submit report'}</button>
                </div>
              </form>
            )}

            {confirmingBlock ? (
              <div className="mt-5 rounded-xl bg-red-50 p-4">
                <p className="text-sm text-red-900">Blocking this person removes them from your friends and prevents future contact.</p>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmingBlock(false)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold">Cancel</button>
                  <button type="button" onClick={() => void blockFriend()} disabled={actionBusy} className="rounded-full bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{actionBusy ? 'Blocking...' : 'Block user'}</button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap justify-between gap-3">
                <div className="flex gap-2">
                  {!reporting && <button type="button" onClick={() => { setReporting(true); setActionNotice(''); setActionError(''); }} className="rounded-full border border-black/10 px-4 py-2 text-sm font-bold">Report</button>}
                  <button type="button" onClick={() => { setConfirmingBlock(true); setActionNotice(''); setActionError(''); }} className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-700">Block</button>
                </div>
                <Link href={`/chat?friend=${encodeURIComponent(selectedFriend.id)}`} className="rounded-full bg-snapchat-yellow px-4 py-2 text-sm font-black">Message</Link>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
