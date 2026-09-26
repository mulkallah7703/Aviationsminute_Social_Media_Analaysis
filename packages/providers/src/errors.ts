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

/** Internal TikTok Display API failure with preserved platform error details (never tokens). */
export class TikTokApiError extends OAuthFlowError {
  readonly httpStatus: number;
  readonly tikTokCode: string | null;
  readonly tikTokMessage: string | null;
  readonly errorDescription: string | null;
  readonly logId: string | null;
  readonly errorCode: string | number | null;
  readonly phase: 'oauth_callback' | 'normal';

  constructor(input: {
    oauthCode: OAuthErrorCode;
    publicMessage: string;
    httpStatus: number;
    tikTokCode: string | null;
    tikTokMessage: string | null;
    errorDescription: string | null;
    logId: string | null;
    errorCode: string | number | null;
    phase: 'oauth_callback' | 'normal';
  }) {
    super(input.oauthCode, input.publicMessage);
    this.name = 'TikTokApiError';
    this.httpStatus = input.httpStatus;
    this.tikTokCode = input.tikTokCode;
    this.tikTokMessage = input.tikTokMessage;
    this.errorDescription = input.errorDescription;
    this.logId = input.logId;
    this.errorCode = input.errorCode;
    this.phase = input.phase;
  }
}
