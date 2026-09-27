import { randomUUID } from 'node:crypto';

export function createRequestLogger({ logger = console } = {}) {
  return function requestLoggerMiddleware(request, response, next) {
    const requestId = randomUUID();
    const startedAt = process.hrtime.bigint();
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    response.on('finish', () => {
      if (process.env.NODE_TEST_CONTEXT && logger === console) return;
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info(
        JSON.stringify({
          type: 'http_request',
          requestId,
          method: request.method,
          path: request.originalUrl.split('?')[0],
          statusCode: response.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
        }),
      );
    });

    next();
  };
}

export const requestLogger = createRequestLogger();
