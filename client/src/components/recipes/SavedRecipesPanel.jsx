import { useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { RecipeCard } from './RecipeCard.jsx';
import { RecipeDetailsDialog } from './RecipeDetailsDialog.jsx';

export function SavedRecipesPanel({ savedRecipes }) {
  const [selectedSavedRecipe, setSelectedSavedRecipe] = useState(null);
  const detailsTriggerRef = useRef(null);
  const {
    status,
    savedRecipes: items,
    pagination,
    error,
    feedback,
    removingSavedRecipeIds,
    load,
    remove,
  } = savedRecipes;

  function openDetails(recipe, trigger, savedRecipe) {
    detailsTriggerRef.current = trigger;
    setSelectedSavedRecipe(savedRecipe);
  }

  function closeDetails() {
    setSelectedSavedRecipe(null);
    window.requestAnimationFrame(() => detailsTriggerRef.current?.focus());
  }

  return (
    <Card className="saved-recipes-panel" as="section">
      <div className="saved-recipes-heading">
        <span aria-hidden="true">
          <Bookmark size={20} />
        </span>
        <div>
          <p className="dashboard-kicker">Your collection</p>
          <h2>Saved recipes</h2>
          <p>Recipes are saved only when you choose and remain available as complete snapshots.</p>
        </div>
        {pagination.total > 0 && (
          <strong>
            {pagination.total} saved recipe{pagination.total === 1 ? '' : 's'}
          </strong>
        )}
      </div>

      {feedback && (
        <p
          className={`saved-recipes-feedback saved-recipes-feedback-${feedback.tone}`}
          role="status"
        >
          {feedback.message}
        </p>
      )}

      {status === 'loading' && (
        <div className="saved-recipes-state" role="status" aria-live="polite">
          <span className="saved-recipes-loader" aria-hidden="true" />
          <h3>Loading your saved recipes...</h3>
        </div>
      )}

      {status === 'error' && (
        <div className="saved-recipes-state" role="alert">
          <h3>Saved recipes could not be loaded.</h3>
          <p>{error}</p>
          <Button type="button" variant="secondary" onClick={() => load(pagination.page || 1)}>
            <RefreshCw size={16} aria-hidden="true" /> Retry
          </Button>
        </div>
      )}

      {status === 'ready' && items.length === 0 && (
        <div className="saved-recipes-state saved-recipes-empty" role="status">
          <Bookmark size={30} aria-hidden="true" />
          <h3>No saved recipes yet.</h3>
          <p>Generate recommendations and use Save recipe to build a private collection.</p>
        </div>
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <div
            className="recipe-card-grid saved-recipe-card-grid"
            role="list"
            aria-label="Saved recipes"
          >
            {items.map((savedRecipe, index) => (
              <RecipeCard
                key={savedRecipe.id}
                recipe={savedRecipe.recipe}
                index={index}
                context="saved"
                savedAt={savedRecipe.createdAt}
                isRemoving={removingSavedRecipeIds.includes(savedRecipe.id)}
                onOpen={(recipe, trigger) => openDetails(recipe, trigger, savedRecipe)}
                onRemove={() => remove(savedRecipe)}
              />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <nav className="saved-recipes-pagination" aria-label="Saved recipe pages">
              <Button
                type="button"
                variant="secondary"
                disabled={pagination.page <= 1 || status === 'loading'}
                onClick={() => load(pagination.page - 1)}
              >
                <ChevronLeft size={16} aria-hidden="true" /> Previous
              </Button>
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={pagination.page >= pagination.totalPages || status === 'loading'}
                onClick={() => load(pagination.page + 1)}
              >
                Next <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}

      <RecipeDetailsDialog
        open={Boolean(selectedSavedRecipe)}
        recipe={selectedSavedRecipe?.recipe}
        provider={selectedSavedRecipe?.provider}
        onClose={closeDetails}
      />
    </Card>
  );
}
