import { Component, useRef, useState } from 'react';
import { Bookmark, ChefHat, Info, Sparkles } from 'lucide-react';

import { AuthenticatedAppShell } from '../components/auth/AuthenticatedAppShell.jsx';
import { IngredientEditor } from '../components/recipes/IngredientEditor.jsx';
import { RecipePreferences } from '../components/recipes/RecipePreferences.jsx';
import { RecipeResultsState } from '../components/recipes/RecipeResultsState.jsx';
import { SavedRecipesPanel } from '../components/recipes/SavedRecipesPanel.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { useAuth } from '../context/authContext.js';
import { useRecipeRecommendations } from '../hooks/useRecipeRecommendations.js';
import { useSavedRecipes } from '../hooks/useSavedRecipes.js';
import {
  buildRecipeRecommendationRequest,
  createDefaultRecipePreferences,
  mapRecipeApiFieldErrors,
} from '../utils/recipeRecommendationForm.js';

class RecipeWorkspaceBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) console.error('Recipe workspace render error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="recipes-page-error" role="alert">
          <p className="dashboard-kicker">Recipe workspace unavailable</p>
          <h1>We couldn’t prepare this page.</h1>
          <p>Refresh the page to try loading the recipe workspace again.</p>
          <Button type="button" onClick={() => window.location.reload()}>
            Refresh page
          </Button>
        </section>
      );
    }
    return this.props.children;
  }
}

const recipeViews = [
  {
    id: 'discover',
    label: 'Find recipes',
    panelId: 'recipe-discover-panel',
    icon: Sparkles,
  },
  {
    id: 'saved',
    label: 'Saved',
    panelId: 'recipe-saved-panel',
    icon: Bookmark,
  },
];

export function RecipeViewSwitch({ activeView, onChange, savedCount = 0 }) {
  const tabRefs = useRef(new Map());

  function activateView(viewId, moveFocus = false) {
    onChange(viewId);
    if (moveFocus) tabRefs.current.get(viewId)?.focus();
  }

  function handleKeyDown(event, index) {
    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % recipeViews.length;
    if (event.key === 'ArrowLeft')
      nextIndex = (index - 1 + recipeViews.length) % recipeViews.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = recipeViews.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    activateView(recipeViews[nextIndex].id, true);
  }

  return (
    <div className="recipes-view-switch" role="tablist" aria-label="Recipe workspace views">
      {recipeViews.map((view, index) => {
        const Icon = view.icon;
        const isSelected = activeView === view.id;
        return (
          <button
            key={view.id}
            ref={(node) => {
              if (node) tabRefs.current.set(view.id, node);
              else tabRefs.current.delete(view.id);
            }}
            id={`recipe-${view.id}-tab`}
            type="button"
            role="tab"
            aria-label={
              view.id === 'saved' && savedCount > 0
                ? `Saved recipes, ${savedCount} saved`
                : undefined
            }
            aria-controls={view.panelId}
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={isSelected ? 'active' : ''}
            onClick={() => activateView(view.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <Icon size={16} aria-hidden="true" /> {view.label}
            {view.id === 'saved' && savedCount > 0 && <span>{savedCount}</span>}
          </button>
        );
      })}
    </div>
  );
}

function RecipeWorkspace() {
  const [activeView, setActiveView] = useState('discover');
  const [ingredients, setIngredients] = useState([]);
  const [preferences, setPreferences] = useState(createDefaultRecipePreferences);
  const [fieldErrors, setFieldErrors] = useState({});
  const { refreshSession } = useAuth();
  const recommendations = useRecipeRecommendations({ onUnauthorized: refreshSession });
  const savedRecipes = useSavedRecipes({ onUnauthorized: refreshSession });

  function updateIngredients(nextIngredients) {
    recommendations.reset();
    setFieldErrors({});
    setIngredients(nextIngredients);
  }

  function updatePreferences(nextPreferences) {
    recommendations.reset();
    setFieldErrors({});
    setPreferences(nextPreferences);
  }

  async function requestRecommendations(event) {
    event.preventDefault();
    if (recommendations.isLoading) return;
    const result = buildRecipeRecommendationRequest({ ingredients, preferences });
    setFieldErrors(result.errors);
    if (!result.request) return;

    const outcome = await recommendations.submit(result.request);
    if (outcome?.status === 'error' && outcome.errorPresentation.kind === 'validation') {
      setFieldErrors(mapRecipeApiFieldErrors(outcome.error));
    }
  }

  function resetOptionalFilters() {
    recommendations.reset();
    setFieldErrors({});
    setPreferences(createDefaultRecipePreferences());
  }

  function reviewInputs() {
    document.getElementById('recipe-preferences-heading')?.focus();
  }

  return (
    <div className="recipes-shell">
      <section className="recipes-hero" aria-labelledby="recipes-heading">
        <div>
          <p className="dashboard-kicker">Recipe workspace</p>
          <h1 id="recipes-heading">Cook well with what you already have.</h1>
          <p>
            Add ingredients, choose what matters, and compare practical recipes with transparent
            scoring and estimated nutrition.
          </p>
        </div>
      </section>

      <RecipeViewSwitch
        activeView={activeView}
        onChange={setActiveView}
        savedCount={savedRecipes.pagination.total}
      />

      {activeView === 'discover' ? (
        <div
          id="recipe-discover-panel"
          role="tabpanel"
          aria-labelledby="recipe-discover-tab"
          className="recipes-discover-view"
        >
          <aside className="recipe-provider-note" aria-label="How recommendations are created">
            <Info size={17} aria-hidden="true" />
            <p>
              Recipe text may come from Gemini or the bundled fallback. Covers are generated
              separately from each validated recipe's main ingredients, while nutrition is always
              calculated independently and shown as an estimate.
            </p>
          </aside>

          <div className="recipes-workspace-grid">
            <Card className="recipe-input-panel" as="section">
              <div className="recipe-panel-heading">
                <span aria-hidden="true">
                  <Sparkles size={19} />
                </span>
                <div>
                  <p className="dashboard-kicker">Step 1</p>
                  <h2>What is in your kitchen?</h2>
                </div>
              </div>
              <p className="recipe-panel-copy">
                Add at least one ingredient. Quantities and filters are optional.
              </p>
              <IngredientEditor ingredients={ingredients} onChange={updateIngredients} />
              <RecipePreferences
                preferences={preferences}
                errors={fieldErrors}
                ingredientCount={ingredients.length}
                isLoading={recommendations.isLoading}
                onChange={updatePreferences}
                onSubmit={requestRecommendations}
                onCancel={recommendations.cancel}
              />
            </Card>

            <Card className="recipe-results-panel" as="section">
              <div className="recipe-panel-heading">
                <span aria-hidden="true">
                  <ChefHat size={19} />
                </span>
                <div>
                  <p className="dashboard-kicker">Step 2</p>
                  <h2>Compare your matches</h2>
                </div>
              </div>
              <RecipeResultsState
                status={recommendations.status}
                data={recommendations.data}
                error={recommendations.errorPresentation}
                ingredientCount={ingredients.length}
                onCancel={recommendations.cancel}
                onRetry={recommendations.retry}
                onResetFilters={resetOptionalFilters}
                onReviewInputs={reviewInputs}
                onSave={savedRecipes.save}
                savedRecipeSourceIds={savedRecipes.savedRecipeSourceIds}
                savingRecipeIds={savedRecipes.savingRecipeIds}
                request={recommendations.lastRequest}
              />
            </Card>
          </div>
        </div>
      ) : (
        <div
          id="recipe-saved-panel"
          role="tabpanel"
          aria-labelledby="recipe-saved-tab"
          className="recipes-saved-view"
        >
          <SavedRecipesPanel savedRecipes={savedRecipes} />
        </div>
      )}
    </div>
  );
}

export function RecipesPage() {
  return (
    <AuthenticatedAppShell contentId="recipes-content">
      <RecipeWorkspaceBoundary>
        <RecipeWorkspace />
      </RecipeWorkspaceBoundary>
    </AuthenticatedAppShell>
  );
}
