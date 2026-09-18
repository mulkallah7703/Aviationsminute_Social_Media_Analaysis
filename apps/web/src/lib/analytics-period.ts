import type { AnalyticsPeriodPreset } from '@sma/types';

export const ANALYTICS_PERIOD_LABELS: Record<AnalyticsPeriodPreset, string> = {
  '1m': '1 Month',
  '3m': '3 Months',
  '1y': '1 Year',
  custom: 'Custom range',
};

const PRESETS: readonly AnalyticsPeriodPreset[] = ['1m', '3m', '1y', 'custom'];

export function isAnalyticsPeriodPreset(value: string | null | undefined): value is AnalyticsPeriodPreset {
  return PRESETS.includes(value as AnalyticsPeriodPreset);
}

export function utcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatUtcDate(date: Date): string {
  return utcDateOnly(date).toISOString().slice(0, 10);
}

export function addUtcCalendarMonths(date: Date, months: number): Date {
  const source = utcDateOnly(date);
  const day = source.getUTCDate();
  const cursor = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), 1));
  cursor.setUTCMonth(cursor.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  cursor.setUTCDate(Math.min(day, lastDay));
  return cursor;
}
