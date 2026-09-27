import {
  ArrowUpRight,
  BookmarkCheck,
  BookmarkPlus,
  Clock3,
  CookingPot,
  LoaderCircle,
  Trash2,
  UsersRound,
} from 'lucide-react';

import {
  RECIPE_NUTRITION_METRICS,
  formatRecipeNutritionValue,
  humanizeRecipeValue,
} from '../../utils/recipePresentation.js';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { RecipeImage } from './RecipeImage.jsx';

function IngredientPreview({ label, ingredients, emptyLabel }) {
  return (
    <div className="recipe-card-ingredient-group">
      <span>{label}</span>
      {ingredients.length ? (
        <ul aria-label={`${label} for this recipe`}>
          {ingredients.slice(0, 2).map((ingredient) => (
            <li key={ingredient.name}>{ingredient.name}</li>
          ))}
          {ingredients.length > 2 && <li>+{ingredients.length - 2} more</li>}
        </ul>
      ) : (
        <small>{emptyLabel}</small>
      )}
    </div>
  );
}

export function RecipeCard({
  recipe,
  index,
  onOpen,
  onSave,
  isSaved = false,
  isSaving = false,
  onRemove,
  isRemoving = false,
  context = 'recommendation',
  savedAt,
}) {
  const keyMetrics = RECIPE_NUTRITION_METRICS.filter(({ key }) =>
    ['calories', 'protein', 'fiber'].includes(key),
  );

  return (
    <article
      className="recipe-card"
      role="listitem"
      style={{ '--recipe-card-delay': `${index * 55}ms` }}
    >
      <div className="recipe-card-topline">
        <div className="recipe-card-badges">
          <Badge>{humanizeRecipeValue(recipe.difficulty)}</Badge>
          {recipe.dietaryTags?.slice(0, 2).map((tag) => (
            <Badge key={tag} tone="muted">
              {humanizeRecipeValue(tag)}
            </Badge>
          ))}
        </div>
        <div
          className="recipe-match-gauge"
          role="img"
          style={{ '--recipe-match-angle': `${recipe.match.score * 3.6}deg` }}
          aria-label={`${recipe.match.score} percent recipe match`}
        >
          <strong>{recipe.match.score}%</strong>
          <small>match</small>
        </div>
      </div>

      <RecipeImage image={recipe.image} title={recipe.title} ingredients={recipe.ingredients} />

      <div className="recipe-card-heading">
        <h3>{recipe.title}</h3>
        <p>{recipe.summary}</p>
        {savedAt && (
          <small className="recipe-card-saved-date">
            Saved {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(savedAt))}
          </small>
        )}
      </div>

      <dl className="recipe-card-meta">
        <div>
          <dt>
            <Clock3 size={15} aria-hidden="true" /> Total time
          </dt>
          <dd>{recipe.time.totalMinutes} min</dd>
        </div>
        <div>
          <dt>
            <UsersRound size={15} aria-hidden="true" /> Servings
          </dt>
          <dd>{recipe.servings}</dd>
        </div>
        <div>
          <dt>
            <CookingPot size={15} aria-hidden="true" /> Meal
          </dt>
          <dd>{recipe.mealTypes.map(humanizeRecipeValue).join(', ')}</dd>
        </div>
      </dl>

      <dl className="recipe-card-nutrition" aria-label="Estimated nutrition per serving">
        {keyMetrics.map((metric) => (
          <div key={metric.key}>
            <dt>{metric.label}</dt>
            <dd>
              {formatRecipeNutritionValue(recipe.nutritionPerServing[metric.key])}{' '}
              <small>{metric.unit}</small>
            </dd>
          </div>
        ))}
      </dl>

      <div className="recipe-card-ingredients">
        <IngredientPreview
          label="Already available"
          ingredients={recipe.ingredients.available}
          emptyLabel="No direct ingredient matches"
        />
        <IngredientPreview
          label="Additional ingredients"
          ingredients={recipe.ingredients.additional}
          emptyLabel="Nothing extra needed"
        />
      </div>

      <p className="recipe-card-reason">{recipe.match.reason}</p>

      <div className="recipe-card-actions">
        {context === 'recommendation' && onSave && (
          <Button
            type="button"
            variant={isSaved ? 'secondary' : 'primary'}
            disabled={isSaved || isSaving}
            aria-busy={isSaving || undefined}
            aria-label={`${isSaved ? 'Recipe saved' : 'Save recipe'}: ${recipe.title}`}
            onClick={() => onSave(recipe)}
          >
            {isSaving ? (
              <LoaderCircle className="recipe-button-spinner" size={16} aria-hidden="true" />
            ) : isSaved ? (
              <BookmarkCheck size={16} aria-hidden="true" />
            ) : (
              <BookmarkPlus size={16} aria-hidden="true" />
            )}
            {isSaving ? 'Saving...' : isSaved ? 'Saved' : 'Save recipe'}
          </Button>
        )}
        {context === 'saved' && onRemove && (
          <Button
            type="button"
            variant="secondary"
            className="recipe-card-remove"
            disabled={isRemoving}
            aria-busy={isRemoving || undefined}
            aria-label={`Remove saved recipe: ${recipe.title}`}
            onClick={onRemove}
          >
            {isRemoving ? (
              <LoaderCircle className="recipe-button-spinner" size={16} aria-hidden="true" />
            ) : (
              <Trash2 size={16} aria-hidden="true" />
            )}
            {isRemoving ? 'Removing...' : 'Remove'}
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          className="recipe-card-open"
          aria-label={`View full recipe: ${recipe.title}`}
          onClick={(event) => onOpen(recipe, event.currentTarget)}
        >
          View full recipe <ArrowUpRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}
