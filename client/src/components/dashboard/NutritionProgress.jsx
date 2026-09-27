import { Beef, Droplets, Flame, Leaf, Wheat } from 'lucide-react';

import {
  formatNutritionNumber,
  getFiberIntake,
  getNutrientProgress,
  TRACKED_NUTRIENTS,
} from '../../utils/nutritionProgress.js';

const nutrientPresentation = Object.freeze({
  calories: { label: 'Calories', icon: Flame, tone: 'lime' },
  protein: { label: 'Protein', icon: Beef, tone: 'peach' },
  carbohydrates: { label: 'Carbohydrates', icon: Wheat, tone: 'blue' },
  fat: { label: 'Fat', icon: Droplets, tone: 'sun' },
});

export function NutritionProgressCard({ nutrient, summary }) {
  const presentation = nutrientPresentation[nutrient];
  const progress = getNutrientProgress(summary, nutrient);
  const Icon = presentation.icon;
  const headingId = `nutrition-${nutrient}-heading`;
  const progressDescription = progress.isOverTarget
    ? `${progress.progressText}; ${progress.statusText}.`
    : `${progress.progressText}; ${formatNutritionNumber(progress.remaining)} ${progress.unit} remaining.`;

  return (
    <article
      className={`nutrition-progress-card nutrition-progress-card-${presentation.tone}${
        progress.isOverTarget ? ' is-over-target' : ''
      }${progress.isTargetReached ? ' is-target-reached' : ''}`}
      aria-labelledby={headingId}
    >
      <header className="nutrition-card-header">
        <span className="nutrition-card-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div>
          <p>Daily target</p>
          <h3 id={headingId}>{presentation.label}</h3>
        </div>
        <span className="nutrition-card-percentage" key={progress.percentage}>
          {formatNutritionNumber(progress.percentage)}%
        </span>
      </header>

      <div className="nutrition-card-consumed">
        <strong key={progress.consumed}>{formatNutritionNumber(progress.consumed)}</strong>
        <span>{progress.unit} consumed</span>
      </div>

      <div
        className="nutrition-progress-track"
        role="progressbar"
        aria-label={`${presentation.label} daily progress`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progress.visualPercentage}
        aria-valuetext={progressDescription}
      >
        <span style={{ '--nutrition-progress': `${progress.visualPercentage}%` }} />
      </div>

      <dl className="nutrition-card-details">
        <div>
          <dt>Target</dt>
          <dd>
            {formatNutritionNumber(progress.target)} {progress.unit}
          </dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd>
            {formatNutritionNumber(progress.remaining)} {progress.unit}
          </dd>
        </div>
      </dl>

      <p className="nutrition-card-status">
        <span aria-hidden="true" />
        {progress.statusText}
      </p>
    </article>
  );
}

export function NutritionProgressGrid({ summary }) {
  return (
    <section className="nutrition-progress-section" aria-labelledby="nutrition-progress-heading">
      <div className="nutrition-progress-heading">
        <div>
          <p className="dashboard-kicker">Live daily summary</p>
          <h2 id="nutrition-progress-heading">Nutrition progress</h2>
        </div>
        <p>Actual percentages stay visible even after a target is exceeded.</p>
      </div>
      <div className="nutrition-progress-grid">
        {TRACKED_NUTRIENTS.map((nutrient) => (
          <NutritionProgressCard key={nutrient} nutrient={nutrient} summary={summary} />
        ))}
      </div>
    </section>
  );
}

export function FiberIntakeCard({ summary }) {
  const fiber = getFiberIntake(summary);

  return (
    <aside className="fiber-intake-card" aria-labelledby="fiber-intake-heading">
      <span className="fiber-intake-icon" aria-hidden="true">
        <Leaf size={22} />
      </span>
      <p className="dashboard-kicker">Additional intake</p>
      <h2 id="fiber-intake-heading">Fiber</h2>
      <div className="fiber-intake-value">
        <strong key={fiber.consumed}>{formatNutritionNumber(fiber.consumed)}</strong>
        <span>{fiber.unit} consumed</span>
      </div>
      <p>Fiber is tracked from your logged foods without implying a personalized daily target.</p>
      <span className="fiber-no-target">No target configured</span>
    </aside>
  );
}
