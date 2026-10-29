'use client';

import { usePathname } from 'next/navigation';

const pageHeadings: Record<string, { title: string; subtitle: string }> = {
  '/friends': { title: 'Friends', subtitle: 'Find your people and grow your circle.' },
  '/add-friend': { title: 'Find friends', subtitle: 'A little closer starts with a hello.' },
  '/requests': { title: 'Friend requests', subtitle: 'Your next connection could be one tap away.' },
  '/gems': { title: 'Public Gems', subtitle: 'Discover places worth sharing.' },
  '/spots': { title: 'Private Spots', subtitle: 'Keep meaningful places in your circle.' },
  '/chat': { title: 'Messages', subtitle: 'A note from your people.' },
  '/profile': { title: 'Your profile', subtitle: 'Your location, your choice.' },
  '/dashboard': { title: 'Your Hidden Gem', subtitle: 'Your people, a little closer.' }
};

/** Slim page title. The map is the page, so it gets no title bar. */
export function AppTopbar() {
  const pathname = usePathname();
  const heading = pageHeadings[pathname];
  if (!heading) return null;

  return (
    <div className="app-topbar">
      <h1>{heading.title}</h1>
      <p className="app-topbar-subtitle">{heading.subtitle}</p>
    </div>
  );
}
