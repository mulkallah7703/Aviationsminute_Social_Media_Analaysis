import { Suspense } from 'react';
import { isOAuthErrorCode, OAUTH_ERROR_MESSAGES } from '@sma/types';
import { PageHeader } from '@/components/ui/page-header';
import { YoutubeAnalyticsPanel } from '@/components/youtube/youtube-analytics-panel';
import { YoutubeConnectionPanel } from '@/components/youtube/youtube-connection-panel';
import { fetchApi } from '@/lib/api';
import type { YoutubeConnectionResponse } from '@sma/types';

export const dynamic = 'force-dynamic';

export default async function YoutubePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; code?: string }>;
}) {
  const params = await searchParams;
  const youtube = await fetchApi<YoutubeConnectionResponse>('/api/youtube/connection');
  const errorMessage =
    params.status === 'error' && params.code && isOAuthErrorCode(params.code)
      ? OAUTH_ERROR_MESSAGES[params.code]
      : params.status === 'error'
        ? OAUTH_ERROR_MESSAGES.oauth_error
        : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="YouTube Analytics"
        description="Connected channel details and live YouTube Analytics after a successful sync. Unavailable metrics show N/A."
      />

      <YoutubeConnectionPanel
        account={youtube.ok ? youtube.data.account : null}
        status={youtube.ok ? youtube.data.status : 'disconnected'}
        banner={
          params.status === 'connected'
            ? {
                tone: 'ok',
                title: 'YouTube connected successfully.',
                titleAr: 'تم ربط يوتيوب بنجاح.',
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
      {youtube.ok && youtube.data.connected ? (
        <Suspense fallback={<p className="text-sm text-ink-700/70">Loading analytics…</p>}>
          <YoutubeAnalyticsPanel />
        </Suspense>
      ) : null}
    </div>
  );
}
