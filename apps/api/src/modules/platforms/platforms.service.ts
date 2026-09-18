import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PlatformRepository } from '@sma/database';
import type { PlatformProviderRegistry } from '@sma/providers';
import { getPlatformCatalogEntry, isPlatformCode, type PlatformListItem } from '@sma/types';
import { PLATFORM_PROVIDER_REGISTRY } from '../../infrastructure/providers/providers.tokens';

@Injectable()
export class PlatformsService {
  constructor(
    private readonly platformRepository: PlatformRepository,
    @Inject(PLATFORM_PROVIDER_REGISTRY)
    private readonly providerRegistry: PlatformProviderRegistry,
  ) {}

  async list(): Promise<{ data: PlatformListItem[] }> {
    try {
      const rows = await this.platformRepository.findAll();
      const data: PlatformListItem[] = rows.map((row) => {
        const code = row.platformCode.toLowerCase();
        const catalog = isPlatformCode(code) ? getPlatformCatalogEntry(code) : undefined;
        const provider = isPlatformCode(code) ? this.providerRegistry.tryGet(code) : undefined;

        return {
          code: row.platformCode,
          name: row.platformName,
          nameAr: catalog?.nameAr ?? row.platformName,
          availability: catalog?.availability ?? 'coming_soon',
          isConnectable: Boolean(provider?.isImplemented),
          comingSoonLabel: catalog?.comingSoonLabel ?? 'Coming Soon',
          comingSoonLabelAr: catalog?.comingSoonLabelAr ?? 'ستتاح قريبًا',
        };
      });

      return { data };
    } catch {
      throw new ServiceUnavailableException({
        message: 'Database is unavailable.',
        messageAr: 'قاعدة البيانات غير متاحة.',
        database: 'disconnected',
      });
    }
  }
}
