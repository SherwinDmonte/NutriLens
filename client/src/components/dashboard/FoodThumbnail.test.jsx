import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FoodThumbnail } from './FoodThumbnail.jsx';

describe('FoodThumbnail', () => {
  it('lazy-loads a supplied product image inside a stable thumbnail', () => {
    const { container } = render(
      <FoodThumbnail
        food={{
          name: 'Masala oats',
          imageUrl: 'https://images.openfoodfacts.org/images/products/oats.200.jpg',
        }}
      />,
    );

    const image = container.querySelector('img');
    expect(image?.getAttribute('loading')).toBe('lazy');
    expect(image?.getAttribute('decoding')).toBe('async');
    expect(image?.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('replaces a failed remote image with a category illustration', () => {
    const { container } = render(
      <FoodThumbnail
        food={{
          name: 'Paneer',
          category: 'dairy',
          imageUrl: 'https://images.openfoodfacts.org/missing.jpg',
        }}
      />,
    );

    fireEvent.error(container.querySelector('img'));

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.food-thumbnail--dairy svg')).not.toBeNull();
  });

  it('gives packaged foods without photos a package illustration', () => {
    const { container } = render(
      <FoodThumbnail food={{ name: 'Packaged food', source: { provider: 'open_food_facts' } }} />,
    );

    expect(container.querySelector('.food-thumbnail--packaged svg')).not.toBeNull();
  });
});
