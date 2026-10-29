import { redirect } from 'next/navigation';
import { ProfileEditor } from '@/components/profile-editor';
import { getSessionUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function OnboardingPage() {
  const localUserId = await getSessionUserId();
  if (!localUserId) redirect('/sign-in');

  const profile = await prisma.user.findUnique({
    where: { id: localUserId },
    select: {
      username: true,
      email: true,
      displayName: true,
      bio: true,
      profileImageUrl: true,
      defaultLocationPrivacy: true,
      profileComplete: true
    }
  });
  if (!profile) redirect('/sign-in');
  if (profile.profileComplete) redirect('/dashboard');

  return (
    <main className="min-h-screen bg-[#F7F4EC] px-4 py-10 text-[#111111] md:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-7">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-black/55">Hidden Gem</div>
          <h1 className="mt-2 text-4xl font-black">Set up your profile</h1>
          <p className="mt-2 text-black/65">Choose a username and add a few details so friends can recognize you.</p>
        </header>
        <ProfileEditor initialProfile={profile} mode="setup" />
      </div>
    </main>
  );
}
