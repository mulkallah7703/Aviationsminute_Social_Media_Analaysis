export type SocialAccountStatus = 'pending' | 'connected' | 'disconnected' | 'error' | 'revoked';

export type SyncJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export type SyncJobType = 'account_profile' | 'account_metrics' | 'posts' | 'post_metrics' | 'full';

export const QUEUE_NAMES = {
  SOCIAL_SYNC: 'social-sync',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  SYNC_ACCOUNT: 'sync-account',
  SYNC_ACCOUNT_METRICS: 'sync-account-metrics',
  SYNC_POSTS: 'sync-posts',
  SYNC_POST_METRICS: 'sync-post-metrics',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export interface SyncAccountJobPayload {
  socialAccountId: string;
  platformCode: string;
  jobType: SyncJobType;
  requestedBy?: string;
  reason: 'scheduled' | 'manual';
  syncJobId?: string;
}
