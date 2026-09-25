'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/navigation';

const LEGAL_TITLES: Record<string, string> = {
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Service',
};

export function Topbar() {
  const pathname = usePathname();
  const current = NAV_ITEMS.find((item) => item.href === pathname);
  const title = current?.label ?? LEGAL_TITLES[pathname] ?? 'Social Media Analytics';

  return (
    <header className="border-b border-cloud-200 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-700/50">Workspace</p>
          <h1 className="font-display text-xl text-ink-900">{title}</h1>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-cloud-200 px-3 py-1 text-xs text-ink-800"
            >
              {item.shortLabel}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
