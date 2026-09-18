export const UTC_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function utcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatUtcDate(date: Date): string {
  return utcDateOnly(date).toISOString().slice(0, 10);
}

export function parseUtcDateOnly(value: string): Date | null {
  if (!UTC_DATE_ONLY_PATTERN.test(value)) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
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

export function utcDayDifference(start: Date, end: Date): number {
  return Math.round((utcDateOnly(end).getTime() - utcDateOnly(start).getTime()) / 86_400_000);
}
