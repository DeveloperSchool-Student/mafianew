import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Global HTTP exception filter.
 * Ensures ALL error responses follow the same shape:
 *
 *   { success: false, error: string, statusCode: number }
 *
 * Handles both NestJS HttpExceptions and unexpected errors.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Don't run for WebSocket contexts
    if (!response || typeof response.status !== 'function') return;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Внутрішня помилка сервера';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, any>;
        // class-validator returns an array of messages
        if (Array.isArray(resp.message)) {
          message = resp.message.join('; ');
        } else if (typeof resp.message === 'string') {
          message = resp.message;
        } else if (typeof resp.error === 'string') {
          message = resp.error;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unexpected error: ${exception.message}`,
        exception.stack,
      );
      message = 'Внутрішня помилка сервера';
    }

    response.status(statusCode).json({
      success: false,
      error: message,
      statusCode,
    });
  }
}
