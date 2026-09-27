export function assertNutritionProvider(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new TypeError('Nutrition provider must be an object.');
  }
  if (typeof provider.name !== 'string' || provider.name.length === 0) {
    throw new TypeError('Nutrition provider must expose a non-empty name.');
  }
  if (typeof provider.estimateIngredient !== 'function') {
    throw new TypeError('Nutrition provider must expose estimateIngredient().');
  }
  if (
    !provider.provenance ||
    typeof provider.provenance.dataset !== 'string' ||
    typeof provider.provenance.version !== 'string' ||
    typeof provider.provenance.calculationMethod !== 'string'
  ) {
    throw new TypeError('Nutrition provider must expose dataset provenance.');
  }
  return provider;
}
