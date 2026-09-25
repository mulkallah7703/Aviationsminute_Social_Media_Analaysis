import { YouTubeProvider } from './youtube.provider';
import { TikTokProvider } from './tiktok.provider';
import { PlatformProviderRegistry } from './registry';
import type { YouTubeProviderConfig } from './youtube.config';
import type { TikTokProviderConfig } from './tiktok.config';

export function createDefaultProviderRegistry(
  youtubeConfig?: YouTubeProviderConfig,
  tiktokConfig?: TikTokProviderConfig,
): PlatformProviderRegistry {
  const registry = new PlatformProviderRegistry();
  registry.register(new YouTubeProvider(youtubeConfig));
  registry.register(new TikTokProvider(tiktokConfig));
  return registry;
}
