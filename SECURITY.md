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

Status key: `[x]` implemented and checked, `[ ]` planned / not yet verified.
Update this list as work lands. Do not mark an item done without checking it.

### Secrets and data
- [ ] No secrets, keys, or tokens in the repository or history
      (verify: `git grep -iE "api[_-]?key|token|secret|password"`).
- [ ] No API keys required to run (map tiles need none).
- [ ] `.env*` files are gitignored.
- [ ] No personal data collected, stored, or transmitted. No cookies set by
      the app. Geolocation, if added, is opt-in and never sent anywhere.

### Third parties
- [ ] No analytics, trackers, ad scripts, or third-party CDNs.
- [ ] The only runtime network dependency is map tile requests; the app remains
      fully usable if they fail.
- [ ] Tile provider attribution and usage policy are respected.

### Handling untrusted input
- [ ] Dataset text (names, descriptions, addresses, URLs) is treated as
      untrusted and rendered as plain text.
- [ ] No `dangerouslySetInnerHTML`, `innerHTML`, or `eval` (verify: `git grep`).
- [ ] The dataset is validated at a single boundary; malformed records are
      skipped without crashing the app.
- [ ] Image URLs are used only as `<img src>`; failures fall back gracefully.
- [ ] External links use `rel="noopener noreferrer"`.

### Browser hardening
- [ ] A restrictive Content-Security-Policy is documented and tested
      (default `'self'`; allow only the tile and image origins actually used).
- [ ] No inline scripts requiring `'unsafe-inline'` for script execution.

### Supply chain
- [ ] Dependencies kept minimal; lockfile committed.
- [ ] `npm audit` run before release; result recorded below.
- [ ] Automated dependency updates (Dependabot or equivalent) enabled.

### AI-assisted development
- [ ] AI tools worked on branches only; every change reviewed by a human
      before merge.
- [ ] No credentials, personal data, or private material was given to AI tools.
- [ ] Generated code and dependencies were reviewed before being accepted.
- [ ] Full, unredacted session logs are kept in `ai-log/`.

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
Fill in with real output; write "not run" if not run.

| Check | Date | Result |
|---|---|---|
| `npm audit` | | |
| Secret scan (`git grep` patterns above) | | |
| CSP exercised in browser | | |
