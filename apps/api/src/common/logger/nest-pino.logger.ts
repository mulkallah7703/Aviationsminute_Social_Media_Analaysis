import { ConsoleLogger, type LoggerService } from '@nestjs/common';
import type { Logger } from '@sma/config';

export class NestPinoLogger extends ConsoleLogger implements LoggerService {
  constructor(private readonly pino: Logger) {
    super();
  }

  override log(message: string, ...optionalParams: unknown[]): void {
    this.pino.info({ context: optionalParams[0] }, message);
  }

  override error(message: string, ...optionalParams: unknown[]): void {
    this.pino.error({ err: optionalParams[0], context: optionalParams[1] }, message);
  }

  override warn(message: string, ...optionalParams: unknown[]): void {
    this.pino.warn({ context: optionalParams[0] }, message);
  }

  override debug(message: string, ...optionalParams: unknown[]): void {
    this.pino.debug({ context: optionalParams[0] }, message);
  }

  override verbose(message: string, ...optionalParams: unknown[]): void {
    this.pino.trace({ context: optionalParams[0] }, message);
  }
}
