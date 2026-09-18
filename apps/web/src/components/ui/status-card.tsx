const TONE_CLASS = {
  ok: 'bg-signal-500/10 text-signal-600',
  warn: 'bg-amber-100 text-amber-800',
  pending: 'bg-sky-100 text-sky-800',
  neutral: 'bg-cloud-100 text-ink-800',
} as const;

export function StatusCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: keyof typeof TONE_CLASS;
}) {
  return (
    <article className="rounded-2xl border border-cloud-200 bg-white p-5 shadow-panel">
      <p className="text-sm text-ink-700/60">{label}</p>
      <p
        className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${TONE_CLASS[tone]}`}
      >
        {value}
      </p>
      <p className="mt-4 text-sm leading-6 text-ink-700/75">{detail}</p>
    </article>
  );
}
