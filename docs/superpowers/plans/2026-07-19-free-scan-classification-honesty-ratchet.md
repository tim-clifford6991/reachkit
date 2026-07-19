# Free-scan classification honesty + calibration ratchet

**Goal:** Make the free scan's rendered numbers consistent and high-quality across ALL sites (giant, small, aggregator, SPA, single-char/renamed brand), and ratchet that quality into the process so this class of "misleading/skewed" result can't ship again.

**Status:** planned, awaiting approval. Read-only exploration complete (2 code maps + an 11-site live survey).

---

## Context — why this exists

Two confirmed failures of the **same class**, at opposite scales:

- **SpaceX (small-scale):** "category demand" rendered as `Σ of 2 narrow LLM seeds` (8,170) while the site ranks for category terms worth hundreds of thousands. The demand-merge (#106) patched the symptom; the **classifier** is still the root.
- **x.com (giant-scale):** brand detected as **0%** (its brand "x"/"twitter" is undetectable); **"google" (101M/mo), "fox news", "usps"** misclassified as x.com's **category** and surfaced as *"your biggest untapped opportunity"*; on-page **20** (a JS/SPA fetch artifact) drags the unified score to 35.

**Live survey (11 sites)** confirms the distribution, not a one-off: brand-detection failure on short/renamed brands (x.com brand 0), giant off-topic terms leaking into category/opportunity (x.com "google"), and on-page fetch artifacts on JS-heavy sites (x.com 20, spacex 26).

### Root causes (verified against code)
1. **Brand** — tokens come ONLY from the domain label behind a hard `label.length >= 3` gate (`lib/scan/referral/brand-keywords.ts:33`): "x" is dropped, "twitter" is never derivable. `isBrandKeyword` then always returns false → `brandPct = 0`.
2. **Category** — `classify` flips a WHOLE phrase to "category" on a **single shared unigram** (`lib/scan/search-visibility.ts:157`), and LLM multi-word seeds are shattered into unigrams into `categoryVocab` (`:382–386`). So "fox news" matches on `news`, "google" matches when that unigram lands in vocab. No distinctiveness, no other-brand exclusion, no volume sanity. The highest-volume category-classed row becomes the rendered "biggest opportunity" (`components/report/captured/results-screen.tsx:442–449`).
3. **On-page** — the fetch is **raw HTML only** (`lib/scan/adapters/site-fetch.ts:25`), no JS execution. A client-rendered SPA emits a near-empty shell → 6–8 of the 8 on-page signals score 0 → `headlineScore ≈ 20`, which the geomean (`discoverabilityScore`, `registry-score.ts:57`) multiplies straight into the headline.

### Why nothing caught it (the guard gap — the real problem)
G1–G7 + RC1 are arithmetic/aliasing checks on **synthetic** inputs, source tripwires, or shared-plumbing proofs. **No guard runs the classifier against a realistic ranked-keyword footprint under assertion.** The evals feed the classifier `[]` — `fetchRankedKeywords` returns `[]` in fixture mode (`lib/scan/adapters/dataforseo-ranked-keywords.ts:107`), and there is no fixture seam for `RankedKeyword[]`. The only classifier inputs ever asserted are tiny hand-made ≤12-row arrays. So misclassification is invisible to CI by construction — exactly why SpaceX and x.com shipped.

**Intended outcome:** accurate, consistent, non-misleading free-scan numbers on every site, enforced by a calibration ratchet that runs every build.

---

## Part A — Classification quality (the fix)

**A1. Brand detection from the real product identity, not just the domain label.**
- Reuse the shared detector (RC1) but feed it the **LLM-extracted product name + known aliases**, not only the domain label. The name is already known (extract/positioning: e.g. "X", alias "Twitter"). So "x" registers (exact whole-word token) and "twitter" registers (alias).
- Short (≤2-char) labels: match only as an exact whole-word token ("x app" → brand) + any provided alias — never a bare substring (avoids "x" firing inside every word).
- Files: `lib/scan/referral/brand-keywords.ts` (accept `names: string[]`), `lib/scan/search-visibility.ts` `buildVocab` + `lib/scan/free-report.ts` (supply the name), and the paid caller `lib/scan/referral/keyword-gap.ts` — one detector, both engines (RC1 invariant preserved).

**A2. Category classification tightening (kill the giant-off-topic leak).**
- `classify` (`search-visibility.ts:152`): a "category" verdict must be more than one generic unigram. Combine:
  - **Other-brand exclusion:** a keyword that IS a known other entity — the discovered competitors (`facts.competitors`, already available) + a small curated lexicon of ubiquitous brands/orgs (google, youtube, facebook, amazon, major news/gov) — is **off-topic**, never the subject's category.
  - **Distinctive match:** require the matched token(s) to be distinctive to the subject (match the LLM seed **phrases/bigrams**, not lone shattered unigrams); demote ubiquitous single-word matches.
- Result: "google"/"fox news"/"usps" classify as off-topic, so they can't inflate `categoryPct` or become the opportunity.

**A3. Opportunity honesty.** The rendered "biggest untapped opportunity" (`categoryOpportunities[0]`) must be a genuine category term — falls out of A2, plus an explicit guard (Part B) that it is never a known-entity/other-brand term.

---

## Part B — The calibration ratchet (the centerpiece)

**B1. A realistic classification corpus.** Capture the REAL classifier inputs — `{ domain, seedText, llmCategorySeeds, rankedKeywords: RankedKeyword[] }` — for ~8–10 domains that span the failure space:
`x.com` (giant; single-char + renamed brand), `spacex.com` (narrow-seed), `trustmrr.com` (aggregator ~90% off-topic), `resend.com` (normal SaaS), `nudgi.ai` (small/new, ~0 rankings), an SPA, `savvycal.com` (small brand), `cal.com` (established).
Store as JSON fixtures under `lib/scan/fixtures/classification-corpus/*.json`, captured from the DB/external-cache (the `rk:*` ranked-keyword sets are already cached from prior scans) — a one-time capture script, no live cost.

**B2. A calibration guard — pure unit test, every build.** For each corpus domain, reproduce the real pipeline purely (no network, no fixtures seam needed — `computeSearchVisibility` is already a pure function over `RankedKeyword[]`):
```
vocab = buildVocab(domain, seedText); fold llmCategorySeeds
sv = computeSearchVisibility(rankedKeywords, vocab)
```
and assert per-domain classification truth, e.g.:
- the subject's **brand is detected** (x.com: "twitter"/"x" → brand; a heavy-brand giant is not `brandPct 0`);
- **no known other-brand/giant term is category** or in `categoryOpportunities` (x.com: "google"/"fox news"/"usps" → off-topic);
- the subject's own brand is **never** in `offTopicExamples`;
- the **biggest opportunity** is a genuine category phrase.
Lives in `lib/scan/classification-corpus.test.ts`, runs under `pnpm test` (~ms). This is **TDD for the classifier**: the expectations fail on today's code, then Part A is built until green.

**B3. Ratchet discipline + Change Protocol.** New failing site → add it to the corpus with its expected split; expectations only tighten, never weaken. Register the guard in the enforcement-layers table (`CLAUDE.md:105`) per "iterate forward, never backwards," in the same commit as the code + `docs/architecture.md`.

---

## Part C — Accurate on-page for every site (owner decision: never blank, no weak disclaimers)

On-page must be **accurate for all sites** — including JS-rendered SPAs.
- **Detect the thin-HTML/SPA case** (raw HTML has near-zero title/meta/headings/content) and **fall back to a JS-rendered fetch** so the 8 on-page signals are read from the real rendered DOM. Only SPAs trigger the fallback → server-HTML sites (the common case) are unaffected and pay nothing extra.
- Rendering source (decide at build): DataForSEO's rendered/OnPage fetch (same vendor already integrated, structured), or a headless render service. Cost is bounded to SPA sites only.
- Files: `lib/scan/adapters/site-fetch.ts` (the fetch + SPA-detect + rendered fallback), `lib/scan/tools/get-listing.ts` (persist), `lib/scan/extract-html.ts` (signals unchanged — they just get real DOM).
- This recalibrates the on-page → unified score for SPA sites: handle via the **Change Protocol** (rule + guard + docs same commit). **Invariant #1 holds** — on-page is computed identically free & paid, so free↔paid stability is untouched (verified by the v5-parity eval). The corpus/calibration guard extends to on-page: an SPA fixture asserts a non-artifact on-page.

---

## Verification
1. **Corpus guard green** (Part B) — the primary ratchet, every build; each new guard **mutation-proven** (break the classifier, watch it fail, revert).
2. **`pnpm eval`** — v5 free↔paid parity stays green (the reclassification + on-page moves free & paid together).
3. **Live, render-not-DB** (the conversion-surface rule): after deploy, re-scan **x.com + spacex + an SPA + a normal SaaS**, headless-render each, and confirm: brand detected, "google" is NOT the opportunity, on-page accurate (no 20-artifact), unified score sensible, the competitive honesty preserved for genuinely weak sites.
4. Gates: `pnpm test` · `pnpm check:arch` · `pnpm check:design` · `pnpm test:mobile` · `tsc`.

## Sequencing
**B first, then A** (TDD: corpus + failing expectations → fix the classifier until green), then **C** (on-page fetch, its own PR since it touches the fetch layer + a score recalibration). Three reviewable PRs. Never weaken a guard to pass.
