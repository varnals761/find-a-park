# PLAN.md: Find a Park (NYC sample parks)

Status: approved by owner. Written before any application code.

## Stack
TypeScript `strict`, Vite + React, plain Leaflet + OpenStreetMap tiles, Vitest +
Testing Library, Playwright + axe-core. No new dependency without approval.

| Package | Why |
|---|---|
| `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript` | App and build |
| `leaflet`, `@types/leaflet` | Map; OSM tiles need no key |
| `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | Unit/component tests |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` | Lint + static a11y checks |
| `@playwright/test`, `@axe-core/playwright` | E2E keyboard path + automated a11y scan |

Not adding: react-router, react-leaflet, CSS framework, state library.

## Decisions (resolved)
| # | Decision |
|---|---|
| D1 | Hash route hook: `#/` list, `#/parks/<id>` details. Single source of truth for selection. |
| D2 | Plain Leaflet in one `ParkMap` component via `useEffect`. |
| D3 | Static import of `assets/parks.sample.json`, typed `unknown`, through `normalizePark`. |
| D4 | Skip a record only if `id` or `name` is not a non-empty string. Duplicate ids: keep first. Everything else degrades per field. |
| D5 | Park with missing/invalid coords stays in list and details, omitted from map, details say "Not shown on map". |
| D6 | Desktop: list/details left, map right. Phone: single column, list and details swap by hash, map below. DOM order: list, details, map. |
| D7 | Amenity label: generic slug transform (`dog-run` -> "Dog run") plus one override `wifi` -> "Wi-Fi". |
| D8 | Hours shown verbatim. No parsing, no "open now". Enhancement deferred by owner. |
| D9 | Rating shown as "Rating: 4.7", no "/5" (scale not in the data). |
| D10 | `<img>` with alt from park name + photo index; `onError` swaps to an "Image unavailable" box. All sample image hosts are fake, so this runs for every image. |
| D11 | List sorted alphabetically by name. |
| D12 | Search/filter/near-me out of scope until the core is verified. |

## Data model
```ts
type Park = {
  id: string;
  name: string;
  description?: string;
  address?: string;
  coords?: { lat: number; lng: number }; // only if both finite and in range
  amenities: string[];                   // [] if absent; raw slugs
  hours?: string;
  images: string[];                      // non-empty http(s) strings only
  acreage?: number;                      // finite, >= 0
  rating?: number;                       // finite
};
```
- `normalizePark(raw: unknown): Park | null` is the only place raw JSON is touched.
- `acreage: 0` and `rating: 0` are treated as real values, not missing (flagged for review).
- Strings trimmed; empty/whitespace becomes absent.

## File layout
```
src/data/       types.ts, normalizePark.ts (+test), parks.ts
src/lib/        amenityLabel.ts (+test), useHashRoute.ts (+test)
src/components/ App, ParkList, ParkDetails, ParkImage, ParkMap, LiveRegion
src/styles.css
e2e/            keyboard.spec.ts, a11y.spec.ts
ai-log/         unredacted AI session logs
```

## Accessibility strategy
- One `<h1>`; landmarks `header`, list `nav`/region, `main` for details, labelled map region.
- List is a real `<ul>` of `<a href="#/parks/<id>">` links; `aria-current="page"` on selected.
- Focus: opening details focuses the details `<h2 tabIndex={-1}>`; back returns focus to the
  originating list link (else the list heading). Marker click behaves like list click.
  Focus moves only on user-initiated selection, not initial load.
- One polite `role="status"` live region: "Showing details for {name}", "Showing all {n} parks".
- Map is an enhancement: nothing exists only on the map; tile failure leaves list/details intact.
- `:focus-visible` outline >= 3:1, targets >= 24x24, reflow at 320px, `prefers-reduced-motion`
  honored (no animated pan/zoom), `document.title` follows selection.

## Security specifics
- JSX text only; no `dangerouslySetInnerHTML`. Marker names via Leaflet `title`/`alt`, no HTML popups.
- External links `rel="noopener noreferrer"`. Leaflet marker icons bundled, no CDN.
- CSP applied and tested against the production build (dev server needs looser rules).
  `img-src https:` is weak because real image hosts are unknown; documented in SECURITY.md.

## Test strategy
Tests first, confirmed failing for the right reason, then implementation.
- `normalizePark`: null description, empty images, missing address key, null rating,
  non-array amenities, bad coords (NaN, out of range, strings), `javascript:` image URL,
  non-object input, duplicate ids; plus the real sample (12 in, 12 out, expected gaps).
- Components: list renders links, details omit absent fields without placeholder text,
  image error shows fallback, focus lands on heading.
- `ParkMap` is covered by Playwright only (jsdom cannot render Leaflet reliably).
- E2E: keyboard-only path, marker click, tiles blocked, axe scan. axe is not a substitute
  for the manual checklist.

## Staged build (stop at each checkpoint)
| Stage | Branch | Content | ~min |
|---|---|---|---|
| 0 | `feature/02-scaffold` | Vite/TS/lint/Vitest config; fill CLAUDE.md commands; `npm audit` | 10 |
| 1 | `feature/03-data` | Types, `normalizePark`, tests first, impl | 20 |
| 2 | `feature/04-list-details` | Hash route, list, details, image fallback, live region, focus | 30 |
| 3 | `feature/05-map` | Leaflet map, marker/selection sync, fit bounds | 20 |
| 4 | `feature/06-a11y` | Playwright + axe, manual checklist, fixes | 20 |
| 5 | `feature/07-polish` | CSS, CSP, README, REVIEW_NOTES, demo script + walkthrough | 10 |

Owner commits; AI proposes messages. Owner keeps their own clock for time spent.

## Known risks
- Leaflet default marker icons break under Vite unless imported explicitly; test in a real browser.
- Playwright browser download is large and needs network; fallback is a manual checklist.
- OSM public tiles are fine for a demo, not production.
- Cannot verify with real screen readers (NVDA/VoiceOver) or a real phone; manual steps will be given.

## Out of scope
Backend, accounts, deployment (not required). Search/filters/near-me (after stage 4, if time).
Hours parsing / "open now" (free text). Image hosting (fake URLs). Marker clustering (12 parks).
