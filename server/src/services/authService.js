import bcrypt from 'bcryptjs';

import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

export function toPublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function hashPassword(password) {
  return bcrypt.hash(password, env.bcryptRounds);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export async function registerUser({ name, email, password }) {
  const existingUser = await User.exists({ email });

  if (existingUser) {
    throw new AppError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists.');
  }

  const passwordHash = await hashPassword(password);

  try {
    const user = await User.create({ name, email, passwordHash });
    return toPublicUser(user);
  } catch (error) {
    if (error?.code === 11_000) {
      throw new AppError(409, 'ACCOUNT_EXISTS', 'An account with this email already exists.');
    }
    throw error;
  }
}

export async function authenticateUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  return toPublicUser(user);
}

export async function findPublicUserById(userId) {
  const user = await User.findById(userId);
  return user ? toPublicUser(user) : null;
}
