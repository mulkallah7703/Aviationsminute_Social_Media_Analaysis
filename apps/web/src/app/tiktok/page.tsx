import { Suspense } from 'react';
import { isOAuthErrorCode, OAUTH_ERROR_MESSAGES } from '@sma/types';
import { PageHeader } from '@/components/ui/page-header';
import { TikTokAnalyticsPanel } from '@/components/tiktok/tiktok-analytics-panel';
import { TikTokConnectionPanel } from '@/components/tiktok/tiktok-connection-panel';
import { fetchApi } from '@/lib/api';
import type { TikTokConnectionResponse } from '@sma/types';

export const dynamic = 'force-dynamic';

export default async function TikTokPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; code?: string }>;
}) {
  const params = await searchParams;
  const tiktok = await fetchApi<TikTokConnectionResponse>('/api/tiktok/connection');
  const errorMessage =
    params.status === 'error' && params.code && isOAuthErrorCode(params.code)
      ? OAUTH_ERROR_MESSAGES[params.code]
      : params.status === 'error'
        ? OAUTH_ERROR_MESSAGES.oauth_error
        : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="TikTok Analytics"
        description="Connected TikTok account details and synced video analytics. Unavailable metrics show N/A."
      />

      <TikTokConnectionPanel
        account={tiktok.ok ? tiktok.data.account : null}
        status={tiktok.ok ? tiktok.data.status : 'disconnected'}
        banner={
          params.status === 'connected'
            ? {
                tone: 'ok',
                title: 'TikTok connected successfully.',
                titleAr: 'تم ربط تيك توك بنجاح.',
              }
            : errorMessage
              ? {
                  tone: 'error',
                  title: errorMessage.en,
                  titleAr: errorMessage.ar,
                }
              : undefined
        }
      />
      {tiktok.ok && tiktok.data.connected ? (
        <Suspense fallback={<p className="text-sm text-ink-700/70">Loading analytics…</p>}>
          <TikTokAnalyticsPanel />
        </Suspense>
      ) : null}
    </div>
  );
}
