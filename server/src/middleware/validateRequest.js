import { AppError } from '../utils/AppError.js';

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function containsForbiddenObjectKey(value) {
  const pending = [value];
  const visited = new Set();

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === null || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);

    for (const key of Object.keys(current)) {
      if (FORBIDDEN_OBJECT_KEYS.has(key)) return true;
      pending.push(current[key]);
    }
  }

  return false;
}

function validateRequestPart(schema, requestKey, validatedKey) {
  return function requestPartValidator(request, _response, next) {
    if (containsForbiddenObjectKey(request[requestKey])) {
      return next(
        new AppError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', [
          { field: requestKey, message: 'Unsupported object key.' },
        ]),
      );
    }

    const validation = schema.safeParse(request[requestKey]);

    if (!validation.success) {
      const details = validation.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));

      return next(
        new AppError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', details),
      );
    }

    request[validatedKey] = validation.data;
    return next();
  };
}

export function validateBody(schema) {
  return validateRequestPart(schema, 'body', 'validatedBody');
}

export function validateParams(schema) {
  return validateRequestPart(schema, 'params', 'validatedParams');
}

export function validateQuery(schema) {
  return validateRequestPart(schema, 'query', 'validatedQuery');
}
