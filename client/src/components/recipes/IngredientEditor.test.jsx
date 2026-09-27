import assert from 'node:assert/strict';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it } from 'vitest';

import {
  RECIPE_INGREDIENT_LIMITS,
  toRecipeIngredientRequest,
} from '../../utils/recipeIngredients.js';
import { IngredientEditor } from './IngredientEditor.jsx';

function IngredientEditorHarness({ initialIngredients = [] }) {
  const [ingredients, setIngredients] = useState(initialIngredients);

  return (
    <>
      <IngredientEditor ingredients={ingredients} onChange={setIngredients} />
      <output data-testid="request-model">
        {JSON.stringify(toRecipeIngredientRequest(ingredients))}
      </output>
    </>
  );
}

function requestModel() {
  return JSON.parse(screen.getByTestId('request-model').textContent);
}

describe('IngredientEditor', () => {
  it('adds a normalized ingredient with pointer controls and rejects a duplicate non-destructively', async () => {
    const user = userEvent.setup();
    render(<IngredientEditorHarness />);

    const nameInput = screen.getByLabelText(/^Ingredient$/i);
    await user.type(nameInput, '  Brown   Rice  ');
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));

    assert.deepEqual(requestModel(), [{ name: 'brown rice' }]);
    assert.ok(screen.getByRole('button', { name: /edit brown rice/i }));
    assert.ok(screen.getByRole('button', { name: /remove brown rice/i }));

    await user.type(nameInput, 'BROWN RICE');
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));

    assert.match(screen.getByText(/already in your list/i).textContent, /edit the existing/i);
    assert.equal(nameInput.value, 'BROWN RICE');
    assert.deepEqual(requestModel(), [{ name: 'brown rice' }]);
  });

  it('keeps quantity optional and sends canonical quantity and unit values to the request model', async () => {
    const user = userEvent.setup();
    render(<IngredientEditorHarness />);

    const unitSelect = screen.getByLabelText(/Unit/i);
    assert.equal(unitSelect.disabled, true);

    await user.type(screen.getByLabelText(/^Ingredient$/i), 'Chickpeas');
    await user.type(screen.getByLabelText(/Quantity/i), '2.5');
    assert.equal(unitSelect.disabled, false);
    await user.selectOptions(unitSelect, 'cup');
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));

    assert.deepEqual(requestModel(), [{ name: 'chickpeas', quantity: 2.5, unit: 'cup' }]);
    assert.ok(screen.getByText('2.5 cups'));
  });

  it('supports Enter submission, Escape clearing, and Backspace removal from an empty name field', async () => {
    const user = userEvent.setup();
    render(<IngredientEditorHarness />);

    const nameInput = screen.getByLabelText(/^Ingredient$/i);
    await user.type(nameInput, 'Tomato{Enter}');
    assert.deepEqual(requestModel(), [{ name: 'tomato' }]);

    await user.type(nameInput, 'temporary{Escape}');
    assert.equal(nameInput.value, '');
    assert.deepEqual(requestModel(), [{ name: 'tomato' }]);

    await user.type(nameInput, '{Backspace}');
    assert.deepEqual(requestModel(), []);
    assert.ok(screen.getByText(/no ingredients yet/i));
  });

  it('adds comma and newline separated pasted names while reporting duplicate and invalid entries', () => {
    render(<IngredientEditorHarness initialIngredients={[{ name: 'tomato' }]} />);

    const nameInput = screen.getByLabelText(/^Ingredient$/i);
    fireEvent.paste(nameInput, {
      clipboardData: {
        getData: () => 'Tomato, spinach\n<script>, chickpeas',
      },
    });

    assert.deepEqual(requestModel(), [
      { name: 'tomato' },
      { name: 'spinach' },
      { name: 'chickpeas' },
    ]);
    const announcement = screen.getByText(/Added 2 ingredients/i);
    assert.match(announcement.textContent, /1 duplicate skipped/i);
    assert.match(announcement.textContent, /1 invalid name skipped/i);
  });

  it('edits an item, preserves invalid edit data, and prevents adding while an edit is open', async () => {
    const user = userEvent.setup();
    render(
      <IngredientEditorHarness initialIngredients={[{ name: 'tomato' }, { name: 'spinach' }]} />,
    );

    await user.click(screen.getByRole('button', { name: /edit spinach/i }));
    assert.equal(screen.getByRole('button', { name: /add ingredient/i }).disabled, true);

    const editItem = screen.getByRole('button', { name: /save changes/i }).closest('li');
    const editName = within(editItem).getByLabelText(/^Ingredient$/i);
    await user.clear(editName);
    await user.type(editName, 'Tomato');
    await user.click(within(editItem).getByRole('button', { name: /save changes/i }));

    assert.match(
      within(editItem).getByText(/already in your list/i).textContent,
      /different name/i,
    );
    assert.equal(editName.value, 'Tomato');
    assert.deepEqual(requestModel(), [{ name: 'tomato' }, { name: 'spinach' }]);

    await user.clear(editName);
    await user.type(editName, 'Kale');
    await user.click(within(editItem).getByRole('button', { name: /save changes/i }));
    assert.deepEqual(requestModel(), [{ name: 'tomato' }, { name: 'kale' }]);
  });

  it('enforces the 20-item limit and clears the list with an explicit pointer action', async () => {
    const user = userEvent.setup();
    const initialIngredients = Array.from(
      { length: RECIPE_INGREDIENT_LIMITS.maximumItems },
      (_, index) => ({ name: `ingredient ${index + 1}` }),
    );
    render(<IngredientEditorHarness initialIngredients={initialIngredients} />);

    await user.type(screen.getByLabelText(/^Ingredient$/i), 'one more');
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));

    assert.match(screen.getByRole('alert').textContent, /up to 20 ingredients/i);
    assert.equal(requestModel().length, 20);

    await user.click(screen.getByRole('button', { name: /clear all/i }));
    assert.deepEqual(requestModel(), []);
  });

  it('exposes labels, list semantics, invalid state, and descriptive edit/remove controls', async () => {
    const user = userEvent.setup();
    render(<IngredientEditorHarness initialIngredients={[{ name: 'oats' }]} />);

    assert.ok(screen.getByRole('list', { name: /available ingredients/i }));
    assert.ok(screen.getByRole('button', { name: /edit oats/i }));
    assert.ok(screen.getByRole('button', { name: /remove oats/i }));

    const nameInput = screen.getByLabelText(/^Ingredient$/i);
    await user.click(screen.getByRole('button', { name: /add ingredient/i }));
    assert.equal(nameInput.getAttribute('aria-invalid'), 'true');
    assert.ok(nameInput.getAttribute('aria-describedby'));
    assert.equal(
      document.getElementById(nameInput.getAttribute('aria-describedby')).textContent,
      'Enter an ingredient name.',
    );
  });
});
