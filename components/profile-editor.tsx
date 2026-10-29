'use client';

import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { readApiResponse } from '@/lib/api-response';

type Privacy = 'off' | 'friends_only' | 'public';
type Profile = {
  username: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  defaultLocationPrivacy: string;
};
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';

export function ProfileEditor({ initialProfile, mode }: { initialProfile: Profile; mode: 'setup' | 'edit' }) {
  const { user } = useUser();
  const router = useRouter();
  const [username, setUsername] = useState(initialProfile.username.startsWith('user_') ? '' : initialProfile.username);
  const [displayName, setDisplayName] = useState(initialProfile.displayName ?? '');
  const [bio, setBio] = useState(initialProfile.bio ?? '');
  const [profileImageUrl, setProfileImageUrl] = useState(initialProfile.profileImageUrl);
  const [privacy, setPrivacy] = useState<Privacy>(initialProfile.defaultLocationPrivacy as Privacy);
  const [availability, setAvailability] = useState<{ username: string; status: UsernameStatus }>({ username: '', status: 'idle' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalized)) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetch(`/api/users/username-availability?username=${encodeURIComponent(normalized)}`, { signal: controller.signal })
        .then(async (response) => {
          const result = await readApiResponse(response);
          if (!response.ok) throw new Error(result.error ?? 'Could not check username');
          setAvailability({ username: normalized, status: result.available ? 'available' : 'taken' });
        })
        .catch((cause: Error) => {
          if (cause.name !== 'AbortError') setAvailability({ username: normalized, status: 'error' });
        });
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [username]);

  async function uploadPhoto(file: File | null) {
    if (!user) return;
    setError('');
    setNotice('');
    if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setError('Choose an image smaller than 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const uploadedImage = await user.setProfileImage({ file });
      const imageUrl = uploadedImage.publicUrl;
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileImageUrl: imageUrl })
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error ?? 'Could not save profile photo');
      setProfileImageUrl(imageUrl);
      setNotice(file ? 'Profile photo updated.' : 'Profile photo removed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update profile photo');
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          displayName,
          bio,
          defaultLocationPrivacy: privacy
        })
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error ?? 'Could not save profile');
      if (mode === 'setup') {
        router.replace('/dashboard');
        router.refresh();
      } else {
        setNotice('Profile saved.');
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  const usernameMessage: Record<UsernameStatus, string> = {
    idle: 'Use 3-24 letters, numbers, or underscores.',
    checking: 'Checking availability...',
    available: 'Username is available.',
    taken: 'That username is already taken.',
    invalid: 'Use 3-24 letters, numbers, or underscores.',
    error: 'Could not check username. Try again.'
  };
  const normalizedUsername = username.trim().toLowerCase();
  const usernameStatus: UsernameStatus = !normalizedUsername
    ? 'idle'
    : !/^[a-z0-9_]{3,24}$/.test(normalizedUsername)
      ? 'invalid'
      : availability.username === normalizedUsername
        ? availability.status
        : 'checking';
  const canSave = usernameStatus === 'available' && displayName.trim().length > 0 && !saving && !uploading;

  return (
    <form onSubmit={saveProfile} className="space-y-5 rounded-[28px] border border-black/10 bg-white p-5 shadow-snap md:p-7">
      <div>
        <h2 className="text-2xl font-black">{mode === 'setup' ? 'Make it yours' : 'Edit profile'}</h2>
        <p className="mt-1 text-sm text-black/60">Your username helps friends find you. You can change these details later.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-[#F3F3F3] text-3xl font-black">
          {profileImageUrl ? (
            <Image src={profileImageUrl} alt="Profile photo" width={96} height={96} unoptimized className="h-full w-full object-cover" />
          ) : (
            (displayName || username || 'HG').slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-full bg-snapchat-yellow px-4 py-2 text-sm font-black">
            {uploading ? 'Uploading...' : 'Upload photo'}
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadPhoto(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
          {profileImageUrl && (
            <button type="button" className="rounded-full border border-black/15 px-4 py-2 text-sm font-bold" disabled={uploading} onClick={() => void uploadPhoto(null)}>
              Remove photo
            </button>
          )}
          <p className="w-full text-xs text-black/55">JPG, PNG, or WebP. Maximum 5 MB.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-bold">
          Username
          <div className="mt-2 flex items-center rounded-full border border-black/10 bg-[#F3F3F3] px-4 focus-within:border-black/40">
            <span className="text-black/50">@</span>
            <input
              className="w-full bg-transparent px-2 py-3 outline-none"
              value={username}
              minLength={3}
              maxLength={24}
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              required
            />
          </div>
          <span aria-live="polite" className={`mt-1 block text-xs ${usernameStatus === 'available' ? 'text-green-800' : usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'error' ? 'text-red-700' : 'text-black/55'}`}>
            {usernameMessage[usernameStatus]}
          </span>
        </label>
        <label className="block text-sm font-bold">
          Display name
          <input className="mt-2 w-full rounded-full border border-black/10 bg-[#F3F3F3] px-4 py-3 outline-none focus:border-black/40" value={displayName} maxLength={80} onChange={(event) => setDisplayName(event.target.value)} required />
        </label>
      </div>

      <label className="block text-sm font-bold">
        Bio
        <textarea className="mt-2 min-h-28 w-full rounded-2xl border border-black/10 bg-[#F3F3F3] px-4 py-3 outline-none focus:border-black/40" value={bio} maxLength={280} onChange={(event) => setBio(event.target.value)} placeholder="A little about you, your favorite places, or what you like doing." />
        <span className="mt-1 block text-right text-xs font-normal text-black/55">{bio.length}/280</span>
      </label>

      <label className="block text-sm font-bold">
        Default location sharing
        <select className="mt-2 w-full rounded-full border border-black/10 bg-[#F3F3F3] px-4 py-3" value={privacy} onChange={(event) => setPrivacy(event.target.value as Privacy)}>
          <option value="off">Off</option>
          <option value="friends_only">Friends only</option>
          <option value="public">Public</option>
        </select>
      </label>
      <p className="text-xs text-black/55">Account email: {initialProfile.email}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
      <button className="rounded-full bg-snapchat-yellow px-5 py-3 font-black disabled:cursor-not-allowed disabled:opacity-50" disabled={!canSave}>
        {saving ? 'Saving...' : mode === 'setup' ? 'Finish setup' : 'Save changes'}
      </button>
    </form>
  );
}
