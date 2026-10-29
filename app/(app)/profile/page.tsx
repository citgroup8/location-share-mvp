'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import LogOutButton from '@/components/logout-button';
import { ProfileEditor } from '@/components/profile-editor';
import { readApiResponse } from '@/lib/api-response';

type Profile = {
  username: string;
  email: string;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  defaultLocationPrivacy: 'off' | 'friends_only' | 'public';
  liveLocationMode: string;
  isOnline: boolean;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/users/me'), fetch('/api/friends/list')])
      .then(async ([profileResponse, friendsResponse]) => {
        const profileData = await readApiResponse(profileResponse);
        const friendsData = await readApiResponse(friendsResponse);
        if (!profileResponse.ok) throw new Error(profileData.error ?? 'Could not load profile');
        if (!friendsResponse.ok) throw new Error(friendsData.error ?? 'Could not load friends');
        const user = profileData.user as Profile;
        setProfile(user);
        setFriendCount(friendsData.friends.length);
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <main className="rounded-[28px] bg-white p-6">Loading your profile...</main>;
  if (!profile) return <main role="alert" className="rounded-[28px] bg-white p-6 text-red-700">{error || 'Profile unavailable.'}</main>;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-2 md:px-0">
      <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-snap">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-orange-400 text-3xl font-black">
              {profile.profileImageUrl ? (
                <Image src={profile.profileImageUrl} alt="" width={80} height={80} unoptimized className="h-full w-full rounded-full object-cover" />
              ) : (
                (profile.displayName || profile.username).slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-3xl font-black">{profile.displayName || profile.username}</h1>
              <p className="text-sm text-black/60">@{profile.username} · {profile.email}</p>
            </div>
          </div>
          <LogOutButton />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] bg-[#F3F3F3] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-black/60">Friends</div>
            <div className="mt-2 text-2xl font-black">{friendCount}</div>
          </div>
          <div className="rounded-[22px] bg-[#F3F3F3] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-black/60">Presence</div>
            <div className="mt-2 text-2xl font-black">{profile.isOnline ? 'Online' : 'Offline'}</div>
          </div>
          <div className="rounded-[22px] bg-[#F3F3F3] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-black/60">Live location</div>
            <div className="mt-2 text-2xl font-black">{profile.liveLocationMode.replace('_', ' ')}</div>
          </div>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <ProfileEditor initialProfile={profile} mode="edit" />
    </main>
  );
}
