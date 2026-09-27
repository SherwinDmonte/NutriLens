import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AppError } from '../utils/AppError.js';

export const RECIPE_IMAGE_SIGNATURE_PATTERN = /^[a-f0-9]{64}$/u;
export const DEFAULT_RECIPE_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const DEFAULT_RECIPE_IMAGE_CACHE_ROOT = fileURLToPath(
  new URL('../../storage/recipe-images/', import.meta.url),
);

function invalidSignatureError() {
  return new AppError(
    400,
    'INVALID_RECIPE_IMAGE_SIGNATURE',
    'Recipe image signature must be a lowercase 64-character hexadecimal value.',
  );
}

function invalidImageError() {
  return new AppError(
    400,
    'INVALID_RECIPE_IMAGE_DATA',
    'Recipe image data must use the expected bounded JPEG byte format.',
  );
}

function assertPositiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer.`);
  }
}

function imagePath(cacheRoot, signature) {
  return resolve(cacheRoot, `${signature}.jpg`);
}

function normalizeJpegBytes(imageBytes) {
  if (!Buffer.isBuffer(imageBytes) && !(imageBytes instanceof Uint8Array)) {
    throw invalidImageError();
  }

  const bytes = Buffer.from(imageBytes);
  const hasJpegMarkers =
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9;

  if (!hasJpegMarkers) throw invalidImageError();
  return bytes;
}

async function removeTemporaryFile(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export function isRecipeImageSignature(value) {
  return typeof value === 'string' && RECIPE_IMAGE_SIGNATURE_PATTERN.test(value);
}

export function assertRecipeImageSignature(value) {
  if (!isRecipeImageSignature(value)) throw invalidSignatureError();
  return value;
}

export function createRecipeImageStorageService({
  cacheRoot = DEFAULT_RECIPE_IMAGE_CACHE_ROOT,
  maxImageBytes = DEFAULT_RECIPE_IMAGE_MAX_BYTES,
} = {}) {
  if (typeof cacheRoot !== 'string' || cacheRoot.trim().length === 0) {
    throw new TypeError('cacheRoot must be a non-empty path string.');
  }
  assertPositiveInteger(maxImageBytes, 'maxImageBytes');

  const resolvedCacheRoot = resolve(cacheRoot);

  async function read(signature) {
    assertRecipeImageSignature(signature);
    const path = imagePath(resolvedCacheRoot, signature);

    let fileStats;
    try {
      fileStats = await stat(path);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }

    if (!fileStats.isFile()) return null;
    if (fileStats.size > maxImageBytes) {
      throw new AppError(
        500,
        'RECIPE_IMAGE_CACHE_INVALID',
        'The cached recipe image could not be read safely.',
      );
    }

    const bytes = await readFile(path);
    if (bytes.byteLength > maxImageBytes) {
      throw new AppError(
        500,
        'RECIPE_IMAGE_CACHE_INVALID',
        'The cached recipe image could not be read safely.',
      );
    }
    try {
      return normalizeJpegBytes(bytes);
    } catch (error) {
      if (error instanceof AppError) {
        throw new AppError(
          500,
          'RECIPE_IMAGE_CACHE_INVALID',
          'The cached recipe image could not be read safely.',
        );
      }
      throw error;
    }
  }

  async function write(signature, imageBytes) {
    assertRecipeImageSignature(signature);
    const bytes = normalizeJpegBytes(imageBytes);
    if (bytes.byteLength > maxImageBytes) {
      throw new AppError(
        413,
        'RECIPE_IMAGE_TOO_LARGE',
        `Recipe images must not exceed ${maxImageBytes} bytes.`,
      );
    }

    await mkdir(resolvedCacheRoot, { recursive: true });
    const path = imagePath(resolvedCacheRoot, signature);
    const temporaryPath = resolve(resolvedCacheRoot, `.${signature}.${randomUUID()}.tmp`);

    try {
      await writeFile(temporaryPath, bytes, { flag: 'wx', mode: 0o600 });
      await rename(temporaryPath, path);
    } finally {
      await removeTemporaryFile(temporaryPath);
    }
  }

  return Object.freeze({
    cacheRoot: resolvedCacheRoot,
    maxImageBytes,
    read,
    write,
  });
}

export const recipeImageStorageService = createRecipeImageStorageService();
