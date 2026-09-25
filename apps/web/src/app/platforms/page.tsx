import { PLATFORM_CATALOG } from '@sma/types';
import { PageHeader } from '@/components/ui/page-header';
import { ComingSoonBadge } from '@/components/ui/coming-soon-badge';
import { TikTokConnectionPanel } from '@/components/tiktok/tiktok-connection-panel';
import { YoutubeConnectionPanel } from '@/components/youtube/youtube-connection-panel';
import { fetchApi } from '@/lib/api';
import type { TikTokConnectionResponse, YoutubeConnectionResponse } from '@sma/types';

export const dynamic = 'force-dynamic';

export default async function PlatformsPage() {
  const [youtube, tiktok] = await Promise.all([
    fetchApi<YoutubeConnectionResponse>('/api/youtube/connection'),
    fetchApi<TikTokConnectionResponse>('/api/tiktok/connection'),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Connected Platforms"
        description="YouTube and TikTok can be connected now. Other platform connectors remain reserved and show no placeholder metrics."
      />

      <YoutubeConnectionPanel
        account={youtube.ok ? youtube.data.account : null}
        status={youtube.ok ? youtube.data.status : 'disconnected'}
      />

      <TikTokConnectionPanel
        account={tiktok.ok ? tiktok.data.account : null}
        status={tiktok.ok ? tiktok.data.status : 'disconnected'}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PLATFORM_CATALOG.filter(
          (platform) => platform.code !== 'youtube' && platform.code !== 'tiktok',
        ).map((platform) => (
          <article
            key={platform.code}
            className="rounded-2xl border border-cloud-200 bg-white p-5 shadow-panel"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">{platform.name}</h2>
                <p className="mt-1 text-sm text-ink-700/70">{platform.nameAr}</p>
              </div>
              <ComingSoonBadge label="Coming Soon" labelAr="ستتاح قريبًا" />
            </div>
            <p className="mt-4 text-sm leading-6 text-ink-700/80">
              Connector interface is reserved. No fake data is shown.
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
