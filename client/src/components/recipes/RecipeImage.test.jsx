import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RecipeImage } from './RecipeImage.jsx';

describe('RecipeImage', () => {
  it('renders a responsive lazy generated image from the API origin', () => {
    render(
      <RecipeImage
        title="Chickpea Curry"
        ingredients={{
          available: [{ name: 'chickpeas', optional: false }],
          additional: [{ name: 'tomato', optional: false }],
        }}
        image={{
          url: '/api/recipe-images/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
          alt: 'AI-generated serving of Chickpea Curry featuring chickpeas and tomato',
          kind: 'generated',
          provider: 'cloudflare',
          ingredientSignature: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        }}
      />,
    );

    const image = screen.getByRole('img', {
      name: 'AI-generated serving of Chickpea Curry featuring chickpeas and tomato',
    });
    expect(image.getAttribute('src')).toBe(
      'http://localhost:5000/api/recipe-images/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg',
    );
    expect(image.getAttribute('loading')).toBe('lazy');
    expect(image.getAttribute('crossorigin')).toBe('use-credentials');
    expect(screen.getByText('AI image from recipe ingredients')).toBeTruthy();
  });

  it('replaces missing or failed images with an honest ingredient-labelled fallback', () => {
    const ingredients = {
      available: [{ name: 'spinach', optional: false }],
      additional: [{ name: 'paneer', optional: false }],
    };
    const { rerender } = render(<RecipeImage title="Garden Bowl" ingredients={ingredients} />);
    expect(screen.getByRole('img', { name: 'No image available for Garden Bowl' })).toBeTruthy();
    expect(screen.getByText('Expected: spinach, paneer')).toBeTruthy();

    rerender(
      <RecipeImage
        title="Garden Bowl"
        ingredients={ingredients}
        image={{
          url: '/api/recipe-images/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.jpg',
          alt: 'AI-generated serving of Garden Bowl featuring spinach and paneer',
          kind: 'generated',
          provider: 'cloudflare',
          ingredientSignature: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        }}
      />,
    );
    fireEvent.error(
      screen.getByRole('img', {
        name: 'AI-generated serving of Garden Bowl featuring spinach and paneer',
      }),
    );
    expect(screen.getByRole('img', { name: 'No image available for Garden Bowl' })).toBeTruthy();
    expect(screen.queryByText('Representative serving')).toBeNull();
  });
});
