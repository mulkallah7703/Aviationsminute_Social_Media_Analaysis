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
        const tiktokConfig =
          env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.TIKTOK_REDIRECT_URI
            ? {
                clientKey: env.TIKTOK_CLIENT_KEY,
                clientSecret: env.TIKTOK_CLIENT_SECRET,
                redirectUri: env.TIKTOK_REDIRECT_URI,
                scopes: env.TIKTOK_OAUTH_SCOPES,
              }
            : undefined;
        return createDefaultProviderRegistry(
          {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            redirectUri: env.GOOGLE_REDIRECT_URI,
            scopes: env.YOUTUBE_OAUTH_SCOPES,
          },
          tiktokConfig,
        );
      },
    },
  ],
  exports: [PLATFORM_PROVIDER_REGISTRY],
})
export class ProvidersModule {}
