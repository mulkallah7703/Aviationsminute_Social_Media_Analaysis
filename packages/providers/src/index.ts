export type { SocialPlatformProvider } from './social-platform-provider';
export type {
  AuthorizationRequest,
  AuthorizationCodeExchange,
  ProviderSyncCursor,
} from './social-platform-provider';
export type { YouTubeProviderConfig } from './youtube.config';
export {
  ProviderCapabilityNotReadyError,
  UnsupportedPlatformError,
  OAuthFlowError,
} from './errors';
export { YouTubeProvider, type YouTubePlatformProvider } from './youtube.provider';
export { PlatformProviderRegistry } from './registry';
export { createDefaultProviderRegistry } from './create-registry';
