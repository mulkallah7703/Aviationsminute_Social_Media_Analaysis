export type { SocialPlatformProvider } from './social-platform-provider';
export type {
  AuthorizationRequest,
  AuthorizationCodeExchange,
  ProviderSyncCursor,
} from './social-platform-provider';
export type { YouTubeProviderConfig } from './youtube.config';
export type { TikTokProviderConfig } from './tiktok.config';
export {
  ProviderCapabilityNotReadyError,
  UnsupportedPlatformError,
  OAuthFlowError,
} from './errors';
export { YouTubeProvider, type YouTubePlatformProvider } from './youtube.provider';
export {
  TikTokProvider,
  type TikTokPlatformProvider,
  createTikTokCodeVerifier,
  createTikTokCodeChallenge,
  mapTikTokOAuthError,
} from './tiktok.provider';
export { PlatformProviderRegistry } from './registry';
export { createDefaultProviderRegistry } from './create-registry';
