# NutriLens

NutriLens is a full-stack nutrition application for authenticated food tracking and healthy recipe discovery. It combines a hybrid food database, server-authoritative nutrition calculations, daily progress tracking, optional Gemini recipe generation, deterministic recipe nutrition and ranking, and explicit saved-recipe persistence.

## Final implementation status

- **Status:** Modules 1 and 2 are implemented, tested, documented, and approved.
- **Last updated:** 2026-09-27
- **Module 1:** Authentication, Manual Food Logging, food search, nutrition preview, daily summaries, and dashboard CRUD are complete.
- **Module 2:** Healthy Recipe Recommendation, Gemini/bundled providers, deterministic nutrition/scoring, filters, result details, and Saved Recipes are complete.
- **Database:** MongoDB Atlas M0 compatible.
- **Themes:** Responsive light and dark themes with reduced-motion support.
- **Deferred:** Image-based food recognition, automated portion estimation, clinical advice, fitness coaching, and automated meal planning.

The detailed implementation guide is available at [Manual Logging and Recipe Recommendation Systems](docs/manual-logging-and-recommendations.md).

## Product capabilities

### Manual Food Logging

- Register, log in, restore a session, and log out.
- Search USDA FoodData Central and Open Food Facts through one normalized catalog.
- Search India-first packaged foods and fall back to global Open Food Facts results.
- Continue with one provider when the other provider is unavailable.
- Display trusted packaged-food images with a safe visual fallback.
- Add custom Indian, regional, homemade, or missing foods.
- Select Breakfast, Lunch, Dinner, or Snack.
- Select supported quantity and serving units.
- Preview server-calculated calories, protein, carbohydrates, fat, and fiber.
- Create, list, edit, move, and delete owned food-log entries.
- Navigate historical and future calendar dates without cross-date leakage.
- View meal calorie subtotals and daily nutrition progress.
- Preserve food-provider attribution, license, missing nutrients, and serving metadata.

### Healthy Recipe Recommendation

- Add, edit, remove, and clear 1-20 ingredient chips.
- Supply optional quantities and canonical units.
- Apply dietary, meal, calorie, and time hard filters.
- Choose Balanced, Higher protein, Higher fiber, or Lower calorie ranking.
- Request 3-5 recipe ideas.
- Generate recipes through optional Gemini or the free bundled provider.
- Fall back safely to bundled generation when Gemini is unavailable or invalid.
- Validate all provider output before use.
- Calculate recipe nutrition independently from structured ingredients.
- Show estimated nutrition coverage, confidence, assumptions, and provenance.
- Rank results with a documented deterministic formula.
- Separate ingredients already available from additional ingredients.
- Display applied criteria, provider mode, fallback reason, and recommendation evidence.
- Optionally attempt an ingredient-aware recipe cover from each validated recipe's actual main ingredients, independently of whether Gemini or the bundled provider supplied the recipe.
- Cache generated covers by an ingredient-and-method signature and never substitute an unrelated stock image when generation is unavailable.
- Save and remove immutable recipe snapshots explicitly.

## Technology stack

| Layer             | Technology                                                  |
| ----------------- | ----------------------------------------------------------- |
| Frontend          | React 19, React Router 7, Vite 8                            |
| UI                | CSS design system, Manrope, Newsreader, Lucide icons        |
| Backend           | Node.js 22+, Express 5                                      |
| Database          | MongoDB Atlas, Mongoose 9                                   |
| Validation        | Zod 4 and Mongoose validation                               |
| Authentication    | JWT, HTTP-only cookies, bcryptjs                            |
| Food data         | USDA FoodData Central and Open Food Facts                   |
| Recipe generation | Google Gemini or bundled deterministic templates            |
| Recipe nutrition  | Bundled deterministic ingredient dataset                    |
| Recipe imagery    | Cloudflare Workers AI FLUX (optional), SHA-256 local cache  |
| Testing           | Node test runner, Supertest, Vitest, Testing Library, jsdom |

## Runtime architecture

```text
Browser
  -> React pages, forms, accessible dialogs, and local request state
  -> credentialed requests to /api
  -> Express security and origin middleware
  -> verified HTTP-only JWT session
  -> strict Zod validation
  -> provider/service/repository layer
  -> deterministic server calculations
  -> owner-scoped MongoDB operation when persistence is needed
  -> sanitized data/meta response
```

The client never reads the JWT and never supplies database ownership. The backend derives ownership from the verified session for every protected operation.

## Repository structure

```text
NutriLens/
|-- client/
|   |-- public/
|   |   |-- brand/               Production logo assets
|   |   `-- media/               Optimized landing media
|   `-- src/
|       |-- components/          Shared UI, dashboard, and recipe components
|       |-- context/             Authentication and theme state
|       |-- hooks/               Dashboard and recipe request lifecycles
|       |-- pages/               Landing, auth, dashboard, recipes, profile
|       |-- services/            Credentialed API clients
|       |-- styles/              Design system and responsive themes
|       `-- utils/               Forms, dates, presentation, view models
|-- server/
|   |-- src/
|       |-- config/              Environment, limits, targets, database schema
|       |-- controllers/         HTTP request/response adaptation
|       |-- data/                Bundled recipe and nutrition datasets
|       |-- middleware/          Auth, validation, security, rate limits, errors
|       |-- models/              User, FoodLog, SavedRecipe
|       |-- providers/           Food, recipe, image, and nutrition adapters
|       |-- repositories/        Owner-scoped MongoDB access
|       |-- routes/              API routing
|       |-- services/            Business rules and calculations
|       |-- validators/          Strict Zod contracts
|       `-- utils/               Dates, recipe units, dietary rules, API errors
|   `-- storage/recipe-images/   Ignored runtime-generated JPEG cache
|-- docs/
|   |-- manual-logging-and-recommendations.md
|   `-- UI_UX_AUDIT.md
`-- README.md
```

## Local setup

### Requirements

- Node.js 22 or newer
- npm 10 or newer
- MongoDB Atlas account and accessible cluster
- Optional free USDA FoodData Central key
- Optional Gemini API key
- Optional free Cloudflare account for ingredient-aware recipe covers

### Install

Run from the repository root:

```powershell
npm ci
```

Use `npm install` only when intentionally changing dependencies and updating `package-lock.json`.

Copy the environment templates:

- `server/.env.example` to `server/.env`
- `client/.env.example` to `client/.env`

Do not commit the completed `.env` files.

### Required server values

```ini
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173

MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority
MONGODB_DATABASE=nutrilens

JWT_SECRET=<at-least-64-random-characters>
JWT_EXPIRES_IN=15m
COOKIE_NAME=nutrilens_session
BCRYPT_ROUNDS=12
```

Create a long JWT secret locally, for example:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Food-provider values

```ini
USDA_FDC_API_KEY=<optional-free-key>
OPEN_FOOD_FACTS_COUNTRY=india
OPEN_FOOD_FACTS_USER_AGENT=NutriLens/0.1 (contact@example.com)
FOOD_PROVIDER_TIMEOUT_MS=7000
```

Open Food Facts works without a key. USDA is enabled only when a valid USDA key is present. The custom-food workflow remains available when external search is unavailable.

### Recipe-provider values

Zero-key bundled mode:

```ini
RECIPE_PROVIDER=bundled
RECIPE_FALLBACK_PROVIDER=bundled
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_MS=10000
```

Optional Gemini mode:

```ini
RECIPE_PROVIDER=gemini
RECIPE_FALLBACK_PROVIDER=bundled
GEMINI_API_KEY=<server-only-key>
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_MS=10000
```

Gemini is never trusted for nutrition or scoring. The bundled provider remains the safe fallback.

### Optional ingredient-aware recipe images

Recipe text and recipe imagery are separate providers. The same image pipeline runs after either a Gemini or bundled recipe has passed validation, nutrition calculation, filtering, and scoring.

Prevent new external image-generation calls:

```ini
RECIPE_IMAGE_PROVIDER=none
```

Enable the free-first Cloudflare Workers AI adapter:

```ini
RECIPE_IMAGE_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=<32-hexadecimal-character-account-id>
CLOUDFLARE_AI_API_TOKEN=<server-only-workers-ai-token>
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
RECIPE_IMAGE_TIMEOUT_MS=20000
RECIPE_IMAGE_CONCURRENCY=2
```

Cloudflare setup follows the official [Workers AI REST API guide](https://developers.cloudflare.com/workers-ai/get-started/rest-api/); current free allocation and usage terms are documented on the [Workers AI pricing page](https://developers.cloudflare.com/workers-ai/platform/pricing/). The Account ID must be exactly 32 hexadecimal characters. `RECIPE_IMAGE_TIMEOUT_MS` accepts 1,000-60,000 ms and is shared by the image batch; concurrency accepts 1-4. One recommendation can attempt 3-5 unique covers, bounded by that concurrency.

The cache is checked before a provider is selected, so `RECIPE_IMAGE_PROVIDER=none` prevents new calls while an existing matching cache entry remains usable. Generated responses and stored files are capped at 3 MiB and checked for bounded JPEG start/end markers. The prompt is capped at 2,000 characters. Cached files have no automatic TTL or eviction, and removing a saved recipe does not remove a shared cached JPEG.

Generated JPEGs are cached in `server/storage/recipe-images/`, which is ignored by Git. MongoDB stores only validated image metadata with an explicitly saved recipe; it does not store image bytes. The authenticated image route returns private, immutable browser-cache headers. On a cache miss, disabled, unavailable, timed-out, invalid, or over-quota generation leaves the recommendation usable and the UI shows an honest ingredient-labelled placeholder instead of a mismatched cover. A different Cloudflare model is compatible only when it returns the same base64 `result.image` JPEG contract.

### Client value

```ini
VITE_API_BASE_URL=http://localhost:5000/api
```

This is a Vite build-time value. Do not add a trailing slash. Its origin must correspond to the server's exact `CLIENT_ORIGIN` value.

### MongoDB Atlas checklist

1. Create or reuse an Atlas M0 cluster.
2. Create a database user with an application-specific password.
3. Allow the development machine's IP address in Atlas Network Access.
4. Percent-encode reserved characters in the username or password.
5. Set `MONGODB_URI` and keep `MONGODB_DATABASE=nutrilens` unless another valid database name is intentionally selected.
6. Run the database check before starting normal development.

```powershell
npm run db:check
```

The server ensures the required `users`, `foodlogs`, and `savedrecipes` collections/indexes when the database schema is initialized.

### Run

Start the client and server together from the root:

```powershell
npm run dev
```

- Client: `http://localhost:5173`
- API: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

## Root scripts

| Command                   | Purpose                                           |
| ------------------------- | ------------------------------------------------- |
| `npm run dev`             | Run client and server together                    |
| `npm run dev:client`      | Run only Vite                                     |
| `npm run dev:server`      | Run only Express in watch mode                    |
| `npm run build`           | Create the production client build                |
| `npm run start`           | Start the production-style server process         |
| `npm run lint`            | Run ESLint                                        |
| `npm run format`          | Format supported files                            |
| `npm run format:check`    | Verify formatting                                 |
| `npm run test`            | Run all server and client tests                   |
| `npm run verify`          | Run lint, formatting, tests, and production build |
| `npm run db:check`        | Verify Atlas connection, collections, and indexes |
| `npm run auth:check`      | Exercise the authentication flow                  |
| `npm run food-logs:check` | Exercise food-log CRUD                            |
| `npm run summary:check`   | Exercise daily summary behavior                   |

## Manual Food Logging design

### Catalog strategy

USDA and Open Food Facts are normalized behind separate provider adapters. Searches run concurrently, results are interleaved, and one provider can succeed when the other fails. Open Food Facts searches India first and globally when needed. Custom food entry is the guaranteed fallback.

### Server-authoritative calculation

```text
reference quantity = selected quantity x reference quantity per selected unit
scale = reference quantity / provider base-serving quantity
calculated nutrient = provider nutrient x scale
```

The server calculates calories, protein, carbohydrates, fat, and fiber for previews and recalculates them during save/update. Client-supplied catalog nutrition is not accepted.

### Daily summary

Temporary targets are 2,000 kcal, 100 g protein, 250 g carbohydrates, and 67 g fat. Fiber is consumed-only.

```text
remaining = max(target - consumed, 0)
actual percentage = consumed / target x 100
visual percentage = min(actual percentage, 100)
over target = max(consumed - target, 0)
```

## Recipe recommendation design

### Provider pipeline

```text
validated request
  -> Gemini or bundled recipe candidates
  -> strict untrusted-output validation
  -> independent bundled nutrition estimation
  -> hard diet/meal/calorie/time filters
  -> deterministic scoring and stable sorting
  -> shared ingredient-aware image prompt for either recipe source
  -> content-addressed generated-image cache, or honest unavailable state
  -> validated response with provider provenance
```

### Hard filters and ranking

Dietary preference, meal type, maximum calories, and maximum time are hard filters. Wellness goal changes ordering only.

```text
overall match =
  ingredient fit x 40%
  + goal fit x 25%
  + dietary fit x 15%
  + calorie fit x 10%
  + time fit x 10%
```

Every result exposes all five components and a human-readable reason. A request returns `no_match` instead of relaxing explicit constraints.

For exact formulas, confidence rules, provider behavior, examples, and data shapes, see [Manual Logging and Recipe Recommendation Systems](docs/manual-logging-and-recommendations.md).

## Database collections

### `users`

- Normalized unique email
- Display name
- Salted bcrypt password hash
- Timestamps
- Password hashes are excluded from public user responses

### `foodlogs`

- Immutable authenticated owner
- Canonical calendar date and meal
- Selected quantity/unit
- Server-calculated nutrition snapshot
- Provider/custom catalog snapshot and provenance
- Manual source marker and timestamps
- Owner/date/meal and summary indexes

### `savedrecipes`

- Immutable authenticated owner
- Normalized SHA-256 fingerprint
- Immutable validated recipe snapshot
- Generated-image signature, controlled cache path, and provider metadata when available
- Immutable provider/fallback provenance
- Timestamps
- Unique owner/fingerprint index
- Recent-first owner index

## API summary

### Authentication

| Method | Route                | Purpose                         |
| ------ | -------------------- | ------------------------------- |
| POST   | `/api/auth/register` | Create account and session      |
| POST   | `/api/auth/login`    | Authenticate and create session |
| GET    | `/api/auth/me`       | Restore current session         |
| POST   | `/api/auth/logout`   | Clear current session           |

### Food catalog and logging

| Method    | Route                          | Purpose                                     |
| --------- | ------------------------------ | ------------------------------------------- |
| GET       | `/api/foods`                   | Search normalized USDA/Open Food Facts data |
| GET       | `/api/foods/:foodId`           | Read one normalized food                    |
| GET       | `/api/foods/:foodId/nutrition` | Preview calculated nutrition                |
| POST      | `/api/foods/custom/nutrition`  | Preview custom nutrition                    |
| POST      | `/api/food-logs`               | Create owned manual log                     |
| GET       | `/api/food-logs`               | List owned logs                             |
| GET       | `/api/food-logs/summary`       | Read owned date summary                     |
| GET       | `/api/food-logs/:foodLogId`    | Read one owned log                          |
| PUT/PATCH | `/api/food-logs/:foodLogId`    | Recalculate and update owned log            |
| DELETE    | `/api/food-logs/:foodLogId`    | Delete owned log                            |

### Recipes

| Method | Route                               | Purpose                                         |
| ------ | ----------------------------------- | ----------------------------------------------- |
| POST   | `/api/recipes/recommend`            | Generate, validate, calculate, filter, and rank |
| POST   | `/api/recipes/saved`                | Save one validated recipe explicitly            |
| GET    | `/api/recipes/saved`                | List owned saved recipes                        |
| GET    | `/api/recipes/saved/:savedRecipeId` | Read one owned saved recipe                     |
| DELETE | `/api/recipes/saved/:savedRecipeId` | Remove one owned saved recipe                   |
| GET    | `/api/recipe-images/:signature.jpg` | Read one authenticated cached generated cover   |

All catalog, log, summary, recommendation, and saved-recipe routes require authentication.

## Security and privacy guarantees

- HTTP-only cookie session; no JWT in localStorage.
- HS256 algorithm, issuer, audience, expiry, and subject verification.
- Password hashing with configurable bcrypt cost.
- Authentication and recipe request rate limiting.
- Helmet security headers, credentialed CORS, browser-origin guard, and 100 KB JSON limit.
- Strict request schemas reject unknown and ownership fields.
- MongoDB operations are owner-scoped.
- Provider output is untrusted and schema-validated.
- Gemini receives only normalized recipe inputs and preferences.
- Cloudflare receives only a bounded visual recipe description made from validated recipe fields; account credentials remain server-side.
- Generated-image URLs are controlled, content-addressed API paths rather than provider-supplied URLs.
- Logs contain metadata, not bodies, query secrets, cookies, prompts, or provider output.
- Provider/database errors are sanitized.
- No recommendation is persisted automatically.

## UI and accessibility

- Shared responsive authenticated shell for Dashboard, Food Log, Recipes, and Account.
- Desktop sidebar and mobile navigation.
- Consistent light/dark surface hierarchy.
- Selected production logo variants for light and dark surfaces.
- Keyboard-operable tabs, ingredient input, food combobox, dialogs, and actions.
- Focus restoration after dialogs.
- Accessible loading, error, empty, success, and no-match states.
- Touch-friendly controls and long-content wrapping.
- Reduced-motion behavior for nonessential animation.
- Lazy optimized landing media with a static fallback.
- Lazy ingredient-generated recipe imagery with fixed aspect ratios and an accessible ingredient-labelled failure fallback.

## Verification status

Final verified baseline on 2026-09-27:

- ESLint passed.
- Repository-wide Prettier check passed.
- 163 server tests passed.
- 55 client tests passed.
- Vite production build passed.
- Focused combined-filter tests prove diet, meal, calorie, and time constraints are enforced together.
- Theme regression tests verify dark recipe surfaces load after light refinements.
- Database, authentication, food-log, and daily-summary smoke scripts are available for configured local environments.

Run the complete automated gate:

```powershell
npm run lint
npm run format:check
npm run test
npm run build
```

The same gate is available as one command:

```powershell
npm run verify
```

The dependency audit also reports zero known vulnerabilities at the configured audit level:

```powershell
npm audit --audit-level=high
```

## Repository hygiene and publishing

- Real environment files stay local and are ignored; only `.env.example` templates belong in Git.
- Installed dependencies, Vite output, test caches, logs, coverage, temporary files, and generated recipe-image bytes are ignored and reproducible.
- `package-lock.json` is intentionally committed so `npm ci` recreates the verified dependency graph.
- `client/public/media/README.md` is intentionally retained because it records the active landing video's source and license.
- The runtime recipe-image cache is intentionally retained locally because saved-recipe image descriptors may refer to it; it is never staged for Git.

Before every push, run `npm ci`, `npm run verify`, `npm audit --audit-level=high`, inspect `git status`, and confirm that `server/.env` and `server/storage/recipe-images/` remain ignored.

## Known limitations

- External food data can be incomplete; missing nutrients and provenance remain visible.
- Custom-food accuracy depends on user input.
- Current daily targets are fixed product defaults, not personalized medical advice.
- Dietary filters are not allergen or cross-contamination guarantees.
- Recipe nutrition is estimated from a finite bundled dataset.
- Generated covers are based on each recipe's validated major ingredients and preparation cues, but text-to-image output is probabilistic; invisible pantry ingredients such as salt, oil, and spices cannot be guaranteed to appear, and a generated image is not a photograph of the cooked result.
- The local filesystem cache is appropriate for development and a persistent single-server deployment. An ephemeral or multi-instance production deployment should replace it with object storage while keeping the same storage interface.
- The food-provider memory caches use TTLs but do not yet enforce a maximum entry count. Add bounded LRU eviction and provider request budgets before exposing the service to untrusted high-volume traffic.
- Public production deployments should add a global image-generation budget and cache-retention policy in addition to the existing per-account recommendation limiter, concurrency limits, and Cloudflare quota controls.
- Gemini free quota and availability are controlled by Google.
- Bundled recommendation variety is limited to the included deterministic ingredients/templates.
- No food-photo analysis, portion detection, barcode workflow, automated meal planning, clinical guidance, or fitness module is implemented.
- The integrated browser was unavailable for the final automated visual pass; the UI was refined through supplied screenshots, source-level responsive review, component tests, and manual user feedback.

## Documentation

- [Manual Logging and Recipe Recommendation Systems](docs/manual-logging-and-recommendations.md) - complete functional and calculation guide
- [UI/UX Audit](docs/UI_UX_AUDIT.md) - product-wide design review

## Final development record

### 2026-08-27

- Approved the incremental delivery plan and completed the MERN foundation, visual system, Atlas schema, authentication, Manual Food Logging, daily summaries, dashboard workflows, CRUD, historical dates, testing, and security verification.

### 2026-09-25

- Approved the Healthy Recipe Recommendation architecture and implemented strict recipe contracts, bundled nutrition, deterministic generation/scoring, protected APIs, complete recipe UI, Gemini fallback, and Saved Recipes.

### 2026-09-26

- Completed the product-wide UI/UX redesign, responsive and dark-theme systems, production branding, licensed landing media, hybrid USDA/Open Food Facts integration, food images, repository cleanup, dynamic dates, final recipe filter transparency, dark recipe-card corrections, and final documentation.
- Historical automated baseline at that date: 138 server tests, 53 client tests, ESLint, Prettier, and the production build all passed.
- No additional implementation phase is active. Future work is limited to the explicitly deferred scope or deployment-specific operations.

### 2026-09-27

- Replaced the recipe-family cover resolver with a shared ingredient-aware generation pipeline for both bundled and Gemini recipes.
- Added bounded Cloudflare Workers AI generation, deterministic visual signatures, local JPEG caching, an authenticated image route, strict controlled-path validation, and nonfatal unavailable states.
- Updated cards, recipe details, Saved Recipes, responsive image rendering, and accessible fallbacks so an unrelated static image is never presented as the recommended dish.
- Removed the redundant landing availability badge, unused validator barrel, duplicate environment assignment, unused configuration surface, misleading catalog-check alias, generated build output, and reproducible dependency folders.
- Consolidated recipe architecture into the canonical implementation guide and hardened ignore/configuration templates for safe publication.
- Final automated baseline: 163 server tests, 55 client tests, ESLint, Prettier, and the production build all pass.
