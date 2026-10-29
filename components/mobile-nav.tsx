'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Map, MapPin, MessageCircle, Send, Sparkles, UserRound, Users } from 'lucide-react';
import LogOutButton from '@/components/logout-button';
import { RealtimeStatusPill } from '@/components/realtime-status';
import { readApiResponse } from '@/lib/api-response';
import { subscribeRealtime } from '@/lib/realtime-client';

const navItems = [
  { href: '/map', label: 'Map', icon: Map },
  { href: '/friends', label: 'Friends', icon: Users },
  { href: '/gems', label: 'Gems', icon: Sparkles },
  { href: '/spots', label: 'Spots', icon: MapPin },
  { href: '/requests', label: 'Requests', icon: Send },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/profile', label: 'Profile', icon: UserRound }
];

const headerHrefs = ['/map', '/friends', '/gems', '/spots', '/requests', '/chat'];
const mobileHrefs = ['/map', '/friends', '/gems', '/chat', '/profile'];

function isActive(pathname: string, href: string) {
  if (href === '/friends') return ['/friends', '/add-friend', '/requests'].includes(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RequestBadge({ count, className }: { count: number; className: string }) {
  if (count <= 0) return null;
  return <span aria-label={`${count} pending requests`} className={className}>{count}</span>;
}

export function MobileNav() {
  const pathname = usePathname();
  const headerItems = navItems.filter((item) => headerHrefs.includes(item.href));
  const mobileItems = navItems.filter((item) => mobileHrefs.includes(item.href));
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    let active = true;
    const loadCount = () => {
      fetch('/api/notifications')
        .then(async (response) => {
          if (!response.ok) return;
          const data = await readApiResponse(response);
          if (active) setPendingRequests(data.count);
        })
        .catch(() => undefined);
    };
    loadCount();
    const interval = window.setInterval(loadCount, 60000);
    const unsubscribe = subscribeRealtime((update) => {
      if (update.friendRequestsChanged) loadCount();
    });
    return () => {
      active = false;
      window.clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const badgeFor = (href: string) => ['/friends', '/requests'].includes(href) ? pendingRequests : 0;

  return (
    <>
      <header className="app-header">
        <Link href="/map" className="app-brand" aria-label="Hidden Gem home">
          <span className="app-brand-mark" aria-hidden="true">✦</span>
          <span className="app-brand-name">Hidden Gem</span>
        </Link>
        <nav className="app-header-nav" aria-label="Main navigation">
          {headerItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className={`app-nav-link${isActive(pathname, item.href) ? ' active' : ''}`}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              <span className="app-nav-label">{item.label}</span>
              <RequestBadge count={badgeFor(item.href)} className="app-badge" />
            </Link>
          ))}
        </nav>
        <div className="app-header-actions">
          <RealtimeStatusPill />
          <Link href="/profile" className="app-avatar" aria-label="Open your profile">
            <UserRound className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="app-logout"><LogOutButton /></div>
        </div>
      </header>

      <nav className="app-mobile-nav" aria-label="Mobile navigation">
        {mobileItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            className={`app-mobile-link${isActive(pathname, item.href) ? ' active' : ''}`}
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {item.label}
            {item.href === '/friends' && <RequestBadge count={pendingRequests} className="app-badge" />}
          </Link>
        ))}
      </nav>
    </>
  );
}
