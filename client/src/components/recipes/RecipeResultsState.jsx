import {
  AlertTriangle,
  ChefHat,
  CircleGauge,
  ListRestart,
  RefreshCw,
  Salad,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  UtensilsCrossed,
  WifiOff,
} from 'lucide-react';

import { getRecipeCriteria } from '../../utils/recipeRecommendationForm.js';
import { Button } from '../ui/Button.jsx';
import { RecipeResults } from './RecipeResults.jsx';

function AppliedCriteria({ request }) {
  const criteria = getRecipeCriteria(request);
  if (criteria.length === 0) return null;

  return (
    <div className="recipe-state-criteria" aria-label="Criteria applied to this request">
      {criteria.map((criterion) => (
        <span
          key={criterion.key}
          className={`recipe-criteria-chip recipe-criteria-chip-${criterion.type}`}
        >
          {criterion.label}
        </span>
      ))}
    </div>
  );
}

function ResultState({ icon: Icon, eyebrow, title, description, children, role }) {
  return (
    <div className="recipe-result-state" role={role}>
      <span className="recipe-result-state-icon" aria-hidden="true">
        <Icon size={32} strokeWidth={1.6} />
      </span>
      <p className="dashboard-kicker">{eyebrow}</p>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}

function LoadingResults({ onCancel }) {
  return (
    <div className="recipe-results-loading" aria-live="polite" aria-busy="true">
      <div className="recipe-loading-orbit" aria-hidden="true">
        <ChefHat size={29} />
      </div>
      <p className="dashboard-kicker">Building matches</p>
      <h3>Finding practical recipes...</h3>
      <p>
        NutriLens is validating ingredients, estimating nutrition, applying your filters, and
        preparing ingredient-matched covers.
      </p>
      <div className="recipe-loading-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel request
      </Button>
    </div>
  );
}

function ErrorResults({ error, onRetry, onResetFilters, onReviewInputs }) {
  const Icon =
    error.kind === 'network'
      ? WifiOff
      : error.kind === 'unauthorized'
        ? ShieldAlert
        : error.kind === 'validation'
          ? SlidersHorizontal
          : AlertTriangle;

  return (
    <ResultState
      icon={Icon}
      eyebrow="Request needs attention"
      title={error.title}
      description={error.message}
      role="alert"
    >
      <div className="recipe-result-actions">
        {error.retryable && (
          <Button type="button" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden="true" /> Retry request
          </Button>
        )}
        {error.kind === 'validation' ? (
          <Button type="button" variant="secondary" onClick={onReviewInputs}>
            <SlidersHorizontal size={16} aria-hidden="true" /> Review inputs
          </Button>
        ) : (
          error.kind !== 'unauthorized' && (
            <Button type="button" variant="secondary" onClick={onResetFilters}>
              <ListRestart size={16} aria-hidden="true" /> Reset filters
            </Button>
          )
        )}
      </div>
    </ResultState>
  );
}

function RecipeOnboardingState({ ingredientCount }) {
  const isReady = ingredientCount > 0;

  return (
    <div className={`recipe-onboarding-state${isReady ? ' is-ready' : ''}`} role="status">
      <div className="recipe-onboarding-copy">
        <span className="recipe-result-state-icon" aria-hidden="true">
          {isReady ? <Sparkles size={28} /> : <Salad size={28} />}
        </span>
        <p className="dashboard-kicker">{isReady ? 'Ready when you are' : 'Recipe board'}</p>
        <h3>
          {isReady ? 'Your ingredient list is ready.' : 'Start with what is in your kitchen.'}
        </h3>
        <p>
          {isReady
            ? 'Adjust any optional filters, then find recipes. Only the latest request can update this board.'
            : 'Add at least one ingredient. Validated recommendations will appear here with honest provider and nutrition labels.'}
        </p>
      </div>

      <div className="recipe-onboarding-flow" aria-hidden="true">
        <article className={isReady ? 'is-complete' : 'is-active'}>
          <span>
            <Salad size={18} />
          </span>
          <div>
            <strong>Ingredients</strong>
            <p>{isReady ? `${ingredientCount} ready` : 'Add what you have'}</p>
          </div>
        </article>
        <article className={isReady ? 'is-active' : ''}>
          <span>
            <SlidersHorizontal size={18} />
          </span>
          <div>
            <strong>Preferences</strong>
            <p>Filters are verified</p>
          </div>
        </article>
        <article>
          <span>
            <CircleGauge size={18} />
          </span>
          <div>
            <strong>Clear matches</strong>
            <p>Nutrition is estimated</p>
          </div>
        </article>
      </div>

      <p className="recipe-onboarding-note">
        {isReady
          ? 'Use Find recipes when your filters look right.'
          : 'Nothing is sent to a recipe provider until you choose Find recipes.'}
      </p>
    </div>
  );
}

export function RecipeResultsState({
  status,
  data,
  error,
  ingredientCount,
  onCancel,
  onRetry,
  onResetFilters,
  onReviewInputs,
  onSave,
  savedRecipeSourceIds,
  savingRecipeIds,
  request,
}) {
  if (status === 'loading') return <LoadingResults onCancel={onCancel} />;
  if (status === 'success') {
    return (
      <RecipeResults
        data={data}
        onSave={onSave}
        savedRecipeSourceIds={savedRecipeSourceIds}
        savingRecipeIds={savingRecipeIds}
        request={request}
      />
    );
  }
  if (status === 'no-match') {
    return (
      <ResultState
        icon={UtensilsCrossed}
        eyebrow="No exact match"
        title="Those filters are too tight for the current ingredients."
        description="Nothing unsafe or unrelated was substituted. Remove a strict limit, reset the optional filters, or adjust your ingredients."
        role="status"
      >
        <AppliedCriteria request={request} />
        <div className="recipe-result-actions">
          <Button type="button" onClick={onResetFilters}>
            <ListRestart size={16} aria-hidden="true" /> Reset optional filters
          </Button>
        </div>
      </ResultState>
    );
  }
  if (status === 'error') {
    return (
      <ErrorResults
        error={error}
        onRetry={onRetry}
        onResetFilters={onResetFilters}
        onReviewInputs={onReviewInputs}
      />
    );
  }
  if (ingredientCount > 0) {
    return <RecipeOnboardingState ingredientCount={ingredientCount} />;
  }
  return <RecipeOnboardingState ingredientCount={ingredientCount} />;
}
