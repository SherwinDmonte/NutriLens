import mongoose from 'mongoose';

import { findPublicUserById } from '../services/authService.js';
import { getSessionCookieName, verifyAccessToken } from '../services/tokenService.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from './asyncHandler.js';

export function createRequireAuth({
  findUser = findPublicUserById,
  verifyToken = verifyAccessToken,
  cookieName = getSessionCookieName(),
} = {}) {
  return asyncHandler(async (request, _response, next) => {
    const token = request.cookies?.[cookieName];

    if (!token) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please log in to continue.');
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new AppError(401, 'INVALID_SESSION', 'Your session is invalid or has expired.');
    }

    if (!mongoose.isObjectIdOrHexString(payload.sub)) {
      throw new AppError(401, 'INVALID_SESSION', 'Your session is invalid or has expired.');
    }

    const user = await findUser(payload.sub);
    if (!user) {
      throw new AppError(401, 'INVALID_SESSION', 'Your session is invalid or has expired.');
    }

    request.auth = { userId: user.id };
    request.user = user;
    next();
  });
}

export const requireAuth = createRequireAuth();
