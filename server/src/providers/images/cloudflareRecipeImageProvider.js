export const DEFAULT_CLOUDFLARE_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
export const DEFAULT_MAXIMUM_RECIPE_IMAGE_BYTES = 5 * 1024 * 1024;

const CLOUDFLARE_API_ORIGIN = 'https://api.cloudflare.com';
const CLOUDFLARE_MODEL_PATTERN = /^@cf\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/iu;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

export class CloudflareRecipeImageProviderError extends Error {
  constructor(kind) {
    super('Cloudflare recipe image generation did not complete.');
    this.name = 'CloudflareRecipeImageProviderError';
    this.kind = kind;
  }
}

function providerEndpoint(accountId, model) {
  const safeAccountId = encodeURIComponent(accountId);
  return `${CLOUDFLARE_API_ORIGIN}/client/v4/accounts/${safeAccountId}/ai/run/${model}`;
}

function failureText(payload) {
  try {
    return JSON.stringify(payload).toLocaleLowerCase('en-US');
  } catch {
    return '';
  }
}

function classifyProviderFailure(status, payload) {
  const text = failureText(payload);
  if (
    status === 402 ||
    /\b(quota|allocation|credits?|billing|payment required|insufficient balance)\b/u.test(text)
  ) {
    return 'quota';
  }
  if (
    status === 429 ||
    /\b(rate limit|rate-limit|too many requests|throttl(?:e|ed|ing))\b/u.test(text)
  ) {
    return 'rate_limited';
  }
  return 'unavailable';
}

function isAbortError(error, signal) {
  return signal?.aborted === true || error?.name === 'AbortError';
}

function decodeJpeg(base64Image, maximumImageBytes) {
  if (typeof base64Image !== 'string') {
    throw new CloudflareRecipeImageProviderError('invalid_output');
  }

  const encoded = base64Image.trim();
  const maximumEncodedLength = Math.ceil(maximumImageBytes / 3) * 4 + 4;
  if (
    encoded.length === 0 ||
    encoded.length > maximumEncodedLength ||
    encoded.length % 4 !== 0 ||
    !BASE64_PATTERN.test(encoded)
  ) {
    throw new CloudflareRecipeImageProviderError('invalid_output');
  }

  const bytes = Buffer.from(encoded, 'base64');
  if (
    bytes.length === 0 ||
    bytes.length > maximumImageBytes ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[2] !== 0xff
  ) {
    throw new CloudflareRecipeImageProviderError('invalid_output');
  }

  return bytes;
}

export function createCloudflareRecipeImageProvider({
  accountId,
  apiToken,
  model = DEFAULT_CLOUDFLARE_IMAGE_MODEL,
  fetchImplementation = globalThis.fetch,
  maximumImageBytes = DEFAULT_MAXIMUM_RECIPE_IMAGE_BYTES,
} = {}) {
  const hasConfiguration =
    typeof accountId === 'string' &&
    accountId.trim().length > 0 &&
    typeof apiToken === 'string' &&
    apiToken.trim().length > 0 &&
    typeof model === 'string' &&
    CLOUDFLARE_MODEL_PATTERN.test(model) &&
    typeof fetchImplementation === 'function' &&
    Number.isSafeInteger(maximumImageBytes) &&
    maximumImageBytes > 0;

  return Object.freeze({
    name: 'cloudflare',
    async generateImage({ prompt, signal } = {}) {
      if (!hasConfiguration) {
        throw new CloudflareRecipeImageProviderError('missing_configuration');
      }
      if (signal?.aborted) {
        throw new CloudflareRecipeImageProviderError('cancelled');
      }
      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        throw new CloudflareRecipeImageProviderError('invalid_output');
      }

      let response;
      try {
        response = await fetchImplementation(providerEndpoint(accountId.trim(), model), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${apiToken.trim()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: prompt.trim() }),
          signal,
        });
      } catch (error) {
        if (isAbortError(error, signal)) {
          throw new CloudflareRecipeImageProviderError('cancelled');
        }
        throw new CloudflareRecipeImageProviderError('unavailable');
      }

      if (!response || typeof response.json !== 'function') {
        throw new CloudflareRecipeImageProviderError('unavailable');
      }

      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        if (isAbortError(error, signal)) {
          throw new CloudflareRecipeImageProviderError('cancelled');
        }
        if (response.ok) {
          throw new CloudflareRecipeImageProviderError('invalid_output');
        }
        throw new CloudflareRecipeImageProviderError(
          classifyProviderFailure(Number(response.status), undefined),
        );
      }

      if (!response.ok || payload?.success !== true) {
        throw new CloudflareRecipeImageProviderError(
          classifyProviderFailure(Number(response.status), payload),
        );
      }

      return Object.freeze({
        bytes: decodeJpeg(payload?.result?.image, maximumImageBytes),
        mimeType: 'image/jpeg',
      });
    },
  });
}
