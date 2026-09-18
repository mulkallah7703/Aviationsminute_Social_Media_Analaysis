export const SOCIAL_CONNECTION_STATUSES = ['connected', 'reauth_required', 'disconnected'] as const;

export type SocialConnectionStatus = (typeof SOCIAL_CONNECTION_STATUSES)[number];

export function isSocialConnectionStatus(value: string | null | undefined): value is SocialConnectionStatus {
  return SOCIAL_CONNECTION_STATUSES.includes(value as SocialConnectionStatus);
}

export function resolveSocialConnectionStatus(account: {
  connectionStatus?: string | null;
  isConnected: boolean;
}): SocialConnectionStatus {
  if (isSocialConnectionStatus(account.connectionStatus)) {
    return account.connectionStatus;
  }
  return account.isConnected ? 'connected' : 'disconnected';
}
