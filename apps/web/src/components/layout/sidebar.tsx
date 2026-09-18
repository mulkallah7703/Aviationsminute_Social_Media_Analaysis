'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/navigation';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-72 shrink-0 bg-ink-950 text-white md:flex md:flex-col">
      <div className="border-b border-white/10 px-6 py-6">
        <p className="font-display text-xl tracking-tight">Social Media Analytics</p>
        <p className="mt-2 text-sm text-white/60">Aviations Minute</p>
      </div>
      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="block font-medium">{item.label}</span>
              <span className="mt-0.5 block text-xs text-white/45">{item.labelAr}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-6 py-4 text-xs text-white/45">
        Step 1 foundation · no live provider calls
      </div>
    </aside>
  );
}
