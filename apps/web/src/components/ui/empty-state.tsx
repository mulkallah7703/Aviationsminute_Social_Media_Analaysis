export function EmptyState({
  title,
  titleAr,
  description,
  descriptionAr,
}: {
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-cloud-200 bg-white px-6 py-12 text-center shadow-panel">
      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      {titleAr ? <p className="mt-1 text-sm text-ink-700/70">{titleAr}</p> : null}
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink-700/75">{description}</p>
      {descriptionAr ? (
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-700/60">{descriptionAr}</p>
      ) : null}
    </section>
  );
}
