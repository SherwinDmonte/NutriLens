import { ArrowLeft } from 'lucide-react';

import { BrandMark } from '../components/BrandMark.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { ButtonLink } from '../components/ui/Button.jsx';

export function NotFoundPage() {
  return (
    <main className="status-page">
      <div className="status-page-header">
        <BrandMark />
        <ThemeToggle />
      </div>
      <p className="eyebrow">404</p>
      <h1>This page is not on the menu.</h1>
      <p>The address may be incorrect. Your NutriLens data is safe and unchanged.</p>
      <ButtonLink to="/">
        <ArrowLeft size={16} aria-hidden="true" /> Return home
      </ButtonLink>
    </main>
  );
}
