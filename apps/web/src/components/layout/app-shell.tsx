import type { ReactNode } from 'react';
import Link from 'next/link';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cloud-50">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          <footer className="border-t border-cloud-200 bg-white/80 px-4 py-3 text-xs text-ink-700/60 sm:px-6 lg:px-8">
            <div className="flex flex-wrap gap-3">
              <Link href="/privacy" className="hover:text-ink-950 hover:underline">
                Privacy Policy
              </Link>
              <span aria-hidden>·</span>
              <Link href="/terms" className="hover:text-ink-950 hover:underline">
                Terms of Service
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
