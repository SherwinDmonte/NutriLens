import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CloudflareRecipeImageProviderError,
  DEFAULT_CLOUDFLARE_IMAGE_MODEL,
  createCloudflareRecipeImageProvider,
} from '../src/providers/images/cloudflareRecipeImageProvider.js';
import { assertRecipeImageProvider } from '../src/providers/images/recipeImageProvider.js';

const TEST_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);

function response(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

function providerWithFetch(fetchImplementation, overrides = {}) {
  return createCloudflareRecipeImageProvider({
    accountId: 'test-account-id',
    apiToken: 'test-server-only-token',
    model: DEFAULT_CLOUDFLARE_IMAGE_MODEL,
    fetchImplementation,
    ...overrides,
  });
}

async function expectProviderFailure(provider, kind, request = { prompt: 'A chickpea bowl' }) {
  await assert.rejects(
    provider.generateImage(request),
    (error) =>
      error instanceof CloudflareRecipeImageProviderError &&
      error.kind === kind &&
      error.message === 'Cloudflare recipe image generation did not complete.',
  );
}

test('recipe image provider interface requires a name and generateImage method', () => {
  const provider = providerWithFetch(async () =>
    response({ success: true, result: { image: TEST_JPEG.toString('base64') } }),
  );

  assert.equal(assertRecipeImageProvider(provider), provider);
  assert.throws(() => assertRecipeImageProvider(), /must be an object/u);
  assert.throws(() => assertRecipeImageProvider({ generateImage() {} }), /non-empty name/u);
  assert.throws(() => assertRecipeImageProvider({ name: 'broken' }), /generateImage/u);
});

test('Cloudflare adapter posts a prompt to the official Workers AI endpoint and decodes JPEG output', async () => {
  let capturedUrl;
  let capturedOptions;
  const signal = new AbortController().signal;
  const provider = providerWithFetch(async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return response({
      success: true,
      result: { image: TEST_JPEG.toString('base64') },
    });
  });

  const result = await provider.generateImage({
    prompt: '  Overhead photograph of a chickpea and spinach bowl  ',
    signal,
  });

  assert.equal(
    capturedUrl,
    'https://api.cloudflare.com/client/v4/accounts/test-account-id/ai/run/@cf/black-forest-labs/flux-1-schnell',
  );
  assert.equal(capturedOptions.method, 'POST');
  assert.equal(capturedOptions.headers.Accept, 'application/json');
  assert.equal(capturedOptions.headers.Authorization, 'Bearer test-server-only-token');
  assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(capturedOptions.body), {
    prompt: 'Overhead photograph of a chickpea and spinach bowl',
  });
  assert.equal(capturedOptions.signal, signal);
  assert.deepEqual(result, { bytes: TEST_JPEG, mimeType: 'image/jpeg' });
  assert.equal(
    JSON.stringify(JSON.parse(capturedOptions.body)).includes('test-server-only-token'),
    false,
  );
});

test('missing server configuration is rejected without making a network request', async () => {
  let requests = 0;
  const provider = createCloudflareRecipeImageProvider({
    accountId: '',
    apiToken: '',
    fetchImplementation: async () => {
      requests += 1;
      return response({});
    },
  });

  await expectProviderFailure(provider, 'missing_configuration');
  assert.equal(requests, 0);
});

test('rate limits, quota exhaustion, and transport failures use sanitized failure kinds', async () => {
  const scenarios = [
    {
      fetchImplementation: async () =>
        response(
          { success: false, errors: [{ message: 'Too many requests' }] },
          { ok: false, status: 429 },
        ),
      kind: 'rate_limited',
    },
    {
      fetchImplementation: async () =>
        response(
          {
            success: false,
            errors: [{ message: 'Daily allocation quota exhausted: secret details' }],
          },
          { ok: false, status: 429 },
        ),
      kind: 'quota',
    },
    {
      fetchImplementation: async () => {
        throw new Error('socket failed and test-server-only-token appeared here');
      },
      kind: 'unavailable',
    },
  ];

  for (const scenario of scenarios) {
    await expectProviderFailure(providerWithFetch(scenario.fetchImplementation), scenario.kind);
  }
});

test('an already-aborted or in-flight aborted request is classified as cancelled', async () => {
  let requests = 0;
  const beforeRequestController = new AbortController();
  beforeRequestController.abort();
  const provider = providerWithFetch(async () => {
    requests += 1;
    return response({});
  });

  await expectProviderFailure(provider, 'cancelled', {
    prompt: 'A bowl',
    signal: beforeRequestController.signal,
  });
  assert.equal(requests, 0);

  const duringRequestController = new AbortController();
  const abortingProvider = providerWithFetch(async (_url, options) => {
    duringRequestController.abort();
    assert.equal(options.signal, duringRequestController.signal);
    throw Object.assign(new Error('provider abort details'), { name: 'AbortError' });
  });
  await expectProviderFailure(abortingProvider, 'cancelled', {
    prompt: 'A bowl',
    signal: duringRequestController.signal,
  });
});

test('malformed base64, non-JPEG bytes, and oversized images are rejected', async () => {
  const malformedProvider = providerWithFetch(async () =>
    response({ success: true, result: { image: 'not base64!' } }),
  );
  await expectProviderFailure(malformedProvider, 'invalid_output');

  const pngProvider = providerWithFetch(async () =>
    response({
      success: true,
      result: { image: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64') },
    }),
  );
  await expectProviderFailure(pngProvider, 'invalid_output');

  const oversizedProvider = providerWithFetch(
    async () => response({ success: true, result: { image: TEST_JPEG.toString('base64') } }),
    { maximumImageBytes: TEST_JPEG.length - 1 },
  );
  await expectProviderFailure(oversizedProvider, 'invalid_output');
});

test('malformed success responses and provider response details never escape the adapter', async () => {
  const malformedJsonProvider = providerWithFetch(async () => ({
    ok: true,
    status: 200,
    async json() {
      throw new SyntaxError('private response payload and token');
    },
  }));
  await expectProviderFailure(malformedJsonProvider, 'invalid_output');

  const failedPayloadProvider = providerWithFetch(async () =>
    response({
      success: false,
      errors: [{ message: 'Internal provider secret response body' }],
    }),
  );

  await assert.rejects(failedPayloadProvider.generateImage({ prompt: 'A bowl' }), (error) => {
    assert.equal(error.kind, 'unavailable');
    assert.equal(error.message.includes('Internal provider secret'), false);
    assert.equal(JSON.stringify(error).includes('Internal provider secret'), false);
    assert.equal(JSON.stringify(error).includes('test-server-only-token'), false);
    return true;
  });
});
