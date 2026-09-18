import type { SocialConnectionStatus, YoutubeConnectionAccount } from '@sma/types';
import { formatCount, youtubeConnectUrl } from '@/lib/youtube';

export function ConnectYouTubeButton({ label = 'Connect YouTube' }: { label?: string }) {
  return (
    <a
      href={youtubeConnectUrl()}
      className="inline-flex items-center justify-center rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800"
    >
      {label}
    </a>
  );
}

const STATUS_LABEL: Record<SocialConnectionStatus, string> = {
  connected: 'Connected',
  reauth_required: 'Reauthorization required',
  disconnected: 'Not connected',
};

export function YoutubeConnectionPanel({
  account,
  status = account ? 'connected' : 'disconnected',
  banner,
}: {
  account: YoutubeConnectionAccount | null;
  status?: SocialConnectionStatus;
  banner?: { tone: 'ok' | 'error'; title: string; titleAr: string; detail?: string };
}) {
  const connected = status === 'connected';
  const reauthRequired = status === 'reauth_required';

  return (
    <article className="rounded-2xl border border-cloud-200 bg-white p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">YouTube</h2>
          <p className="mt-1 text-sm text-ink-700/70">يوتيوب</p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
            connected
              ? 'bg-signal-500/10 text-signal-600'
              : reauthRequired
                ? 'bg-amber-100 text-amber-800'
                : 'bg-cloud-100 text-ink-800'
          }`}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>

      {banner ? (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            banner.tone === 'ok' ? 'bg-signal-500/10 text-signal-600' : 'bg-amber-100 text-amber-800'
          }`}
        >
          <p className="font-medium">{banner.title}</p>
          <p className="mt-1">{banner.titleAr}</p>
          {banner.detail ? <p className="mt-2 text-ink-700/80">{banner.detail}</p> : null}
        </div>
      ) : null}

      {reauthRequired && !banner ? (
        <div className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-800">
          YouTube access was revoked or the refresh token is no longer valid. Reconnect to continue
          syncing. Historical data is kept.
        </div>
      ) : null}

      {account ? (
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
          {account.profileImageUrl ? (
            <img
              src={account.profileImageUrl}
              alt={account.displayName ?? 'YouTube channel'}
              className="h-20 w-20 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-cloud-100 text-sm font-medium text-ink-700/70">
              YT
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-semibold text-ink-950">
              {account.displayName ?? 'YouTube channel'}
            </p>
            {account.username ? (
              <p className="mt-1 text-sm text-ink-700/70">@{account.username}</p>
            ) : null}
            {account.profileUrl ? (
              <a
                href={account.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm font-medium text-signal-600"
              >
                Open channel
              </a>
            ) : null}

            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-700/60">Subscribers</dt>
                <dd className="mt-1 text-lg font-semibold text-ink-950">
                  {formatCount(account.subscribersCount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-700/60">Views</dt>
                <dd className="mt-1 text-lg font-semibold text-ink-950">
                  {formatCount(account.totalViews)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-700/60">Videos</dt>
                <dd className="mt-1 text-lg font-semibold text-ink-950">
                  {formatCount(account.totalPosts)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm leading-6 text-ink-700/80">
          Connect a YouTube channel to store the OAuth tokens securely and display live channel
          information. No placeholder metrics are shown.
        </p>
      )}

      <div className="mt-6">
        <ConnectYouTubeButton
          label={connected ? 'Reconnect YouTube' : reauthRequired ? 'Reconnect YouTube' : 'Connect YouTube'}
        />
      </div>
    </article>
  );
}
