import Link from 'next/link';

const featureCards = [
  {
    title: 'Hidden Gems',
    text: 'Create, find, and saves the places worth sharing.',
    tone: 'bg-snapchat-yellow'
  },
  {
    title: 'Private Spots',
    text: 'Keep favorite places shared with a chosen group of friends.',
    tone: 'bg-white'
  },
  {
    title: 'Live locations',
    text: 'See where friends are in real time with privacy-first controls.',
    tone: 'bg-[#FDE68A]'
  },
  {
    title: 'Direct chat',
    text: 'Talk instantly, keep context, and know when messages are seen.',
    tone: 'bg-[#E5E7EB]'
  }
];

const stats = [
  { label: 'Instant', value: 'friend updates' },
  { label: 'Private', value: 'by default' },
  { label: 'Social', value: 'map sharing' }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F7F4EC] text-[#111111]">
      <section className="mx-auto max-w-7xl px-6 py-8 md:px-10">
        <header className="flex items-center justify-between rounded-full border border-black/10 bg-white/80 px-5 py-3 shadow-snap backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-snapchat-yellow text-lg font-black">H</div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">social map</div>
              <div className="text-lg font-black">Hidden Gem</div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-semibold md:flex">
            <a href="#features" className="text-black/80">Features</a>
            <a href="#roadmap" className="text-black/80">Roadmap</a>
            <a href="#design" className="text-black/80">Brand</a>
          </nav>

          <Link href="/signup" className="rounded-full bg-snapchat-yellow px-4 py-2 text-sm font-black shadow-sm">Get started</Link>
        </header>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-12 pt-8 md:grid-cols-[1.15fr_0.85fr] md:px-10 md:pb-20">
        <div className="flex flex-col justify-center">
          <span className="mb-4 inline-flex w-fit rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-black/70">
            share where you are
          </span>
          <h1 className="max-w-xl text-5xl font-black leading-[0.95] tracking-[-0.06em] md:text-7xl">
            Find the <span className="inline-block rounded-full bg-snapchat-yellow px-3">hidden gems</span> around you.
          </h1>
          <p className="mt-6 max-w-lg text-lg text-black/70">
            Hidden Gem helps friends stay connected through live location, direct chat, and places worth sharing. Discover what matters nearby.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/signup" className="rounded-full bg-snapchat-yellow px-6 py-3 text-sm font-black shadow-sm">Launch MVP</Link>
            <a href="#roadmap" className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-bold">View roadmap</a>
          </div>

          <div className="mt-8 flex flex-wrap gap-5">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-snap">
                <div className="text-xl font-black">{stat.label}</div>
                <div className="text-xs uppercase tracking-[0.14em] text-black/60">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-5 top-8 h-24 w-24 rounded-full bg-[#FDE68A] blur-2xl" />
          <div className="absolute -right-8 bottom-8 h-28 w-28 rounded-full bg-[#FF8A8A] blur-2xl" />

          <div className="relative rounded-[32px] border border-black/10 bg-white p-4 shadow-snap">
            <div className="rounded-[28px] bg-[#F0F1F3] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-orange-400" />
                  <div>
                    <div className="text-sm font-black">Maya</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-black/50">online now</div>
                  </div>
                </div>
                <div className="rounded-full bg-snapchat-yellow px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]">Live</div>
              </div>

              <div className="relative h-[420px] overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_30%_30%,#cfe7ff,#9dd5ff_35%,#6db0e8_55%,#5ca8a0_100%)]">
                <div className="absolute left-4 top-5 h-16 w-16 rounded-full border-8 border-white/80 bg-[#4ADE80]" />
                <div className="absolute left-16 top-20 h-14 w-14 rounded-full border-8 border-white/80 bg-[#F59E0B]" />
                <div className="absolute right-8 top-14 h-14 w-14 rounded-full border-8 border-white/80 bg-[#60A5FA]" />
                <div className="absolute bottom-16 left-12 h-16 w-16 rounded-full border-8 border-white/80 bg-[#F472B6]" />
                <div className="absolute bottom-7 right-9 h-24 w-24 rounded-full border-8 border-white/80 bg-[#FDE68A]" />
                <div className="absolute inset-x-6 bottom-6 rounded-[24px] bg-white/70 p-3 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-black/60">Nearby</div>
                      <div className="text-lg font-black">4 friends around you</div>
                    </div>
                    <div className="rounded-full bg-snapchat-yellow px-3 py-1 text-xs font-black">Map</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 pb-14 md:px-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-black/60">What Hidden Gem does</div>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">A social map for real life.</h2>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((card) => (
            <article key={card.title} className={`${card.tone} rounded-[28px] border border-black/10 p-5 shadow-snap`}>
              <div className="mb-5 h-12 w-12 rounded-full bg-black text-center text-lg font-black leading-[3rem] text-white">+</div>
              <h3 className="text-xl font-black">{card.title}</h3>
              <p className="mt-3 text-sm text-black/70">{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="roadmap" className="mx-auto max-w-7xl px-6 pb-20 md:px-10">
        <div className="rounded-[32px] border border-black/10 bg-white p-7 shadow-snap md:p-9">
          <div className="mb-6 text-xs font-bold uppercase tracking-[0.18em] text-black/60">Roadmap</div>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-black/60">Phase 1</div>
              <h3 className="text-2xl font-black">Trust + network</h3>
              <ul className="mt-4 space-y-2 text-sm text-black/70">
                <li>• Sign up / login</li>
                <li>• Username and profile</li>
                <li>• Friend requests</li>
              </ul>
            </div>
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-black/60">Phase 2</div>
              <h3 className="text-2xl font-black">Live map</h3>
              <ul className="mt-4 space-y-2 text-sm text-black/70">
                <li>• Presence and location</li>
                <li>• Public Gems</li>
                <li>• Private Spots</li>
              </ul>
            </div>
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-black/60">Phase 3</div>
              <h3 className="text-2xl font-black">Talk + sync</h3>
              <ul className="mt-4 space-y-2 text-sm text-black/70">
                <li>• Direct chat</li>
                <li>• Offline queueing</li>
                <li>• Notification polish</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
