import { Global, Module } from '@nestjs/common';
import { parseApiEnv } from '@sma/config';
import { createDefaultProviderRegistry } from '@sma/providers';
import { PLATFORM_PROVIDER_REGISTRY } from './providers.tokens';

@Global()
@Module({
  providers: [
    {
      provide: PLATFORM_PROVIDER_REGISTRY,
      useFactory: () => {
        const env = parseApiEnv();
        return createDefaultProviderRegistry({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectUri: env.GOOGLE_REDIRECT_URI,
          scopes: env.YOUTUBE_OAUTH_SCOPES,
        });
      },
    },
  ],
  exports: [PLATFORM_PROVIDER_REGISTRY],
})
export class ProvidersModule {}
