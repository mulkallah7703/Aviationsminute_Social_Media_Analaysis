export default function NotFound() {
  return (
    <div className="rounded-2xl border border-cloud-200 bg-white p-10 text-center shadow-panel">
      <h2 className="font-display text-2xl text-ink-950">Page not found</h2>
      <p className="mt-2 text-sm text-ink-700/70">The requested workspace route does not exist.</p>
    </div>
  );
}
