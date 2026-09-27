# NutriLens UI/UX Audit and Redesign Record

Last reviewed: 2026-09-27  
Status: maintained design record for the current implementation  
Scope: every currently implemented client route and its supporting states  
Product boundary: preserve authentication, Manual Food Logging, Healthy Recipe Recommendation, and
Saved Recipes behavior while redesigning their presentation and interaction hierarchy.

## Executive assessment

The original interface had a strong wellness identity and good functional coverage, but visual
weight accumulated as features were added phase by phase. Large rounded panels, repeated summaries,
oversized provider explanations, dense recipe cards, and a crowded mobile header made the product
feel more like a collection of feature demonstrations than one focused application. The redesign
keeps the established green editorial identity while making the interface quieter, denser where it
helps scanning, and more explicit about the user's next action.

## Audit findings by surface

### Landing page

- Healthy Recipes was still presented as a future feature after the feature had shipped.
- The promise ticker, three manual-logging demonstrations, future-module grid, illustration block,
  and closing call to action repeated similar claims and created a long marketing page.
- Several floating decorative elements competed with the actual dashboard preview.
- The page focused almost entirely on Manual Food Logging and no longer described the implemented
  product accurately.

Redesign decision: use one product preview, three current capabilities, one three-step workflow, and
one final call to action. Remove the animated promise ticker and speculative feature roadmap. Present
Food Log and Healthy Recipes as current capabilities, with free-first and privacy language kept
factual. The redundant “Food log + recipes, now available” badge was later removed because it
repeated information already communicated by the capability section and primary calls to action.

Current media decision: use one purposeful, licensed local MP4 in the landing story, paired with a
poster image. Load the video only as it approaches the viewport, preserve its aspect ratio and allow
the user to pause it. Reduced-motion preferences and data-saver connections receive the static
poster instead. This keeps the visual demonstration useful without making video a prerequisite for
understanding or using the page.

### Authentication

- The split layout was appropriate, but the form and story panels used larger radii, shadows, and
  type than the rest of the product.
- Security information was useful but visually dominant relative to the sign-in task on smaller
  screens.

Redesign decision: retain the trusted split layout, tighten typography and form controls, hide the
secondary security list on compact screens, and keep errors adjacent to the form.

### Application navigation

- The desktop sidebar mixed navigation, account identity, and logout without a clear section label.
- Mobile placed four icon-only navigation actions plus logout in the top header, producing crowding
  and weak discoverability.

Redesign decision: use a restrained desktop rail with a labeled Workspace group and linked account
summary. On mobile, keep brand/account controls in the header and move the four labeled destinations
to a persistent bottom navigation surface.

### Dashboard and food log

- Four status cards repeated values already available in the nutrition progress and food-log areas.
- The Product overview link was a low-frequency action placed beside the primary Add food action.
- Nutrition cards, meal sections, the whole-day empty state, and fiber context all competed for
  attention with similar card styling.
- Two-column meal content could become narrow before the old layout changed breakpoints.

Redesign decision: remove the duplicate status cards and overview link. Keep the date navigator,
primary Add food action, four required nutrient summaries, meal log, and fiber context. Reduce card
elevation, strengthen spacing hierarchy, and introduce early two-to-one-column fallbacks.

### Add, edit, and delete food

- The workflow was complete and accessible, but wide modal content could become compressed at
  tablet widths.
- Nutrition preview and form controls needed the same compact control language as the main app.

Redesign decision: preserve all server-preview and reconciliation behavior, keep form and nutrition
preview side by side only when there is enough width, then stack them. Make action rows full-width on
mobile and retain explicit destructive confirmation.

### Recipe recommendation

- The provider explanation occupied a large dark panel before the user's actual task.
- Recipe discovery and the complete Saved Recipes collection were stacked on one long page.
- Recommendation cards showed badges, a circular score gauge, metadata, nutrition, ingredient lists,
  a quotation, and actions at once; this caused excessive height and overlap risk.
- The input/results split remained active too far into laptop/tablet widths.

Redesign decision: replace the provider panel with a compact factual note. Add Find recipes and Saved
views for progressive disclosure. Convert match scoring to a compact label, shorten ingredient
previews, use one recommendation-card column, and collapse the workspace earlier. Complete evidence
remains available in the detail dialog.

### Saved recipes

- Saving behavior was explicit and correct, but the collection competed with recommendation results
  even when the user was not managing saved items.

Redesign decision: keep saving explicit and place the collection in its own Saved view. Retain empty,
loading, retry, pagination, remove feedback, and full detail states.

### Profile and settings

- Name and email were separated into two oversized cards.
- There was no real settings route or settings API. Adding switches or edit controls would have been
  misleading and nonfunctional.

Redesign decision: combine identity into one account surface and add concise, factual session,
storage, and provider-privacy explanations. Treat this as the account/settings destination until a
real user-preference capability exists.

### Error, loading, empty, and success states

- Functional states existed throughout, but their size, border radius, and density varied.
- The 404 action used a legacy class rather than the shared button primitive.

Redesign decision: normalize state containers, keep messages action-oriented, retain live regions and
retry/cancel actions, and use the shared button component on the 404 screen.

### Light and dark appearance

- The original client exposed only a light palette, while several components also embedded fixed
  white and pale feedback surfaces that could not participate in a second theme.
- Applying dark colors after React mounted would create a visible light flash, and an authenticated
  switch alone would leave the landing and sign-in routes without a discoverable preference.

Redesign decision: retain the existing light theme and add a purpose-built dark surface and ink
hierarchy through shared tokens plus targeted legacy-surface overrides. Follow the operating-system
preference on first use, persist an explicit user choice, apply it before the first render, and place
an accessible switch in every public and authenticated shell. Keep charts, semantic feedback,
autofill, native form controls, dialogs, navigation glass, and responsive states theme-aware.

### Brand identity

- The original mark was a useful CSS placeholder, but it was not a final identity asset and could
  not serve as a favicon or high-fidelity product mark.
- Five supplied directions were reviewed against the implemented product rather than their package
  descriptions: Focus Leaf, Macro Monogram, Plate Scan, Nourish Pulse, and Aperture Bloom.

Redesign decision: use Focus Leaf exclusively. Its lens-shaped `N` and leaf preserve the product's
established visual language while remaining relevant to both manual logging and recipes. Use the
provided deep-navy/emerald icon on light surfaces and white/mint icon on dark surfaces, paired with
the existing Manrope wordmark for compact interface clarity. Reuse the shared component everywhere
instead of adding page-specific logo treatments, and use the icon-only form where mobile or loading
space is constrained.

## Unified visual language

- Typography: Manrope for interface text; Newsreader for high-level editorial headings only.
- Color: warm neutral surfaces, deep forest structure, lime as a controlled positive accent, and
  coral/sky/sun only for nutrient differentiation. Dark mode uses layered forest-black surfaces,
  softened off-white text, and semantic tinted feedback instead of mechanically inverted colors.
- Spacing: an 8-pixel-informed scale with 12-24 pixel component padding and larger section spacing.
- Radius: 8-18 pixels for controls and product surfaces; 24-32 pixels only for major marketing
  containers.
- Elevation: borders and low shadows by default; stronger shadows reserved for dialogs and the
  marketing preview.
- Motion: short opacity/transform entrances, progress transitions, and one purposeful landing-page
  video sequence with lightweight interface motion; no layout-affecting animation. Reduced-motion
  preferences remain authoritative, and the landing video exposes a pause control.
- Breakpoints: wide desktop, compact desktop/laptop at 1180 pixels, tablet/mobile navigation at 900
  pixels, compact content at 680/620 pixels, and narrow-phone safeguards at 420/390 pixels.

## Accessibility and performance decisions

- Preserve semantic headings, landmarks, skip links, labels, native dialog behavior, live regions,
  focus restoration, and explicit progress semantics.
- Maintain visible keyboard focus and at least 40-44 pixel primary control targets.
- Expose the appearance control with a changing accessible name and pressed state; keep the saved
  choice stable across navigation, reloads, and browser tabs.
- Keep representative dark primary, secondary, muted, accent, success, warning, and error text
  combinations above WCAG AA contrast requirements.
- Label mobile navigation items instead of using icons alone.
- Allow long titles, emails, ingredient names, and numeric values to wrap or truncate within bounded
  containers rather than force horizontal overflow.
- Use CSS-generated visual structure and existing Lucide icons for interface decoration. The single
  landing-page story video is an optimized, licensed local MP4 with a fixed poster-sized container,
  viewport-aware lazy loading, a pause control, and static-poster fallbacks for reduced motion and
  data-saver connections. It does not require a runtime animation dependency or cause layout shift.
- Keep state-driven rendering unchanged so the redesign does not introduce new API calls or data
  fetching.

## Screenshot-led verification follow-up

The supplied desktop screenshots exposed several issues that were not obvious from source review
alone. The recipe-page eyebrow could lose its first letters, the ingredient action wrapped into an
uneven two-line button, the empty result panel devoted too much space to too little guidance, and
long recipe-dialog titles were forced into ellipsis. The follow-up refinement adds safe editorial
line heights and overflow wrapping, keeps action labels intact, replaces the oversized empty state
with a useful three-step recommendation flow, and allows dialog headings to wrap naturally. Subtle
dashboard, account, landing-preview, and recipe-onboarding motion now improves continuity without
moving layout or blocking input.

## Intentionally not added

- No additional decorative video, testimonial carousel, streak system, notifications, profile
  editor, unrelated preference toggles, or standalone Settings page was added because the current
  product has no corresponding behavior or demonstrated user need. The one landing video is retained
  as a focused product-story asset, not background decoration.
- No medical claims, personalization claims, or implication that bundled recipes are live AI output
  was introduced.
