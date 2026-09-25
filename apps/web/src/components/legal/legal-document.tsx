import Link from 'next/link';
import type { ReactNode } from 'react';

/** Display date for Privacy Policy and Terms of Service. */
export const LEGAL_LAST_UPDATED = '25 September 2026';

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="font-display text-xl tracking-tight text-ink-950">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-7 text-ink-700/85">{children}</div>
    </section>
  );
}

export function LegalDoc({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <div className="rounded-2xl border border-cloud-200 bg-white p-6 shadow-panel sm:p-8">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-700/50">Legal</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-950">{title}</h1>
        <p className="mt-3 text-base leading-7 text-ink-700/75">{description}</p>
        <p className="mt-4 text-sm text-ink-700/60">Last updated: {LEGAL_LAST_UPDATED}</p>

        <nav className="mt-6 flex flex-wrap gap-3 border-t border-cloud-200 pt-5 text-sm">
          <Link href="/" className="font-medium text-signal-600 hover:underline">
            Back to application
          </Link>
          <span className="text-ink-700/30" aria-hidden>
            ·
          </span>
          <Link href="/privacy" className="font-medium text-ink-800 hover:underline">
            Privacy Policy
          </Link>
          <span className="text-ink-700/30" aria-hidden>
            ·
          </span>
          <Link href="/terms" className="font-medium text-ink-800 hover:underline">
            Terms of Service
          </Link>
        </nav>
      </div>

      <div className="space-y-8 rounded-2xl border border-cloud-200 bg-white p-6 shadow-panel sm:p-8">
        {children}
      </div>

      <footer className="flex flex-wrap gap-3 px-1 pb-4 text-sm text-ink-700/70">
        <Link href="/" className="hover:text-ink-950 hover:underline">
          Home
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="hover:text-ink-950 hover:underline">
          Privacy Policy
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terms" className="hover:text-ink-950 hover:underline">
          Terms of Service
        </Link>
      </footer>
    </article>
  );
}
