import { Cookie, MoonStar, Pencil, Plus, Sunrise, SunMedium, Trash2, Utensils } from 'lucide-react';

import { buildMealSections, formatFoodQuantity } from '../../utils/mealSections.js';
import { formatNutritionNumber } from '../../utils/nutritionProgress.js';
import { Button } from '../ui/Button.jsx';

const mealIcons = Object.freeze({
  breakfast: Sunrise,
  lunch: SunMedium,
  dinner: MoonStar,
  snack: Cookie,
});

function entryCountLabel(count) {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}

function MealEntry({ foodLog, index, onEdit, onDelete, actionsDisabled }) {
  return (
    <article
      className="meal-entry"
      style={{ '--entry-index': index }}
      aria-label={`${foodLog.foodName}, ${formatFoodQuantity(foodLog.quantity, foodLog.unit)}, ${formatNutritionNumber(foodLog.nutrition.calories)} calories`}
    >
      <span className="meal-entry-mark" aria-hidden="true">
        {foodLog.foodName.charAt(0)}
      </span>
      <div className="meal-entry-content">
        <div className="meal-entry-heading">
          <div>
            <h4>{foodLog.foodName}</h4>
            <p>{formatFoodQuantity(foodLog.quantity, foodLog.unit)}</p>
          </div>
          <strong>
            {formatNutritionNumber(foodLog.nutrition.calories)} <small>kcal</small>
          </strong>
        </div>
        <dl className="meal-entry-macros" aria-label={`${foodLog.foodName} macronutrients`}>
          <div>
            <dt>Protein</dt>
            <dd>{formatNutritionNumber(foodLog.nutrition.protein)} g</dd>
          </div>
          <div>
            <dt>Carbs</dt>
            <dd>{formatNutritionNumber(foodLog.nutrition.carbohydrates)} g</dd>
          </div>
          <div>
            <dt>Fat</dt>
            <dd>{formatNutritionNumber(foodLog.nutrition.fat)} g</dd>
          </div>
        </dl>
      </div>
      <div className="meal-entry-actions" aria-label={`Actions for ${foodLog.foodName}`}>
        <button
          type="button"
          disabled={actionsDisabled}
          title={`Edit ${foodLog.foodName}`}
          aria-label={`Edit ${foodLog.foodName}`}
          onClick={() => onEdit(foodLog)}
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={actionsDisabled}
          title={`Delete ${foodLog.foodName}`}
          aria-label={`Delete ${foodLog.foodName}`}
          onClick={() => onDelete(foodLog)}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function MealSection({ meal, onAddFood, onEdit, onDelete, actionsDisabled }) {
  const Icon = mealIcons[meal.key];
  const headingId = `meal-${meal.key}-heading`;

  return (
    <section className={`meal-section meal-section-${meal.key}`} aria-labelledby={headingId}>
      <header className="meal-section-header">
        <span className="meal-section-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div>
          <h3 id={headingId}>{meal.label}</h3>
          <p>{entryCountLabel(meal.entries.length)}</p>
        </div>
        <strong>
          {formatNutritionNumber(meal.subtotalCalories)} <small>kcal</small>
        </strong>
      </header>

      {meal.entries.length === 0 ? (
        <div className="meal-section-empty">
          <p>{meal.emptyLabel}</p>
          <button type="button" onClick={() => onAddFood(meal.key)}>
            <Plus size={14} aria-hidden="true" /> Add {meal.label.toLowerCase()}
          </button>
        </div>
      ) : (
        <div className="meal-entry-list">
          {meal.entries.map((foodLog, index) => (
            <MealEntry
              foodLog={foodLog}
              index={index}
              onEdit={onEdit}
              onDelete={onDelete}
              actionsDisabled={actionsDisabled}
              key={foodLog.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function DailyMealLog({
  foodLogs,
  mealCalories,
  onAddFood,
  onEdit,
  onDelete,
  actionsDisabled = false,
}) {
  const mealSections = buildMealSections(foodLogs, mealCalories);
  const isWholeDayEmpty = foodLogs.length === 0;

  return (
    <div className="daily-meal-log">
      {isWholeDayEmpty && (
        <div className="whole-day-empty">
          <span aria-hidden="true">
            <Utensils size={23} />
          </span>
          <div>
            <p className="dashboard-kicker">A fresh page</p>
            <h3>Nothing logged for this day yet.</h3>
            <p>Add your first food and NutriLens will build the day around it.</p>
          </div>
          <Button type="button" onClick={() => onAddFood('breakfast')}>
            <Plus size={16} aria-hidden="true" /> Add your first food
          </Button>
        </div>
      )}

      <div className="meal-section-grid">
        {mealSections.map((meal) => (
          <MealSection
            meal={meal}
            onAddFood={onAddFood}
            onEdit={onEdit}
            onDelete={onDelete}
            actionsDisabled={actionsDisabled}
            key={meal.key}
          />
        ))}
      </div>
    </div>
  );
}
