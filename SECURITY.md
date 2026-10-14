# Security Policy

This is a small, front-end-only demonstration app (a "Find a Park" finder) built
for a time-boxed engineering exercise. It has no backend, no accounts, and no
user data collection. This document states the security posture honestly:
what is in place, what is planned, and what is **not** claimed.

## Reporting a vulnerability
If you find a security issue, please report it privately rather than opening a
public issue:

- Use GitHub's **"Report a vulnerability"** (Security tab > Advisories) on this
  repository, or
- Email: `ryan.varnals@gmail.com`  <!-- fill in before publishing -->

Please include steps to reproduce and the affected file or behavior. This is a
personal exercise project, so response is best-effort.

## Supported versions
Only the latest commit on `release/1.0.0` (the default branch) is considered.

## Scope
**In scope:** the application source in this repository and its build
configuration.
**Out of scope:** third-party services (e.g., OpenStreetMap tile servers),
browser or OS vulnerabilities, and the contents of the sample dataset, which is
placeholder data.

## Security posture

Status key: `[x]` implemented and checked (see the verification record below),
`[ ]` planned / not yet verified. Do not mark an item done without checking it.

### Secrets and data
- [x] No secrets, keys, or tokens in the repository or history. Checked with a
      pattern scan of tracked and untracked source plus a history scan; a
      pattern scan is not proof of absence.
- [x] No API keys required to run (map tiles need none).
- [x] `.env*` files are gitignored (`git check-ignore` confirmed).
- [x] No personal data collected, stored, or transmitted by the app. No cookies
      and no localStorage/sessionStorage use (checked in a browser test).
- [x] Location ("Near me") is opt-in: the device location is requested only
      after a button press. The starting point is held in memory only and is
      never placed in the URL, storage, a cookie or any request (browser test
      with a typed point). There is no address lookup, so no typed address
      leaves the page. Map tiles are requested for the area the map shows, not
      for the starting point.

### Third parties
- [x] No analytics, trackers, ad scripts, or third-party CDNs. Leaflet and its
      CSS and icons are bundled from `node_modules`.
- [x] Runtime network requests are map tiles (OpenStreetMap) and the park image
      URLs from the dataset. The app remains fully usable if either fails
      (browser test with both blocked).
- [ ] Tile provider attribution and usage policy are respected. Attribution is
      shown; the OSM tile usage policy was not reviewed in depth and the
      public tile server is not suitable for production traffic.

### Handling untrusted input
- [x] Dataset text (names, descriptions, addresses, URLs) is rendered as text.
      One owner-requested exception: exactly `<b>`, `</b>`, `<i>`, `</i>` (no
      attributes) in the name, description and address are turned into React
      elements by our own parser (`src/lib/inlineMarkup.ts`). `<script>`, `<img>`,
      `<a>`, tags with attributes and unbalanced tags stay literal text. Covered by
      unit and browser tests. No `innerHTML` and no sanitizer library is involved.
- [x] No `dangerouslySetInnerHTML`, `innerHTML`, or `eval` in app source. Note:
      Leaflet itself uses `innerHTML` for its attribution control; the only
      string given to it is a constant in `ParkMap.tsx`, never dataset text.
- [x] The dataset is validated at a single boundary (`normalizePark`);
      malformed records are skipped without crashing the app.
- [x] Image URLs are used only as `<img src>`, are limited to http(s), and
      failures fall back gracefully.
- [x] External links use `rel="noopener noreferrer"` (unit test on the
      attribution links, which are the only external links).

### Browser hardening
- [x] A restrictive Content-Security-Policy is documented (`vite.config.ts`) and
      exercised in a browser test against the production build. It is a
      `<meta>` tag, which cannot set `frame-ancestors` or report violations.
- [x] No `'unsafe-inline'` or `'unsafe-eval'` in the policy.
- [ ] `img-src` allows any `https:` host because the real park image hosts are
      not known. This is the weakest directive.
- [ ] Policy is not applied in the dev server (it needs inline scripts for hot
      reload).

### Supply chain
- [x] Dependencies kept minimal (3 runtime packages); lockfile committed.
- [x] `npm audit` run; result recorded below.
- [ ] Automated dependency updates (Dependabot or equivalent) enabled.
- [ ] ESLint is pinned to 9.x (a11y plugin does not support 10 yet); npm prints
      a "no longer supported" notice for it.

### AI-assisted development
- [ ] AI tools worked on branches only; every change reviewed by a human
      before merge. (Owner to confirm.)
- [ ] No credentials, personal data, or private material was given to AI tools.
      (Owner to confirm.)
- [ ] Generated code and dependencies were reviewed before being accepted.
      (Owner to confirm.)
- [ ] Full, unredacted session logs are kept in `ai-log/`. (Directory was empty
      when this was written.)

## Not claimed
This project is **not** assessed against, and makes no claim of compliance
with, FedRAMP, SOC 2, NIST SP 800-53, or any other framework. It has not had a
penetration test or a third-party security review. Accessibility is tracked
separately in `REVIEW_NOTES.md` and the README.

## Before any public or production use
- Serve over HTTPS with security headers (CSP, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`), not only meta tags.
- Replace public OSM tiles with a provider and plan suited to production
  traffic, and review its terms.
- Own and validate the data source server-side; add schema validation at
  ingest and monitoring for bad data.
- Host images from a controlled origin and restrict `img-src` accordingly.
- Add dependency and secret scanning plus an SBOM to CI.
- Add error monitoring that does not capture personal data.
- Commission an independent accessibility and security review.

## Verification record
Real results, run 2026-10-14 on branch `feature/07-polish`.

| Check | Date | Result |
|---|---|---|
| `npm audit` | 2026-10-14 | `found 0 vulnerabilities` |
| Secret scan: `grep -rniE "api[_-]?key\|token\|secret\|password"` over `src e2e index.html` and config files, plus `git grep` on tracked files | 2026-10-14 | No matches |
| History scan: `git log -p --all -G"api[_-]?key\|token\|secret\|password"` (docs excluded) | 2026-10-14 | No matches |
| Unsafe DOM/eval scan: `grep -rnE "dangerouslySetInnerHTML\|innerHTML\|eval\(\|document\.write" src e2e index.html` | 2026-10-14 | No matches |
| Third-party tags in `index.html` | 2026-10-14 | Only `data:` icon and the local module script |
| `.env`, `.env.local` ignored | 2026-10-14 | `git check-ignore` matched both |
| CSP exercised in browser (`e2e/csp.spec.ts`, production build) | 2026-10-14 | Policy present, no `unsafe-*`, tiles allowed, zero `securitypolicyviolation` events across list, marker and back navigation |
| Cookies / web storage (`e2e/csp.spec.ts`) | 2026-10-14 | None set |
| External link `rel` (`ParkMap.test.tsx`) | 2026-10-14 | All attribution links `noopener noreferrer` (after fixing Leaflet's default link) |
| Near me privacy (`e2e/near-me.spec.ts`) | 2026-10-14 | After setting a starting point: no coordinates in the URL, no web storage, no cookies, no request URL containing them |
