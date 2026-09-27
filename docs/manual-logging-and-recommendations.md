# NutriLens Manual Logging and Recipe Recommendation Systems

## Document status

- **Status:** Canonical final implementation and architecture guide
- **Last updated:** 2026-09-27
- **Application:** NutriLens full-stack MERN application
- **Covered systems:** Manual Food Logging and Healthy Recipe Recommendation
- **Primary audience:** Developers, reviewers, maintainers, and project evaluators

This document consolidates the final architecture and implementation details for both NutriLens modules. It explains what they do, how data moves through the frontend and backend, how nutrition and recommendation scores are calculated, what is stored in MongoDB, which external providers are used, and which security and reliability boundaries are enforced.

## 1. System overview

NutriLens currently contains two complete authenticated product workflows:

1. **Manual Food Logging** lets a user search a hybrid nutrition catalog, select a serving quantity, preview server-calculated nutrition, save the food under a meal and date, edit or delete it, and view daily nutrition progress.
2. **Healthy Recipe Recommendation** lets a user enter ingredients and preferences, obtain validated recipe candidates from Gemini or the bundled fallback, apply deterministic nutrition and scoring, compare results, and explicitly save selected recipes.

Both modules use the same user account, protected JWT session, Express API, MongoDB Atlas database, responsive React interface, light/dark theme, and stable error format.

```text
React client
  -> credentialed /api request
  -> Express security, authentication, and Zod validation
  -> module service and provider interfaces
  -> deterministic server calculations
  -> owner-scoped MongoDB operation when persistence is required
  -> versioned/sanitized JSON response
  -> accessible UI state and immediate dashboard refresh
```

## 2. Shared technology and security foundation

### Frontend

- React 19
- React Router 7
- Vite 8
- Manrope for interface typography
- Newsreader for editorial headings
- Lucide React icons
- Vitest, Testing Library, and jsdom for client tests
- Responsive CSS with shared light and dark design tokens

### Backend

- Node.js 22+
- Express 5
- MongoDB Atlas through Mongoose 9
- Zod 4 for strict request and provider-output validation
- JSON Web Tokens through `jsonwebtoken`
- `bcryptjs` password hashing
- Helmet, CORS, origin protection, request-size limits, and rate limiting
- Node's built-in test runner and Supertest

### Authentication and ownership

Registration and login create a signed HS256 JWT. The token is stored in an HTTP-only cookie, so normal client JavaScript cannot read it. In production the cookie is secure and uses the `__Host-` prefix. The token validates its algorithm, issuer, audience, expiry, type, and user subject.

Every food, recommendation, and saved-recipe route requires authentication. The server derives `userId` from the verified session; it never accepts ownership from request bodies or query strings.

Owner-scoped database queries always include both the authenticated user ID and the requested record ID. A record owned by another user returns the same not-found response as a nonexistent record.

### API response conventions

Successful responses use a `data` object and may include `meta`:

```json
{
  "data": {},
  "meta": {
    "apiVersion": "1",
    "requestId": "uuid"
  }
}
```

Failures use a stable sanitized shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": []
  },
  "meta": {
    "apiVersion": "1",
    "requestId": "uuid"
  }
}
```

Provider errors, database errors, secrets, stack traces, raw prompts, cookies, and JWT values are not returned to the browser.

---

## 3. Manual Food Logging

### 3.1 User experience

From the dashboard, the user selects a date and opens **Add food**. The dialog supports two entry modes.

#### Search database

The user:

1. Chooses Breakfast, Lunch, Dinner, or Snack.
2. Searches for a food using at least two characters.
3. Selects a USDA or Open Food Facts result.
4. Chooses one of the units supported by that specific result.
5. Enters a quantity.
6. Reviews the server-calculated nutrition preview.
7. Adds the food to the log.

Food images are shown when a trusted Open Food Facts image is available. If no usable image exists, the interface displays a stable branded fallback rather than a broken image.

#### Add custom food

If an Indian dish, homemade recipe, or regional food is missing from both providers, the user can enter:

- Food name
- Optional description
- Quantity and unit
- Calories
- Protein
- Carbohydrates
- Fat
- Fiber

The record is clearly labelled as user-entered nutrition. Custom values are validated and processed by the server like provider foods; they are not presented as USDA or Open Food Facts data.

### 3.2 Hybrid food catalog

The catalog service uses two replaceable provider adapters.

#### USDA FoodData Central

- Used for generic foods, raw ingredients, survey foods, legacy foods, and branded records.
- Requires `USDA_FDC_API_KEY`.
- Accepts Foundation, Survey/FNDDS, SR Legacy, and Branded data types.
- Normalizes results to a 100 gram base where possible.
- Uses CC0 provenance in saved snapshots.
- Results without calories are excluded because they cannot support a meaningful food-log entry.

#### Open Food Facts

- Used primarily for packaged foods and Indian/global branded products.
- Does not require an API key.
- Searches the configured country first, which defaults to India.
- Falls back to a global search when the country search has no results.
- Requires an identifiable `OPEN_FOOD_FACTS_USER_AGENT`.
- Uses ODbL provenance in saved snapshots.
- Only accepts product images hosted securely by `images.openfoodfacts.org`.

#### Search merging and failure behavior

The server runs configured provider searches concurrently, then interleaves their normalized results. This prevents one provider from occupying every visible position.

If one provider fails, results from the other provider are still returned and the unavailable provider is disclosed to the client. If both fail, the user receives a retryable search error while custom entry remains available.

Search responses are cached in server memory for 15 minutes. Resolved food details are cached for one hour. Cache keys contain normalized search text, limit, and active provider names.

### 3.3 Normalized catalog food

Although USDA and Open Food Facts return different shapes, NutriLens maps them into one internal structure:

```json
{
  "id": "off-8901234567890",
  "name": "Example Paneer Product",
  "description": "Brand - 200 g",
  "category": "packaged food",
  "imageUrl": "https://images.openfoodfacts.org/...",
  "baseServing": {
    "quantity": 100,
    "unit": "grams"
  },
  "supportedUnits": [
    {
      "unit": "grams",
      "label": "grams",
      "defaultQuantity": 100,
      "step": 1,
      "min": 1,
      "max": 5000
    }
  ],
  "nutritionPerBaseServing": {
    "calories": 265,
    "protein": 18.3,
    "carbohydrates": 3.4,
    "fat": 20.1,
    "fiber": 0
  },
  "missingNutrients": [],
  "source": {
    "provider": "open_food_facts",
    "label": "Open Food Facts",
    "externalId": "8901234567890",
    "dataType": "packaged food",
    "license": "ODbL"
  }
}
```

Provider-prefixed IDs ensure USDA and Open Food Facts records cannot collide.

### 3.4 Food nutrition calculation

Nutrition is always recalculated on the server. The browser submits only the selected food ID or custom-food data, quantity, unit, meal, and date.

For a catalog food:

```text
reference quantity = selected quantity x reference quantity per selected unit

scale = reference quantity / provider base-serving quantity

calculated nutrient = provider nutrient per base serving x scale
```

The formula is applied independently to calories, protein, carbohydrates, fat, and fiber.

#### Example

Assume a food has the following values per 100 grams:

- 200 kcal
- 10 g protein
- 30 g carbohydrates
- 5 g fat
- 4 g fiber

For 150 grams:

```text
reference quantity = 150 x 1 = 150 g
scale = 150 / 100 = 1.5

calories = 200 x 1.5 = 300 kcal
protein = 10 x 1.5 = 15 g
carbohydrates = 30 x 1.5 = 45 g
fat = 5 x 1.5 = 7.5 g
fiber = 4 x 1.5 = 6 g
```

Calories are rounded to one decimal place. Protein, carbohydrates, fat, and fiber are rounded to two decimal places in API responses.

If a provider omits a nutrient, NutriLens records `0` for calculation compatibility and includes the nutrient name in `missingNutrients`. The UI displays that the provider did not supply it; zero must not be interpreted as a laboratory-confirmed absence.

### 3.5 Preview and save reconciliation

Changing the selected food, quantity, or unit invalidates the existing preview. A new preview request is sent, and the Add button cannot save until a successful preview exists.

The preview is informational; the server recalculates the same nutrition again during the create or update operation. The client compares the preview with the saved response and refreshes dashboard state from the server. The client cannot forge calories or macros in a catalog-food request.

### 3.6 MongoDB food-log record

Each manual entry stores:

- Authenticated `userId`
- Canonical `YYYY-MM-DD` date
- Meal type and internal meal ordering
- Catalog food ID and food name
- Quantity and unit
- Server-calculated calories, protein, carbohydrates, fat, and fiber
- A catalog snapshot containing normalized serving, supported units, nutrition, source, license, and optional image URL
- Source value `manual`
- `createdAt` and `updatedAt`

The catalog snapshot is important. Future edits can recalculate the food using the data that was originally saved, even if an external provider later changes or temporarily becomes unavailable. Selecting a different food intentionally creates a new snapshot.

MongoDB indexes support:

- User/date/meal ordering
- User/date/source daily summaries
- Owner-scoped recent history

### 3.7 Create, read, update, and delete

#### Create

The server validates the request, derives the authenticated owner, resolves the provider record or custom record, calculates nutrition, saves a snapshot, and returns the stored entry.

#### Read

The dashboard lists entries for the selected date, ordered Breakfast, Lunch, Dinner, and Snack. Pagination exists at API level; the dashboard requests up to 100 entries for the selected day.

#### Update

The user can change the date, meal, food, quantity, or unit. The server loads the owned record and recalculates the complete nutrition snapshot. It never adjusts only one nutrient or trusts stale browser values.

#### Delete

Deletion requires confirmation. The server removes only a record matching both the authenticated owner and record ID. The selected date is refreshed after deletion.

### 3.8 Daily nutrition summary

MongoDB aggregates only manual entries belonging to the authenticated user and selected date.

The implemented temporary daily targets are:

| Nutrient      |     Target |
| ------------- | ---------: |
| Calories      | 2,000 kcal |
| Protein       |      100 g |
| Carbohydrates |      250 g |
| Fat           |       67 g |

Fiber is displayed as consumed-only because NutriLens does not currently calculate a personalized fiber target.

For calories, protein, carbohydrates, and fat:

```text
consumed = sum of all owned entries on the selected date

remaining = max(target - consumed, 0)

actual completion percentage = (consumed / target) x 100

visual progress percentage = min(actual completion percentage, 100)

over target = max(consumed - target, 0)
```

Actual percentages remain uncapped so a user can see values above 100%. Only the progress-bar width is capped.

Meal calories are separately summed for breakfast, lunch, dinner, and snack.

### 3.9 Manual Food Logging API

All routes below require the authenticated cookie session.

| Method    | Route                                                 | Purpose                                  |
| --------- | ----------------------------------------------------- | ---------------------------------------- |
| GET       | `/api/foods?search=&limit=`                           | Search the hybrid catalog                |
| GET       | `/api/foods/:foodId`                                  | Read a normalized provider food          |
| GET       | `/api/foods/:foodId/nutrition?quantity=&unit=`        | Preview catalog-food nutrition           |
| POST      | `/api/foods/custom/nutrition`                         | Preview custom-food nutrition            |
| POST      | `/api/food-logs`                                      | Create a manual entry                    |
| GET       | `/api/food-logs?date=&page=&limit=`                   | List owned manual entries                |
| GET       | `/api/food-logs/summary?date=`                        | Read the owned daily summary             |
| GET       | `/api/food-logs/:foodLogId`                           | Read one owned entry                     |
| GET       | `/api/food-logs/:foodLogId/nutrition?quantity=&unit=` | Preview an edit using its saved snapshot |
| PUT/PATCH | `/api/food-logs/:foodLogId`                           | Recalculate and update an owned entry    |
| DELETE    | `/api/food-logs/:foodLogId`                           | Delete an owned entry                    |

Example create request:

```json
{
  "date": "2026-09-26",
  "mealType": "lunch",
  "foodId": "off-8901234567890",
  "quantity": 150,
  "unit": "grams"
}
```

Only one of `foodId` and `customFood` is permitted.

---

## 4. Healthy Recipe Recommendation

### 4.1 User experience

The authenticated user opens **Recipes**, then:

1. Adds 1-20 available ingredients.
2. Optionally adds a quantity and compatible unit for each ingredient.
3. Selects dietary preference, wellness goal, and meal type.
4. Optionally sets maximum calories, maximum total time, and result count.
5. Reviews the visible criteria summary.
6. Chooses **Find recipes**.
7. Compares validated cards containing an optional ingredient-generated recipe image, match score, total time, servings, meal type, estimated nutrition, available ingredients, additional ingredients, and recommendation reason.
8. Opens a details dialog for steps, score components, assumptions, confidence, and provider provenance.
9. Optionally saves a recipe explicitly.

Changing ingredients or preferences clears old recommendations so results cannot be mistaken for a request they no longer match. Only the latest request may update the result board, and an in-flight request can be cancelled.

### 4.2 Request model

```json
{
  "ingredients": [{ "name": "chickpeas", "quantity": 200, "unit": "grams" }, { "name": "tomato" }],
  "dietaryPreference": "vegan",
  "goal": "high-protein",
  "mealType": "dinner",
  "maxCaloriesPerServing": 500,
  "maxTotalTimeMinutes": 30,
  "resultCount": 4
}
```

Defaults are:

- `dietaryPreference: "none"`
- `goal: "balanced"`
- `mealType: "any"`
- No explicit calorie limit
- No explicit time limit
- `resultCount: 4`

Result count must be 3-5. Calories must be an integer from 100-1,500 when supplied. Time must be an integer from 5-240 minutes when supplied.

Ingredient text is normalized, bounded, checked for unsafe markup/control characters, converted to lower case, and deduplicated. Duplicate quantified ingredients must use the same canonical unit and are added together within the maximum bound.

### 4.3 Recipe providers

Recommendation generation is behind a provider interface. Nutrition estimation and scoring are separate services.

#### Gemini provider

When `RECIPE_PROVIDER=gemini`, the server sends Gemini only:

- Requested result count
- Normalized ingredient names and optional quantities/units
- Selected diet, goal, meal, calorie, and time preferences
- A bounded list of ingredients supported by the local nutrition dataset

It does not send:

- Name or email
- User ID
- JWT or cookie
- Food-log history
- MongoDB records
- API keys
- Medical information

Gemini is instructed to return structured JSON only. It cannot provide trusted nutrition, IDs, scores, or prose outside the schema. Ingredient data is placed between explicit untrusted-data boundaries to reduce prompt-injection risk.

The response is bounded by token and byte limits, parsed as JSON, and strictly validated. Any nutrition or score fields supplied by a model would violate the schema and be rejected.

#### Bundled provider

The bundled provider uses local culinary templates and ingredient groups. It:

- Requires no API key or paid service
- Prefers recognized user ingredients
- Uses bounded practical portions
- Adds a maximum of eight additional ingredients after validation
- Applies meal and time constraints before candidate creation
- Applies all hard filters again during deterministic scoring
- Identifies itself as bundled output, never live AI

The bundled provider is the default zero-key mode and the fallback for Gemini failures.

### 4.4 Gemini fallback behavior

If Gemini cannot safely complete a request, NutriLens attempts the bundled provider for these public failure categories:

- Missing configuration
- Rate limited
- Quota exhausted
- Timeout
- Provider unavailable
- Safety refusal
- Invalid or oversized output

The response reports:

- Provider requested
- Provider actually used
- Whether fallback was used
- A safe fallback reason

If both providers fail, the API returns a sanitized `RECIPE_PROVIDER_UNAVAILABLE` error. Raw provider messages are not exposed.

### 4.5 Untrusted output validation

Both Gemini and bundled candidates pass through the same strict provider schema before nutrition or scoring.

Validation includes:

- Unique recipe titles
- 1-12 servings
- Bounded preparation and cooking time
- Supported difficulty and meal values
- Supported dietary labels
- 1-30 unique structured ingredients
- Positive bounded quantities and canonical units
- 1-20 bounded cooking steps
- Safe text without markup or control characters
- Maximum five candidates

Provider dietary tags are not trusted by themselves. NutriLens independently derives dietary tags from the validated ingredient list.

### 4.6 Recipe imagery

Recipe generation and image generation are separate. Gemini or the bundled provider first produces recipe candidates. NutriLens then validates those candidates, calculates nutrition, enforces filters, scores them, and only afterward sends a bounded visual description to the configured image provider. This shared post-validation position means Gemini results, bundled results, and Gemini-to-bundled fallback results all use exactly the same image behavior.

The image prompt is built from the final structured recipe rather than raw free-form input. It contains:

- The validated recipe title
- Required ingredients from `ingredients.available`, which are matched user-supplied ingredients and receive visual priority
- Required ingredients from `ingredients.additional`
- Quantities and canonical units where available
- The first bounded preparation cues from validated instructions
- Optional or pantry ingredients as supporting context only

Salt, water, oil, and similar pantry items are not required to be separately visible. The prompt explicitly rejects unlisted proteins, vegetables, fruit, grains, sauces, garnishes, text, logos, packaging, and hands. User identity, email, session data, food-log history, database records, and API credentials are never placed in the prompt.

NutriLens hashes a canonical representation of the title, sorted available/additional ingredients, amounts, meal types, and ordered preparation cues. That SHA-256 ingredient signature is the cache key. Changing a main ingredient or preparation changes the signature; repeating the same recipe reuses the cached file and avoids another provider call.

A successful result uses a controlled content-addressed path:

```json
{
  "image": {
    "url": "/api/recipe-images/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg",
    "alt": "AI-generated serving of Spinach and Paneer Rice Bowl featuring spinach, paneer, rice",
    "kind": "generated",
    "provider": "cloudflare",
    "ingredientSignature": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```

The provider output is base64-decoded and accepted only when it fits the 3 MiB limit and has the expected JPEG start markers. Storage performs the same bound check plus JPEG start/end marker validation; this is deliberately described as marker validation rather than a full image decode. Bytes are written atomically to `server/storage/recipe-images/`; the folder is ignored by Git. MongoDB stores only the validated descriptor when a user explicitly saves a recipe, not base64 data or image bytes. `GET /api/recipe-images/:signature.jpg` verifies the authenticated session and accepts only a lowercase 64-character hexadecimal signature before reading the cache.

When generation is disabled, misconfigured, times out, exceeds the free allocation, returns invalid data, or otherwise fails, recipe recommendation still succeeds with an honest unavailable descriptor:

```json
{
  "image": {
    "url": null,
    "alt": "AI-generated serving of Spinach and Paneer Rice Bowl featuring spinach, paneer, rice",
    "kind": "unavailable",
    "ingredientSignature": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  }
}
```

The client reserves the image aspect ratio to prevent layout shift, lazy-loads available files, uses asynchronous decoding, and labels successful output as an AI image created from recipe ingredients. Failure displays the expected main ingredient names instead of an unrelated stock photograph. Older saved snapshots containing the retired representative-image format are normalized to the unavailable state rather than preserving a misleading image.

The content-addressed cache is checked before provider selection. Consequently, `RECIPE_IMAGE_PROVIDER=none` prevents new external image calls while still allowing a matching cached cover to be returned. A cache miss then uses the honest unavailable descriptor. The cache has no automatic TTL or eviction, and deleting a saved recipe does not delete a shared cached file.

Cloudflare Workers AI FLUX is the optional free-first adapter. Configuration follows the official [Workers AI REST API guide](https://developers.cloudflare.com/workers-ai/get-started/rest-api/), and current free allocation and pricing should be checked on the [Workers AI pricing page](https://developers.cloudflare.com/workers-ai/platform/pricing/). The image batch shares one configured 1,000-60,000 ms deadline, uses 1-4 concurrent operations, and can attempt 3-5 unique covers per recommendation. Prompts are capped at 2,000 characters. A replacement Cloudflare model must satisfy the same base64 `result.image` JPEG response contract.

Successful authenticated image responses are marked private and immutable for one year. Invalid signatures return `INVALID_RECIPE_IMAGE_SIGNATURE` (400), missing files return `RECIPE_IMAGE_NOT_FOUND` (404), and an unsafe or corrupt cache entry produces `RECIPE_IMAGE_CACHE_INVALID` (500). Image generation is best effort: a text-to-image model cannot guarantee that every ingredient, particularly a spice or oil, is visually identifiable. The generated cover is an illustration of the validated recipe, not evidence of the cooked result or a food-recognition output.

### 4.7 Deterministic recipe nutrition

Recipe nutrition never comes from Gemini. NutriLens uses its bundled ingredient nutrition dataset through a replaceable nutrition-provider interface.

For each non-optional ingredient:

```text
resolved base quantity = converted ingredient quantity

ingredient scale = resolved base quantity / dataset reference quantity

ingredient nutrient = dataset reference nutrient x ingredient scale
```

Recipe totals are the sum of matched required ingredients:

```text
recipe nutrient total = sum of calculated ingredient nutrients

nutrient per serving = recipe nutrient total / recipe servings
```

The calculation covers calories, protein, carbohydrates, fat, and fiber.

#### Missing amounts and conversions

- Missing quantity uses the ingredient's documented bundled default and lowers confidence.
- Quantity without a unit uses the ingredient's default unit and lowers confidence.
- Ingredient-specific conversions, such as a piece weight, are allowed only when defined and are disclosed.
- Unknown ingredients are not guessed.
- Unsupported conversions are not guessed.
- Optional ingredients are excluded and disclosed.

#### Coverage and confidence

```text
coverage percentage = matched required ingredients / all required ingredients x 100
```

Confidence begins with the average ingredient estimate confidence and subtracts up to 15 points for excluded optional ingredients. Levels are:

- High: 90-100
- Medium: 70-89
- Low: below 70

Each result preserves dataset name, version, calculation method, unmatched ingredients, and assumptions.

### 4.8 Hard filters

Hard filters determine eligibility. They are re-applied after provider generation and cannot be relaxed by ranking.

#### Dietary preference

- **Vegetarian:** excludes meat, fish, and egg; dairy is permitted.
- **Eggetarian:** permits egg and dairy; excludes meat and fish.
- **Vegan:** excludes animal-derived ingredients.
- **None:** no dietary classification requirement.

The server checks both the recipe ingredients and its independently derived dietary tags.

#### Meal type

When a meal is selected, the recipe must include that meal type.

#### Maximum total time

```text
total time = preparation minutes + cooking minutes
```

Recipes above the selected maximum are rejected.

#### Maximum calories

Recipes above the selected calories per serving are rejected. A calorie limit also requires 100% nutrition coverage; NutriLens will not claim that an incompletely calculated recipe satisfies the limit.

### 4.9 Explainable ranking

Eligible recipes receive five scores from 0-100.

| Component         | Weight |
| ----------------- | -----: |
| Ingredient fit    |    40% |
| Wellness-goal fit |    25% |
| Dietary fit       |    15% |
| Calorie-limit fit |    10% |
| Time-limit fit    |    10% |

```text
overall score = round(
  ingredient fit x 0.40
  + goal fit x 0.25
  + dietary fit x 0.15
  + calorie fit x 0.10
  + time fit x 0.10
)
```

All component and total scores are clamped to 0-100.

#### Ingredient fit

```text
ingredient fit = matched core ingredients / total core ingredients x 100
```

Optional ingredients and common pantry ingredients such as salt, water, pepper, cumin, turmeric, garlic, ginger, lemon juice, and olive oil do not inflate the core match.

#### Goal fit

**Higher protein:**

```text
goal fit = clamp(protein grams per serving / 30 x 100)
```

**Higher fiber:**

```text
goal fit = clamp(fiber grams per serving / 10 x 100)
```

**Lower calorie:**

- 100 at or below 300 kcal
- 0 at or above 600 kcal
- Linear interpolation between 300 and 600 kcal

**Balanced:** average of:

- Protein score relative to 20 g
- Fiber score relative to 8 g
- Calorie score, with full credit from 250-650 kcal and a gradual reduction outside that range

Wellness goal affects ordering, not eligibility. It is not a medical or treatment recommendation.

#### Diet fit

Every eligible recipe receives 100 because dietary mismatches were already removed as hard constraints.

#### Calorie and time fit

If no explicit limit exists, the component score is 100. Otherwise:

```text
limit fit = clamp((limit - actual value) / limit x 100)
```

This rewards eligible recipes that leave more room below the selected ceiling.

#### Stable sorting

Recipes sort by:

1. Higher total match score
2. Higher ingredient-fit score
3. Fewer additional ingredients
4. Shorter total time
5. Alphabetical title

This keeps deterministic bundled results repeatable.

### 4.10 Recommendation statuses

- `ok`: enough eligible recipes were produced.
- `partial`: at least one recipe matched, but fewer than requested were safely available.
- `no_match`: no candidate satisfied all hard constraints.

A no-match response is a successful API response, not a provider failure. NutriLens does not substitute a conflicting recipe merely to fill the requested count.

### 4.11 Saved recipes

Recommendations are not automatically stored. Saving is an explicit authenticated action.

The server validates the complete enriched recipe and provider metadata, creates a normalized SHA-256 fingerprint, and stores an immutable snapshot containing:

- Authenticated `userId`
- Recipe fingerprint
- Validated recipe snapshot
- Controlled generated-image signature, cache path, and provider metadata when available
- Provider/fallback provenance
- `createdAt` and `updatedAt`

A unique `{ userId, fingerprint }` index prevents the same account from saving the same normalized recipe twice. Different users remain isolated. Deleting a saved recipe does not affect recommendation generation.

Raw prompts, raw model responses, API keys, cookies, JWTs, food-log history, and profile data are not stored with a saved recipe.

### 4.12 Recipe API

| Method | Route                               | Purpose                                                        |
| ------ | ----------------------------------- | -------------------------------------------------------------- |
| POST   | `/api/recipes/recommend`            | Validate, generate, filter, calculate, score, and rank recipes |
| POST   | `/api/recipes/saved`                | Explicitly save one validated recommendation                   |
| GET    | `/api/recipes/saved?page=&limit=`   | List owned saved recipes                                       |
| GET    | `/api/recipes/saved/:savedRecipeId` | Read one owned saved recipe                                    |
| DELETE | `/api/recipes/saved/:savedRecipeId` | Remove one owned saved recipe                                  |
| GET    | `/api/recipe-images/:signature.jpg` | Read an authenticated cached ingredient-generated JPEG         |

Recommendation requests are limited to 30 per authenticated user per 15 minutes. Provider calls have bounded deadlines and are cancelled when the client disconnects.

---

## 5. Environment configuration

Server values belong in `server/.env`:

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

USDA_FDC_API_KEY=<optional-free-usda-key>
OPEN_FOOD_FACTS_COUNTRY=india
OPEN_FOOD_FACTS_USER_AGENT=NutriLens/0.1 (contact@example.com)
FOOD_PROVIDER_TIMEOUT_MS=7000

RECIPE_PROVIDER=bundled
RECIPE_FALLBACK_PROVIDER=bundled
RECIPE_IMAGE_PROVIDER=none
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_TIMEOUT_MS=10000

CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_AI_API_TOKEN=
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
RECIPE_IMAGE_TIMEOUT_MS=20000
RECIPE_IMAGE_CONCURRENCY=2
```

Client values belong in `client/.env`:

```ini
VITE_API_BASE_URL=http://localhost:5000/api
```

`VITE_API_BASE_URL` is read at client build time and must not end with a slash. Its origin must correspond to the server's exact `CLIENT_ORIGIN` value.

Set `RECIPE_IMAGE_PROVIDER=cloudflare` only after adding a 32-hexadecimal-character Cloudflare Account ID and server-only Workers AI token. `RECIPE_IMAGE_TIMEOUT_MS` accepts 1,000-60,000 and `RECIPE_IMAGE_CONCURRENCY` accepts 1-4. The image adapter remains independent from `RECIPE_PROVIDER`, so one Cloudflare configuration covers recipes produced by both Gemini and bundled mode. Keep `none` to prevent new image-provider calls; pre-existing signature cache hits remain usable.

Never commit real `.env` files, database passwords, JWT secrets, USDA keys, Gemini keys, Cloudflare tokens, or cached generated images.

## 6. Running and verifying

From the repository root:

```powershell
npm ci
npm run dev
```

Quality checks:

```powershell
npm run lint
npm run format:check
npm run test
npm run build
```

Run the complete release gate with one command:

```powershell
npm run verify
npm audit --audit-level=high
```

Optional integration checks:

```powershell
npm run db:check
npm run auth:check
npm run food-logs:check
npm run summary:check
```

### Repository and publication hygiene

- Commit `package-lock.json`; do not commit installed `node_modules`, `client/dist`, coverage, logs, temporary files, or tool caches.
- Keep real client/server `.env` files local. Commit only the reviewed `.env.example` templates.
- Keep `server/storage/recipe-images/` local and ignored. It is runtime-generated but may contain files referenced by saved recipe descriptors.
- Keep `client/public/media/README.md`; it records the active landing video's source and license.
- Before staging a release, inspect `git status`, verify ignored secrets with `git check-ignore`, run `npm run verify`, and run `npm audit --audit-level=high`.

## 7. Important limitations

- Food-provider data may be incomplete or inaccurate; NutriLens preserves source and missing-nutrient information.
- Custom foods depend on user-entered nutrition.
- Daily targets are fixed temporary product defaults, not personalized medical targets.
- Dietary recipe filters are not allergen guarantees and do not account for cross-contamination.
- Recipe nutrition is an estimate based on the bundled ingredient dataset and disclosed conversions.
- Ingredient-generated covers are probabilistic illustrations. Main ingredients are explicitly requested, but exact visual inclusion cannot be guaranteed, particularly for salt, oils, spices, and other non-visible pantry items.
- Generated bytes currently use a local filesystem cache. Production deployments with ephemeral disks or multiple server instances should use durable object storage behind the same storage interface.
- Food-provider memory caches expire entries by TTL but are not currently capped by entry count. A public high-volume deployment should add bounded LRU eviction, request coalescing, and per-account/IP/provider budgets.
- Image generation has per-account recommendation limits, timeouts, concurrency bounds, content-addressed reuse, and provider quota failure handling, but no application-wide spend budget or automatic disk-retention policy. Add both before an unrestricted public launch.
- Gemini availability and free quota are controlled by Google.
- Bundled recipes are deterministic templates, not live AI.
- The application does not perform image-based food recognition, portion estimation, meal-plan automation, clinical nutrition, or personalized fitness coaching.

## 8. Extension boundaries

The provider/service separation permits future replacement without rewriting UI or ownership logic:

- Add another food provider behind the food-provider interface.
- Add barcode lookup while retaining normalized catalog foods.
- Add a larger nutrition dataset behind the recipe nutrition-provider interface.
- Add another structured recipe generator behind the recipe-provider interface.
- Add another image generator or durable image store behind the independent recipe-image interfaces.
- Add user-configurable nutrition targets with an explicit target model and migration.

Any future provider must still pass strict server validation, preserve provenance, avoid trusting provider-calculated scores, and keep ownership derived from the authenticated session.
