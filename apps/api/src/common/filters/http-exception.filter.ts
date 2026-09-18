import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  OAuthFlowError,
  ProviderCapabilityNotReadyError,
  UnsupportedPlatformError,
} from '@sma/providers';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, error, code, message, messageAr } = this.normalize(exception);

    response.status(statusCode).json({
      statusCode,
      error,
      ...(code ? { code } : {}),
      message,
      messageAr,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private normalize(exception: unknown): {
    statusCode: number;
    error: string;
    code?: string;
    message: string;
    messageAr?: string;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : typeof body === 'object' && body && 'message' in body
            ? String((body as { message: string | string[] }).message)
            : exception.message;
      const code =
        typeof body === 'object' && body && 'code' in body
          ? String((body as { code: string }).code)
          : undefined;
      const messageAr =
        typeof body === 'object' && body && 'messageAr' in body
          ? String((body as { messageAr: string }).messageAr)
          : undefined;

      return {
        statusCode,
        error: code ?? HttpStatus[statusCode] ?? 'Error',
        code,
        message,
        messageAr,
      };
    }

    if (exception instanceof OAuthFlowError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: exception.code,
        message: exception.message,
        messageAr: 'تعذر إكمال ربط يوتيوب.',
      };
    }

    if (exception instanceof ProviderCapabilityNotReadyError) {
      return {
        statusCode: HttpStatus.NOT_IMPLEMENTED,
        error: 'Not Implemented',
        message: `${exception.platformCode} ${exception.capability} is not available yet.`,
        messageAr: 'هذه القدرة غير متاحة بعد.',
      };
    }

    if (exception instanceof UnsupportedPlatformError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: exception.message,
        messageAr: 'المنصة غير مدعومة حالياً.',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred.',
      messageAr: 'حدث خطأ غير متوقع.',
    };
  }
}
