import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth';
import { MobileNav } from '@/components/mobile-nav';
import { LiveLocationTracker } from '@/components/live-location-tracker';
import { AppTopbar } from '@/components/app-topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const localUserId = await getSessionUserId();
  if (!localUserId) redirect('/sign-in');
  const profile = await prisma.user.findUnique({
    where: { id: localUserId },
    select: { profileComplete: true }
  });
  if (!profile) redirect('/sign-in');
  if (!profile.profileComplete) redirect('/onboarding');

  return (
    <div className="app-shell">
      <LiveLocationTracker />
      <MobileNav />
      <div className="app-main">
        <AppTopbar />
        <div className="app-page-content">{children}</div>
      </div>
    </div>
  );
}
