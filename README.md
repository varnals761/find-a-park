# Find a Park

A small, accessible web app that helps residents find local parks: a map, a
list, and a details view. It uses **NYC sample parks** from the supplied
`assets/parks.sample.json`. The data is placeholder data, not an official
dataset.

## Run it
Requires Node 22.12+ or 24+ (Vitest's requirement; Vite alone allows 20.19+) and
npm. Developed and checked on Node 24.

```
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```
npm test             # unit and component tests (Vitest + Testing Library)
npm run typecheck    # tsc --noEmit, strict
npm run lint         # ESLint, including jsx-a11y rules
npm run build        # typecheck + production build into dist/
npm run e2e          # builds, serves via vite preview on :4173, runs Playwright + axe
```

One-time setup for `npm run e2e`: `npx playwright install chromium`.

No API keys or credentials are needed. Map tiles come from the public
OpenStreetMap tile server.

## What works
- **List** of all parks (alphabetical). Real links, so it works with no map and
  no JavaScript-heavy interaction. Selecting a park opens its details.
- **Details**: name, description, address, hours, acreage, rating, amenities,
  and photos. A field that is missing, null, or empty is left out; nothing is
  invented.
- **Map** (Leaflet + OpenStreetMap): one marker per park that has coordinates.
  Selecting a marker (click, Enter, or Space) opens the same details as the
  list. The map is an enhancement; if it fails, the rest of the app keeps
  working.
- **Single source of truth**: the URL hash (`#/parks/<id>`). List, map, and
  details all derive from it, so links are shareable and Back works.
- **Accessibility** (target WCAG 2.2 AA): semantic landmarks and headings, real
  lists and links, visible `:focus-visible` indicator, focus moves to the
  details heading on open and returns to the originating link on back, a
  polite live region announces selection changes, reflow at 320px, reduced
  motion respected, broken images get a visible text fallback.
- **No location needed**: the app never asks for geolocation.

## What I left out, and why
- Search, filters, and "near me": optional in the brief; core experience and
  its verification came first.
- Marker clustering: extra dependency, and only 12 parks.
- Parsing hours or "open now": hours are free text ("Dawn to dusk", "24 hours",
  a range that crosses midnight), so they are shown exactly as given.
- Backend, accounts, hosted deployment: not required.

## Data
`assets/parks.sample.json` is used **unchanged**; no fields or records were
added. It is treated as untrusted and validated at one boundary,
`src/data/normalizePark.ts`. Traps handled and tested:

| Trap | Where in the sample |
|---|---|
| `description: null` | Old Mill Botanical Garden |
| `images: []` | Cedar Hill Nature Preserve, East Ridge Trailhead |
| `rating: null` | Cedar Hill Nature Preserve |
| `address` key missing | Highland Dog Park |
| Every image host is `images.example.com` (does not resolve) | all photos |
| Free-text `hours` | all |
| Slug-style amenities (`dog-run`, `wifi`, ...) | all |

The model also defends against shapes the sample does not contain: wrong
types, non-finite or out-of-range coordinates, non-http(s) image URLs,
duplicate ids, and a non-array top level.

## Key decisions and trade-offs
Full list in `PLAN.md` (D1-D12). The ones worth knowing:
- **Plain Leaflet, no react-leaflet**; **hash routing, no router**. Fewer
  dependencies and less to explain. Cost: lifecycle and focus code is written by
  hand.
- **A park without valid coordinates stays in the list and details** and is
  just left off the map ("Not shown on the map").
- **Rating is shown without a scale** ("4.7", not "4.7/5") because the data does
  not state one.
- **Amenity labels** are a generic slug transform plus one override
  (`wifi` -> "Wi-Fi"). Unknown slugs still render.
- **Content-Security-Policy** is a `<meta>` tag added to the production build
  only (the dev server needs inline scripts).
- **ESLint pinned to 9**: the jsx-a11y plugin does not support ESLint 10 yet.

## Known issues
- **Map pins overlap** at the overview zoom. axe's `target-size` rule flags
  partially covered pins, and a selected pin can sit on top of a neighbour and
  take its mouse clicks. The list is an equivalent control on the same page and
  pins can be reached by keyboard, but this is a real usability limit. The axe
  rule is disabled in the scan for this reason (see `REVIEW_NOTES.md`).
- **Re-selecting the already selected park** (same list link or same marker)
  does nothing: the hash does not change, so focus does not move and nothing is
  announced.
- **Every photo shows "Image unavailable"** because the sample image hosts are
  fake. The success path was only checked through a unit test, not with a real
  image.
- **CSP `img-src` allows any `https:` host**, and plain `http:` image URLs the
  normalizer accepts are blocked by it (they show the fallback).
- **One coordinate looks suspicious**: Cedar Hill Nature Preserve is exactly the
  well-known generic NYC point (40.7128, -74.006). I cannot confirm it is wrong.
- **Public OSM tiles** are fine for a demo, not for production traffic.
- **`.idea/` is tracked in git** from the initial commit despite being in
  `.gitignore`.

## How it was checked
Run on 2026-10-14; real output was read, not assumed.
- `npm test`: 9 files, 112 tests passing. Written test-first; each stage's
  tests were seen failing for the right reason before the code existed.
- `npm run typecheck`, `npm run lint`: clean.
- `npm run e2e`: 27 Playwright tests in Chromium against the production build:
  keyboard-only path, marker selection with Enter and Space, focus ring present,
  broken-image and blocked-tile fallbacks, 320px reflow, phone list/details
  swap, CSP violations, and axe scans (6 views x desktop and 320px, plus dark
  and reduced-motion emulation).
- `npm audit`: 0 vulnerabilities. Secret, history, and unsafe-DOM scans are
  recorded in `SECURITY.md`.

**Not verified by the AI:** real screen readers (NVDA/JAWS/VoiceOver), a real
phone or touch input, 200%/400% zoom, Firefox/Safari, forced-colors mode,
contrast of the OSM tile imagery. A clean axe scan is not proof of
accessibility. See `REVIEW_NOTES.md` for what was checked by hand.

## Time spent
**[Owner to fill in: actual time, including testing and this README.]**

## Next steps before public use
1. Manual accessibility audit with real assistive technology and real devices.
2. Own the data source and validate it server-side; add monitoring for bad data.
3. Host images from a controlled origin and tighten `img-src`.
4. Send the CSP and other security headers as HTTP headers over HTTPS.
5. Replace public OSM tiles with a provider suited to production traffic.
6. Fix the marker overlap (clustering or a larger/zoomed map) and re-selection.
7. Add search and filters, with result counts announced in the live region.
8. CI: tests, e2e, audit, secret scanning; dependency updates; error
   monitoring that does not capture personal data.

## AI use
Built with Claude Code. The planning conversation (including reading the brief
and sample data) happened in the same AI session as the build; the brief was
read by the AI in that session before I had studied it closely. Full,
unredacted logs are in `ai-log/`. Records of decisions and checks are in
`PLAN.md` and `REVIEW_NOTES.md`.
