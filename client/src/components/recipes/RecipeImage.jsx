import { ImageIcon } from 'lucide-react';
import { useState } from 'react';

import { API_BASE_URL } from '../../services/api.js';

function resolvedImageUrl(value) {
  if (!value) return '';
  if (!value.startsWith('/api/')) return value;

  const apiOrigin = new URL(API_BASE_URL, window.location.origin).origin;
  return new URL(value, apiOrigin).toString();
}

function visibleIngredientNames(ingredients) {
  const available = ingredients?.available || [];
  const additional = ingredients?.additional || [];
  return [...available, ...additional]
    .filter((ingredient) => !ingredient.optional)
    .map((ingredient) => ingredient.name)
    .slice(0, 3);
}

export function RecipeImage({ image, title, ingredients, variant = 'card' }) {
  const [failedImageUrl, setFailedImageUrl] = useState('');
  const imageUrl = resolvedImageUrl(image?.url || '');
  const ingredientNames = visibleIngredientNames(ingredients);
  const label =
    image?.kind === 'generated'
      ? 'AI image from recipe ingredients'
      : 'Ingredient image unavailable';
  const imageLoaded = imageUrl && failedImageUrl !== imageUrl;

  return (
    <figure
      className={`recipe-image recipe-image-${variant}${imageLoaded ? '' : ' recipe-image-unavailable'}`}
    >
      {imageLoaded ? (
        <img
          src={imageUrl}
          alt={image.alt || `AI-generated serving of ${title}`}
          loading="lazy"
          decoding="async"
          crossOrigin={image.kind === 'generated' ? 'use-credentials' : undefined}
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        <div
          className="recipe-image-fallback"
          role="img"
          aria-label={`No image available for ${title}`}
        >
          <ImageIcon size={28} aria-hidden="true" />
          <strong>Ingredient image unavailable</strong>
          <span>
            {ingredientNames.length
              ? `Expected: ${ingredientNames.join(', ')}`
              : 'The recipe remains available below.'}
          </span>
        </div>
      )}
      <figcaption>{label}</figcaption>
    </figure>
  );
}
