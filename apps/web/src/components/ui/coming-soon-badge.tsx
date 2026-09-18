export function ComingSoonBadge({ label, labelAr }: { label: string; labelAr: string }) {
  return (
    <span className="inline-flex flex-col rounded-full bg-cloud-100 px-3 py-1 text-right text-[11px] font-medium text-ink-800">
      <span>{label}</span>
      <span className="text-ink-700/60">{labelAr}</span>
    </span>
  );
}
