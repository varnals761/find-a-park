# CLAUDE.md

Project guidance for AI coding tools. Read this first, every session.

## What this is
A time-boxed (about 2 hours) take-home: a small, accessible web app that helps
residents find local parks (map, list, details). The human owner must be able to
explain, defend, and demo every line. Optimize for **correct, small,
accessible, explainable**. Not impressive.

Source material lives in the project root / `assets/`. Read it before
proposing anything. Do not assume facts that are not in those files.

## Non-negotiables
1. **Never invent data.** Missing, null, or empty values are shown as absent or
   omitted. No placeholder prose, no guessed addresses, hours, or ratings.
2. **Do not claim something works unless you ran it.** Show real output from
   tests, type-check, lint, and build. State plainly what you could not verify.
3. **Plan before code, stage the work, stop at checkpoints.** Wait for approval
   before starting a stage and before committing.
4. **Flag uncertainty.** If you are unsure or made a trade-off, say so. Do not
   smooth it over.
5. **Keep it small.** Prefer boring, readable code over clever abstractions.
   No new dependency without a one-line justification and my approval.

## Stack (proposed, confirm in the plan)
- TypeScript, `strict: true`. No `any` without a comment explaining why.
- Vite + React.
- Leaflet with OpenStreetMap tiles. No API keys, no credentials in the repo.
- Vitest + Testing Library for unit/component tests.
- Playwright + axe-core for end-to-end and accessibility checks.

## Architecture rules
- Raw JSON is untrusted. It is parsed and validated at one boundary
  (`normalizePark` or a schema); the UI only sees the typed `Park` model.
- A single source of truth for the selected park (URL hash), derived by both
  list and map.
- The list and details are the primary path. The map is an enhancement and the
  app must work fully with the map unavailable and without geolocation.
- Park text is untrusted: render as text. Never `dangerouslySetInnerHTML`.

## Accessibility rules (target: WCAG 2.2 AA)
- Semantic HTML first: real lists, headings in order, links/buttons, landmarks.
- Every interactive element is keyboard operable with a visible
  `:focus-visible` indicator. Never remove outlines without a replacement.
- Focus moves to the details heading when details open; returns sensibly on
  back. Selection and result-count changes are announced via a live region.
- Touch targets >= 24x24 CSS px; text contrast >= 4.5:1; reflow at 320px.
- Respect `prefers-reduced-motion`.
- Images have meaningful `alt` (or empty `alt` if decorative) and a fallback
  when they fail to load.

## Security rules (see SECURITY.md)
- No secrets, tokens, or personal data in code, fixtures, logs, or commits.
- No third-party scripts, analytics, or trackers.
- External links use `rel="noopener noreferrer"`.
- Keep dependencies minimal; run `npm audit` before the final commit and
  report the real result.

## Workflow
- Work on a feature branch (`feature/<n>-<name>`), never directly on `release/1.0.0`.
- Write or update the acceptance checks (evals/tests) **first**, confirm they
  fail for the right reason, then implement.
- Small commits, one logical change each. Propose the message; I commit.
- Conventional-style messages: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- At the end of each stage: summarize what changed, list the 1-3 pieces of
  code most worth my close review and how each could be wrong.

## Commands (verified in stage 0, except e2e)
```
install:    npm install
dev:        npm run dev
typecheck:  npm run typecheck
lint:       npm run lint
test:       npm test
e2e:        npm run e2e   (Playwright not installed yet; added in stage 4)
build:      npm run build
```

## Records to keep current
- `REVIEW_NOTES.md`: decisions, real defects found (only real ones), what was
  checked, what remains unverified.
- README: what works, what was left out, known issues, how it was checked,
  time spent, next steps before public use.
- `ai-log/`: unredacted AI session logs. Do not edit or trim them.

## Out of scope unless I ask
Backend/server, accounts, hosted deployment, search/filters/near-me (only after
the core is verified and time remains).
