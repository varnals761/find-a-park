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
Nothing run yet.

## Unverified / open
- Everything about runtime behavior, accessibility, and the build.
- Real screen reader and real phone behavior (cannot be verified by the AI).

## Out of scope (and why)
See `PLAN.md` "Out of scope".
