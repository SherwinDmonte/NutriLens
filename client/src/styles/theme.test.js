import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { describe, it } from 'vitest';

const themeCss = readFileSync(resolve(process.cwd(), 'src/styles/theme.css'), 'utf8');
const mainSource = readFileSync(resolve(process.cwd(), 'src/main.jsx'), 'utf8');

describe('dark recipe surfaces', () => {
  it('loads theme overrides after recipe refinements', () => {
    const refinementImport = mainSource.indexOf("import './styles/refinement.css'");
    const themeImport = mainSource.indexOf("import './styles/theme.css'");

    assert.ok(refinementImport >= 0);
    assert.ok(themeImport > refinementImport);
  });

  it('replaces every light recipe-card inset with an intentional dark surface', () => {
    assert.match(
      themeCss,
      /html\[data-theme='dark'\] \.recipe-card-meta > div \{\s*background: var\(--surface-soft\);\s*\}/,
    );
    assert.match(
      themeCss,
      /html\[data-theme='dark'\] \.recipe-card-nutrition > div \{\s*background: var\(--surface-muted\);\s*\}/,
    );
    assert.match(
      themeCss,
      /html\[data-theme='dark'\] \.recipe-card-ingredient-group \{\s*background: var\(--surface\);\s*\}/,
    );
    assert.match(
      themeCss,
      /html\[data-theme='dark'\] \.recipe-match-gauge \{[\s\S]*?background: var\(--success-surface\);\s*\}/,
    );
  });
});
