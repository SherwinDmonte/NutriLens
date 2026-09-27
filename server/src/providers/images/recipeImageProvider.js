export function assertRecipeImageProvider(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new TypeError('Recipe image provider must be an object.');
  }
  if (typeof provider.name !== 'string' || provider.name.length === 0) {
    throw new TypeError('Recipe image provider must expose a non-empty name.');
  }
  if (typeof provider.generateImage !== 'function') {
    throw new TypeError('Recipe image provider must expose generateImage().');
  }
  return provider;
}
