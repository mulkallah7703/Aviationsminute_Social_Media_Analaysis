/**
 * Browser navigation target for Google OAuth.
 * Always uses the public API origin (never API_INTERNAL_URL).
 */
export function youtubeConnectUrl(): string {
  const publicUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!publicUrl || publicUrl === '/') {
    return '/api/auth/google';
  }
  return `${publicUrl.replace(/\/$/, '')}/api/auth/google`;
}

export function formatCount(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  try {
    return new Intl.NumberFormat('en-US').format(BigInt(value));
  } catch {
    return value;
  }
}

export function formatMetric(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }
  return formatCount(value);
}

export function formatWatchTime(seconds: string | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds === '') {
    return 'N/A';
  }

  try {
    const total = Number(BigInt(seconds));
    if (!Number.isFinite(total) || total < 0) {
      return 'N/A';
    }
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  } catch {
    return 'N/A';
  }
}

export function formatAnalyzedDate(value: string | null | undefined): string {
  if (!value) {
    return 'N/A';
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatLastSynced(value: string | null | undefined): string {
  if (!value) {
    return 'Never';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Never';
  }
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
