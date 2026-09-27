import { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

import { getRecipeCriteria } from '../../utils/recipeRecommendationForm.js';
import { getFallbackReasonLabel, getRecipeProviderLabel } from '../../utils/recipePresentation.js';
import { Badge } from '../ui/Badge.jsx';
import { RecipeCard } from './RecipeCard.jsx';
import { RecipeDetailsDialog } from './RecipeDetailsDialog.jsx';

export function RecipeResults({ data, request, onSave, savedRecipeSourceIds, savingRecipeIds }) {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const detailsTriggerRef = useRef(null);
  const recipeCount = data.recipes.length;
  const appliedCriteria = getRecipeCriteria(request);

  function openDetails(recipe, trigger) {
    detailsTriggerRef.current = trigger;
    setSelectedRecipe(recipe);
  }

  function closeDetails() {
    if (!selectedRecipe) return;
    setSelectedRecipe(null);
    window.requestAnimationFrame(() => detailsTriggerRef.current?.focus());
  }

  return (
    <div className="recipe-results-success">
      <div className="recipe-results-success-heading" role="status" aria-live="polite">
        <span aria-hidden="true">
          <Sparkles size={21} />
        </span>
        <div>
          <Badge>{getRecipeProviderLabel(data.provider.used)}</Badge>
          <h3>
            {recipeCount} validated recipe {recipeCount === 1 ? 'match' : 'matches'} ready
          </h3>
          <p>Ranked from your ingredients and selected filters. Nutrition is estimated.</p>
          {data.provider.fallbackUsed && (
            <p className="recipe-results-fallback-note">
              {getFallbackReasonLabel(data.provider.fallbackReason)}. The bundled provider supplied
              these recommendations instead.
            </p>
          )}
        </div>
      </div>

      {appliedCriteria.length > 0 && (
        <div className="recipe-results-criteria" aria-label="Criteria applied to these results">
          <div>
            <strong>Applied criteria</strong>
            <small>
              Hard filters were re-checked by the server before these matches were shown.
            </small>
          </div>
          <div>
            {appliedCriteria.map((criterion) => (
              <span
                key={criterion.key}
                className={`recipe-criteria-chip recipe-criteria-chip-${criterion.type}`}
              >
                {criterion.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="recipe-card-grid" role="list" aria-label="Recommended recipes">
        {data.recipes.map((recipe, index) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            index={index}
            onOpen={openDetails}
            onSave={onSave ? (selectedRecipe) => onSave(selectedRecipe, data.provider) : undefined}
            isSaved={savedRecipeSourceIds?.has(recipe.id)}
            isSaving={savingRecipeIds?.includes(recipe.id)}
          />
        ))}
      </div>

      <RecipeDetailsDialog
        open={Boolean(selectedRecipe)}
        recipe={selectedRecipe}
        provider={data.provider}
        onClose={closeDetails}
      />
    </div>
  );
}
