import assert from 'node:assert/strict';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { recipeFixture, recipeResponseDataFixture } from '../../test/recipeFixtures.js';
import { RecipeResults } from './RecipeResults.jsx';

describe('RecipeResults', () => {
  it('renders understandable cards with match, time, servings, nutrition, and ingredient groups', () => {
    render(<RecipeResults data={recipeResponseDataFixture} />);

    assert.ok(screen.getByText(recipeFixture.title));
    assert.ok(screen.getByText(recipeFixture.summary));
    assert.ok(screen.getByRole('img', { name: recipeFixture.image.alt }));
    assert.ok(screen.getByLabelText('91 percent recipe match'));
    assert.ok(screen.getByText('35 min'));
    assert.ok(screen.getByText(recipeFixture.match.reason, { exact: false }));
    assert.ok(screen.getByLabelText(/estimated nutrition per serving/i));
    assert.ok(screen.getByLabelText(/already available for this recipe/i));
    assert.ok(screen.getByLabelText(/additional ingredients for this recipe/i));
    assert.ok(screen.getByRole('button', { name: `View full recipe: ${recipeFixture.title}` }));
  });

  it('shows an explicit reason when Gemini safely falls back to bundled recipes', () => {
    render(
      <RecipeResults
        data={{
          ...recipeResponseDataFixture,
          provider: {
            requested: 'gemini',
            used: 'bundled',
            fallbackUsed: true,
            fallbackReason: 'quota_exhausted',
          },
        }}
      />,
    );

    assert.ok(screen.getByText(/gemini free quota exhausted/i));
    assert.ok(screen.getByText(/bundled provider supplied these recommendations/i));
  });

  it('shows the exact server-applied criteria and dietary classification with the results', () => {
    render(
      <RecipeResults
        data={recipeResponseDataFixture}
        request={{
          dietaryPreference: 'vegan',
          goal: 'high-protein',
          mealType: 'dinner',
          maxCaloriesPerServing: 500,
          maxTotalTimeMinutes: 30,
          resultCount: 4,
        }}
      />,
    );

    const summary = screen.getByLabelText(/criteria applied to these results/i);
    assert.ok(within(summary).getByText('Vegan'));
    assert.ok(within(summary).getByText('Higher protein ranking'));
    assert.ok(within(summary).getByText('Dinner only'));
    assert.ok(within(summary).getByText('Up to 500 kcal'));
    assert.ok(within(summary).getByText('Up to 30 min'));
    assert.ok(screen.getAllByText('Vegetarian').length >= 1);
  });

  it('saves a recommendation explicitly and shows an existing saved state', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(
      <RecipeResults
        data={recipeResponseDataFixture}
        onSave={onSave}
        savedRecipeSourceIds={new Set()}
        savingRecipeIds={[]}
      />,
    );

    await user.click(screen.getByRole('button', { name: `Save recipe: ${recipeFixture.title}` }));
    expect(onSave).toHaveBeenCalledWith(recipeFixture, recipeResponseDataFixture.provider);

    rerender(
      <RecipeResults
        data={recipeResponseDataFixture}
        onSave={onSave}
        savedRecipeSourceIds={new Set([recipeFixture.id])}
        savingRecipeIds={[]}
      />,
    );
    expect(
      screen.getByRole('button', { name: `Recipe saved: ${recipeFixture.title}` }).disabled,
    ).toBe(true);
  });

  it('opens complete details, explains every score component, and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(<RecipeResults data={recipeResponseDataFixture} />);
    const trigger = screen.getByRole('button', {
      name: `View full recipe: ${recipeFixture.title}`,
    });
    trigger.focus();
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog');
    assert.ok(
      within(dialog).getByRole('img', {
        name: recipeFixture.image.alt,
      }),
    );
    assert.ok(within(dialog).getByText(/estimated nutrition per serving/i));
    assert.ok(within(dialog).getByText(/not a medical or health score/i));
    assert.equal(within(dialog).getAllByRole('progressbar').length, 5);
    assert.ok(within(dialog).getByText('200 g'));
    assert.ok(within(dialog).getByText('2 pieces'));
    assert.ok(within(dialog).getByText(recipeFixture.steps[1].instruction));
    assert.ok(within(dialog).getByText(/nutrilens-bundled-ingredients/i));

    await user.click(within(dialog).getByRole('button', { name: /close recipe/i }));
    await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
    await waitFor(() => assert.equal(document.activeElement, trigger));
  });

  it('closes with the native cancel event and returns focus to the opening card', async () => {
    const user = userEvent.setup();
    render(<RecipeResults data={recipeResponseDataFixture} />);
    const trigger = screen.getByRole('button', { name: /view full recipe/i });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');

    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    await waitFor(() => assert.equal(screen.queryByRole('dialog'), null));
    await waitFor(() => assert.equal(document.activeElement, trigger));
  });

  it('keeps edge-length content, unknown nutrition, and missing optional classifications readable', async () => {
    const user = userEvent.setup();
    const longTitle = `Garden Bowl ${'with seasonal vegetables '.repeat(4)}`.trim();
    const longStep =
      `Carefully prepare every ingredient. ${'Continue gently and check the texture. '.repeat(8)}`.trim();
    const edgeRecipe = {
      ...recipeFixture,
      id: 'edge-content',
      title: longTitle,
      summary: 'A detailed recipe summary that remains available in the full detail view.',
      dietaryTags: [],
      ingredients: {
        available: [
          {
            name: 'seasonal vegetables',
            quantity: null,
            unit: null,
            optional: true,
            matchedInputName: 'seasonal vegetables',
          },
        ],
        additional: [],
      },
      steps: [{ number: 1, instruction: longStep }],
      nutritionPerServing: {
        ...recipeFixture.nutritionPerServing,
        coveragePercent: 72,
        unmatchedIngredients: ['seasonal vegetables'],
        confidence: { score: 68, level: 'medium' },
        assumptions: [],
      },
    };
    render(<RecipeResults data={{ ...recipeResponseDataFixture, recipes: [edgeRecipe] }} />);

    assert.ok(screen.getByText(longTitle));
    await user.click(screen.getByRole('button', { name: `View full recipe: ${longTitle}` }));
    const dialog = await screen.findByRole('dialog');
    assert.ok(within(dialog).getByText('Amount as needed'));
    assert.ok(within(dialog).getByText('No dietary classification'));
    assert.ok(within(dialog).getByText('No additional ingredients are needed.'));
    assert.ok(within(dialog).getByText(longStep));
    assert.ok(within(dialog).getByText(/not included in the estimate/i));
    assert.ok(within(dialog).getByText(/72% ingredient coverage/i));
  });
});
