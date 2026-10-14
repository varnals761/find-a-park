# Demo script and code walkthrough (30-minute follow-up)

Items in **[brackets]** are for you to fill in from your own review. I have
not written your review for you.

## Before the call
- `npm install`, `npm run dev`, open http://localhost:5173
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run e2e` all green
- Have `REVIEW_NOTES.md`, `PLAN.md`, `SECURITY.md` open in tabs
- Have a screen reader ready if you will demo one (NVDA is free)

## Demo (about 8 minutes)
1. **List first, no mouse** (1 min). Reload. Tab once: ring on the first park
   link. Say: "the list is the primary path; the map is an enhancement."
2. **Open details by keyboard** (1 min). Enter. Show the URL change, focus on
   the details heading, the title change. Mention the live region.
3. **Back** (30 s). "All parks" returns focus to the same list link.
4. **Missing data** (1.5 min). Open Old Mill (no description), Cedar Hill (no
   images, no rating), Highland Dog Park (no address). Point out nothing says
   "null" or "N/A".
5. **Broken images** (30 s). Prospect Park: every image host is fake, so each
   photo shows the text fallback.
6. **Map** (1.5 min). Click a marker; then keyboard: Tab to a marker, Enter,
   Space. Show the selected pin is bigger and recoloured, not colour alone.
7. **Resilience** (1 min). DevTools > Network, block `tile.openstreetmap.org`,
   reload: list and details still work.
8. **Phone width** (1 min). 320px: list and details replace each other; no
   horizontal scroll.
9. **Be upfront about the known issue** (30 s). Pins overlap; the list is the
   equivalent control. Show the axe `target-size` note in `REVIEW_NOTES.md`.

## Code walkthrough outline (about 12 minutes)
Suggested order, following the data:
1. `assets/parks.sample.json` -> `src/data/normalizePark.ts` (the only place raw
   JSON is touched; `loadParks` skips and counts bad records).
2. `src/data/types.ts` (what the UI is allowed to see).
3. `src/lib/useHashRoute.ts` (URL hash is the single source of truth;
   `navigations` counter so focus moves only after a user navigation).
4. `src/components/App.tsx` (the two focus effects; derived announcement).
5. `src/components/ParkDetails.tsx` (render only what exists).
6. `src/components/ParkMap.tsx` (three effects; Enter/Space handling;
   `MapBoundary` isolates failures).
7. `e2e/` (what is checked in a real browser, and what is not).

## The piece of code I reviewed closely

- **`ParkMap.tsx` keyboard handling.** Finding: Leaflet marks markers
  `role="button"` and `tabindex="0"` but only turns Enter into a click for
  markers with popups (found by reading `Popup.js` in `node_modules`, not by a
  test). The code handles `keydown` Enter and Space itself.
  *Checked by:* unit test with real Leaflet in jsdom; Playwright test pressing
  Enter and Space on a focused marker in Chromium.
  *Still unsure:* behavior with screen reader virtual cursors, which may send
  synthesized clicks instead of keydown events.
- **The focus effects in `App.tsx`.** They depend on effect declaration order.
  *Checked by:* tests for open, back, first-load, and unknown id; Playwright
  keyboard path. *Could be wrong:* not tested under every history-navigation
  pattern.
- **`normalizePark.ts`.** Checked by 60+ table-driven tests, including bad
  types, out-of-range coordinates, `javascript:` and `data:` image URLs, and the
  real sample file. *Could be wrong:* the 1-5 rating scale is an owner-supplied
  assumption, not in the data; amenity canonicalization (e.g. `Wi-Fi` -> `wifi`)
  only knows one alias.

## Mistakes caught during the build (real ones only)
- Leaflet markers inert on Enter (above).
- Leaflet's default attribution link lacked `rel="noopener noreferrer"`; found by
  inspecting links in the browser against our own rule, then fixed test-first.
- A mouse click on a pin was intercepted by the selected (overlapping) pin,
  found while writing the cookie test; led to documenting the overlap.
- Test-side only: my selectors twice matched Leaflet's own buttons/tiles; the
  code was right, the tests were fixed.

## Decisions to be ready to defend
- Plain Leaflet and a hash hook instead of react-leaflet / a router.
- Keeping a park in the list when its coordinates are invalid.
- Hours verbatim; rating shown "out of 5" on an owner-supplied 1-5 assumption.
- Disabling axe `target-size` and relying on the WCAG 2.5.8 equivalent-control
  exception (be ready for "isn't that a failure?").
- CSP as a meta tag, production build only.

## What I would change before release
See "Next steps before public use" in the README: real assistive-technology
audit, owned data source, controlled image host, security headers over HTTPS,
production tile provider, pin overlap fix, search/filter with announced counts,
CI and monitoring.

## Questions to ask them
- What is the biggest challenge or bottleneck the team is facing right now?
- How often are releases? What is the production release cycle like?
- What is the ratio of Junior engineers to Senior engineers?
