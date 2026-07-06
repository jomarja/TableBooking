import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IS_PRODUCTION } from '../config/env';

/**
 * Catch-all exception filter.
 *
 * Nest's intentional HttpExceptions (e.g. "Invalid email or password") are
 * passed through to the client unchanged, but any *unexpected* error is logged
 * in full server-side and reduced to a generic message for the client so we
 * never leak stack traces, Prisma errors, or internal details in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttp || status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (isHttp) {
      const body = exception.getResponse();
      res
        .status(status)
        .json(
          typeof body === 'string' ? { statusCode: status, message: body } : body,
        );
      return;
    }

    res.status(status).json({
      statusCode: status,
      message: IS_PRODUCTION
        ? 'Internal server error'
        : String((exception as { message?: unknown })?.message ?? exception),
    });
  }
}
