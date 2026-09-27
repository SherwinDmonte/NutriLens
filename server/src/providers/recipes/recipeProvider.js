export function assertRecipeProvider(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new TypeError('Recipe provider must be an object.');
  }
  if (typeof provider.name !== 'string' || provider.name.length === 0) {
    throw new TypeError('Recipe provider must expose a non-empty name.');
  }
  if (typeof provider.generateRecipes !== 'function') {
    throw new TypeError('Recipe provider must expose generateRecipes().');
  }
  return provider;
}
