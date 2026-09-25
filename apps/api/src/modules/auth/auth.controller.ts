import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('google')
  async google(@Req() request: Request, @Res() response: Response): Promise<void> {
    try {
      const authorizationUrl = await this.authService.startGoogleAuthorization(request, response);
      response.redirect(authorizationUrl);
    } catch (error) {
      response.redirect(
        this.authService.frontendRedirectUrl(
          {
            status: 'error',
            code: this.authService.toPublicErrorCode(error),
          },
          '/youtube',
        ),
      );
    }
  }

  @Get('google/callback')
  async googleCallback(
    @Req() request: Request,
    @Res() response: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ): Promise<void> {
    const result = await this.authService.completeGoogleCallback(request, response, {
      code,
      state,
      error,
    });
    response.redirect(this.authService.frontendRedirectUrl(result, '/youtube'));
  }

  @Get('tiktok')
  async tiktok(@Req() request: Request, @Res() response: Response): Promise<void> {
    try {
      const authorizationUrl = await this.authService.startTikTokAuthorization(request, response);
      response.redirect(authorizationUrl);
    } catch (error) {
      response.redirect(
        this.authService.frontendRedirectUrl(
          {
            status: 'error',
            code: this.authService.toPublicErrorCode(error),
          },
          '/tiktok',
        ),
      );
    }
  }

  @Get('tiktok/callback')
  async tiktokCallback(
    @Req() request: Request,
    @Res() response: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
    @Query('error_description') errorDescription?: string,
  ): Promise<void> {
    const result = await this.authService.completeTikTokCallback(request, response, {
      code,
      state,
      error,
      error_description: errorDescription,
    });
    response.redirect(this.authService.frontendRedirectUrl(result, '/tiktok'));
  }
}
