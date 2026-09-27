import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createRecipeImageStorageService } from '../src/services/recipeImageStorageService.js';

const SIGNATURE = 'a'.repeat(64);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x4e, 0x4c, 0xff, 0xd9]);

async function temporaryCache(t) {
  const cacheRoot = await mkdtemp(join(tmpdir(), 'nutrilens-recipe-images-'));
  t.after(async () => rm(cacheRoot, { recursive: true, force: true }));
  return cacheRoot;
}

test('recipe image storage writes and reads JPEG bytes by immutable signature', async (t) => {
  const cacheRoot = await temporaryCache(t);
  const storage = createRecipeImageStorageService({ cacheRoot });

  const written = await storage.write(SIGNATURE, JPEG_BYTES);

  assert.equal(written, undefined);
  assert.deepEqual(await storage.read(SIGNATURE), JPEG_BYTES);
  assert.deepEqual(await readFile(join(cacheRoot, `${SIGNATURE}.jpg`)), JPEG_BYTES);
  assert.deepEqual(await readdir(cacheRoot), [`${SIGNATURE}.jpg`]);
});

test('recipe image storage returns null for a cache miss', async (t) => {
  const storage = createRecipeImageStorageService({ cacheRoot: await temporaryCache(t) });
  assert.equal(await storage.read(SIGNATURE), null);
});

test('recipe image storage rejects unsafe signatures and non-JPEG input', async (t) => {
  const storage = createRecipeImageStorageService({ cacheRoot: await temporaryCache(t) });

  await assert.rejects(storage.read('../outside'), {
    code: 'INVALID_RECIPE_IMAGE_SIGNATURE',
    statusCode: 400,
  });
  await assert.rejects(storage.write('A'.repeat(64), JPEG_BYTES), {
    code: 'INVALID_RECIPE_IMAGE_SIGNATURE',
    statusCode: 400,
  });
  await assert.rejects(storage.write(SIGNATURE, Buffer.from('not a jpeg')), {
    code: 'INVALID_RECIPE_IMAGE_DATA',
    statusCode: 400,
  });
});

test('recipe image storage enforces the configured byte limit before writing', async (t) => {
  const cacheRoot = await temporaryCache(t);
  const storage = createRecipeImageStorageService({ cacheRoot, maxImageBytes: 7 });

  await assert.rejects(storage.write(SIGNATURE, JPEG_BYTES), {
    code: 'RECIPE_IMAGE_TOO_LARGE',
    statusCode: 413,
  });
  assert.deepEqual(await readdir(cacheRoot), []);
});

test('recipe image storage fails closed for a corrupt cached file', async (t) => {
  const cacheRoot = await temporaryCache(t);
  await writeFile(join(cacheRoot, `${SIGNATURE}.jpg`), 'corrupt');
  const storage = createRecipeImageStorageService({ cacheRoot });

  await assert.rejects(storage.read(SIGNATURE), {
    code: 'RECIPE_IMAGE_CACHE_INVALID',
    statusCode: 500,
  });
});
