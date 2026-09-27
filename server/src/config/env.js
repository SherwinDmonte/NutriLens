import 'dotenv/config';

const parsedPort = Number.parseInt(process.env.PORT || '5000', 10);
if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const mongodbDatabase = process.env.MONGODB_DATABASE?.trim() || 'nutrilens';

if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/.test(mongodbDatabase)) {
  throw new Error(
    'MONGODB_DATABASE must start with a letter or number and contain only letters, numbers, underscores, or hyphens.',
  );
}

const bcryptRounds = Number.parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

if (!Number.isInteger(bcryptRounds) || bcryptRounds < 10 || bcryptRounds > 14) {
  throw new Error('BCRYPT_ROUNDS must be an integer between 10 and 14.');
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN?.trim() || '15m';

if (!/^\d+[mhd]$/.test(jwtExpiresIn)) {
  throw new Error('JWT_EXPIRES_IN must use a value such as 15m, 1h, or 7d.');
}

function enumSetting(name, fallback, allowedValues) {
  const value = process.env[name]?.trim().toLocaleLowerCase('en-US') || fallback;
  if (!allowedValues.includes(value)) {
    throw new Error(`${name} must be one of: ${allowedValues.join(', ')}.`);
  }
  return value;
}

function integerSetting(name, fallback, { minimum, maximum }) {
  const value = Number.parseInt(process.env[name] || String(fallback), 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

const geminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(geminiModel)) {
  throw new Error('GEMINI_MODEL contains unsupported characters.');
}

const cloudflareImageModel =
  process.env.CLOUDFLARE_IMAGE_MODEL?.trim() || '@cf/black-forest-labs/flux-1-schnell';
if (!/^@cf\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/u.test(cloudflareImageModel)) {
  throw new Error('CLOUDFLARE_IMAGE_MODEL must use an approved @cf/owner/model identifier.');
}

const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || '';
if (cloudflareAccountId && !/^[a-f\d]{32}$/iu.test(cloudflareAccountId)) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID must be a 32-character hexadecimal account ID.');
}

const openFoodFactsCountry =
  process.env.OPEN_FOOD_FACTS_COUNTRY?.trim().toLocaleLowerCase('en-US') || 'india';
if (!/^[a-z][a-z -]{1,48}$/.test(openFoodFactsCountry)) {
  throw new Error(
    'OPEN_FOOD_FACTS_COUNTRY must be a country name using letters, spaces, or hyphens.',
  );
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parsedPort,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI?.trim() || '',
  mongodbDatabase,
  jwtSecret: process.env.JWT_SECRET?.trim() || '',
  jwtExpiresIn,
  cookieName: process.env.COOKIE_NAME?.trim() || 'nutrilens_session',
  bcryptRounds,
  recipeProvider: enumSetting('RECIPE_PROVIDER', 'bundled', ['bundled', 'gemini']),
  recipeFallbackProvider: enumSetting('RECIPE_FALLBACK_PROVIDER', 'bundled', ['bundled']),
  recipeImageProvider: enumSetting('RECIPE_IMAGE_PROVIDER', 'none', ['none', 'cloudflare']),
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || '',
  geminiModel,
  geminiTimeoutMs: integerSetting('GEMINI_TIMEOUT_MS', 10_000, {
    minimum: 1_000,
    maximum: 30_000,
  }),
  cloudflareAccountId,
  cloudflareAiApiToken: process.env.CLOUDFLARE_AI_API_TOKEN?.trim() || '',
  cloudflareImageModel,
  recipeImageTimeoutMs: integerSetting('RECIPE_IMAGE_TIMEOUT_MS', 20_000, {
    minimum: 1_000,
    maximum: 60_000,
  }),
  recipeImageConcurrency: integerSetting('RECIPE_IMAGE_CONCURRENCY', 2, {
    minimum: 1,
    maximum: 4,
  }),
  usdaFdcApiKey: process.env.USDA_FDC_API_KEY?.trim() || '',
  openFoodFactsCountry,
  openFoodFactsUserAgent:
    process.env.OPEN_FOOD_FACTS_USER_AGENT?.trim() || 'NutriLens/0.1 (local-development)',
  foodProviderTimeoutMs: integerSetting('FOOD_PROVIDER_TIMEOUT_MS', 7_000, {
    minimum: 1_000,
    maximum: 20_000,
  }),
});

export function assertAuthConfiguration() {
  const insecureSecretMarkers = ['replace-with', 'change-me', 'your-secret', '<secret>'];
  const secretIsPlaceholder = insecureSecretMarkers.some((marker) =>
    env.jwtSecret.toLowerCase().includes(marker),
  );

  if (env.jwtSecret.length < 64 || secretIsPlaceholder) {
    throw new Error(
      'JWT_SECRET must be replaced with at least 64 random characters before authentication can start.',
    );
  }
}
