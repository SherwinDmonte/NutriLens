import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function originGuard(request, _response, next) {
  if (SAFE_METHODS.has(request.method)) return next();

  const requestOrigin = request.get('origin');
  const fetchSite = request.get('sec-fetch-site');
  const isUnexpectedOrigin = requestOrigin && requestOrigin !== env.clientOrigin;
  const isCrossSiteBrowserRequest = fetchSite === 'cross-site';

  if (isUnexpectedOrigin || isCrossSiteBrowserRequest) {
    return next(new AppError(403, 'ORIGIN_REJECTED', 'This request origin is not allowed.'));
  }

  return next();
}
