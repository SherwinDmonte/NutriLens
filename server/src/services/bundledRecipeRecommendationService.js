import { bundledRecipeProvider } from '../providers/recipes/bundledRecipeProvider.js';
import { assertRecipeProvider } from '../providers/recipes/recipeProvider.js';
import { recipeRecommendationRequestSchema } from '../validators/recipeRecommendationValidators.js';
import { scoreAndRankRecipeCandidates } from './recipeScoringService.js';

export async function recommendBundledRecipes(request, { provider = bundledRecipeProvider } = {}) {
  const normalizedRequest = recipeRecommendationRequestSchema.parse(request);
  const recipeProvider = assertRecipeProvider(provider);
  const providerOutput = await recipeProvider.generateRecipes(normalizedRequest);
  return scoreAndRankRecipeCandidates({ request: normalizedRequest, providerOutput });
}
