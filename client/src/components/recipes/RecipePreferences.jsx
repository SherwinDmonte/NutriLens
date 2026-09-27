import { useState } from 'react';
import { ChevronDown, LoaderCircle, Search, SlidersHorizontal, X } from 'lucide-react';

import {
  DIETARY_OPTIONS,
  RECIPE_FILTER_LIMITS,
  RECIPE_GOAL_OPTIONS,
  RECIPE_MEAL_OPTIONS,
  countAdvancedRecipePreferences,
  getRecipeCriteria,
} from '../../utils/recipeRecommendationForm.js';
import { Button } from '../ui/Button.jsx';

function SelectField({ id, label, kind, hint, value, options, error, onChange }) {
  const messageId = `${id}-message`;
  return (
    <label className="recipe-preference-field" htmlFor={id}>
      <span>
        {label} <small>{kind}</small>
      </span>
      <select
        id={id}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={messageId}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <small className={error ? 'recipe-preference-error' : ''} id={messageId}>
        {error || hint}
      </small>
    </label>
  );
}

function NumberField({ id, label, kind = 'Hard filter', hint, value, min, max, error, onChange }) {
  const messageId = `${id}-message`;
  return (
    <label className="recipe-preference-field" htmlFor={id}>
      <span>
        {label} <small>{kind}</small>
      </span>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step="1"
        value={value}
        placeholder="No limit"
        aria-invalid={Boolean(error)}
        aria-describedby={messageId}
        onChange={(event) => onChange(event.target.value)}
      />
      <small className={error ? 'recipe-preference-error' : ''} id={messageId}>
        {error || hint}
      </small>
    </label>
  );
}

export function RecipePreferences({
  preferences,
  errors,
  ingredientCount,
  isLoading,
  onChange,
  onSubmit,
  onCancel,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const criteria = getRecipeCriteria(preferences);
  const advancedCount = countAdvancedRecipePreferences(preferences);
  const hasAdvancedError = Boolean(
    errors.resultCount || errors.maxCaloriesPerServing || errors.maxTotalTimeMinutes,
  );
  const showAdvanced = advancedOpen || advancedCount > 0 || hasAdvancedError;

  function update(field, value) {
    onChange({ ...preferences, [field]: value });
  }

  return (
    <form
      className="recipe-preferences"
      noValidate
      aria-busy={isLoading || undefined}
      onSubmit={onSubmit}
    >
      <div className="recipe-preferences-heading" id="recipe-preferences-heading" tabIndex="-1">
        <span aria-hidden="true">
          <SlidersHorizontal size={17} />
        </span>
        <div>
          <h3>Shape your recommendations</h3>
          <p>Filters remove mismatches. Your goal changes ranking, not eligibility.</p>
        </div>
      </div>

      <div className="recipe-preference-grid recipe-preference-grid-primary">
        <SelectField
          id="recipe-dietary-preference"
          label="Dietary preference"
          kind="Hard filter"
          hint="Only qualifying recipes can appear"
          value={preferences.dietaryPreference}
          options={DIETARY_OPTIONS}
          error={errors.dietaryPreference}
          onChange={(value) => update('dietaryPreference', value)}
        />
        <SelectField
          id="recipe-goal"
          label="Wellness goal"
          kind="Ranking"
          hint="Changes the order of eligible recipes"
          value={preferences.goal}
          options={RECIPE_GOAL_OPTIONS}
          error={errors.goal}
          onChange={(value) => update('goal', value)}
        />
        <SelectField
          id="recipe-meal-type"
          label="Meal type"
          kind="Hard filter"
          hint="Only the selected meal type can appear"
          value={preferences.mealType}
          options={RECIPE_MEAL_OPTIONS}
          error={errors.mealType}
          onChange={(value) => update('mealType', value)}
        />
      </div>

      <details
        className="recipe-advanced-filters"
        open={showAdvanced}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
      >
        <summary>
          <span>
            Limits &amp; result count
            <small>Calories, total time, and number of ideas</small>
          </span>
          <span className="recipe-advanced-summary-meta">
            {advancedCount > 0 && <strong>{advancedCount} active</strong>}
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </summary>
        <div className="recipe-preference-grid recipe-preference-grid-advanced">
          <SelectField
            id="recipe-result-count"
            label="Number of ideas"
            kind="Display"
            hint="Default: 4 results"
            value={preferences.resultCount}
            options={['3', '4', '5'].map((value) => ({ value, label: `${value} recipes` }))}
            error={errors.resultCount}
            onChange={(value) => update('resultCount', value)}
          />
          <NumberField
            id="recipe-max-calories"
            label="Calories / serving"
            hint={`${RECIPE_FILTER_LIMITS.calories.min}-${RECIPE_FILTER_LIMITS.calories.max} kcal`}
            value={preferences.maxCaloriesPerServing}
            min={RECIPE_FILTER_LIMITS.calories.min}
            max={RECIPE_FILTER_LIMITS.calories.max}
            error={errors.maxCaloriesPerServing}
            onChange={(value) => update('maxCaloriesPerServing', value)}
          />
          <NumberField
            id="recipe-max-time"
            label="Total time"
            hint={`${RECIPE_FILTER_LIMITS.timeMinutes.min}-${RECIPE_FILTER_LIMITS.timeMinutes.max} minutes`}
            value={preferences.maxTotalTimeMinutes}
            min={RECIPE_FILTER_LIMITS.timeMinutes.min}
            max={RECIPE_FILTER_LIMITS.timeMinutes.max}
            error={errors.maxTotalTimeMinutes}
            onChange={(value) => update('maxTotalTimeMinutes', value)}
          />
        </div>
      </details>

      <div className="recipe-active-criteria" aria-label="Current recommendation criteria">
        <span className="recipe-active-criteria-label">Current criteria</span>
        {criteria.map((criterion) => (
          <span
            key={criterion.key}
            className={`recipe-criteria-chip recipe-criteria-chip-${criterion.type}`}
          >
            {criterion.label}
          </span>
        ))}
      </div>

      <p className="recipe-filter-disclaimer">
        Dietary preferences are recipe filters, not allergen-free or medical guarantees.
      </p>

      {errors.ingredients && (
        <p className="recipe-form-error" id="recipe-ingredients-error" role="alert">
          {errors.ingredients}
        </p>
      )}

      <div className="recipe-request-actions">
        <Button type="submit" disabled={isLoading || ingredientCount === 0}>
          {isLoading ? (
            <>
              <LoaderCircle className="recipe-loading-icon" size={17} aria-hidden="true" />
              Finding recipes
            </>
          ) : (
            <>
              <Search size={17} aria-hidden="true" /> Find {preferences.resultCount} recipes
            </>
          )}
        </Button>
        {isLoading && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            <X size={16} aria-hidden="true" /> Cancel request
          </Button>
        )}
        <span>
          {ingredientCount ? `${ingredientCount} ingredients ready` : 'Add an ingredient first'}
        </span>
      </div>
    </form>
  );
}
