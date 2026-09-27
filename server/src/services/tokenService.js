import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

const JWT_ALGORITHM = 'HS256';
const JWT_ISSUER = 'nutrilens-api';
const JWT_AUDIENCE = 'nutrilens-web';

function durationToMilliseconds(duration) {
  const match = /^(\d+)([mhd])$/.exec(duration);
  if (!match) throw new Error('Unsupported JWT duration.');

  const value = Number(match[1]);
  const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[match[2]];
}

export function signAccessToken(userId, secret = env.jwtSecret) {
  return jwt.sign({ type: 'access' }, secret, {
    algorithm: JWT_ALGORITHM,
    audience: JWT_AUDIENCE,
    expiresIn: env.jwtExpiresIn,
    issuer: JWT_ISSUER,
    subject: userId.toString(),
  });
}

export function verifyAccessToken(token, secret = env.jwtSecret) {
  const payload = jwt.verify(token, secret, {
    algorithms: [JWT_ALGORITHM],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  });

  if (typeof payload !== 'object' || payload.type !== 'access' || !payload.sub) {
    throw new Error('Invalid access token payload.');
  }

  return payload;
}

export function getSessionCookieName() {
  if (env.nodeEnv !== 'production') return env.cookieName;
  return `__Host-${env.cookieName.replace(/^__Host-/, '')}`;
}

export function getSessionCookieOptions({ includeMaxAge = true } = {}) {
  return {
    httpOnly: true,
    ...(includeMaxAge ? { maxAge: durationToMilliseconds(env.jwtExpiresIn) } : {}),
    path: '/',
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
  };
}
