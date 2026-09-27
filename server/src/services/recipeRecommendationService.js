import { env } from '../config/env.js';
import { RECIPE_FALLBACK_REASONS, RECIPE_RUNTIME } from '../config/recipes.js';
import { bundledRecipeProvider } from '../providers/recipes/bundledRecipeProvider.js';
import { geminiRecipeProvider } from '../providers/recipes/geminiRecipeProvider.js';
import { assertRecipeProvider } from '../providers/recipes/recipeProvider.js';
import { AppError } from '../utils/AppError.js';
import {
  providerRecipeBatchSchema,
  recipeRecommendationRequestSchema,
} from '../validators/recipeRecommendationValidators.js';
import { enrichRecipeImages } from './recipeImageService.js';
import { scoreAndRankRecipeCandidates } from './recipeScoringService.js';

class RecipeProviderOperationError extends Error {
  constructor(kind) {
    super('Recipe provider operation did not complete.');
    this.name = 'RecipeProviderOperationError';
    this.kind = kind;
  }
}

function emitRecipeLog(logger, event) {
  if (process.env.NODE_TEST_CONTEXT && logger === console) return;
  try {
    logger.info(JSON.stringify(event));
  } catch {
    // Observability must never break a recommendation response.
  }
}

async function runProviderWithDeadline({ provider, input, externalSignal, timeoutMs }) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('Recipe provider timeout must be greater than 0.');
  }

  const operationController = new AbortController();
  let abortKind = 'cancelled';
  const abortOperation = () => {
    abortKind = 'cancelled';
    operationController.abort(externalSignal?.reason);
  };
  if (externalSignal?.aborted) abortOperation();
  else externalSignal?.addEventListener('abort', abortOperation, { once: true });

  const timeout = setTimeout(() => {
    abortKind = 'timeout';
    operationController.abort(new Error('Recipe provider deadline exceeded.'));
  }, timeoutMs);

  const abortPromise = new Promise((resolve, reject) => {
    const rejectForAbort = () => reject(new RecipeProviderOperationError(abortKind));
    if (operationController.signal.aborted) rejectForAbort();
    else operationController.signal.addEventListener('abort', rejectForAbort, { once: true });
  });

  try {
    const providerPromise = Promise.resolve().then(() =>
      provider.generateRecipes({ ...input, signal: operationController.signal }),
    );
    return await Promise.race([providerPromise, abortPromise]);
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortOperation);
  }
}

function publicFailureKind(error) {
  if (error instanceof RecipeProviderOperationError) return error.kind;
  if (RECIPE_FALLBACK_REASONS.includes(error?.kind)) return error.kind;
  if (error?.name === 'ZodError') return 'invalid_output';
  return 'unavailable';
}

function configuredPrimaryProvider() {
  return env.recipeProvider === 'gemini' ? geminiRecipeProvider : bundledRecipeProvider;
}

function configuredFallbackProvider(primaryProvider) {
  if (primaryProvider.name !== 'gemini') return null;
  return env.recipeFallbackProvider === 'bundled' ? bundledRecipeProvider : null;
}

function configuredTimeout(provider) {
  return provider.name === 'gemini' ? env.geminiTimeoutMs : RECIPE_RUNTIME.providerTimeoutMs;
}

async function generateAndScore({ provider, input, signal, timeoutMs, imageService }) {
  const untrustedOutput = await runProviderWithDeadline({
    provider,
    input,
    externalSignal: signal,
    timeoutMs,
  });
  const providerOutput = providerRecipeBatchSchema.parse(untrustedOutput);
  const recommendation = scoreAndRankRecipeCandidates({
    request: input,
    providerOutput,
    providerName: provider.name,
  });

  try {
    const recipes = imageService
      ? await imageService.enrichRecipes(recommendation.recipes, { signal })
      : await enrichRecipeImages(recommendation.recipes, { signal });
    return { ...recommendation, recipes };
  } catch {
    // Recipe imagery is supplemental. A provider/cache outage must not discard valid recipes.
    return recommendation;
  }
}

export async function getRecipeRecommendations(
  { authenticatedUserId, input, requestId, signal },
  {
    provider,
    fallbackProvider,
    timeoutMs,
    fallbackTimeoutMs = RECIPE_RUNTIME.providerTimeoutMs,
    imageService,
    logger = console,
  } = {},
) {
  if (!authenticatedUserId) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Please log in to continue.');
  }

  const normalizedInput = recipeRecommendationRequestSchema.parse(input);
  const recipeProvider = assertRecipeProvider(provider || configuredPrimaryProvider());
  const resolvedFallbackProvider =
    fallbackProvider === undefined
      ? configuredFallbackProvider(recipeProvider)
      : fallbackProvider === null
        ? null
        : assertRecipeProvider(fallbackProvider);
  const primaryTimeoutMs = timeoutMs ?? configuredTimeout(recipeProvider);
  const startedAt = process.hrtime.bigint();

  try {
    const recommendation = await generateAndScore({
      provider: recipeProvider,
      input: normalizedInput,
      signal,
      timeoutMs: primaryTimeoutMs,
      imageService,
    });
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    emitRecipeLog(logger, {
      type: 'recipe_recommendation',
      requestId,
      provider: recipeProvider.name,
      outcome: recommendation.status,
      recipeCount: recommendation.recipes.length,
      durationMs: Number(durationMs.toFixed(2)),
    });

    return {
      ...recommendation,
      provider: {
        requested: recipeProvider.name,
        used: recipeProvider.name,
        fallbackUsed: false,
        fallbackReason: null,
      },
    };
  } catch (error) {
    const failureKind = publicFailureKind(error);

    if (
      resolvedFallbackProvider &&
      recipeProvider.name === 'gemini' &&
      RECIPE_FALLBACK_REASONS.includes(failureKind) &&
      !signal?.aborted
    ) {
      try {
        const recommendation = await generateAndScore({
          provider: resolvedFallbackProvider,
          input: normalizedInput,
          signal,
          timeoutMs: fallbackTimeoutMs,
          imageService,
        });
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        emitRecipeLog(logger, {
          type: 'recipe_recommendation',
          requestId,
          provider: recipeProvider.name,
          usedProvider: resolvedFallbackProvider.name,
          outcome: recommendation.status,
          recipeCount: recommendation.recipes.length,
          fallbackUsed: true,
          fallbackReason: failureKind,
          durationMs: Number(durationMs.toFixed(2)),
        });

        return {
          ...recommendation,
          provider: {
            requested: recipeProvider.name,
            used: resolvedFallbackProvider.name,
            fallbackUsed: true,
            fallbackReason: failureKind,
          },
        };
      } catch (fallbackError) {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        emitRecipeLog(logger, {
          type: 'recipe_recommendation',
          requestId,
          provider: recipeProvider.name,
          usedProvider: resolvedFallbackProvider.name,
          outcome: 'failed',
          failureKind: publicFailureKind(fallbackError),
          fallbackUsed: true,
          fallbackReason: failureKind,
          durationMs: Number(durationMs.toFixed(2)),
        });
        throw new AppError(
          503,
          'RECIPE_PROVIDER_UNAVAILABLE',
          'Recipe recommendations are temporarily unavailable. Please try again.',
        );
      }
    }

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    emitRecipeLog(logger, {
      type: 'recipe_recommendation',
      requestId,
      provider: recipeProvider.name,
      outcome: 'failed',
      failureKind,
      durationMs: Number(durationMs.toFixed(2)),
    });
    throw new AppError(
      503,
      'RECIPE_PROVIDER_UNAVAILABLE',
      'Recipe recommendations are temporarily unavailable. Please try again.',
    );
  }
}
