import { rateLimit } from 'express-rate-limit';

const defaultOptions = {
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'AUTH_RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
};

export function createAuthRateLimit(overrides = {}) {
  return rateLimit({ ...defaultOptions, ...overrides });
}

export const authRateLimit = createAuthRateLimit();
