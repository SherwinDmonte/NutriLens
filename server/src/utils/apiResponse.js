import { API_VERSION } from '../config/api.js';

export function buildResponseMeta(request, additions = {}) {
  return {
    apiVersion: API_VERSION,
    ...(request.requestId ? { requestId: request.requestId } : {}),
    ...additions,
  };
}
