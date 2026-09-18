import type { OAuthErrorCode, PlatformCode } from '@sma/types';

export class ProviderCapabilityNotReadyError extends Error {
  readonly platformCode: PlatformCode;
  readonly capability: string;

  constructor(platformCode: PlatformCode, capability: string) {
    super(
      `${platformCode} provider capability "${capability}" is not implemented yet. This is architectural scaffolding only.`,
    );
    this.name = 'ProviderCapabilityNotReadyError';
    this.platformCode = platformCode;
    this.capability = capability;
  }
}

export class UnsupportedPlatformError extends Error {
  readonly platformCode: string;

  constructor(platformCode: string) {
    super(`No provider is registered for platform "${platformCode}".`);
    this.name = 'UnsupportedPlatformError';
    this.platformCode = platformCode;
  }
}

export class OAuthFlowError extends Error {
  readonly code: OAuthErrorCode;

  constructor(code: OAuthErrorCode, message: string) {
    super(message);
    this.name = 'OAuthFlowError';
    this.code = code;
  }
}
