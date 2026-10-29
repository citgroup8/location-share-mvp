'use client';

import { useCallback, useEffect, useState } from 'react';
import { PhotoPicker, PostPhotoGallery, type PostPhoto } from '@/components/post-photo-controls';
import { PostEngagement, type PostComment } from '@/components/post-engagement';
import { readApiResponse } from '@/lib/api-response';

type Friend = { id: string; username: string; displayName: string | null };
type Scope = 'all' | 'mine' | 'saved';
type Spot = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  latitude: number;
  longitude: number;
  visibility: string;
  isSaved: boolean;
  isMine: boolean;
  createdAt: string;
  photos: PostPhoto[];
  comments: PostComment[];
  commentCount: number;
  creator: { id: string; username: string; displayName: string | null };
  shares: { userId: string }[];
};

export default function SpotsPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [scope, setScope] = useState<Scope>('all');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'hangout' });
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: 'hangout', latitude: '', longitude: '' });
  const [editPhotos, setEditPhotos] = useState<File[]>([]);
  const [editSelected, setEditSelected] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSpotId, setSavingSpotId] = useState<string | null>(null);
  const [deletingSpotId, setDeletingSpotId] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSpots = useCallback(async (nextScope: Scope) => {
    const [spotsResponse, friendsResponse] = await Promise.all([fetch(`/api/spots?scope=${nextScope}`), fetch('/api/friends/list')]);
    const [spotsData, friendsData] = await Promise.all([readApiResponse(spotsResponse), readApiResponse(friendsResponse)]);
    if (!spotsResponse.ok) throw new Error(spotsData.error ?? 'Could not load Spots');
    if (!friendsResponse.ok) throw new Error(friendsData.error ?? 'Could not load friends');
    setSpots(spotsData.spots);
    setFriends(friendsData.friends);
  }, []);

  useEffect(() => {
    // The initial data fetch updates state when the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSpots('all').catch((cause: Error) => setError(cause.message)).finally(() => setLoading(false));
  }, [loadSpots]);

  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [spots]);

  async function getCurrentLocation() {
    setError('');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Location is not available in this browser.'));
        navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Location permission was denied.')), { timeout: 10000, maximumAge: 60000 });
      });
      setPoint({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not get your location');
    }
  }

  async function createSpot(event: React.FormEvent) {
    event.preventDefault();
    if (!point) {
      setError('Set your location before creating a Spot.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/spots/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...point, friendIds: Array.from(selected) })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not create Spot');
      const photosToUpload = newPhotos;
      setForm({ title: '', description: '', category: 'hangout' });
      setNewPhotos([]);
      setSelected(new Set());
      try {
        await uploadSpotPhotos(data.spot.id, photosToUpload);
        setNotice('Your private Spot was saved.');
      } catch (cause) {
        setNotice('Your Spot was saved, but its photos could not be uploaded. You can add them from Edit.');
        setError(cause instanceof Error ? cause.message : 'Photo upload failed.');
      }
      await loadSpots(scope);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create Spot');
    } finally {
      setSaving(false);
    }
  }

  function toggleFriend(friendId: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  }

  function toggleEditFriend(friendId: string) {
    setEditSelected((previous) => {
      const next = new Set(previous);
      if (next.has(friendId)) next.delete(friendId);
      else next.add(friendId);
      return next;
    });
  }

  async function toggleSaved(spot: Spot) {
    setSavingSpotId(spot.id);
    setError('');
    try {
      const response = await fetch(`/api/saved/spot/${spot.id}`, { method: spot.isSaved ? 'DELETE' : 'POST' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not update saved Spots');
      await loadSpots(scope);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update saved Spots');
    } finally {
      setSavingSpotId(null);
    }
  }

  async function deleteSpot(spot: Spot) {
    if (!window.confirm(`Delete "${spot.title}"? This cannot be undone.`)) return;
    setDeletingSpotId(spot.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/spots/${encodeURIComponent(spot.id)}`, { method: 'DELETE' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not delete Spot');
      setSpots((current) => current.filter((item) => item.id !== spot.id));
      setNotice('Spot deleted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete Spot');
    } finally {
      setDeletingSpotId(null);
    }
  }

  async function updateSpot(event: React.FormEvent) {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/spots/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          latitude: Number(editForm.latitude),
          longitude: Number(editForm.longitude),
          friendIds: Array.from(editSelected)
        })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not update Spot');
      const photosToUpload = editPhotos;
      if (photosToUpload.length) await uploadSpotPhotos(editingId, photosToUpload);
      setEditingId(null);
      setEditPhotos([]);
      setNotice('Spot updated.');
      await loadSpots(scope);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update Spot');
    } finally {
      setSaving(false);
    }
  }

  async function uploadSpotPhotos(spotId: string, photos: File[]) {
    if (!photos.length) return;
    const body = new FormData();
    photos.forEach((photo) => body.append('photos', photo));
    const response = await fetch(`/api/spots/${spotId}/photos`, { method: 'POST', body });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error ?? 'Could not upload Spot photos.');
  }

  async function addSpotPhotos(spot: Spot) {
    setSaving(true);
    setError('');
    try {
      await uploadSpotPhotos(spot.id, editPhotos);
      setEditPhotos([]);
      setNotice('Memory photos added.');
      await loadSpots(scope);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload Spot photos.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSpotPhoto(spot: Spot, photo: PostPhoto) {
    setDeletingPhotoId(photo.id);
    setError('');
    try {
      const response = await fetch(`/api/spots/${spot.id}/photos/${photo.id}`, { method: 'DELETE' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not remove photo.');
      await loadSpots(scope);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove photo.');
    } finally {
      setDeletingPhotoId(null);
    }
  }

  return (
    <main className="space-y-6 px-2 md:px-0">
      <section className="rounded-[var(--card-radius)] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-soft">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Private</div>
        <h1 className="mt-2 font-display text-3xl font-extrabold">Spots</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Your private places, shared Spots, and places your friends share with you.</p>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Spot collections">
          {([['all', 'All available'], ['mine', 'My Spots'], ['saved', 'Saved']] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={scope === value} className={`rounded-full px-4 py-2 text-sm font-bold ${scope === value ? 'bg-[var(--green)] text-[var(--green-contrast)]' : 'bg-[var(--surface-muted)] text-[var(--foreground)]'}`} onClick={() => { setScope(value); void loadSpots(value); }}>{label}</button>
          ))}
        </div>
      </section>

      <form onSubmit={createSpot} className="space-y-3 rounded-[var(--card-radius)] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-soft">
        <h2 className="font-display text-xl font-extrabold">Save a Spot</h2>
        <input className="w-full rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" placeholder="Place name" maxLength={100} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <textarea className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" placeholder="Description (optional)" maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <input className="w-full rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" placeholder="Category" maxLength={40} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
        <PhotoPicker files={newPhotos} onChange={setNewPhotos} />
        <button type="button" className="text-sm font-bold underline" onClick={() => void getCurrentLocation()}>
          {point ? 'Refresh coordinates' : 'Use my current location'}
        </button>
        <p className="text-xs text-[var(--muted)]">{point ? `${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)}` : 'Location is required to save a Spot.'}</p>
        <fieldset className="space-y-2 rounded-2xl bg-[var(--surface-muted)] p-4">
          <legend className="px-1 text-sm font-bold">Share with selected friends (optional)</legend>
          {friends.length === 0 ? <p className="text-sm text-[var(--muted)]">Add friends first, or keep this Spot private.</p> : friends.map((friend) => (
            <label key={friend.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.has(friend.id)} onChange={() => toggleFriend(friend.id)} />
              {friend.displayName || friend.username} (@{friend.username})
            </label>
          ))}
        </fieldset>
        <button className="rounded-full bg-[var(--green)] px-5 py-3 font-bold text-[var(--green-contrast)] disabled:opacity-60" disabled={saving || !point}>
          {saving ? 'Saving...' : 'Save private Spot'}
        </button>
      </form>

      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-2xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
      <section className="space-y-4">
        {loading && <p className="rounded-2xl bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">Loading Spots...</p>}
        {!loading && spots.length === 0 && <p className="rounded-2xl bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">No Spots in this collection yet.</p>}
        {spots.map((spot) => (
          <article id={`spot-${spot.id}`} key={spot.id} className="scroll-mt-24 rounded-[var(--card-radius)] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-soft">
            {editingId === spot.id ? (
              <form className="space-y-3" onSubmit={updateSpot}>
                <h2 className="text-xl font-black">Edit Spot</h2>
                <PostPhotoGallery photos={spot.photos} deletingId={deletingPhotoId} onDelete={(photo) => void deleteSpotPhoto(spot, photo)} />
                <PhotoPicker files={editPhotos} onChange={setEditPhotos} existingCount={spot.photos.length} />
                {editPhotos.length > 0 && <button type="button" disabled={saving} className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold" onClick={() => void addSpotPhotos(spot)}>{saving ? 'Uploading...' : 'Upload photos'}</button>}
                <input aria-label="Spot title" className="w-full rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} maxLength={100} required />
                <textarea aria-label="Spot description" className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} maxLength={500} />
                <input aria-label="Spot category" className="w-full rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" value={editForm.category} onChange={(event) => setEditForm({ ...editForm, category: event.target.value })} maxLength={40} required />
                <div className="grid grid-cols-2 gap-3">
                  <input aria-label="Latitude" type="number" step="any" min="-90" max="90" className="min-w-0 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" value={editForm.latitude} onChange={(event) => setEditForm({ ...editForm, latitude: event.target.value })} required />
                  <input aria-label="Longitude" type="number" step="any" min="-180" max="180" className="min-w-0 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" value={editForm.longitude} onChange={(event) => setEditForm({ ...editForm, longitude: event.target.value })} required />
                </div>
                <fieldset className="space-y-2 rounded-2xl bg-[var(--surface-muted)] p-4">
                  <legend className="px-1 text-sm font-bold">Share with friends</legend>
                  {friends.length === 0 ? <p className="text-sm text-[var(--muted)]">No friends to share with yet.</p> : friends.map((friend) => (
                    <label key={friend.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={editSelected.has(friend.id)} onChange={() => toggleEditFriend(friend.id)} />
                      {friend.displayName || friend.username} (@{friend.username})
                    </label>
                  ))}
                </fieldset>
                <button disabled={saving} className="rounded-full bg-[var(--green)] px-4 py-2 text-sm font-bold text-[var(--green-contrast)]">{saving ? 'Saving...' : 'Save changes'}</button>
                <button type="button" className="ml-2 rounded-full border border-black/15 px-4 py-2 text-sm font-bold" onClick={() => setEditingId(null)}>Cancel</button>
              </form>
            ) : <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--green-soft)] font-display text-lg font-extrabold text-[var(--green)]">
                  {(spot.creator.displayName || spot.creator.username).slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{spot.creator.displayName || spot.creator.username}</div>
                  <time className="text-xs text-[var(--muted)]" dateTime={spot.createdAt}>
                    @{spot.creator.username} · {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(spot.createdAt))}
                  </time>
                </div>
              </div>
              <div className="shrink-0 rounded-full bg-[var(--green-soft)] px-3 py-1 text-xs font-bold text-[var(--green)]">
                {spot.shares.length ? `Shared with ${spot.shares.length}` : spot.visibility === 'friends' ? 'Friends' : 'Private'}
              </div>
            </div>
            <div className="mt-4">
              <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-bold capitalize text-[var(--muted)]">{spot.category}</span>
              <h2 className="mt-3 font-display text-2xl font-extrabold">{spot.title}</h2>
              {spot.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]/80">{spot.description}</p>}
            </div>
            <div className="mt-3"><PostPhotoGallery photos={spot.photos} /></div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[var(--green-soft)] px-4 py-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--green)]">Saved Spot</div>
                <div className="mt-1 text-xs text-[var(--muted)]">Only people with access can see this post</div>
              </div>
              <span className="text-right text-xs font-semibold text-[var(--green)]">{spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
              <button type="button" className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--foreground)] hover:bg-[var(--green-soft)]" disabled={savingSpotId === spot.id} onClick={() => void toggleSaved(spot)}>{savingSpotId === spot.id ? 'Updating...' : spot.isSaved ? 'Saved' : 'Save Spot'}</button>
              {spot.isMine && <>
                <button type="button" className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold" onClick={() => { setEditingId(spot.id); setEditForm({ title: spot.title, description: spot.description ?? '', category: spot.category, latitude: String(spot.latitude), longitude: String(spot.longitude) }); setEditSelected(new Set(spot.shares.map((share) => share.userId))); }}>Edit</button>
                <button type="button" className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-60" disabled={deletingSpotId === spot.id} onClick={() => void deleteSpot(spot)}>{deletingSpotId === spot.id ? 'Deleting...' : 'Delete'}</button>
              </>}
            </div>
            <PostEngagement type="spots" postId={spot.id} title={spot.title} comments={spot.comments} commentCount={spot.commentCount} />
            </>}
          </article>
        ))}
      </section>
    </main>
  );
}
