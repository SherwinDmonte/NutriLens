import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Leaf,
  NotebookTabs,
  ShieldCheck,
  Sparkles,
  Target,
  Utensils,
} from 'lucide-react';

import { BrandMark } from '../components/BrandMark.jsx';
import { LandingNutritionVideo } from '../components/LandingNutritionVideo.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { useCurrentMoment } from '../hooks/useCurrentMoment.js';
import { formatCalendarDate, getTodayCalendarDate } from '../utils/calendarDate.js';

const macroProgress = [
  { label: 'Protein', value: '78 / 100 g', percent: 78, tone: 'coral' },
  { label: 'Carbs', value: '156 / 250 g', percent: 62, tone: 'sky' },
  { label: 'Fat', value: '42 / 67 g', percent: 63, tone: 'sun' },
];

const productFeatures = [
  {
    icon: Utensils,
    label: 'Food log',
    title: 'Log a meal without doing the maths.',
    description:
      'Search USDA and Open Food Facts, set a serving, and review server-calculated nutrition before saving.',
    detail: 'Add, edit, delete, and browse by date',
  },
  {
    icon: NotebookTabs,
    label: 'Healthy recipes',
    title: 'Make something useful from what you have.',
    description:
      'Enter ingredients, apply practical filters, and compare ranked recipes with transparent estimated nutrition.',
    detail: 'Gemini-ready with a free bundled fallback',
  },
  {
    icon: ShieldCheck,
    label: 'Private workspace',
    title: 'Your account stays your boundary.',
    description:
      'Food records and saved recipes are scoped to your authenticated account. Provider requests exclude your identity.',
    detail: 'Secure cookie session and isolated records',
  },
];

function ProductPreview({ currentMoment }) {
  const currentDateLabel = formatCalendarDate(getTodayCalendarDate(currentMoment));

  return (
    <div className="product-preview-stage" aria-label="NutriLens daily dashboard preview">
      <div className="product-preview-glow" aria-hidden="true" />
      <Card className="product-preview">
        <header className="product-preview-header">
          <div>
            <span>Today</span>
            <strong>{currentDateLabel}</strong>
          </div>
          <span className="product-preview-calendar" aria-hidden="true">
            <CalendarDays size={17} />
          </span>
        </header>

        <div className="product-preview-summary">
          <div className="product-preview-ring" aria-label="71 percent of calorie target consumed">
            <span>
              <strong>71%</strong>
              <small>of goal</small>
            </span>
          </div>
          <div>
            <span>Calories remaining</span>
            <strong>580</strong>
            <small>of 2,000 kcal</small>
          </div>
        </div>

        <div className="product-preview-macros">
          {macroProgress.map((macro) => (
            <div key={macro.label}>
              <span>
                <strong>{macro.label}</strong>
                <small>{macro.value}</small>
              </span>
              <i className={`preview-progress preview-progress-${macro.tone}`}>
                <span style={{ width: `${macro.percent}%` }} />
              </i>
            </div>
          ))}
        </div>

        <div className="product-preview-meal">
          <span className="product-preview-meal-icon" aria-hidden="true">
            <Utensils size={16} />
          </span>
          <span>
            <strong>Lunch</strong>
            <small>Rice, dal and paneer</small>
          </span>
          <strong>648 kcal</strong>
        </div>
      </Card>

      <div className="product-preview-note product-preview-note-top" aria-hidden="true">
        <Sparkles size={15} /> Nutrition updated
      </div>
      <div className="product-preview-note product-preview-note-bottom" aria-hidden="true">
        <Leaf size={15} /> 3 recipe matches
      </div>
    </div>
  );
}

function NutritionMotionStory() {
  return (
    <section className="motion-story-section section-shell" aria-labelledby="motion-story-heading">
      <div className="motion-story-copy">
        <p className="eyebrow">The NutriLens flow</p>
        <h2 id="motion-story-heading">One meal becomes a useful next step.</h2>
        <p>
          A simple log moves through one trusted nutrition layer, then becomes progress you can read
          and ingredients you can use.
        </p>
        <ul>
          <li>
            <Check size={15} aria-hidden="true" /> Server-calculated nutrition
          </li>
          <li>
            <Check size={15} aria-hidden="true" /> Explainable recipe matching
          </li>
        </ul>
      </div>

      <LandingNutritionVideo />
    </section>
  );
}

export function LandingPage() {
  const currentMoment = useCurrentMoment();

  return (
    <div className="landing-page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="site-header">
        <nav className="nav-shell" aria-label="Primary navigation">
          <BrandMark />
          <div className="nav-links">
            <a href="#features">What you can do</a>
            <a href="#how-it-works">How it works</a>
          </div>
          <div className="nav-actions">
            <ThemeToggle />
            <ButtonLink variant="ghost" to="/login">
              Log in
            </ButtonLink>
            <ButtonLink className="nav-cta" to="/register">
              Get started <ArrowRight size={16} aria-hidden="true" />
            </ButtonLink>
          </div>
        </nav>
      </header>

      <main id="main-content">
        <section className="hero section-shell">
          <div className="hero-copy">
            <h1>
              Nutrition clarity, <em>without the noise.</em>
            </h1>
            <p className="hero-description">
              Track meals, understand daily nutrition, and turn ingredients into practical recipes
              in one private workspace.
            </p>
            <div className="hero-actions">
              <ButtonLink to="/register">
                Create your free account <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
              <a className="button button-secondary" href="#features">
                Explore NutriLens
              </a>
            </div>
            <ul className="hero-proof" aria-label="NutriLens product benefits">
              <li>
                <Check size={15} aria-hidden="true" /> No paid API required
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Honest nutrition estimates
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Your records stay private
              </li>
            </ul>
          </div>

          <ProductPreview currentMoment={currentMoment} />
        </section>

        <section className="product-principles" aria-label="Product principles">
          <div className="section-shell">
            <span>
              <Target size={18} aria-hidden="true" /> Daily targets that stay understandable
            </span>
            <span>
              <Clock3 size={18} aria-hidden="true" /> Fast, reversible food logging
            </span>
            <span>
              <ShieldCheck size={18} aria-hidden="true" /> Authenticated private storage
            </span>
          </div>
        </section>

        <NutritionMotionStory />

        <section className="product-section section-shell" id="features">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow">One focused nutrition workspace</p>
              <h2>Useful at every step, quiet everywhere else.</h2>
            </div>
            <p>
              NutriLens keeps the actions you use every day close and moves the detailed evidence
              one level deeper.
            </p>
          </div>

          <div className="product-feature-grid">
            {productFeatures.map(({ icon: Icon, label, title, description, detail }) => (
              <Card className="product-feature-card" key={label}>
                <span className="product-feature-icon" aria-hidden="true">
                  <Icon size={21} />
                </span>
                <p className="product-feature-label">{label}</p>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="product-feature-detail">
                  <Check size={14} aria-hidden="true" /> {detail}
                </span>
              </Card>
            ))}
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="section-shell how-shell">
            <div className="how-copy">
              <p className="eyebrow eyebrow-light">A simple daily rhythm</p>
              <h2>From a meal to a clearer next choice.</h2>
              <p>
                Start with the facts you know. NutriLens handles the calculations and keeps every
                result explainable.
              </p>
              <ButtonLink variant="light" to="/register">
                Start tracking <ArrowRight size={17} aria-hidden="true" />
              </ButtonLink>
            </div>
            <ol className="steps-list">
              <li>
                <span>01</span>
                <div>
                  <strong>Log what you ate</strong>
                  <p>Choose a food, serving, meal, and date.</p>
                </div>
                <ChevronRight aria-hidden="true" />
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Read the day at a glance</strong>
                  <p>See consumed, remaining, and over-target values.</p>
                </div>
                <ChevronRight aria-hidden="true" />
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Use ingredients intelligently</strong>
                  <p>Generate, inspect, and optionally save a recipe.</p>
                </div>
                <ChevronRight aria-hidden="true" />
              </li>
            </ol>
          </div>
        </section>

        <section className="closing-section section-shell">
          <div className="closing-card">
            <div className="closing-copy">
              <p className="eyebrow">Your next meal can be clearer</p>
              <h2>Build a nutrition record you can actually use.</h2>
              <p>Start free with manual food logging and healthy recipe recommendations.</p>
              <ButtonLink to="/register">
                Create your account <ArrowRight size={18} aria-hidden="true" />
              </ButtonLink>
            </div>
            <div className="closing-metric" aria-hidden="true">
              <span>Today</span>
              <strong>4</strong>
              <small>clear choices logged</small>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer section-shell">
        <BrandMark />
        <p>Clear food tracking and practical recipes.</p>
        <div>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <span>© {currentMoment.getFullYear()} NutriLens</span>
        </div>
      </footer>
    </div>
  );
}
