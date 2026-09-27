import assert from 'node:assert/strict';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, it, vi } from 'vitest';

import { LandingNutritionVideo } from './LandingNutritionVideo.jsx';

function setMotionPreference(matches) {
  window.matchMedia = vi.fn(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('LandingNutritionVideo', () => {
  let intersectionCallback;

  beforeEach(() => {
    intersectionCallback = undefined;
    setMotionPreference(false);
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: false },
    });
    window.IntersectionObserver = class IntersectionObserver {
      constructor(callback) {
        intersectionCallback = callback;
      }

      observe() {}

      disconnect() {}
    };
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('defers the video source until the section approaches the viewport', async () => {
    const user = userEvent.setup();
    const { container } = render(<LandingNutritionVideo />);
    const video = container.querySelector('video');

    assert.equal(video.getAttribute('src'), null);

    act(() => intersectionCallback([{ isIntersecting: true }]));

    await waitFor(() =>
      assert.equal(video.getAttribute('src'), '/media/nutrilens-fresh-salad.mp4'),
    );
    assert.ok(screen.getByRole('button', { name: /pause food video/i }));

    await user.click(screen.getByRole('button', { name: /pause food video/i }));

    assert.equal(window.HTMLMediaElement.prototype.pause.mock.calls.length > 0, true);
    assert.ok(screen.getByRole('button', { name: /play food video/i }));
  });

  it('keeps a static poster when reduced motion is requested', () => {
    setMotionPreference(true);
    const { container } = render(<LandingNutritionVideo />);

    assert.equal(container.querySelector('video').getAttribute('src'), null);
    assert.ok(screen.getByText('Static preview'));
    assert.equal(screen.queryByRole('button', { name: /food video/i }), null);
  });
});
