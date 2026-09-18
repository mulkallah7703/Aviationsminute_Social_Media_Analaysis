import type { PlatformCode } from '@sma/types';
import { UnsupportedPlatformError } from './errors';
import type { SocialPlatformProvider } from './social-platform-provider';

export class PlatformProviderRegistry {
  private readonly providers = new Map<PlatformCode, SocialPlatformProvider>();

  register(provider: SocialPlatformProvider): void {
    this.providers.set(provider.platformCode, provider);
  }

  get(platformCode: PlatformCode): SocialPlatformProvider {
    const provider = this.providers.get(platformCode);
    if (!provider) {
      throw new UnsupportedPlatformError(platformCode);
    }
    return provider;
  }

  tryGet(platformCode: PlatformCode): SocialPlatformProvider | undefined {
    return this.providers.get(platformCode);
  }

  list(): SocialPlatformProvider[] {
    return [...this.providers.values()];
  }
}
