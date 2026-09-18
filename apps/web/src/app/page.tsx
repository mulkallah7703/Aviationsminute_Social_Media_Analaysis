import { PageHeader } from '@/components/ui/page-header';
import { StatusCard } from '@/components/ui/status-card';
import { YoutubeAnalyticsPanel } from '@/components/youtube/youtube-analytics-panel';
import { YoutubeConnectionPanel } from '@/components/youtube/youtube-connection-panel';
import { fetchApi } from '@/lib/api';
import type {
  AnalyticsOverviewResponse,
  HealthLiveResponse,
  YoutubeConnectionResponse,
} from '@sma/types';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const [health, analytics, youtube] = await Promise.all([
    fetchApi<HealthLiveResponse>('/api/health'),
    fetchApi<AnalyticsOverviewResponse>('/api/analytics/overview'),
    fetchApi<YoutubeConnectionResponse>('/api/youtube/connection'),
  ]);

  const youtubeConnected = youtube.ok && youtube.data.status === 'connected';
  const youtubeReauth = youtube.ok && youtube.data.status === 'reauth_required';
  const liveAnalytics = analytics.ok && analytics.data.status === 'ready';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Operational status for the analytics workspace. Metrics appear only after a live platform sync."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatusCard
          label="API"
          value={health.ok ? 'Reachable' : 'Unavailable'}
          detail={
            health.ok
              ? `Database: ${health.data.database}.`
              : (health.error ?? 'The API is not reachable from the frontend.')
          }
          tone={health.ok && health.data.database === 'connected' ? 'ok' : 'warn'}
        />
        <StatusCard
          label="Analytics"
          value={liveAnalytics ? 'Live' : 'No live metrics'}
          detail={
            analytics.ok
              ? analytics.data.message
              : 'Analytics will stay empty until a provider sync completes.'
          }
          tone={liveAnalytics ? 'ok' : 'neutral'}
        />
        <StatusCard
          label="YouTube"
          value={youtubeConnected ? 'Connected' : youtubeReauth ? 'Reauthorization required' : 'Not connected'}
          detail={
            youtubeConnected
              ? (youtube.data.account?.displayName ?? 'A YouTube channel is connected.')
              : youtubeReauth
                ? 'Reconnect YouTube. Historical data is kept.'
                : 'Use Connect YouTube to authorize a channel. No placeholder numbers are shown.'
          }
          tone={youtubeConnected ? 'ok' : youtubeReauth ? 'warn' : 'pending'}
        />
      </div>

      <YoutubeConnectionPanel
        account={youtube.ok ? youtube.data.account : null}
        status={youtube.ok ? youtube.data.status : 'disconnected'}
      />
      {youtubeConnected ? <YoutubeAnalyticsPanel /> : null}
    </div>
  );
}
