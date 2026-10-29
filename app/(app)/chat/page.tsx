'use client';

import { useCallback, useEffect, useState } from 'react';
import { readApiResponse } from '@/lib/api-response';
import { realtimeStatusLabel, subscribeRealtime, useRealtimeStatus } from '@/lib/realtime-client';

type Friend = { id: string; username: string; displayName: string | null };
type Thread = {
  conversationId: string;
  friend: Friend;
  lastMessage: { text: string; createdAt: string };
  unreadCount: number;
};
type Message = {
  id: string;
  senderId: string;
  receiverId: string | null;
  text: string;
  createdAt: string;
  readAt: string | null;
};

export default function ChatPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const streamStatus = realtimeStatusLabel(useRealtimeStatus());

  const loadThreads = useCallback(async () => {
    const response = await fetch('/api/messages/conversations');
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error ?? 'Could not load conversations');
    setThreads(data.conversations);
    setError('');
    return data.conversations as Thread[];
  }, []);

  const loadMessages = useCallback(async (friendId: string, currentThreads?: Thread[]) => {
    const threadList = currentThreads ?? threads;
    const thread = threadList.find((item) => item.friend.id === friendId);
    if (!thread) {
      setMessages([]);
      setError('');
      return;
    }
    const response = await fetch(`/api/messages/${encodeURIComponent(thread.conversationId)}`);
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error ?? 'Could not load messages');
    setMessages(data.messages);
    setError('');
    const unread = (data.messages as Message[]).filter((message) => message.receiverId === currentUserId && !message.readAt);
    await Promise.all(unread.map((message) => fetch(`/api/messages/${encodeURIComponent(message.id)}/read`, { method: 'POST' })));
  }, [currentUserId, threads]);

  useEffect(() => {
    const requestedFriend = new URLSearchParams(window.location.search).get('friend') ?? '';
    Promise.all([fetch('/api/friends/list'), fetch('/api/users/me')])
      .then(async ([friendsResponse, userResponse]) => {
        const [friendData, userData] = await Promise.all([readApiResponse(friendsResponse), readApiResponse(userResponse)]);
        if (!friendsResponse.ok) throw new Error(friendData.error ?? 'Could not load friends');
        if (!userResponse.ok) throw new Error(userData.error ?? 'Could not load account');
        setFriends(friendData.friends);
        setCurrentUserId(userData.user.id);
        const threadList = await loadThreads();
        const chosen = friendData.friends.find((friend: Friend) => friend.id === requestedFriend)
          ?? threadList[0]?.friend
          ?? friendData.friends[0];
        if (chosen) setSelectedFriendId(chosen.id);
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedFriendId) return;
    // Fetching here is the effect's purpose; its async completion updates message state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMessages(selectedFriendId).catch((cause: Error) => setError(cause.message));
    return subscribeRealtime((update) => {
      if (!update.messagesChanged) return;
      loadThreads()
        .then((threadList) => loadMessages(selectedFriendId, threadList))
        .catch((cause: Error) => setError(cause.message));
    });
  }, [loadMessages, loadThreads, selectedFriendId]);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedFriendId || !text.trim()) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: selectedFriendId,
          text: text.trim(),
          conversationId: threads.find((thread) => thread.friend.id === selectedFriendId)?.conversationId
        })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not send message');
      setText('');
      const updatedThreads = await loadThreads();
      await loadMessages(selectedFriendId, updatedThreads);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send message');
    } finally {
      setSending(false);
    }
  }

  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId);

  return (
    <main className="mx-auto max-w-3xl px-2 md:px-0">
      <section className="mb-4 rounded-[28px] border border-black/10 bg-white p-4 shadow-snap">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/60">Direct chat</div>
        <h1 className="mt-2 text-3xl font-black">Messages</h1>
        <label className="mt-4 block text-sm font-bold">
          Chat with
          <select className="mt-2 w-full rounded-full border border-black/10 bg-[#F3F3F3] px-4 py-3" value={selectedFriendId} onChange={(event) => setSelectedFriendId(event.target.value)}>
            <option value="">Choose a friend</option>
            {friends.map((friend) => <option key={friend.id} value={friend.id}>{friend.displayName || friend.username} (@{friend.username})</option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-black/50" role="status">{streamStatus}</p>
        {selectedFriend && <p className="mt-3 text-sm text-black/60">Private conversation with {selectedFriend.displayName || selectedFriend.username}. New messages and read receipts are pushed live.</p>}
      </section>

      {error && <p role="alert" className="mb-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <section aria-live="polite" className="min-h-72 space-y-3 rounded-[28px] border border-black/10 bg-white p-4 shadow-snap">
        {loading ? <p className="text-sm text-black/60">Loading messages...</p> : null}
        {!loading && !friends.length && <p className="text-sm text-black/60">Add friends before starting a conversation.</p>}
        {!loading && selectedFriend && messages.length === 0 && <p className="text-sm text-black/60">No messages yet. Say hello.</p>}
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          return (
            <div key={message.id} className={`max-w-[80%] rounded-[22px] px-4 py-3 text-sm ${mine ? 'ml-auto bg-snapchat-yellow' : 'bg-[#F3F3F3]'}`}>
              <p>{message.text}</p>
              <div className="mt-1 text-[10px] text-black/55">
                {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {mine && message.readAt ? ' · Seen' : ''}
              </div>
            </div>
          );
        })}
      </section>

      <form onSubmit={sendMessage} className="mt-4 flex gap-2">
        <input className="min-w-0 flex-1 rounded-full border border-black/10 bg-white px-4 py-3 outline-none" placeholder={selectedFriend ? 'Message...' : 'Choose a friend to start'} value={text} maxLength={4000} onChange={(event) => setText(event.target.value)} disabled={!selectedFriendId} />
        <button className="rounded-full bg-snapchat-yellow px-5 py-3 font-black disabled:opacity-60" disabled={sending || !selectedFriendId || !text.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
      {threads.some((thread) => thread.friend.id === selectedFriendId && thread.unreadCount > 0) && (
        <p className="mt-2 text-xs text-black/50">Unread messages are marked seen when opened.</p>
      )}
    </main>
  );
}
