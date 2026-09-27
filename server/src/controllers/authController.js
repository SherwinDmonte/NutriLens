import { authenticateUser, registerUser } from '../services/authService.js';
import {
  getSessionCookieName,
  getSessionCookieOptions,
  signAccessToken,
} from '../services/tokenService.js';

function setSessionCookie(response, userId) {
  response.cookie(getSessionCookieName(), signAccessToken(userId), getSessionCookieOptions());
}

export async function register(request, response) {
  const user = await registerUser(request.validatedBody);
  setSessionCookie(response, user.id);
  response.status(201).json({ data: { user } });
}

export async function login(request, response) {
  const user = await authenticateUser(request.validatedBody);
  setSessionCookie(response, user.id);
  response.status(200).json({ data: { user } });
}

export function getCurrentUser(request, response) {
  response.status(200).json({ data: { user: request.user } });
}

export function logout(_request, response) {
  response.clearCookie(getSessionCookieName(), getSessionCookieOptions({ includeMaxAge: false }));
  response.status(204).end();
}
