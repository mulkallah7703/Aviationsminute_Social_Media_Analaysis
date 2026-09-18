import { YouTubeProvider } from './youtube.provider';
import { PlatformProviderRegistry } from './registry';
import type { YouTubeProviderConfig } from './youtube.config';

export function createDefaultProviderRegistry(
  youtubeConfig?: YouTubeProviderConfig,
): PlatformProviderRegistry {
  const registry = new PlatformProviderRegistry();
  registry.register(new YouTubeProvider(youtubeConfig));
  return registry;
}
