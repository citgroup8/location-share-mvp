import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F4EC] p-6">
      <div className="text-center">
        <div className="text-6xl font-black">404</div>
        <h1 className="mt-4 text-2xl font-black">Page not found</h1>
        <p className="mt-2 text-black/60">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/map" className="mt-6 inline-block rounded-full bg-snapchat-yellow px-6 py-3 font-black">
          Back to map
        </Link>
      </div>
    </div>
  );
}
