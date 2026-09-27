import { useRef, useState } from 'react';
import { Check, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';

import {
  RECIPE_INGREDIENT_LIMITS,
  RECIPE_UNIT_OPTIONS,
  addPastedRecipeIngredients,
  addRecipeIngredient,
  formatIngredientAmount,
  getIngredientNameKeyAction,
  parsePastedIngredientNames,
  removeRecipeIngredient,
  updateRecipeIngredient,
} from '../../utils/recipeIngredients.js';
import { Button } from '../ui/Button.jsx';

const emptyDraft = () => ({ name: '', quantity: '', unit: '' });

function withoutFieldError(errors, field) {
  const nextErrors = { ...errors };
  delete nextErrors[field];
  delete nextErrors.form;
  return nextErrors;
}

function IngredientFields({
  draft,
  errors,
  idPrefix,
  onChange,
  nameRef,
  autoFocus = false,
  disabled = false,
  onNameKeyDown,
  onNamePaste,
}) {
  const nameErrorId = `${idPrefix}-name-error`;
  const quantityErrorId = `${idPrefix}-quantity-error`;
  const unitErrorId = `${idPrefix}-unit-error`;

  function updateField(field, value) {
    onChange({
      ...draft,
      [field]: value,
      ...(field === 'quantity' && value === '' ? { unit: '' } : {}),
    });
  }

  return (
    <div className="recipe-ingredient-fields">
      <label className="recipe-ingredient-field recipe-ingredient-name-field">
        <span>Ingredient</span>
        <input
          ref={nameRef}
          id={`${idPrefix}-name`}
          type="text"
          value={draft.name}
          maxLength={RECIPE_INGREDIENT_LIMITS.maximumNameLength + 1}
          placeholder="e.g. chickpeas"
          autoComplete="off"
          autoCapitalize="sentences"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? nameErrorId : undefined}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(event) => updateField('name', event.target.value)}
          onKeyDown={onNameKeyDown}
          onPaste={onNamePaste}
        />
        {errors.name && (
          <span className="recipe-field-error" id={nameErrorId}>
            {errors.name}
          </span>
        )}
      </label>

      <label className="recipe-ingredient-field">
        <span>
          Quantity <small>optional</small>
        </span>
        <input
          id={`${idPrefix}-quantity`}
          type="number"
          value={draft.quantity}
          min="0"
          max={RECIPE_INGREDIENT_LIMITS.maximumQuantity}
          step="any"
          inputMode="decimal"
          placeholder="e.g. 2"
          aria-invalid={Boolean(errors.quantity)}
          aria-describedby={errors.quantity ? quantityErrorId : undefined}
          disabled={disabled}
          onChange={(event) => updateField('quantity', event.target.value)}
        />
        {errors.quantity && (
          <span className="recipe-field-error" id={quantityErrorId}>
            {errors.quantity}
          </span>
        )}
      </label>

      <label className="recipe-ingredient-field">
        <span>
          Unit <small>optional</small>
        </span>
        <select
          id={`${idPrefix}-unit`}
          value={draft.unit}
          aria-invalid={Boolean(errors.unit)}
          aria-describedby={errors.unit ? unitErrorId : undefined}
          disabled={disabled || draft.quantity === ''}
          onChange={(event) => updateField('unit', event.target.value)}
        >
          <option value="">No unit</option>
          {RECIPE_UNIT_OPTIONS.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.label}
            </option>
          ))}
        </select>
        {errors.unit && (
          <span className="recipe-field-error" id={unitErrorId}>
            {errors.unit}
          </span>
        )}
      </label>
    </div>
  );
}

function pasteSummaryMessage({ added, duplicates, invalid, overLimit }) {
  const details = [];
  if (duplicates) details.push(`${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped`);
  if (invalid) details.push(`${invalid} invalid ${invalid === 1 ? 'name' : 'names'} skipped`);
  if (overLimit) details.push(`${overLimit} over the list limit`);
  const addedMessage = added
    ? `Added ${added} ingredient${added === 1 ? '' : 's'}.`
    : 'No ingredients were added.';
  return details.length ? `${addedMessage} ${details.join(', ')}.` : addedMessage;
}

export function IngredientEditor({ ingredients, onChange }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [errors, setErrors] = useState({});
  const [editingIndex, setEditingIndex] = useState(null);
  const [editDraft, setEditDraft] = useState(emptyDraft);
  const [editErrors, setEditErrors] = useState({});
  const [status, setStatus] = useState('');
  const addNameRef = useRef(null);

  const isEditing = editingIndex !== null;

  function updateDraft(nextDraft) {
    const changedFields = Object.keys(nextDraft).filter(
      (field) => nextDraft[field] !== draft[field],
    );
    setDraft(nextDraft);
    setErrors((current) =>
      changedFields.reduce((next, field) => withoutFieldError(next, field), current),
    );
  }

  function updateEditDraft(nextDraft) {
    const changedFields = Object.keys(nextDraft).filter(
      (field) => nextDraft[field] !== editDraft[field],
    );
    setEditDraft(nextDraft);
    setEditErrors((current) =>
      changedFields.reduce((next, field) => withoutFieldError(next, field), current),
    );
  }

  function focusAddField() {
    window.requestAnimationFrame(() => addNameRef.current?.focus());
  }

  function handleAdd(event) {
    event.preventDefault();
    if (isEditing) return;

    const result = addRecipeIngredient(ingredients, draft);
    setErrors(result.errors);
    if (result.ingredients === ingredients) return;

    const addedIngredient = result.ingredients.at(-1);
    onChange(result.ingredients);
    setDraft(emptyDraft());
    setStatus(`Added ${addedIngredient.name}.`);
    focusAddField();
  }

  function handlePaste(event) {
    if (isEditing || draft.name || draft.quantity || draft.unit) return;
    const text = event.clipboardData.getData('text');
    const names = parsePastedIngredientNames(text);
    if (names.length < 2 && !/[,;\r\n]/u.test(text)) return;

    event.preventDefault();
    const result = addPastedRecipeIngredients(ingredients, text);
    if (result.summary.added > 0) onChange(result.ingredients);
    const message = pasteSummaryMessage(result.summary);
    setStatus(message);
    setErrors(result.summary.added === 0 ? { form: message } : {});
  }

  function handleAddNameKeyDown(event) {
    const action = getIngredientNameKeyAction({
      key: event.key,
      name: draft.name,
      ingredientCount: ingredients.length,
    });

    if (action === 'clear-draft') {
      event.preventDefault();
      setDraft(emptyDraft());
      setErrors({});
      setStatus('Ingredient fields cleared.');
    }

    if (action === 'remove-last' && !draft.quantity && !draft.unit && !isEditing) {
      event.preventDefault();
      const removed = ingredients.at(-1);
      onChange(removeRecipeIngredient(ingredients, ingredients.length - 1));
      setStatus(`Removed ${removed.name}.`);
    }
  }

  function beginEdit(index) {
    const ingredient = ingredients[index];
    setEditingIndex(index);
    setEditDraft({
      name: ingredient.name,
      quantity: ingredient.quantity ?? '',
      unit: ingredient.unit ?? '',
    });
    setEditErrors({});
    setErrors({});
    setStatus(`Editing ${ingredient.name}.`);
  }

  function cancelEdit() {
    const ingredient = ingredients[editingIndex];
    setEditingIndex(null);
    setEditDraft(emptyDraft());
    setEditErrors({});
    setStatus(ingredient ? `Cancelled changes to ${ingredient.name}.` : 'Edit cancelled.');
    focusAddField();
  }

  function saveEdit(event) {
    event.preventDefault();
    const previousName = ingredients[editingIndex]?.name;
    const result = updateRecipeIngredient(ingredients, editingIndex, editDraft);
    setEditErrors(result.errors);
    if (result.ingredients === ingredients) return;

    const updatedName = result.ingredients[editingIndex].name;
    onChange(result.ingredients);
    setEditingIndex(null);
    setEditDraft(emptyDraft());
    setStatus(`Updated ${previousName} to ${updatedName}.`);
    focusAddField();
  }

  function removeIngredient(index) {
    const removed = ingredients[index];
    const nextIngredients = removeRecipeIngredient(ingredients, index);
    onChange(nextIngredients);

    if (editingIndex === index) {
      setEditingIndex(null);
      setEditDraft(emptyDraft());
      setEditErrors({});
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }

    setStatus(`Removed ${removed.name}.`);
    focusAddField();
  }

  function clearAll() {
    onChange([]);
    setEditingIndex(null);
    setEditDraft(emptyDraft());
    setEditErrors({});
    setErrors({});
    setStatus('Cleared the ingredient list.');
    focusAddField();
  }

  return (
    <div className="recipe-ingredient-editor">
      <form className="recipe-add-ingredient-form" noValidate onSubmit={handleAdd}>
        <IngredientFields
          draft={draft}
          errors={errors}
          idPrefix="recipe-add"
          nameRef={addNameRef}
          disabled={isEditing}
          onNameKeyDown={handleAddNameKeyDown}
          onNamePaste={handlePaste}
          onChange={updateDraft}
        />
        <div className="recipe-add-actions">
          <Button type="submit" disabled={isEditing}>
            <Plus size={17} aria-hidden="true" /> Add ingredient
          </Button>
          <p>
            Press Enter to add. Paste names separated by commas or new lines. With an empty name,
            Backspace removes the last item.
          </p>
        </div>
        {errors.form && (
          <p className="recipe-form-error" role="alert">
            {errors.form}
          </p>
        )}
      </form>

      <div className="recipe-ingredient-list-heading">
        <div>
          <h3>Available ingredients</h3>
          <p>
            {ingredients.length} of {RECIPE_INGREDIENT_LIMITS.maximumItems} added
          </p>
        </div>
        {ingredients.length > 0 && (
          <Button type="button" variant="ghost" onClick={clearAll}>
            <RotateCcw size={15} aria-hidden="true" /> Clear all
          </Button>
        )}
      </div>

      {ingredients.length === 0 ? (
        <div className="recipe-ingredient-list-empty">
          <p>No ingredients yet. Start with what is already in your kitchen.</p>
        </div>
      ) : (
        <ul className="recipe-ingredient-list" aria-label="Available ingredients">
          {ingredients.map((ingredient, index) => (
            <li key={`${ingredient.name}-${index}`}>
              {editingIndex === index ? (
                <form
                  className="recipe-ingredient-edit-form"
                  noValidate
                  onSubmit={saveEdit}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelEdit();
                    }
                  }}
                >
                  <IngredientFields
                    draft={editDraft}
                    errors={editErrors}
                    idPrefix={`recipe-edit-${index}`}
                    autoFocus
                    onChange={updateEditDraft}
                  />
                  <div className="recipe-edit-actions">
                    <Button type="submit">
                      <Check size={16} aria-hidden="true" /> Save changes
                    </Button>
                    <Button type="button" variant="secondary" onClick={cancelEdit}>
                      <X size={16} aria-hidden="true" /> Cancel
                    </Button>
                  </div>
                  {editErrors.form && (
                    <p className="recipe-form-error" role="alert">
                      {editErrors.form}
                    </p>
                  )}
                </form>
              ) : (
                <div className="recipe-ingredient-chip">
                  <span className="recipe-ingredient-number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="recipe-ingredient-copy">
                    <strong>{ingredient.name}</strong>
                    <small>{formatIngredientAmount(ingredient)}</small>
                  </span>
                  <span className="recipe-ingredient-actions">
                    <button
                      type="button"
                      className="recipe-icon-button"
                      aria-label={`Edit ${ingredient.name}`}
                      disabled={isEditing}
                      onClick={() => beginEdit(index)}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="recipe-icon-button recipe-icon-button-danger"
                      aria-label={`Remove ${ingredient.name}`}
                      disabled={isEditing}
                      onClick={() => removeIngredient(index)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </p>
    </div>
  );
}
