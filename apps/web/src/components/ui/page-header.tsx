export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-3xl">
      <h2 className="font-display text-3xl tracking-tight text-ink-950">{title}</h2>
      <p className="mt-2 text-base leading-7 text-ink-700/75">{description}</p>
    </div>
  );
}
