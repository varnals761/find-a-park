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
