import { AppError } from '../utils/AppError.js';
import { buildResponseMeta } from '../utils/apiResponse.js';

export function createErrorHandler({ logger = console } = {}) {
  return function errorHandlerMiddleware(error, request, response, _next) {
    if (error instanceof AppError) {
      return response.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        meta: buildResponseMeta(request),
      });
    }

    if (error?.type === 'entity.parse.failed') {
      return response.status(400).json({
        error: {
          code: 'INVALID_JSON',
          message: 'The request body must contain valid JSON.',
        },
        meta: buildResponseMeta(request),
      });
    }

    if (error?.type === 'entity.too.large') {
      return response.status(413).json({
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'The request body is too large.',
        },
        meta: buildResponseMeta(request),
      });
    }

    if (error?.name === 'ValidationError') {
      const details = Object.values(error.errors).map((validationError) => ({
        field: validationError.path,
        message: validationError.message,
      }));
      return response.status(400).json({
        error: {
          code: 'DATABASE_VALIDATION_ERROR',
          message: 'The record did not pass database validation.',
          details,
        },
        meta: buildResponseMeta(request),
      });
    }

    if (error?.code === 11_000) {
      return response.status(409).json({
        error: { code: 'DUPLICATE_RESOURCE', message: 'The record already exists.' },
        meta: buildResponseMeta(request),
      });
    }

    if (['MongooseServerSelectionError', 'MongoNetworkError'].includes(error?.name)) {
      return response.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The database is temporarily unavailable. Please try again.',
        },
        meta: buildResponseMeta(request),
      });
    }

    logger.error('Unhandled API error', {
      type: 'unhandled_api_error',
      requestId: request.requestId,
    });
    return response.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The request could not be completed. Please try again.',
      },
      meta: buildResponseMeta(request),
    });
  };
}

export const errorHandler = createErrorHandler();
