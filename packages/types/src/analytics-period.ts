import { addUtcCalendarMonths, formatUtcDate, parseUtcDateOnly, utcDateOnly, utcDayDifference } from './dates';

export const ANALYTICS_PERIOD_PRESETS = ['1m', '3m', '1y', 'custom'] as const;
export type AnalyticsPeriodPreset = (typeof ANALYTICS_PERIOD_PRESETS)[number];

export const DEFAULT_ANALYTICS_PERIOD_PRESET: AnalyticsPeriodPreset = '1m';
export const ANALYTICS_PERIOD_MAX_DAYS = 366 * 3;
export const YOUTUBE_ANALYTICS_END_OFFSET_DAYS = 1;

export const ANALYTICS_PERIOD_LABELS: Record<AnalyticsPeriodPreset, string> = {
  '1m': '1 Month',
  '3m': '3 Months',
  '1y': '1 Year',
  custom: 'Custom range',
};

export interface AnalyticsPeriodInput {
  preset?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface AnalyticsPeriodOptions {
  now?: Date;
  inclusiveEndOffsetDays?: number;
  maxDays?: number;
}

export interface ResolvedAnalyticsPeriod {
  preset: AnalyticsPeriodPreset;
  requestedStartDate: string;
  requestedEndDate: string;
  startDate: string;
  endDate: string;
  clamped: boolean;
}

export interface AnalyticsPeriodError {
  code: 'invalid_date' | 'invalid_preset' | 'end_before_start' | 'future_start' | 'range_too_long';
  message: string;
  messageAr: string;
}

export type AnalyticsPeriodResult =
  | { ok: true; period: ResolvedAnalyticsPeriod }
  | { ok: false; error: AnalyticsPeriodError };

const PRESET_MONTHS: Record<Exclude<AnalyticsPeriodPreset, 'custom'>, number> = {
  '1m': 1,
  '3m': 3,
  '1y': 12,
};

export function isAnalyticsPeriodPreset(value: string | null | undefined): value is AnalyticsPeriodPreset {
  return ANALYTICS_PERIOD_PRESETS.includes(value as AnalyticsPeriodPreset);
}

export function maxAvailableAnalyticsEndDate(
  now: Date = new Date(),
  inclusiveEndOffsetDays: number = YOUTUBE_ANALYTICS_END_OFFSET_DAYS,
): Date {
  const today = utcDateOnly(now);
  today.setUTCDate(today.getUTCDate() - Math.max(0, inclusiveEndOffsetDays));
  return today;
}

export function resolveAnalyticsPeriod(
  input: AnalyticsPeriodInput = {},
  options: AnalyticsPeriodOptions = {},
): AnalyticsPeriodResult {
  const now = options.now ?? new Date();
  const inclusiveEndOffsetDays = options.inclusiveEndOffsetDays ?? YOUTUBE_ANALYTICS_END_OFFSET_DAYS;
  const maxDays = options.maxDays ?? ANALYTICS_PERIOD_MAX_DAYS;
  const today = utcDateOnly(now);
  const maxEnd = maxAvailableAnalyticsEndDate(now, inclusiveEndOffsetDays);
  const rawPreset = input.preset?.trim() || undefined;
  const hasCustomDates = Boolean(input.startDate || input.endDate);

  if (rawPreset && !isAnalyticsPeriodPreset(rawPreset)) {
    return {
      ok: false,
      error: {
        code: 'invalid_preset',
        message: 'Analysis period must be 1 Month, 3 Months, 1 Year, or Custom range.',
        messageAr: 'يجب أن تكون فترة التحليل شهراً أو 3 أشهر أو سنة أو نطاقاً مخصصاً.',
      },
    };
  }

  const preset: AnalyticsPeriodPreset = isAnalyticsPeriodPreset(rawPreset)
    ? rawPreset
    : hasCustomDates
      ? 'custom'
      : DEFAULT_ANALYTICS_PERIOD_PRESET;

  let requestedStart: Date;
  let requestedEnd: Date;

  if (preset === 'custom') {
    if (!input.startDate || !input.endDate) {
      return invalidDate();
    }
    const start = parseUtcDateOnly(input.startDate);
    const end = parseUtcDateOnly(input.endDate);
    if (!start || !end) {
      return invalidDate();
    }
    requestedStart = start;
    requestedEnd = end;
  } else {
    requestedEnd = today;
    requestedStart = addUtcCalendarMonths(today, -PRESET_MONTHS[preset]);
  }

  if (requestedEnd.getTime() < requestedStart.getTime()) {
    return {
      ok: false,
      error: {
        code: 'end_before_start',
        message: 'The analysis end date must be on or after the start date.',
        messageAr: 'يجب أن يكون تاريخ النهاية في يوم البداية أو بعده.',
      },
    };
  }

  if (requestedStart.getTime() > maxEnd.getTime()) {
    return {
      ok: false,
      error: {
        code: 'future_start',
        message: 'The analysis start date cannot be after the latest date YouTube Analytics can report.',
        messageAr: 'لا يمكن أن يكون تاريخ البداية بعد آخر يوم متاح في تحليلات يوتيوب.',
      },
    };
  }

  const analyzedEnd = requestedEnd.getTime() > maxEnd.getTime() ? maxEnd : requestedEnd;
  const analyzedStart = requestedStart;
  if (analyzedEnd.getTime() < analyzedStart.getTime()) {
    return {
      ok: false,
      error: {
        code: 'future_start',
        message: 'The analysis start date cannot be after the latest date YouTube Analytics can report.',
        messageAr: 'لا يمكن أن يكون تاريخ البداية بعد آخر يوم متاح في تحليلات يوتيوب.',
      },
    };
  }

  if (utcDayDifference(analyzedStart, analyzedEnd) > maxDays) {
    return {
      ok: false,
      error: {
        code: 'range_too_long',
        message: `The analysis period cannot be longer than ${maxDays} days.`,
        messageAr: `لا يمكن أن تتجاوز فترة التحليل ${maxDays} يوماً.`,
      },
    };
  }

  return {
    ok: true,
    period: {
      preset,
      requestedStartDate: formatUtcDate(requestedStart),
      requestedEndDate: formatUtcDate(requestedEnd),
      startDate: formatUtcDate(analyzedStart),
      endDate: formatUtcDate(analyzedEnd),
      clamped: formatUtcDate(analyzedEnd) !== formatUtcDate(requestedEnd),
    },
  };
}

function invalidDate(): AnalyticsPeriodResult {
  return {
    ok: false,
    error: {
      code: 'invalid_date',
      message: 'Dates must use YYYY-MM-DD and be valid calendar dates.',
      messageAr: 'يجب أن تكون التواريخ بصيغة YYYY-MM-DD وصحيحة.',
    },
  };
}
