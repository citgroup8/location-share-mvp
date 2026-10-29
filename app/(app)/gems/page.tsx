'use client';

import { useCallback, useEffect, useState } from 'react';
import { PhotoPicker, PostPhotoGallery, type PostPhoto } from '@/components/post-photo-controls';
import { PostEngagement, type PostComment } from '@/components/post-engagement';
import { readApiResponse } from '@/lib/api-response';

type Gem = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  latitude: number;
  longitude: number;
  distanceMeters: number | null;
  isSaved: boolean;
  isMine: boolean;
  createdAt: string;
  photos: PostPhoto[];
  comments: PostComment[];
  commentCount: number;
  creator: { id: string; username: string; displayName: string | null };
};
type Scope = 'all' | 'nearby' | 'saved' | 'mine';
type Point = { latitude: number; longitude: number };

export default function GemsPage() {
  const [gems, setGems] = useState<Gem[]>([]);
  const [coordinates, setCoordinates] = useState<Point | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const [form, setForm] = useState({ title: '', description: '', category: 'food' });
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: 'food', latitude: '', longitude: '' });
  const [editPhotos, setEditPhotos] = useState<File[]>([]);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingGemId, setSavingGemId] = useState<string | null>(null);
  const [deletingGemId, setDeletingGemId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadGems = useCallback(async (nextScope: Scope, point: Point | null = null) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ scope: nextScope });
      if (point) {
        params.set('lat', String(point.latitude));
        params.set('lng', String(point.longitude));
      }
      const response = await fetch(`/api/gems?${params}`);
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not load Gems');
      setGems(data.gems);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load Gems');
    } finally {
      setLoading(false);
    }
  }, []);

  const getCurrentLocation = useCallback(async (showNearby: boolean) => {
    setError('');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Location is not available in this browser.'));
        navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Location permission was denied.')), { timeout: 10000, maximumAge: 60000 });
      });
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setCoordinates(point);
      if (showNearby) {
        setScope('nearby');
        await loadGems('nearby', point);
      }
    } catch (cause) {
      setLoading(false);
      setError(cause instanceof Error ? cause.message : 'Could not get your location');
    }
  }, [loadGems]);

  useEffect(() => {
    // Initial discovery does not require location access.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGems('all');
  }, [loadGems]);

  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [gems]);

  function selectScope(nextScope: Scope) {
    if (nextScope === 'nearby') {
      void getCurrentLocation(true);
      return;
    }
    setScope(nextScope);
    void loadGems(nextScope, coordinates);
  }

  async function createGem(event: React.FormEvent) {
    event.preventDefault();
    if (!coordinates) {
      setError('Set your location before creating a Gem.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/gems/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...coordinates })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not create Gem');
      const photosToUpload = newPhotos;
      setForm({ title: '', description: '', category: 'food' });
      setNewPhotos([]);
      try {
        await uploadGemPhotos(data.gem.id, photosToUpload);
        setNotice('Your public Gem was created.');
      } catch (cause) {
        setNotice('Your public Gem was created, but its photos could not be uploaded. You can add them from Edit.');
        setError(cause instanceof Error ? cause.message : 'Photo upload failed.');
      }
      await loadGems(scope, coordinates);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create Gem');
    } finally {
      setSaving(false);
    }
  }

  async function toggleSaved(gem: Gem) {
    setSavingGemId(gem.id);
    setError('');
    try {
      const response = await fetch(`/api/saved/gem/${gem.id}`, { method: gem.isSaved ? 'DELETE' : 'POST' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not update saved Gems');
      await loadGems(scope, coordinates);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update saved Gems');
    } finally {
      setSavingGemId(null);
    }
  }

  async function deleteGem(gem: Gem) {
    if (!window.confirm(`Delete "${gem.title}"? This cannot be undone.`)) return;
    setDeletingGemId(gem.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/gems/${encodeURIComponent(gem.id)}`, { method: 'DELETE' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not delete Gem');
      setGems((current) => current.filter((item) => item.id !== gem.id));
      setNotice('Gem deleted.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete Gem');
    } finally {
      setDeletingGemId(null);
    }
  }

  async function updateGem(event: React.FormEvent) {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/gems/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description,
          category: editForm.category,
          latitude: Number(editForm.latitude),
          longitude: Number(editForm.longitude)
        })
      });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not update Gem');
      const photosToUpload = editPhotos;
      if (photosToUpload.length) await uploadGemPhotos(editingId, photosToUpload);
      setEditingId(null);
      setEditPhotos([]);
      setNotice('Gem updated.');
      await loadGems(scope, coordinates);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update Gem');
    } finally {
      setSaving(false);
    }
  }

  async function uploadGemPhotos(gemId: string, photos: File[]) {
    if (!photos.length) return;
    const body = new FormData();
    photos.forEach((photo) => body.append('photos', photo));
    const response = await fetch(`/api/gems/${gemId}/photos`, { method: 'POST', body });
    const data = await readApiResponse(response);
    if (!response.ok) throw new Error(data.error ?? 'Could not upload Gem photos.');
  }

  async function addGemPhotos(gem: Gem) {
    setSaving(true);
    setError('');
    try {
      await uploadGemPhotos(gem.id, editPhotos);
      setEditPhotos([]);
      setNotice('Memory photos added.');
      await loadGems(scope, coordinates);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload Gem photos.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteGemPhoto(gem: Gem, photo: PostPhoto) {
    setDeletingPhotoId(photo.id);
    setError('');
    try {
      const response = await fetch(`/api/gems/${gem.id}/photos/${photo.id}`, { method: 'DELETE' });
      const data = await readApiResponse(response);
      if (!response.ok) throw new Error(data.error ?? 'Could not remove photo.');
      await loadGems(scope, coordinates);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove photo.');
    } finally {
      setDeletingPhotoId(null);
    }
  }

  const distanceLabel = (meters: number) => meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;

  return (
    <main className="space-y-6 px-2 md:px-0">
      <section className="rounded-[var(--card-radius)] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">Discover</div>
            <h1 className="mt-2 font-display text-3xl font-extrabold">Public Gems</h1>
          </div>
          <button className="rounded-full bg-[var(--green)] px-4 py-2 text-sm font-bold text-[var(--green-contrast)]" onClick={() => document.getElementById('create-gem')?.scrollIntoView({ behavior: 'smooth' })}>
            Create Gem
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">Browse public places, find nearby Gems, and keep a list of your favorites.</p>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Gem collections">
          {([['all', 'All Gems'], ['nearby', 'Nearby'], ['saved', 'Saved'], ['mine', 'My Gems']] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={scope === value} className={`rounded-full px-4 py-2 text-sm font-bold ${scope === value ? 'bg-[var(--green)] text-[var(--green-contrast)]' : 'bg-[var(--surface-muted)] text-[var(--foreground)]'}`} onClick={() => selectScope(value)}>{label}</button>
          ))}
        </div>
      </section>

      <form id="create-gem" onSubmit={createGem} className="space-y-3 rounded-[var(--card-radius)] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-soft">
        <h2 className="font-display text-xl font-extrabold">Share a Gem</h2>
        <p className="text-sm text-[var(--muted)]">Gems are public. Coordinates come from your current location.</p>
        <input className="w-full rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" placeholder="Place name" maxLength={100} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <textarea className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" placeholder="Description (optional)" maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <select className="w-full rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
          <option value="food">Food</option><option value="cafe">Cafe</option><option value="view">View</option><option value="nature">Nature</option><option value="activity">Activity</option><option value="other">Other</option>
        </select>
        <PhotoPicker files={newPhotos} onChange={setNewPhotos} />
        <button type="button" className="text-sm font-bold underline" onClick={() => void getCurrentLocation(false)}>{coordinates ? 'Refresh coordinates' : 'Use my current location'}</button>
        <p className="text-xs text-[var(--muted)]">{coordinates ? `Using ${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}` : 'Location is required to create a Gem.'}</p>
        <button className="rounded-full bg-[var(--green)] px-5 py-3 font-bold text-[var(--green-contrast)] disabled:opacity-60" disabled={saving || !coordinates}>{saving ? 'Creating...' : 'Publish Gem'}</button>
      </form>

      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-2xl bg-green-50 p-4 text-sm text-green-800">{notice}</p>}
      <section className="space-y-4">
        {loading && <p className="rounded-2xl bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">Loading Gems...</p>}
        {!loading && gems.length === 0 && <p className="rounded-2xl bg-[var(--paper)] p-4 text-sm text-[var(--muted)]">No Gems in this collection yet.</p>}
        {gems.map((gem) => (
          <article id={`gem-${gem.id}`} key={gem.id} className="scroll-mt-24 rounded-[var(--card-radius)] border border-[var(--line)] bg-[var(--paper)] p-5 shadow-soft">
            {editingId === gem.id ? (
              <form className="space-y-3" onSubmit={updateGem}>
                <h2 className="text-xl font-black">Edit Gem</h2>
                <PostPhotoGallery photos={gem.photos} deletingId={deletingPhotoId} onDelete={(photo) => void deleteGemPhoto(gem, photo)} />
                <PhotoPicker files={editPhotos} onChange={setEditPhotos} existingCount={gem.photos.length} />
                {editPhotos.length > 0 && <button type="button" disabled={saving} className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold" onClick={() => void addGemPhotos(gem)}>{saving ? 'Uploading...' : 'Upload photos'}</button>}
                <input aria-label="Gem title" className="w-full rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} maxLength={100} required />
                <textarea aria-label="Gem description" className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} maxLength={500} />
                <select aria-label="Gem category" className="w-full rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" value={editForm.category} onChange={(event) => setEditForm({ ...editForm, category: event.target.value })}>
                  <option value="food">Food</option><option value="cafe">Cafe</option><option value="view">View</option><option value="nature">Nature</option><option value="activity">Activity</option><option value="other">Other</option>
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input aria-label="Latitude" type="number" step="any" min="-90" max="90" className="min-w-0 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" value={editForm.latitude} onChange={(event) => setEditForm({ ...editForm, latitude: event.target.value })} required />
                  <input aria-label="Longitude" type="number" step="any" min="-180" max="180" className="min-w-0 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3" value={editForm.longitude} onChange={(event) => setEditForm({ ...editForm, longitude: event.target.value })} required />
                </div>
                <button disabled={saving} className="rounded-full bg-[var(--green)] px-4 py-2 text-sm font-bold text-[var(--green-contrast)]">{saving ? 'Saving...' : 'Save changes'}</button>
                <button type="button" className="ml-2 rounded-full border border-black/15 px-4 py-2 text-sm font-bold" onClick={() => setEditingId(null)}>Cancel</button>
              </form>
            ) : <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--green-soft)] font-display text-lg font-extrabold text-[var(--green)]">
                  {(gem.creator.displayName || gem.creator.username).slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{gem.creator.displayName || gem.creator.username}</div>
                  <time className="text-xs text-[var(--muted)]" dateTime={gem.createdAt}>
                    @{gem.creator.username} · {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(gem.createdAt))}
                  </time>
                </div>
              </div>
              {gem.distanceMeters !== null && <div className="shrink-0 rounded-full bg-[var(--green-soft)] px-3 py-1 text-xs font-bold text-[var(--green)]">{distanceLabel(gem.distanceMeters)}</div>}
            </div>
            <div className="mt-4">
              <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-bold capitalize text-[var(--muted)]">{gem.category}</span>
              <h2 className="mt-3 font-display text-2xl font-extrabold">{gem.title}</h2>
              {gem.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]/80">{gem.description}</p>}
            </div>
            <div className="mt-3"><PostPhotoGallery photos={gem.photos} /></div>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[var(--green-soft)] px-4 py-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--green)]">Hidden Gem</div>
                <div className="mt-1 text-xs text-[var(--muted)]">A little place worth remembering</div>
              </div>
              <span className="text-right text-xs font-semibold text-[var(--green)]">{gem.latitude.toFixed(4)}, {gem.longitude.toFixed(4)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
              <button type="button" className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--foreground)] hover:bg-[var(--green-soft)]" disabled={savingGemId === gem.id} onClick={() => void toggleSaved(gem)}>{savingGemId === gem.id ? 'Updating...' : gem.isSaved ? 'Saved' : 'Save Gem'}</button>
              {gem.isMine && <>
                <button type="button" className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold" onClick={() => { setEditingId(gem.id); setEditForm({ title: gem.title, description: gem.description ?? '', category: gem.category, latitude: String(gem.latitude), longitude: String(gem.longitude) }); }}>Edit</button>
                <button type="button" className="rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-60" disabled={deletingGemId === gem.id} onClick={() => void deleteGem(gem)}>{deletingGemId === gem.id ? 'Deleting...' : 'Delete'}</button>
              </>}
            </div>
            <PostEngagement type="gems" postId={gem.id} title={gem.title} comments={gem.comments} commentCount={gem.commentCount} />
            </>}
          </article>
        ))}
      </section>
    </main>
  );
}
