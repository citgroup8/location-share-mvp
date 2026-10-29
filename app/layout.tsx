import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hidden Gem',
  description: 'Social map app for friends, live location, Gems, and Spots.',
  icons: { icon: '/hidden-gem-mark.svg' }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <ClerkProvider localization={{ signIn: { start: { title: 'Sign in to Hidden Gem', subtitle: 'Your people, a little closer.' } } }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}