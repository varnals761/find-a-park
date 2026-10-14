# REVIEW_NOTES.md

Only real findings go here. Update as work lands.

## Decisions
- See `PLAN.md` D1-D12. Owner-approved changes to the original recommendations: D8 hours stay
  verbatim (enhancement deferred by owner); D5 and D9 as recommended.
- Dataset presented as "NYC sample parks"; app name "Find a Park".
- Branch/path conventions aligned: base branch `release/1.0.0`, AI logs in `ai-log/`.

## Planning session
- Planning happened in an AI session (Claude Code). The brief PDF and sample JSON were read by
  the AI in that session; the owner had not yet studied them closely at that point.
- That planning conversation belongs in `ai-log/` too.

## Data traps found in `assets/parks.sample.json` (12 parks)
- `description: null`: old-mill-botanical-garden
- `images: []`: cedar-hill-nature-preserve, east-ridge-trailhead
- `rating: null`: cedar-hill-nature-preserve
- `location.address` key missing: highland-dog-park
- Every image host is `images.example.com` (fake), so all images will fail to load
- `hours` is free text ("Dawn to dusk", "24 hours", a range crossing midnight)
- Slug-style amenities (`dog-run`, `picnic-areas`, `wifi`, ...)
- Inconsistent address formats (zip only, street only, intersection)
- Rating scale and review count not stated in data
- cedar-hill-nature-preserve coords (40.7128, -74.006) look like a generic NYC point; unconfirmed

## Defects found
None yet. No application code exists.

## Checked
- Stage 0 (scaffold): `npm test` (1 smoke test, failed first for missing `./App`, then passed),
  `npm run typecheck`, `npm run lint`, `npm run build`, `npm audit` (0 vulnerabilities),
  dev server returns HTTP 200. Real output was reviewed in the session, not just exit codes.

- Stage 1 (data layer): 64 new tests in `src/data/normalizePark.test.ts` failed first (module
  missing), then passed (65 total with the smoke test). Typecheck, lint, build clean. Covers the
  four sample traps, bad types/coords/URLs, duplicate ids, non-array input, and the real sample.
  Not covered: the alphabetical sort in `src/data/parks.ts`, and `parks.ts` is not yet imported
  by the app (build size unchanged, so the build does not exercise it).

- Stage 2 (list + details): tests written first (5 files failed on missing modules, App tests
  failed on missing list), then 99 tests passing across 7 files; typecheck, lint, build clean.
  jsdom covers: keyboard open via Tab+Enter, focus on details heading, focus return on back,
  live-region text, no focus/announcement on initial load, unknown id, absent fields omitted,
  text rendered as text, image fallback on error.
  NOT verified: real browser rendering, CSS layout (phone list/details swap), visible focus
  appearance, contrast values, screen reader output. Stage 4 covers these.

- Stage 3 (map): tests first (ParkMap module missing; App map integration and map-failure
  tests failed), then 111 tests passing across 9 files; typecheck, lint, build, `npm audit`
  (0 vulnerabilities) clean. ParkMap tests run real Leaflet in jsdom (markers, alt text,
  tabindex, click, Enter/Space, selected class, cleanup). One test failed on first run because
  my selector also matched Leaflet's zoom buttons (test bug, fixed; code was right).
  NOT verified: tiles actually loading, marker icons actually showing under Vite (the
  classic broken-icon trap), fitBounds result, real keyboard behavior, layout at any width.
  jsdom has no layout, so none of this is evidence about how the map looks.

- Stage 4 (a11y + e2e): Playwright (Chromium) + axe-core against the production build.
  25 e2e tests pass (11 keyboard/behavior, 14 axe scans). Unit 111, typecheck, lint, audit clean.
  Browser-verified for the first time: marker icons decode (no broken-icon trap), keyboard path
  list -> details -> back with focus ring (computed outline >= 2px), marker select via Enter and
  Space, fallback for failed images, tiles blocked, 320px no horizontal scroll, phone list/details
  swap, deep link, unknown id, title.
  axe scans: list, 4 detail variants, not-found, each at desktop and 320px, plus dark +
  reduced-motion emulation. Zero violations with `target-size` disabled (see below).
  NOT verified: any real screen reader, a real phone/touch, zoom to 200/400%, Firefox/Safari,
  text spacing overrides, contrast of the Leaflet map tiles/controls themselves (axe cannot see
  into tile imagery), tile loading from real OSM (blocked in tests on purpose).

- Stage 5 (polish + records): CSP added as a build-only meta tag (`vite.config.ts`); 27 e2e
  tests pass including `csp.spec.ts` (policy present, no `unsafe-*`, tiles allowed through
  `img-src`, zero `securitypolicyviolation` events, no cookies or web storage). Unit 112 tests.
  typecheck, lint, build, `npm audit` (0 vulnerabilities) clean. Screenshots at 1280, 800 and
  320px were looked at: layout holds, selected pin is larger and red, fallback boxes show, no
  overflow. Tiles were blocked in the screenshots, so the map showed grey, not real tiles.
  Security scans and results are in `SECURITY.md`.

## Real finding: Leaflet attribution link had no rel
- Rule in CLAUDE.md: external links use `rel="noopener noreferrer"`. Inspecting links in the
  browser showed Leaflet's own "Leaflet" credit lacked `rel` (no `target`, so no opener
  risk, but against our rule). Test written first and failed, then `setPrefix` with our own
  link in `ParkMap.tsx`. Note Leaflet inserts that string with innerHTML; it is a constant.

## Real finding: selected pin intercepts clicks on neighbours
- While writing the cookie test, Playwright could not click the Hillcrest pin because the
  selected Prospect Park pin (z-index +1000, larger) sat on top and "intercepts pointer
  events". Same root cause as the axe finding below, seen from mouse use. Not fixed.

## Real finding: map pins overlap (axe target-size)
- At the overview zoom neighbouring pins cover each other. axe: "partially obscured (smallest
  space is 14px by 41px, should be at least 24px by 24px)"; 3 pins at 1280px, 7 at 320px.
- Not a code bug in the sense of a crash; it is a design limit of 12 close-together points on a
  small map. Mitigations in place: the list is a full equivalent control on the same page
  (WCAG 2.5.8 "Equivalent" exception), pins are keyboard-reachable, and users can zoom.
- Decision: `target-size` is disabled in the axe scan (commented in `e2e/a11y.spec.ts`) so
  it does not hide other regressions; every non-pin control is covered by an explicit
  >= 24x24 test. I am relying on the exception, not claiming pins meet the size target.
- Not fixed: marker clustering/spiderfy (extra dependency, out of scope), larger map.

## Real defect avoided (found by reading Leaflet 1.9.4 source, not by a test)
- Leaflet marks markers `role="button"` + `tabindex="0"` but only converts Enter to a click
  for markers with popups (`Popup.js`). A bare marker is focusable and does nothing on Enter.
  `ParkMap` handles `keydown` Enter/Space itself; covered by a test.

## Decisions added during scaffold
- ESLint pinned to 9.x: `eslint-plugin-jsx-a11y@6.10.2` peers only up to ESLint 9, and
  ESLint 10 would have needed `--legacy-peer-deps`. ESLint 9.39.5 prints a "no longer
  supported" deprecation warning; revisit when jsx-a11y supports 10.
- `noUncheckedIndexedAccess` enabled in tsconfig (stricter than `strict`).
- Playwright deferred to stage 4 as planned; `npm run e2e` does not work yet.

## Unverified / open
- Everything about runtime behavior, accessibility, and the build.
- Real screen reader and real phone behavior (cannot be verified by the AI).

## Out of scope (and why)
See `PLAN.md` "Out of scope".
