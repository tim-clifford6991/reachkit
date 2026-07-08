# Score calibration (C3)

Companion doc for `scripts/score-calibration.mts` — the live harness for validating
the Discoverability Score against real sites. Tracks Workstream C3 and the deferred
A6 content-threshold item in `docs/plans/2026-07-07-launch-readiness.md`.

## Why this exists

The live trustmrr.com scan (evidence baseline in the launch-readiness plan) scored
**86/100** with **Content 100/100**. The v2 headline is computed deterministically
(`lib/scan/registry-score.ts`) from the fixed 8-signal on-site basis
(`FIXED_BASIS_SIGNAL_KEYS`) defined over the 18-signal registry
(`lib/scan/signals.ts`, scored by `lib/scan/compute-signals.ts`). Of the 3 fixed-basis
Content signals (`content_depth`, `social_share_tags`, `media_richness`), all three
maxed out on a merely decent landing page — a single well-tagged hero image and a few
hundred words of hero/nav/footer copy were enough to hit the ceiling. That reads as
fake-perfect and undermines trust in the score.

**Important nuance:** a signal's `thresholds: { pass, warn }` in `signals.ts` only
drive the pass/warn/fail **state** badge (explainability panel, fallback-action
eligibility) — they do **not** move the numeric score. The score comes from the
`normalised` value computed in `compute-signals.ts`. Fixing "Content 100/100" required
tightening **both**: the normalization curve in `compute-signals.ts` (so the number
itself is harder to max) and the `thresholds` in `signals.ts` (so the pass/warn labels
track the tightened curve). See the comments at both call sites for the exact rationale.

## What changed (C3 first pass — conservative, provisional)

| Signal | Old | New | Why |
|---|---|---|---|
| `content_depth` normalization ref (word count → 100) | 600 words | 900 words | Log-scale curves saturate well before the ref value — old ref gave `pass`(70) at ~87 words and 100 at 600. A "decent landing page" easily clears 600 words once nav/hero/footer copy is counted. |
| `content_depth` thresholds | pass 70 / warn 40 | pass 80 / warn 50 | Track the new curve: ~316 words now needed for `pass`, ~900 for a full 100. |
| `media_richness` scorer | `count===0 ? 40 : altCoverage*100` (1 alt-tagged image = 100) | image-count cap: `count>=5→100, >=3→85, >=2→70, >=1→55, 0→40`, then `× altCoverage` | A single hero image with alt text is not "media richness" — genuine richness requires several images, not perfect alt-tagging on one. |
| `media_richness` thresholds | pass 70 / warn 40 | pass 80 / warn 45 | Track the new curve; 0 images now `fail`s (was `warn`). |

`FIXED_BASIS_SIGNAL_KEYS` membership is **unchanged** — this only recalibrates the
curve within those 3 already-included Content signals. `social_share_tags` was left
untouched (out of scope for this pass; still trivially maxable — a candidate for a
follow-up C3 iteration if live data shows it's the dominant remaining source of
inflation).

Unit tests locking in the new behavior: `lib/scan/compute-signals.test.ts` (describe
block "content_depth / media_richness — C3 tightened thresholds") and
`lib/scan/signals.test.ts` (describe block "content-pillar thresholds (C3 …)").

**This is a first pass, not a final calibration.** The ref/cap values above are
reasoned from the scoring formulas, not from a live distribution of real sites. They
need to be validated — and very possibly adjusted — against the harness below before
being considered final.

## Running the harness

```bash
# Full detail (score + band + per-pillar breakdown + signal pass/warn/fail/unmeasured
# counts) — needs prod/preview Supabase creds in .env.local:
npx tsx --env-file=.env.local scripts/score-calibration.mts

# Against a preview deployment instead of prod (safer/cheaper — recommended for
# the first calibration pass):
npx tsx --env-file=.env.local scripts/score-calibration.mts --base-url=https://<preview>.vercel.app

# HTTP-only (total score + band only, no DB creds needed — scrapes the <title> tag):
npx tsx scripts/score-calibration.mts --http

# Custom domain list:
npx tsx scripts/score-calibration.mts --domains=linear.app,notion.so,acquire.com,example.com
```

This is a **tool, not a test** — it makes real network calls and creates real
`scans`/`apps` rows (cost + DB writes). It is not run in CI and was **not run** as
part of this change; it needs to be exercised by hand with live network + prod/preview
DB access, per the ground rule in the launch-readiness plan ("live-verify everything").

Default domain list (edit in the script or override with `--domains`):

- **strong** — `linear.app`: polished SaaS marketing site, deep copy, schema, OG/Twitter
  tags, rich imagery. Expected to anchor the top of the range.
- **median** — `nudgi.ai`: real indie SaaS, previously live-verified end-to-end in this
  repo (memory `reachkit-prod-infra`). Genuine but thinner than `linear.app`.
- **weak** — `example.com`: canonical placeholder page, no schema/OG/images/real copy.
  Expected to anchor the bottom of the range.

## Acceptance bar

Per the launch-readiness plan's C3 task:

1. **Monotonic band separation** — `strong.total > median.total > weak.total`.
2. **Median indie lands "Fair" (50–69)** — the band names are the single source of
   truth in `lib/scan/score-bands.ts` (`SCORE_BANDS` / `bandFor`):

   | Band | Range |
   |---|---|
   | Invisible | 0–29 |
   | Hard to find | 30–49 |
   | **Fair — room to climb** | **50–69** |
   | Findable | 70–84 |
   | Highly discoverable | 85–100 |

3. **`trustmrr.com` lands Content < 100** on a fresh re-scan, unless it genuinely maxes
   the tightened bars (900+ words of real copy, 5+ fully alt-tagged images, and
   `social_share_tags` still at 100).

The harness prints a pass/fail verdict for (1) and (2) automatically when run against
the default curated domain list (it's skipped for a custom `--domains` list, since
cohort labels aren't meaningful there).

## If the bar isn't met

- **Bands not monotonic, or median outside 50–69** — re-tune `content_depth`'s ref
  (`lib/scan/compute-signals.ts`) and/or `media_richness`'s cap table, then re-run.
  Prefer small, deliberate steps (this pass moved the ref 600→900 and the pass bar
  70→80 — a single iteration) over large swings; the score must stay legible and the
  thresholds documented at every step.
- **`social_share_tags` turns out to be the dominant source of a still-inflated
  Content pillar** — that signal was intentionally out of scope for this pass (see
  table above); open a follow-up with the same conservative-plus-live-calibration
  approach documented here.
- Whatever changes: update the threshold table above, the inline comments in
  `lib/scan/signals.ts` / `lib/scan/compute-signals.ts`, and the unit tests in
  `lib/scan/signals.test.ts` / `lib/scan/compute-signals.test.ts` together, so this
  doc never drifts from the code it describes.
