import {
  AlertCircle,
  Check,
  ChevronDown,
  CircleCheck,
  Search,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { foodCatalogApi } from '../../services/foodCatalogApi.js';
import { foodLogApi } from '../../services/foodLogApi.js';
import {
  mapApiFieldErrors,
  nutritionSnapshotsMatch,
  validateAddFoodDraft,
} from '../../utils/addFoodForm.js';
import { formatCalendarDate } from '../../utils/calendarDate.js';
import { formatNutritionNumber } from '../../utils/nutritionProgress.js';
import { Button } from '../ui/Button.jsx';
import { Dialog } from '../ui/Dialog.jsx';
import { LoadingSpinner } from '../ui/Feedback.jsx';
import { FoodThumbnail } from './FoodThumbnail.jsx';

const mealOptions = Object.freeze([
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]);

const nutritionPreviewFields = Object.freeze([
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbohydrates', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
]);

const customUnitOptions = Object.freeze([
  { unit: 'grams', label: 'grams', defaultQuantity: 100, step: 1, min: 0.01, max: 100000 },
  {
    unit: 'milliliters',
    label: 'milliliters',
    defaultQuantity: 100,
    step: 1,
    min: 0.01,
    max: 100000,
  },
  { unit: 'piece', label: 'pieces', defaultQuantity: 1, step: 0.25, min: 0.01, max: 100000 },
  {
    unit: 'serving',
    label: 'servings',
    defaultQuantity: 1,
    step: 0.25,
    min: 0.01,
    max: 100000,
  },
]);

function initialCustomDraft() {
  return {
    name: '',
    calories: '',
    protein: '',
    carbohydrates: '',
    fat: '',
    fiber: '',
  };
}

function customFoodPayload(customDraft) {
  return {
    name: customDraft.name.trim(),
    description: 'Nutrition entered manually',
    nutrition: Object.fromEntries(
      nutritionPreviewFields.map(({ key }) => [key, Number(customDraft[key])]),
    ),
  };
}

function initialDraft(mealType = 'breakfast', foodLog = null) {
  return {
    mealType: foodLog?.mealType || mealType,
    quantity: foodLog ? String(foodLog.quantity) : '',
    unit: foodLog?.unit || '',
  };
}

function idleRequestState() {
  return { status: 'idle', data: null, error: null };
}

function providerAvailabilityMessage(unavailableProviders = []) {
  const openFoodFactsUnavailable = unavailableProviders.includes('open_food_facts');
  const usdaUnavailable = unavailableProviders.includes('usda');
  if (openFoodFactsUnavailable && usdaUnavailable) {
    return 'Live food providers are temporarily unavailable.';
  }
  if (openFoodFactsUnavailable) {
    return 'Open Food Facts is temporarily unavailable. Showing USDA results.';
  }
  if (usdaUnavailable) {
    return 'USDA is temporarily unavailable. Showing Open Food Facts results.';
  }
  return '';
}

export function AddFoodDialog({
  open,
  selectedDate,
  initialMealType = 'breakfast',
  foodLog = null,
  onClose,
  onCreated,
  onUnauthorized,
  onStale,
}) {
  const [searchQuery, setSearchQuery] = useState(foodLog?.foodName || '');
  const [searchState, setSearchState] = useState({
    status: foodLog && !foodLog.catalogFood ? 'loading' : 'idle',
    foods: [],
    error: null,
  });
  const [searchRevision, setSearchRevision] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [entryMode, setEntryMode] = useState('catalog');
  const [selectedFood, setSelectedFood] = useState(foodLog?.catalogFood || null);
  const [customDraft, setCustomDraft] = useState(initialCustomDraft);
  const [draft, setDraft] = useState(() => initialDraft(initialMealType, foodLog));
  const [errors, setErrors] = useState({});
  const [previewState, setPreviewState] = useState(idleRequestState);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchInputRef = useRef(null);
  const submitLockRef = useRef(false);
  const listboxId = useId();
  const isEditMode = Boolean(foodLog);

  const selectedUnit = useMemo(
    () =>
      (entryMode === 'custom' ? customUnitOptions : selectedFood?.supportedUnits || []).find(
        (candidate) => candidate.unit === draft.unit,
      ),
    [draft.unit, entryMode, selectedFood],
  );
  const customFood = useMemo(() => customFoodPayload(customDraft), [customDraft]);
  const customFoodIsComplete =
    customFood.name.length > 0 &&
    nutritionPreviewFields.every(
      ({ key }) =>
        customDraft[key] !== '' &&
        Number.isFinite(customFood.nutrition[key]) &&
        customFood.nutrition[key] >= 0,
    );
  const isSelectedQuery =
    entryMode === 'catalog' && selectedFood && searchQuery === selectedFood.name;
  const isEditCatalogLoading = isEditMode && !selectedFood && searchQuery === foodLog.foodName;
  const isSearchListOpen =
    open &&
    entryMode === 'catalog' &&
    !isSelectedQuery &&
    (searchState.status === 'success' || searchState.status === 'error');

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (
      !open ||
      entryMode !== 'catalog' ||
      !isEditMode ||
      selectedFood ||
      searchQuery !== foodLog.foodName
    ) {
      return undefined;
    }

    const controller = new AbortController();
    foodCatalogApi
      .getFood(foodLog.foodCatalogId, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setSelectedFood(response.data.food);
        setSearchQuery(response.data.food.name);
        setDraft(initialDraft(initialMealType, foodLog));
        setSearchState({ status: 'idle', foods: [], error: null });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error.status === 401) void onUnauthorized?.();
        setSearchState({ status: 'error', foods: [], error });
      });

    return () => controller.abort();
  }, [
    foodLog,
    entryMode,
    initialMealType,
    isEditMode,
    onUnauthorized,
    open,
    searchQuery,
    searchRevision,
    selectedFood,
  ]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (
      !open ||
      entryMode !== 'catalog' ||
      isSelectedQuery ||
      isEditCatalogLoading ||
      normalizedQuery.length < 2
    ) {
      return undefined;
    }

    const controller = new AbortController();
    const debounceTimer = setTimeout(() => {
      setSearchState((current) => ({ ...current, status: 'loading', error: null }));
      foodCatalogApi
        .searchFoods(normalizedQuery, { signal: controller.signal, limit: 10 })
        .then((response) => {
          if (controller.signal.aborted) return;
          const foods = response.data.foods;
          setSearchState({
            status: 'success',
            foods,
            providers: response.data.providers || [],
            unavailableProviders: response.data.unavailableProviders || [],
            error: null,
          });
          setActiveIndex(0);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          if (error.status === 401) void onUnauthorized?.();
          setSearchState({ status: 'error', foods: [], error });
        });
    }, 650);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [
    entryMode,
    isEditCatalogLoading,
    isSelectedQuery,
    onUnauthorized,
    open,
    searchQuery,
    searchRevision,
  ]);

  function retryFoodSearch() {
    setSearchState((current) => ({ ...current, status: 'loading', error: null }));
    setSearchRevision((value) => value + 1);
  }

  useEffect(() => {
    const numericQuantity = Number(draft.quantity);
    const hasFood = entryMode === 'custom' ? customFoodIsComplete : Boolean(selectedFood);
    const isValidSelection =
      open &&
      hasFood &&
      selectedUnit &&
      draft.quantity !== '' &&
      Number.isFinite(numericQuantity) &&
      numericQuantity >= selectedUnit.min &&
      numericQuantity <= selectedUnit.max;

    if (!isValidSelection) return undefined;

    const controller = new AbortController();
    const debounceTimer = setTimeout(() => {
      setPreviewState((current) => ({ ...current, status: 'loading', error: null }));
      const previewRequest =
        entryMode === 'custom'
          ? foodCatalogApi.getCustomNutritionPreview(
              {
                customFood,
                quantity: numericQuantity,
                unit: draft.unit,
              },
              { signal: controller.signal },
            )
          : isEditMode && selectedFood.id === foodLog.foodCatalogId
            ? foodLogApi.getNutritionPreview(foodLog.id, {
                quantity: numericQuantity,
                unit: draft.unit,
                signal: controller.signal,
              })
            : foodCatalogApi.getNutritionPreview(selectedFood.id, {
                quantity: numericQuantity,
                unit: draft.unit,
                signal: controller.signal,
              });

      previewRequest
        .then((response) => {
          if (!controller.signal.aborted) {
            setPreviewState({ status: 'success', data: response.data.preview, error: null });
          }
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          if (error.status === 401) void onUnauthorized?.();
          setPreviewState({ status: 'error', data: null, error });
        });
    }, 350);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [
    customFood,
    customFoodIsComplete,
    draft.quantity,
    draft.unit,
    entryMode,
    foodLog,
    isEditMode,
    onUnauthorized,
    open,
    previewRevision,
    selectedFood,
    selectedUnit,
  ]);

  function resetDialog() {
    setSearchQuery(foodLog?.foodName || '');
    setSearchState({
      status: foodLog && !foodLog.catalogFood ? 'loading' : 'idle',
      foods: [],
      error: null,
    });
    setActiveIndex(0);
    setEntryMode('catalog');
    setSelectedFood(foodLog?.catalogFood || null);
    setCustomDraft(initialCustomDraft());
    setDraft(initialDraft(initialMealType, foodLog));
    setErrors({});
    setPreviewState(idleRequestState());
    setSubmitError('');
    submitLockRef.current = false;
    setIsSubmitting(false);
  }

  function handleClose() {
    if (submitLockRef.current) return;
    resetDialog();
    onClose();
  }

  function handleSearchChange(event) {
    const value = event.target.value;
    setSearchQuery(value);
    if (value.trim().length < 2) {
      setSearchState({ status: 'idle', foods: [], error: null });
    }
    setSubmitError('');
    setErrors((current) => ({ ...current, foodId: undefined }));
    if (selectedFood && value !== selectedFood.name) {
      setSelectedFood(null);
      setDraft((current) => ({ ...current, quantity: '', unit: '' }));
      setPreviewState(idleRequestState());
    }
  }

  function changeEntryMode(mode) {
    setEntryMode(mode);
    setErrors({});
    setSubmitError('');
    setPreviewState(idleRequestState());
    if (mode === 'custom') {
      const defaultUnit = customUnitOptions[0];
      setSelectedFood(null);
      setSearchState({ status: 'idle', foods: [], error: null });
      setDraft((current) => ({
        ...current,
        quantity: String(defaultUnit.defaultQuantity),
        unit: defaultUnit.unit,
      }));
    } else {
      setSelectedFood(foodLog?.catalogFood || null);
      setSearchQuery(foodLog?.foodName || '');
      setDraft(
        foodLog
          ? initialDraft(initialMealType, foodLog)
          : (current) => ({ ...current, quantity: '', unit: '' }),
      );
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }

  function updateCustomDraft(event) {
    const { name, value } = event.target;
    setCustomDraft((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined, customFood: undefined }));
    setSubmitError('');
    setPreviewState(idleRequestState());
  }

  function selectFood(food) {
    const defaultUnit = food.supportedUnits[0];
    setSelectedFood(food);
    setSearchQuery(food.name);
    setSearchState({ status: 'idle', foods: [], error: null });
    setDraft((current) => ({
      ...current,
      quantity: String(defaultUnit.defaultQuantity),
      unit: defaultUnit.unit,
    }));
    setErrors((current) => ({
      ...current,
      foodId: undefined,
      quantity: undefined,
      unit: undefined,
    }));
    setPreviewState(idleRequestState());
    setSubmitError('');
  }

  function handleSearchKeyDown(event) {
    const foods = searchState.foods;
    if (!isSearchListOpen || foods.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % foods.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + foods.length) % foods.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectFood(foods[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setSearchState({ status: 'idle', foods: [], error: null });
    }
  }

  function updateDraft(event) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setSubmitError('');
    if (name === 'quantity' || name === 'unit') setPreviewState(idleRequestState());

    if (name === 'unit' && selectedFood) {
      const nextUnit = selectedFood.supportedUnits.find((candidate) => candidate.unit === value);
      if (nextUnit) {
        setDraft((current) => ({
          ...current,
          unit: value,
          quantity: String(nextUnit.defaultQuantity),
        }));
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitLockRef.current) return;

    const nextErrors = validateAddFoodDraft({
      ...draft,
      selectedFood,
      mode: entryMode,
      customFood: customDraft,
    });
    setErrors(nextErrors);
    setSubmitError('');
    if (Object.keys(nextErrors).length > 0) return;
    if (previewState.status !== 'success') {
      setSubmitError('Wait for the nutrition preview before adding this food.');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const input = {
        date: selectedDate,
        mealType: draft.mealType,
        quantity: Number(draft.quantity),
        unit: draft.unit,
        ...(entryMode === 'custom'
          ? { customFood }
          : {
              foodId: selectedFood.id,
            }),
      };
      const response = isEditMode
        ? await foodLogApi.update(foodLog.id, input)
        : await foodLogApi.create(input);
      const savedFoodLog = response.data.foodLog;
      const previewMatched = nutritionSnapshotsMatch(previewState.data, savedFoodLog);

      onCreated({
        foodLog: savedFoodLog,
        previewMatched,
        operation: isEditMode ? 'updated' : 'created',
      });
      resetDialog();
      onClose();
    } catch (error) {
      if (error.status === 401) void onUnauthorized?.();
      if (error.status === 404) onStale?.();
      setErrors(mapApiFieldErrors(error));
      setSubmitError(
        error.message ||
          (isEditMode
            ? 'The changes could not be saved. Try again.'
            : 'The food could not be added. Try again.'),
      );
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  const activeOptionId =
    isSearchListOpen && searchState.foods[activeIndex]
      ? `${listboxId}-option-${searchState.foods[activeIndex].id}`
      : undefined;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={isEditMode ? 'Edit food' : 'Add food'}
      className="add-food-dialog"
      closeDisabled={isSubmitting}
    >
      <div className="add-food-date">
        <Utensils size={15} aria-hidden="true" />
        {isEditMode ? 'Editing' : 'Logging'} for <strong>{formatCalendarDate(selectedDate)}</strong>
      </div>

      <form className="add-food-form" onSubmit={handleSubmit} noValidate>
        <div className="add-food-layout">
          <div className="add-food-fields">
            <fieldset className="add-food-meals">
              <legend>Meal</legend>
              <div>
                {mealOptions.map((meal) => (
                  <label key={meal.value}>
                    <input
                      type="radio"
                      name="mealType"
                      value={meal.value}
                      checked={draft.mealType === meal.value}
                      onChange={updateDraft}
                    />
                    <span>{meal.label}</span>
                  </label>
                ))}
              </div>
              {errors.mealType && <p className="add-food-field-error">{errors.mealType}</p>}
            </fieldset>

            <div className="add-food-source-tabs" aria-label="Food source">
              <button
                type="button"
                className={entryMode === 'catalog' ? 'active' : ''}
                onClick={() => changeEntryMode('catalog')}
                aria-pressed={entryMode === 'catalog'}
              >
                Search database
              </button>
              <button
                type="button"
                className={entryMode === 'custom' ? 'active' : ''}
                onClick={() => changeEntryMode('custom')}
                aria-pressed={entryMode === 'custom'}
              >
                Add custom food
              </button>
            </div>

            {entryMode === 'catalog' ? (
              <>
                <div className="add-food-search-field">
                  <label htmlFor={`${listboxId}-input`}>Search USDA and Open Food Facts</label>
                  <div className="add-food-combobox">
                    <Search size={18} aria-hidden="true" />
                    <input
                      ref={searchInputRef}
                      id={`${listboxId}-input`}
                      type="search"
                      role="combobox"
                      autoComplete="off"
                      placeholder="Try paneer, rice, oats, Amul..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      onKeyDown={handleSearchKeyDown}
                      aria-autocomplete="list"
                      aria-controls={listboxId}
                      aria-expanded={isSearchListOpen}
                      aria-activedescendant={activeOptionId}
                      aria-invalid={Boolean(errors.foodId)}
                      aria-describedby={errors.foodId ? `${listboxId}-food-error` : undefined}
                    />
                    {searchState.status === 'loading' && <LoadingSpinner label="Searching foods" />}
                  </div>

                  {isSearchListOpen && (
                    <div className="add-food-search-results">
                      {searchState.status === 'error' ? (
                        <div className="add-food-search-message" role="alert">
                          <AlertCircle size={17} aria-hidden="true" />
                          <span>Food search is unavailable. Custom entry is still available.</span>
                          <button type="button" onClick={retryFoodSearch}>
                            Retry
                          </button>
                        </div>
                      ) : searchState.status === 'success' && searchState.foods.length === 0 ? (
                        <div className="add-food-search-message" role="status">
                          No foods match &quot;{searchQuery.trim()}&quot;. Try a custom food.
                        </div>
                      ) : searchState.status === 'success' ? (
                        <ul id={listboxId} role="listbox" aria-label="Food search results">
                          {searchState.foods.map((food, index) => (
                            <li
                              id={`${listboxId}-option-${food.id}`}
                              role="option"
                              aria-selected={index === activeIndex}
                              className={index === activeIndex ? 'active' : ''}
                              key={food.id}
                              onMouseEnter={() => setActiveIndex(index)}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => selectFood(food)}
                            >
                              <FoodThumbnail food={food} />
                              <div>
                                <strong>{food.name}</strong>
                                <small>{food.description}</small>
                              </div>
                              <em>{food.source?.label || food.category}</em>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {searchState.status === 'success' &&
                        searchState.unavailableProviders?.length > 0 && (
                          <p className="add-food-provider-status" role="status">
                            <AlertCircle size={15} aria-hidden="true" />
                            {providerAvailabilityMessage(searchState.unavailableProviders)}
                          </p>
                        )}
                    </div>
                  )}

                  {errors.foodId && (
                    <p className="add-food-field-error" id={`${listboxId}-food-error`}>
                      {errors.foodId}
                    </p>
                  )}
                </div>

                {selectedFood && (
                  <div
                    className="add-food-selected"
                    aria-label={`Selected food: ${selectedFood.name}`}
                  >
                    <FoodThumbnail food={selectedFood} className="food-thumbnail--selected" />
                    <div className="add-food-selected-copy">
                      <span>
                        <CircleCheck size={17} aria-hidden="true" />{' '}
                        {selectedFood.source?.label || 'Selected food'}
                      </span>
                      <strong>{selectedFood.name}</strong>
                      <small>{selectedFood.description}</small>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="add-food-custom-fields">
                <label className="add-food-custom-name">
                  <span>Food name</span>
                  <input
                    name="name"
                    value={customDraft.name}
                    onChange={updateCustomDraft}
                    placeholder="e.g. homemade vegetable upma"
                    maxLength={120}
                    aria-invalid={Boolean(errors.name)}
                  />
                  {errors.name && <small className="add-food-field-error">{errors.name}</small>}
                </label>
                <p>
                  Enter nutrition for the quantity below. NutriLens will save it as user supplied.
                </p>
                <div>
                  {nutritionPreviewFields.map((nutrient) => (
                    <label key={nutrient.key}>
                      <span>
                        {nutrient.label} ({nutrient.unit})
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        name={nutrient.key}
                        min="0"
                        step="any"
                        value={customDraft[nutrient.key]}
                        onChange={updateCustomDraft}
                        aria-invalid={Boolean(errors[nutrient.key])}
                      />
                      {errors[nutrient.key] && (
                        <small className="add-food-field-error">{errors[nutrient.key]}</small>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="add-food-quantity-row">
              <label>
                <span>Quantity</span>
                <input
                  type="number"
                  inputMode="decimal"
                  name="quantity"
                  value={draft.quantity}
                  min={selectedUnit?.min}
                  max={selectedUnit?.max}
                  step={selectedUnit?.step || 'any'}
                  disabled={entryMode === 'catalog' && !selectedFood}
                  onChange={updateDraft}
                  aria-invalid={Boolean(errors.quantity)}
                  aria-describedby={errors.quantity ? `${listboxId}-quantity-error` : undefined}
                />
              </label>
              <label>
                <span>Unit</span>
                <div className="add-food-select">
                  <select
                    name="unit"
                    value={draft.unit}
                    disabled={entryMode === 'catalog' && !selectedFood}
                    onChange={updateDraft}
                    aria-invalid={Boolean(errors.unit)}
                    aria-describedby={errors.unit ? `${listboxId}-unit-error` : undefined}
                  >
                    <option value="">Select unit</option>
                    {(entryMode === 'custom'
                      ? customUnitOptions
                      : selectedFood?.supportedUnits || []
                    ).map((unit) => (
                      <option value={unit.unit} key={unit.unit}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} aria-hidden="true" />
                </div>
              </label>
            </div>
            {errors.quantity && (
              <p className="add-food-field-error" id={`${listboxId}-quantity-error`}>
                {errors.quantity}
              </p>
            )}
            {errors.unit && (
              <p className="add-food-field-error" id={`${listboxId}-unit-error`}>
                {errors.unit}
              </p>
            )}
            {selectedUnit && !errors.quantity && (
              <p className="add-food-field-hint">
                Allowed: {selectedUnit.min}-{selectedUnit.max} {selectedUnit.label}
              </p>
            )}
          </div>

          <aside className="add-food-preview" aria-labelledby={`${listboxId}-preview-heading`}>
            <div className="add-food-preview-heading">
              <span aria-hidden="true">
                <Sparkles size={18} />
              </span>
              <div>
                <p>Server calculated</p>
                <h3 id={`${listboxId}-preview-heading`}>Nutrition preview</h3>
              </div>
            </div>

            {previewState.status === 'loading' ? (
              <div className="add-food-preview-state" role="status">
                <LoadingSpinner label="Calculating nutrition" />
                <span>Calculating nutrition...</span>
              </div>
            ) : previewState.status === 'error' ? (
              <div className="add-food-preview-state is-error" role="alert">
                <AlertCircle size={19} aria-hidden="true" />
                <span>{previewState.error?.message || 'Preview unavailable.'}</span>
                <button type="button" onClick={() => setPreviewRevision((value) => value + 1)}>
                  Try again
                </button>
              </div>
            ) : previewState.status === 'success' ? (
              <div className="add-food-preview-data" aria-live="polite">
                <strong>{previewState.data.foodName}</strong>
                <span>
                  Equivalent to {formatNutritionNumber(previewState.data.equivalentBaseQuantity)}{' '}
                  {previewState.data.baseUnit}
                </span>
                <span className="add-food-preview-source">{previewState.data.source?.label}</span>
                <dl>
                  {nutritionPreviewFields.map((nutrient) => (
                    <div key={nutrient.key}>
                      <dt>{nutrient.label}</dt>
                      <dd>
                        {previewState.data.missingNutrients?.includes(nutrient.key)
                          ? 'Not provided'
                          : `${formatNutritionNumber(previewState.data.nutrition[nutrient.key])} ${nutrient.unit}`}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p>
                  <Check size={14} aria-hidden="true" />{' '}
                  {previewState.data.missingNutrients?.length
                    ? 'Missing label nutrients are saved as 0 and clearly marked.'
                    : 'Recalculated again when saved'}
                </p>
              </div>
            ) : (
              <div className="add-food-preview-state">
                <Utensils size={22} aria-hidden="true" />
                <span>
                  {entryMode === 'custom'
                    ? 'Enter the custom food, quantity, and nutrition to preview it.'
                    : 'Select a food and quantity to preview its nutrition.'}
                </span>
              </div>
            )}
          </aside>
        </div>

        {submitError && (
          <div className="add-food-submit-error" role="alert">
            <AlertCircle size={17} aria-hidden="true" /> {submitError}
          </div>
        )}

        <footer className="add-food-actions">
          <p>Database values keep their source. Custom values are labelled as user entered.</p>
          <div>
            <Button variant="ghost" type="button" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoadingSpinner label={isEditMode ? 'Saving food' : 'Adding food'} />{' '}
                  {isEditMode ? 'Saving...' : 'Adding...'}
                </>
              ) : isEditMode ? (
                'Save changes'
              ) : (
                'Add to food log'
              )}
            </Button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
