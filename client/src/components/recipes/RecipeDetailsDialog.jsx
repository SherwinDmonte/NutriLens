import {
  BarChart3,
  CheckCircle2,
  ChefHat,
  Clock3,
  Database,
  Info,
  ShieldCheck,
  ShoppingBasket,
  UsersRound,
} from 'lucide-react';

import {
  RECIPE_NUTRITION_METRICS,
  RECIPE_SCORE_COMPONENTS,
  formatRecipeIngredientAmount,
  formatRecipeNutritionValue,
  getFallbackReasonLabel,
  getRecipeProviderLabel,
  humanizeRecipeValue,
} from '../../utils/recipePresentation.js';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Dialog } from '../ui/Dialog.jsx';
import { RecipeImage } from './RecipeImage.jsx';

function RecipeIngredientList({ title, icon: Icon, ingredients, emptyLabel }) {
  return (
    <section className="recipe-detail-ingredient-section">
      <div className="recipe-detail-section-heading">
        <Icon size={18} aria-hidden="true" />
        <div>
          <h3>{title}</h3>
          <p>
            {ingredients.length} item{ingredients.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      {ingredients.length ? (
        <ul>
          {ingredients.map((ingredient) => (
            <li key={ingredient.name}>
              <span>
                <strong>{ingredient.name}</strong>
                {ingredient.optional && <small>Optional</small>}
              </span>
              <b>{formatRecipeIngredientAmount(ingredient)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="recipe-detail-empty-copy">{emptyLabel}</p>
      )}
    </section>
  );
}

function RecipeScoreBreakdown({ match }) {
  return (
    <section className="recipe-score-breakdown" aria-labelledby="recipe-score-heading">
      <div className="recipe-detail-section-heading">
        <BarChart3 size={18} aria-hidden="true" />
        <div>
          <h3 id="recipe-score-heading">Why this scored {match.score}%</h3>
          <p>A transparent ranking of this recipe against your request</p>
        </div>
      </div>
      <p className="recipe-score-reason">{match.reason}</p>
      <div className="recipe-score-components">
        {RECIPE_SCORE_COMPONENTS.map((component) => (
          <div key={component.key}>
            <span>
              <strong>{component.label}</strong>
              <small>{component.weight} of overall score</small>
            </span>
            <div
              className="recipe-score-track"
              role="progressbar"
              aria-label={component.label}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={match.components[component.key]}
            >
              <span style={{ width: `${match.components[component.key]}%` }} />
            </div>
            <b>{match.components[component.key]}</b>
          </div>
        ))}
      </div>
      <p className="recipe-score-method">
        Dietary, calorie, and time limits are applied before ranking. The score combines ingredient
        fit (40%), wellness-goal fit (25%), dietary fit (15%), calorie fit (10%), and time fit
        (10%). It is a recommendation ranking, not a medical or health score.
      </p>
    </section>
  );
}

function NutritionDetails({ nutrition }) {
  return (
    <section className="recipe-detail-nutrition" aria-labelledby="recipe-nutrition-heading">
      <div className="recipe-detail-section-heading">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <h3 id="recipe-nutrition-heading">Estimated nutrition per serving</h3>
          <p>
            {nutrition.confidence.level} confidence / {nutrition.coveragePercent}% ingredient
            coverage
          </p>
        </div>
      </div>
      <dl>
        {RECIPE_NUTRITION_METRICS.map((metric) => (
          <div key={metric.key}>
            <dt>{metric.label}</dt>
            <dd>
              {formatRecipeNutritionValue(nutrition[metric.key])} <small>{metric.unit}</small>
            </dd>
          </div>
        ))}
      </dl>
      {nutrition.unmatchedIngredients.length > 0 && (
        <div className="recipe-nutrition-caution">
          <Info size={17} aria-hidden="true" />
          <p>
            Not included in the estimate:{' '}
            <strong>{nutrition.unmatchedIngredients.join(', ')}</strong>
          </p>
        </div>
      )}
      {nutrition.assumptions.length > 0 && (
        <details className="recipe-nutrition-assumptions">
          <summary>
            View {nutrition.assumptions.length} calculation assumption
            {nutrition.assumptions.length === 1 ? '' : 's'}
          </summary>
          <ul>
            {nutrition.assumptions.map((assumption, index) => (
              <li key={`${assumption.ingredient}-${assumption.code}-${index}`}>
                <strong>{assumption.ingredient}:</strong> {assumption.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="recipe-nutrition-provenance">
        <Database size={16} aria-hidden="true" />
        <span>
          Dataset <strong>{nutrition.provenance.dataset}</strong> v{nutrition.provenance.version};{' '}
          {humanizeRecipeValue(nutrition.provenance.calculationMethod)}.
        </span>
      </div>
    </section>
  );
}

export function RecipeDetailsDialog({ open, recipe, provider, onClose }) {
  if (!recipe) return null;

  return (
    <Dialog open={open} onClose={onClose} title={recipe.title} className="recipe-details-dialog">
      <div className="recipe-details-scroll">
        <RecipeImage
          image={recipe.image}
          title={recipe.title}
          ingredients={recipe.ingredients}
          variant="detail"
        />

        <div className="recipe-detail-provider-note">
          <ChefHat size={20} aria-hidden="true" />
          <div>
            <Badge>{getRecipeProviderLabel(provider.used)}</Badge>
            <strong>Recipe source: {getRecipeProviderLabel(recipe.source)}</strong>
            <p>
              Nutrition is a deterministic estimate from structured ingredients, not a value
              supplied by the recipe provider.
            </p>
            {provider.fallbackUsed && (
              <small>
                {getFallbackReasonLabel(provider.fallbackReason)}; bundled mode was used safely.
              </small>
            )}
          </div>
        </div>

        <header className="recipe-detail-intro">
          <p>{recipe.summary}</p>
          <div className="recipe-detail-tags" aria-label="Recipe classifications">
            <Badge>{humanizeRecipeValue(recipe.difficulty)}</Badge>
            {recipe.mealTypes.map((mealType) => (
              <Badge key={mealType} tone="muted">
                {humanizeRecipeValue(mealType)}
              </Badge>
            ))}
            {recipe.dietaryTags.length ? (
              recipe.dietaryTags.map((tag) => (
                <Badge key={tag} tone="muted">
                  {humanizeRecipeValue(tag)}
                </Badge>
              ))
            ) : (
              <Badge tone="muted">No dietary classification</Badge>
            )}
          </div>
          <dl className="recipe-detail-meta">
            <div>
              <dt>
                <Clock3 size={16} aria-hidden="true" /> Preparation
              </dt>
              <dd>{recipe.time.prepMinutes} min</dd>
            </div>
            <div>
              <dt>
                <Clock3 size={16} aria-hidden="true" /> Cooking
              </dt>
              <dd>{recipe.time.cookMinutes} min</dd>
            </div>
            <div>
              <dt>
                <Clock3 size={16} aria-hidden="true" /> Total
              </dt>
              <dd>{recipe.time.totalMinutes} min</dd>
            </div>
            <div>
              <dt>
                <UsersRound size={16} aria-hidden="true" /> Servings
              </dt>
              <dd>{recipe.servings}</dd>
            </div>
          </dl>
        </header>

        <RecipeScoreBreakdown match={recipe.match} />

        <div className="recipe-detail-ingredient-grid">
          <RecipeIngredientList
            title="Already available"
            icon={CheckCircle2}
            ingredients={recipe.ingredients.available}
            emptyLabel="No ingredients were directly matched from your list."
          />
          <RecipeIngredientList
            title="Additional ingredients"
            icon={ShoppingBasket}
            ingredients={recipe.ingredients.additional}
            emptyLabel="No additional ingredients are needed."
          />
        </div>

        <section className="recipe-detail-steps" aria-labelledby="recipe-steps-heading">
          <div className="recipe-detail-section-heading">
            <ChefHat size={18} aria-hidden="true" />
            <div>
              <h3 id="recipe-steps-heading">Preparation</h3>
              <p>
                {recipe.steps.length} ordered step{recipe.steps.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <ol>
            {recipe.steps.map((step) => (
              <li key={step.number}>
                <span aria-hidden="true">{String(step.number).padStart(2, '0')}</span>
                <p>{step.instruction}</p>
              </li>
            ))}
          </ol>
        </section>

        <NutritionDetails nutrition={recipe.nutritionPerServing} />

        <footer className="recipe-detail-footer">
          <p>Dietary filters are not allergen-free or medical guarantees.</p>
          <Button type="button" onClick={onClose}>
            Close recipe
          </Button>
        </footer>
      </div>
    </Dialog>
  );
}
