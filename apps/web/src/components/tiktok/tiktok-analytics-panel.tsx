'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchApi } from '@/lib/api';
import {
  addUtcCalendarMonths,
  ANALYTICS_PERIOD_LABELS,
  formatUtcDate,
  isAnalyticsPeriodPreset,
  utcDateOnly,
} from '@/lib/analytics-period';
import { formatAnalyzedDate, formatLastSynced, formatMetric } from '@/lib/youtube';
import type {
  AnalyticsPeriodPreset,
  MetricValueKind,
  TikTokAnalyticsResponse,
  TikTokSyncStatusResponse,
} from '@sma/types';

function metricLabel(label: string, kind?: MetricValueKind): string {
  return kind === 'net' ? `${label} (net change)` : label;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-cloud-200 bg-white p-5 shadow-panel">
      <p className="text-sm text-ink-700/60">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-ink-950">{value}</p>
    </article>
  );
}

function analyticsPath(preset: AnalyticsPeriodPreset, startDate?: string, endDate?: string): string {
  const params = new URLSearchParams();
  params.set('preset', preset);
  if (preset === 'custom') {
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
  }
  return `/api/tiktok/analytics?${params.toString()}`;
}

export function TikTokAnalyticsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPreset = searchParams.get('preset');
  const urlStart = searchParams.get('startDate') ?? '';
  const urlEnd = searchParams.get('endDate') ?? '';
  const preset: AnalyticsPeriodPreset = isAnalyticsPeriodPreset(urlPreset) ? urlPreset : '1m';

  const [analytics, setAnalytics] = useState<TikTokAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [customStart, setCustomStart] = useState(urlStart);
  const [customEnd, setCustomEnd] = useState(urlEnd);

  const dateBounds = useMemo(() => {
    const today = utcDateOnly(new Date());
    return {
      min: formatUtcDate(addUtcCalendarMonths(today, -36)),
      max: formatUtcDate(today),
    };
  }, []);

  const persistPeriod = useCallback(
    (nextPreset: AnalyticsPeriodPreset, startDate?: string, endDate?: string) => {
      const params = new URLSearchParams();
      params.set('preset', nextPreset);
      if (nextPreset === 'custom') {
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
      }
      router.replace(`/tiktok?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const loadAnalytics = useCallback(async () => {
    if (preset === 'custom' && (!urlStart || !urlEnd)) {
      return;
    }
    setPeriodLoading(true);
    const path =
      preset === 'custom' ? analyticsPath('custom', urlStart, urlEnd) : analyticsPath(preset);
    const result = await fetchApi<TikTokAnalyticsResponse>(path);
    if (!result.ok) {
      setError(result.error);
      setPeriodLoading(false);
      return;
    }
    setError(null);
    setAnalytics(result.data);
    setPeriodLoading(false);
  }, [preset, urlEnd, urlStart]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  async function syncNow() {
    setSyncing(true);
    setSyncMessage(null);
    const result = await fetchApi<TikTokSyncStatusResponse>('/api/tiktok/sync', {
      method: 'POST',
    });
    if (!result.ok) {
      setError(result.error);
      setSyncing(false);
      return;
    }

    setSyncMessage(result.data.message);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
      const status = await fetchApi<TikTokSyncStatusResponse>('/api/tiktok/sync/status');
      if (status.ok && (status.data.status === 'completed' || status.data.status === 'failed')) {
        setSyncMessage(status.data.message);
        setError(status.data.status === 'failed' ? status.data.message : null);
        break;
      }
      if (status.ok && status.data.status === 'idle' && attempt > 2) {
        break;
      }
    }

    await loadAnalytics();
    setSyncing(false);
  }

  const metrics = analytics?.metrics;
  const ready = analytics?.status === 'ready' || analytics?.status === 'syncing';
  const analyzedStart = analytics?.range.startDate;
  const analyzedEnd = analytics?.range.endDate;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">TikTok analytics</h2>
            <p className="mt-1 text-sm text-ink-700/70">
              Last synchronized: {formatLastSynced(analytics?.lastSyncedAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1">
              <span className="block text-sm font-medium text-ink-800">Analysis period</span>
              <select
                value={preset}
                disabled={syncing || periodLoading}
                onChange={(event) => {
                  const next = event.target.value as AnalyticsPeriodPreset;
                  if (next === 'custom') {
                    persistPeriod('custom', customStart, customEnd);
                    return;
                  }
                  persistPeriod(next);
                }}
                className="rounded-xl border border-cloud-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm"
              >
                {(['1m', '3m', '1y', 'custom'] as const).map((value) => (
                  <option key={value} value={value}>
                    {ANALYTICS_PERIOD_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            {preset === 'custom' ? (
              <>
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-ink-800">Start date</span>
                  <input
                    type="date"
                    value={customStart}
                    min={dateBounds.min}
                    max={dateBounds.max}
                    onChange={(event) => setCustomStart(event.target.value)}
                    className="rounded-xl border border-cloud-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm"
                  />
                </label>
                <span className="mb-2 text-ink-700/50">→</span>
                <label className="space-y-1">
                  <span className="block text-sm font-medium text-ink-800">End date</span>
                  <input
                    type="date"
                    value={customEnd}
                    min={dateBounds.min}
                    max={dateBounds.max}
                    onChange={(event) => setCustomEnd(event.target.value)}
                    className="rounded-xl border border-cloud-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={syncing || periodLoading || !customStart || !customEnd}
                  onClick={() => persistPeriod('custom', customStart, customEnd)}
                  className="rounded-xl border border-cloud-200 bg-white px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-cloud-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Apply
                </button>
              </>
            ) : null}
          </div>

          {analyzedStart && analyzedEnd ? (
            <p className="text-sm text-ink-700/70">
              Period videos: {formatAnalyzedDate(analyzedStart)} → {formatAnalyzedDate(analyzedEnd)}
              {periodLoading ? ' · Updating…' : ''}
            </p>
          ) : null}
          <p className="text-xs text-ink-700/55">
            Period views, likes, comments, and shares are summed from synced videos published in the
            selected range. Account totals that TikTok does not provide remain N/A.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing}
          className="inline-flex items-center justify-center rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {syncMessage ? (
        <p className="rounded-xl bg-signal-500/10 px-4 py-3 text-sm text-signal-600">{syncMessage}</p>
      ) : null}
      {error ? <p className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-800">{error}</p> : null}

      {!ready ? (
        <p className="rounded-2xl border border-cloud-200 bg-white p-5 text-sm text-ink-700/80 shadow-panel">
          {analytics?.message ??
            'Connect TikTok and run Sync now to load analytics. Unavailable metrics show N/A.'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard label="Followers" value={formatMetric(metrics?.subscribers)} />
          <MetricCard label="Videos" value={formatMetric(metrics?.videos)} />
          <MetricCard label="Views (period)" value={formatMetric(metrics?.views)} />
          <MetricCard
            label={metricLabel('Likes (period)', metrics?.likesKind)}
            value={formatMetric(metrics?.likes)}
          />
          <MetricCard label="Comments (period)" value={formatMetric(metrics?.comments)} />
          <MetricCard label="Shares (period)" value={formatMetric(metrics?.shares)} />
          <MetricCard
            label={metricLabel('Engagement (period)', metrics?.engagementKind)}
            value={formatMetric(metrics?.engagement)}
          />
        </div>
      )}
    </section>
  );
}
