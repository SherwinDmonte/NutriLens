import { Router } from 'express';

import { getCurrentUser, login, logout, register } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authRateLimit } from '../middleware/authRateLimit.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateBody } from '../middleware/validateRequest.js';
import { loginSchema, registerSchema } from '../validators/authValidators.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimit, validateBody(registerSchema), asyncHandler(register));
authRouter.post('/login', authRateLimit, validateBody(loginSchema), asyncHandler(login));
authRouter.get('/me', requireAuth, getCurrentUser);
authRouter.post('/logout', requireAuth, logout);
