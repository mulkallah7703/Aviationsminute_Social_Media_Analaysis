import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { parseApiEnv, type ApiEnv } from '@sma/config';

const STATE_COOKIE = 'sma_oauth_state';
const PKCE_VERIFIER_COOKIE = 'sma_oauth_pkce';
const USER_COOKIE = 'sma_uid';

@Injectable()
export class CookieSessionService {
  private readonly env: ApiEnv;

  constructor() {
    this.env = parseApiEnv();
  }

  createOAuthState(): string {
    return randomBytes(32).toString('base64url');
  }

  setOAuthState(response: Response, state: string): void {
    response.cookie(STATE_COOKIE, state, {
      ...this.baseCookieOptions(),
      maxAge: 10 * 60 * 1000,
      signed: true,
    });
  }

  readOAuthState(request: Request): string | undefined {
    const value = request.signedCookies?.[STATE_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  clearOAuthState(response: Response): void {
    response.clearCookie(STATE_COOKIE, this.baseCookieOptions());
    this.clearOAuthCodeVerifier(response);
  }

  setOAuthCodeVerifier(response: Response, codeVerifier: string): void {
    response.cookie(PKCE_VERIFIER_COOKIE, codeVerifier, {
      ...this.baseCookieOptions(),
      maxAge: 10 * 60 * 1000,
      signed: true,
    });
  }

  readOAuthCodeVerifier(request: Request): string | undefined {
    const value = request.signedCookies?.[PKCE_VERIFIER_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  clearOAuthCodeVerifier(response: Response): void {
    response.clearCookie(PKCE_VERIFIER_COOKIE, this.baseCookieOptions());
  }

  setUserId(response: Response, userId: bigint): void {
    response.cookie(USER_COOKIE, userId.toString(), {
      ...this.baseCookieOptions(),
      maxAge: 30 * 24 * 60 * 60 * 1000,
      signed: true,
    });
  }

  readUserId(request: Request): bigint | undefined {
    const value = request.signedCookies?.[USER_COOKIE];
    if (typeof value !== 'string' || value.length === 0) {
      return undefined;
    }
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }

  private baseCookieOptions(): CookieOptions {
    const isProduction = this.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: isProduction,
    };
  }
}
