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
- **Filters** (added after the core was verified, so beyond the brief's core
  scope): hours (any / open 24 hours / dawn to dusk / open at a time), minimum
  rating, size buckets that do not overlap (Tiny under 5, Small 5-25, Medium 25-100,
  Large 100-500, Very large 500+ acres),
  and amenities (a park must have **all** selected). They stack, update the list
  and the map, and are kept in the URL, so a filtered view is shareable. The
  count ("5 parks found") is announced to screen readers; focus never moves
  because a filter changed.
- **Extended Parks** button at the bottom of the list: switches to
  `assets/extended-parks.sample.json`, synthetic test data (see Data).
- **Near me** (opt-in, a second enhancement beyond the core): sort parks by
  straight-line distance from a starting point. The starting point comes from
  one of three places: the device location (only after pressing "Use my
  location"), a click or tap on the map ("Choose a point on the map"), or typed
  latitude and longitude. Distances are shown in miles in the list and details.
  If location is denied, unavailable or times out, a message explains why and
  the other two ways still work. The starting point stays in the page's memory
  only: it is not in the URL, not stored, and not sent in any request.
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
- Text search, and looking up an address: an address lookup needs a
  third-party geocoding service, which would send what the person types to
  another company and conflict with the privacy statements in `SECURITY.md`.
- Marker clustering: extra dependency, and only 12 parks.
- A real "open now": hours are free text and are always **displayed** exactly
  as given. They are only interpreted for the hours filter, and anything that
  cannot be read as a time range (for example "Mon-Fri 9 AM-5 PM", "Closed for
  renovation") never matches a time filter; the page says how many parks were
  left out for that reason.
- Backend, accounts, hosted deployment: not required.

## Data
`assets/parks.sample.json` is used **unchanged**; no fields or records were
added. A second file, `assets/extended-parks.sample.json`, is **synthetic test
data**: 35 entries (26 valid, 9 that must be skipped) with fictional park names at
approximate New Jersey locations, written to exercise odd hours formats, unicode,
HTML-looking text, very long text, wrong types, bad coordinates and duplicates.
Each entry has a `_case` field saying why it exists. It is not real park data.
Both files are treated as untrusted and validated at one boundary,
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
- **Basic formatting in park text**: `<b>` and `<i>` in a park's name,
  description and address are applied (the extended data has examples). This is
  done by a small parser of our own that only recognises those two tags with no
  attributes; `<script>`, `<img>`, links, tags with attributes and unbalanced
  tags are shown as literal text. Nothing is inserted as raw HTML. Page title,
  announcements and map-marker names use the text without tags.
- **Long park names are cut at two lines** with an ellipsis in the list only
  (the full name is in the details and in the link's tooltip).
- **One skip link, to the park list** (or to the open park's details), rather
  than to the filters.
- **Rating is shown as "4.7 out of 5".** The data itself does not state a scale;
  the 1-5 scale is an assumption supplied by the owner. Ratings outside 1-5 are
  treated as invalid and left out.
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
- **"Dawn to dusk" is approximated as 6:00 AM to 6:00 PM** for the "open at a
  time" filter (owner's choice). Real sunrise and sunset move through the year,
  so a summer evening at 7 PM is reported as closed. The page says so next to
  the filter.
- **Size buckets have fixed edges**: 25 acres is Medium (not Small), 100 is
  Large, 500 is Very large. A park with no acreage is in no bucket and only
  appears under "Any size". "Tiny" was added so parks under 5 acres are
  reachable.
- **Near me limits**: distances are straight-line, not walking or driving.
  Choosing a point by clicking the map is a pointer/touch action, so the typed
  coordinates are the keyboard equivalent. The starting point is not kept
  across a page reload (deliberately). The browser only offers device location
  on HTTPS or localhost. If no park has valid coordinates there is no map to
  click, and typed coordinates still work.
- **A repeated announcement is not re-read**: changing a filter so that the
  count stays the same produces the same text, which screen readers may not
  announce again.
- **One wrong-but-valid coordinate can wreck the map framing.** Swapped lat/lng
  (for example 40.7, -74.0 entered as -74.0, 40.7) are in range and cannot be
  detected, and the map fits itself to every pin, so it would zoom out to the
  whole planet. That case is pinned in a unit test and deliberately left out of
  the extended file for this reason.
- **Many amenities mean many Tab stops**: the sample has 26. The skip link
  jumps past the filters to the park list.
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
- `npm test`: 16 files, 375 tests passing. Written test-first; each stage's
  tests were seen failing for the right reason before the code existed.
- `npm run typecheck`, `npm run lint`: clean.
- `npm run e2e`: 69 Playwright tests in Chromium against the production build
  (including the filters, shareable URLs, the extended dataset and its long text):
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
2 hours

## Next steps before public use
1. Manual accessibility audit with real assistive technology and real devices.
2. Own the data source and validate it server-side; add monitoring for bad data.
3. Host images from a controlled origin and tighten `img-src`.
4. Send the CSP and other security headers as HTTP headers over HTTPS.
5. Replace public OSM tiles with a provider suited to production traffic.
6. Fix the marker overlap (clustering or a larger/zoomed map) and re-selection.
7. Add text search and an address lookup (with a privacy review of whichever
   geocoding service is chosen).
8. CI: tests, e2e, audit, secret scanning; dependency updates; error
   monitoring that does not capture personal data.

## AI use
Built with Claude Code. The planning conversation (including reading the brief
and sample data) happened in the same AI session as the build; the brief was
read by the AI in that session before I had studied it closely. Full,
unredacted logs are in `ai-log/`. Records of decisions and checks are in
`PLAN.md` and `REVIEW_NOTES.md`.
