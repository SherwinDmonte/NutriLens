export const RECIPE_INGREDIENT_LIMITS = Object.freeze({
  maximumItems: 20,
  maximumNameLength: 80,
  maximumQuantity: 10_000,
});

export const RECIPE_UNIT_OPTIONS = Object.freeze([
  Object.freeze({ value: 'grams', label: 'Grams (g)', shortLabel: 'g' }),
  Object.freeze({ value: 'kilograms', label: 'Kilograms (kg)', shortLabel: 'kg' }),
  Object.freeze({ value: 'milliliters', label: 'Milliliters (ml)', shortLabel: 'ml' }),
  Object.freeze({ value: 'liters', label: 'Liters (l)', shortLabel: 'l' }),
  Object.freeze({ value: 'teaspoon', label: 'Teaspoon', shortLabel: 'tsp' }),
  Object.freeze({ value: 'tablespoon', label: 'Tablespoon', shortLabel: 'tbsp' }),
  Object.freeze({ value: 'cup', label: 'Cup', shortLabel: 'cup' }),
  Object.freeze({ value: 'piece', label: 'Piece', shortLabel: 'piece' }),
  Object.freeze({ value: 'serving', label: 'Serving', shortLabel: 'serving' }),
]);

const supportedUnits = new Set(RECIPE_UNIT_OPTIONS.map(({ value }) => value));
const unsafeTextPattern = /[<>]|\b(?:javascript|data):|on[a-z]+\s*=/iu;

function containsUnsafeControlCharacter(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint <= 8 ||
      codePoint === 11 ||
      codePoint === 12 ||
      (codePoint >= 14 && codePoint <= 31) ||
      codePoint === 127
    );
  });
}

export function normalizeIngredientName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');
}

export function validateIngredientDraft(draft) {
  const errors = {};
  const name = normalizeIngredientName(draft?.name);
  const rawQuantity = draft?.quantity;
  const unit = draft?.unit || '';
  const hasQuantity = rawQuantity !== '' && rawQuantity !== undefined && rawQuantity !== null;
  let quantity;

  if (!name) {
    errors.name = 'Enter an ingredient name.';
  } else if (name.length > RECIPE_INGREDIENT_LIMITS.maximumNameLength) {
    errors.name = `Keep the ingredient name under ${RECIPE_INGREDIENT_LIMITS.maximumNameLength} characters.`;
  } else if (unsafeTextPattern.test(name) || containsUnsafeControlCharacter(name)) {
    errors.name = 'Use a plain ingredient name without markup or control characters.';
  }

  if (hasQuantity) {
    quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.quantity = 'Enter a quantity greater than 0, or leave it blank.';
    } else if (quantity > RECIPE_INGREDIENT_LIMITS.maximumQuantity) {
      errors.quantity = `Quantity cannot exceed ${RECIPE_INGREDIENT_LIMITS.maximumQuantity.toLocaleString('en-US')}.`;
    }
  } else if (unit) {
    errors.quantity = 'Enter a quantity before choosing a unit.';
  }

  if (unit && !supportedUnits.has(unit)) {
    errors.unit = 'Choose a supported unit.';
  }

  if (Object.keys(errors).length > 0) return { errors, ingredient: null };

  return {
    errors,
    ingredient: {
      name,
      ...(hasQuantity ? { quantity } : {}),
      ...(hasQuantity && unit ? { unit } : {}),
    },
  };
}

function duplicateIndex(ingredients, name, ignoredIndex = -1) {
  return ingredients.findIndex(
    (ingredient, index) => index !== ignoredIndex && ingredient.name === name,
  );
}

export function addRecipeIngredient(ingredients, draft) {
  const validation = validateIngredientDraft(draft);
  if (!validation.ingredient) return { ingredients, errors: validation.errors };

  if (duplicateIndex(ingredients, validation.ingredient.name) !== -1) {
    return {
      ingredients,
      errors: {
        name: `${validation.ingredient.name} is already in your list. Edit the existing ingredient instead.`,
      },
    };
  }

  if (ingredients.length >= RECIPE_INGREDIENT_LIMITS.maximumItems) {
    return {
      ingredients,
      errors: {
        form: `You can add up to ${RECIPE_INGREDIENT_LIMITS.maximumItems} ingredients.`,
      },
    };
  }

  return { ingredients: [...ingredients, validation.ingredient], errors: {} };
}

export function updateRecipeIngredient(ingredients, index, draft) {
  if (!Number.isInteger(index) || index < 0 || index >= ingredients.length) {
    return { ingredients, errors: { form: 'That ingredient is no longer available to edit.' } };
  }

  const validation = validateIngredientDraft(draft);
  if (!validation.ingredient) return { ingredients, errors: validation.errors };

  if (duplicateIndex(ingredients, validation.ingredient.name, index) !== -1) {
    return {
      ingredients,
      errors: {
        name: `${validation.ingredient.name} is already in your list. Choose a different name.`,
      },
    };
  }

  return {
    ingredients: ingredients.map((ingredient, ingredientIndex) =>
      ingredientIndex === index ? validation.ingredient : ingredient,
    ),
    errors: {},
  };
}

export function removeRecipeIngredient(ingredients, index) {
  if (!Number.isInteger(index) || index < 0 || index >= ingredients.length) return ingredients;
  return ingredients.filter((_, ingredientIndex) => ingredientIndex !== index);
}

function cleanPastedName(value) {
  return value.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s+/u, '').trim();
}

export function parsePastedIngredientNames(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(/[,;\r\n]+/u)
    .map(cleanPastedName)
    .filter(Boolean);
}

export function addPastedRecipeIngredients(ingredients, pastedText) {
  const pastedNames = parsePastedIngredientNames(pastedText);
  let nextIngredients = [...ingredients];
  let added = 0;
  let duplicates = 0;
  let invalid = 0;
  let overLimit = 0;

  for (const name of pastedNames) {
    const validation = validateIngredientDraft({ name, quantity: '', unit: '' });
    if (!validation.ingredient) {
      invalid += 1;
      continue;
    }
    if (duplicateIndex(nextIngredients, validation.ingredient.name) !== -1) {
      duplicates += 1;
      continue;
    }
    if (nextIngredients.length >= RECIPE_INGREDIENT_LIMITS.maximumItems) {
      overLimit += 1;
      continue;
    }
    nextIngredients.push(validation.ingredient);
    added += 1;
  }

  return {
    ingredients: nextIngredients,
    summary: { total: pastedNames.length, added, duplicates, invalid, overLimit },
  };
}

export function getIngredientNameKeyAction({ key, name, ingredientCount }) {
  if (key === 'Escape') return 'clear-draft';
  if (key === 'Backspace' && !name && ingredientCount > 0) return 'remove-last';
  if (key === 'Enter') return 'submit';
  return null;
}

export function formatIngredientAmount(ingredient) {
  if (ingredient.quantity === undefined) return 'Quantity optional';
  if (!ingredient.unit) return String(ingredient.quantity);

  const option = RECIPE_UNIT_OPTIONS.find(({ value }) => value === ingredient.unit);
  const label = option?.shortLabel || ingredient.unit;
  const pluralSuffix =
    ['cup', 'piece', 'serving'].includes(label) && ingredient.quantity !== 1 ? 's' : '';
  return `${ingredient.quantity} ${label}${pluralSuffix}`;
}

export function toRecipeIngredientRequest(ingredients) {
  return ingredients.map(({ name, quantity, unit }) => ({
    name,
    ...(quantity !== undefined ? { quantity } : {}),
    ...(quantity !== undefined && unit ? { unit } : {}),
  }));
}
