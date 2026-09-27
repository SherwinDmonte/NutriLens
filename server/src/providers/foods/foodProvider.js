import { AppError } from '../../utils/AppError.js';

export const FOOD_PROVIDER_NAMES = Object.freeze(['usda', 'open_food_facts']);

const PROVIDER_PREFIXES = Object.freeze({
  usda: 'usda',
  open_food_facts: 'off',
});

const PREFIX_PROVIDERS = Object.freeze(
  Object.fromEntries(
    Object.entries(PROVIDER_PREFIXES).map(([provider, prefix]) => [prefix, provider]),
  ),
);

export function createProviderFoodId(provider, externalId) {
  const prefix = PROVIDER_PREFIXES[provider];
  if (!prefix || !/^[A-Za-z0-9]+$/.test(String(externalId))) {
    throw new TypeError('A supported food provider and alphanumeric external ID are required.');
  }
  return `${prefix}-${externalId}`.toLocaleLowerCase('en-US');
}

export function parseProviderFoodId(foodId) {
  const match = /^(usda|off)-([a-z0-9]+)$/i.exec(foodId);
  if (!match) {
    throw new AppError(404, 'FOOD_NOT_FOUND', 'The requested food was not found.');
  }

  return {
    provider: PREFIX_PROVIDERS[match[1].toLocaleLowerCase('en-US')],
    externalId: match[2],
  };
}

export function assertFoodProvider(provider) {
  if (!provider || typeof provider !== 'object') {
    throw new TypeError('Food provider must be an object.');
  }
  if (!FOOD_PROVIDER_NAMES.includes(provider.name)) {
    throw new TypeError('Food provider must expose a supported name.');
  }
  if (typeof provider.searchFoods !== 'function' || typeof provider.getFood !== 'function') {
    throw new TypeError('Food provider must expose searchFoods() and getFood().');
  }
  return provider;
}

export function providerRequestError(providerLabel, error) {
  if (error instanceof AppError) return error;
  if (error?.name === 'AbortError') {
    return new AppError(
      503,
      'FOOD_PROVIDER_TIMEOUT',
      `${providerLabel} took too long to respond. Please try again.`,
    );
  }
  return new AppError(
    503,
    'FOOD_PROVIDER_UNAVAILABLE',
    `${providerLabel} is temporarily unavailable. Please try again.`,
  );
}
