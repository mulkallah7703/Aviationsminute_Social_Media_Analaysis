import { PageHeader } from '@/components/ui/page-header';

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Workspace, locale, and integration settings will live here. Secrets stay in environment variables."
      />

      <section className="rounded-2xl border border-cloud-200 bg-white p-6 shadow-panel">
        <h2 className="text-base font-semibold text-ink-900">Environment</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-ink-700/70">API URL</dt>
            <dd className="mt-1 font-medium text-ink-900">
              {process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-700/70">Google credentials</dt>
            <dd className="mt-1 font-medium text-ink-900">Loaded from server environment only</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
