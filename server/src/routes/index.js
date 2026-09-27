import { Router } from 'express';

import { getHealth } from '../controllers/healthController.js';
import { authRouter } from './authRoutes.js';
import { foodCatalogRouter } from './foodCatalogRoutes.js';
import { foodLogRouter } from './foodLogRoutes.js';
import { recipeImageRouter } from './recipeImageRoutes.js';
import { recipeRouter } from './recipeRoutes.js';

export const apiRouter = Router();
apiRouter.get('/health', getHealth);
apiRouter.use('/auth', authRouter);
apiRouter.use('/foods', foodCatalogRouter);
apiRouter.use('/food-logs', foodLogRouter);
apiRouter.use('/recipe-images', recipeImageRouter);
apiRouter.use('/recipes', recipeRouter);
