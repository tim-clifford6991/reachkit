# Free-Scan Wow Flow (A→Z) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every gap in the six-stage free-scan flow (Recognition → Market → Position → Rivalry → Action → Bridge, per `docs/plans/2026-07-19-free-scan-wow.md`) so a free scan is a seamless, honest scout of app + industry + market + competitors — at the current speed and cost envelope.

**Architecture:** Pipeline shape untouched (collect → findings → free-report → done). Changes concentrate in four seams: the reviews adapter gains domain-conflict subject-validation (WS-A); the lite synth emits broad/medium/niche market-tier seeds priced by the SAME single volumes call (M1/M2); the free action floor gains deterministic opportunity-targeted actions with a score-model-derived delta (WS-C); the captured report renders everything already paid for with per-stage upgrade teases (WS-B/D/E, M3, R1/R2).

**Tech Stack:** Next.js 16 App Router, Inngest, Supabase, Vitest, DataForSEO/Tavily adapters, Haiku lite synth.

## Global Constraints

- **Speed:** free scan `completed_at − started_at` stays **20–30s** (live baseline 2026-07-19: 21s/23s/33s). ZERO new serial external calls — D1 decided **(a)**: no rival/SERP fetch on free; the tier seeds ride the existing single `search_volume` request.
- **Cost:** free external soft cap **25¢** (`EXTERNAL_SCAN_CAP_CENTS_FREE`, `lib/config/env.ts:85`); live baseline 15.0–16.8¢/run. This plan adds **0¢ external** (only a slightly larger lite-synth prompt/output).
- **Invariant #1 untouched:** nothing here feeds `sv.score`, `classifyFootprint`, or the v5 geomean. `pnpm eval` (v5 parity) must stay green.
- **Number–label honesty:** every new rendered number reconciles to its rendered parts (G4-per-tier for the ladder; teaser counts derive from the SAME rows rendered). Every new guard is **mutation-proven** (break prod code → red → revert → green; verify the mutation applied with `git diff --stat`).
- **Legacy payloads:** every NEW field read in a render defaults at the props boundary (`?? []` / `?? undefined`) AND joins the legacy-payload scenario in `components/report/captured/results-screen.render.test.tsx` in the same commit.
- **Competitor data policy:** discovered rival NAMES render free; per-rival intel (rankings, why they win) stays paid. No LLM-named rivals anywhere (invariant #6).
- **UI:** tokens only (no raw hex beyond the file's existing mockup ramp), inline-style responsiveness rules per CLAUDE.md; DS mirror + label parity updated in the same change as any `results-screen.tsx` copy change.
- **PR structure:** PR-1 = Task 1 alone (live honesty bug). PR-2 = Tasks 2–4 (data/assembly). PR-3 = Tasks 5–8 (render + DS + docs). Task 9 (E2E) runs after each deploy, fully after PR-3.
- Commit style: `fix(scope): …` / `feat(scope): …`, ending with the Co-Authored-By line per repo convention.

---

### Task 1: WS-A — reviews subject-validation (domain-conflict filter) — PR-1, ships alone

The live bug: `filterSubjectSnippets` (`lib/scan/adapters/web-reviews.ts:36-47`) matches the brand TOKEN ("reachkit"), so reviews of **reachkit.ai** passed for subject **reachkit.app** (prod scan `4093f1c9`; the Trustpilot result URL `trustpilot.com/review/reachkit.ai` names the conflicting domain outright, but the parser throws URLs away). Class fix: filter at the RESULT level using every domain the result references.

**Files:**
- Modify: `lib/scan/adapters/web-reviews.ts`
- Test: `lib/scan/adapters/web-reviews.test.ts` (create if absent; extend if present)
- Modify: `CLAUDE.md` (invariant #11 wording + guard row)

**Interfaces:**
- Produces: `filterSubjectResults(body: unknown, subjectHost: string): string[]` — replaces the `filterSubjectSnippets(parseWebReviewSnippets(body), subject)` composition inside `fetchWebReviews`. Existing exports stay (other tests may import them).

- [ ] **Step 1: Check existing test/import surface**

Run: `grep -rn "filterSubjectSnippets\|parseWebReviewSnippets" --include="*.ts" --include="*.tsx" lib app | grep -v node_modules`
Expected: hits in `web-reviews.ts` itself and (possibly) `web-reviews.test.ts` / `grounding.test.ts`. Note the callers — they keep working (exports remain).

- [ ] **Step 2: Write the failing test** (append to / create `lib/scan/adapters/web-reviews.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { filterSubjectResults } from "./web-reviews";

// Real-shape payload from prod scan 4093f1c9 (2026-07-19): the subject is
// reachkit.app but every result is about reachkit.AI (a different product) or an
// unattributable "Reachkit" listing. The old token filter kept all of them.
const CONTESTED_BATCH = {
  results: [
    {
      url: "https://www.trustpilot.com/review/reachkit.ai",
      title: 'Reachkit is rated "Great" with 3.8 / 5 on Trustpilot',
      content: "TrustScore 4 out of 5. We use technology to protect platform integrity.",
    },
    {
      url: "https://www.getapp.co.uk/software/2081334/reachkit",
      title: "Reachkit Reviews, Prices & Ratings",
      content: "Overall rating 5/5 (2) Value for Money 5/5 Customer Support 5/5",
    },
  ],
};

describe("filterSubjectResults — domain-conflict subject validation (WS-A)", () => {
  it("drops the whole batch when a same-brand DIFFERENT domain is referenced (reachkit.ai vs reachkit.app)", () => {
    expect(filterSubjectResults(CONTESTED_BATCH, "reachkit.app")).toEqual([]);
  });

  it("keeps genuine reviews when no conflicting domain appears (the Stripe class)", () => {
    const body = {
      results: [
        { url: "https://www.g2.com/products/stripe/reviews", title: "Stripe Reviews", content: "Stripe is easy to integrate and the docs are great." },
      ],
    };
    expect(filterSubjectResults(body, "stripe.com")).toHaveLength(1);
  });

  it("in a contested batch, keeps only results that explicitly reference the subject host", () => {
    const body = {
      results: [
        { url: "https://www.trustpilot.com/review/reachkit.ai", title: "Reachkit", content: "…" },
        { url: "https://www.trustpilot.com/review/reachkit.app", title: "Reachkit review", content: "Great for solo founders." },
      ],
    };
    const kept = filterSubjectResults(body, "reachkit.app");
    expect(kept).toHaveLength(1);
    expect(kept[0]).toContain("solo founders");
  });

  it("still blocks the same-named different product with no domain evidence in an uncontested batch (nudgi class)", () => {
    const body = { results: [{ url: "https://example.com/x", title: "Nudge AI review", content: "Clinical documentation tool." }] };
    expect(filterSubjectResults(body, "nudgi.ai")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run lib/scan/adapters/web-reviews.test.ts`
Expected: FAIL — `filterSubjectResults` is not exported.

- [ ] **Step 4: Implement** — add to `lib/scan/adapters/web-reviews.ts` (below `filterSubjectSnippets`):

```ts
type TavilyResult = { url?: string; title?: string; content?: string };

/** Every host-shaped token a result references (its URL + text), www-stripped.
 *  Review platforms key products by domain (trustpilot.com/review/<domain>), so
 *  the URL is the strongest subject evidence a result carries. */
export function referencedDomains(r: TavilyResult): string[] {
  const text = `${r.url ?? ""} ${r.title ?? ""} ${r.content ?? ""}`.toLowerCase();
  const found = new Set<string>();
  for (const m of text.matchAll(/([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,})/g)) {
    found.add((m[1] ?? "").replace(/^www\./, ""));
  }
  return [...found];
}

/**
 * WS-A (2026-07-19): brand-ambiguity, domain-conflict edition. The token filter
 * below (`filterSubjectSnippets`) cannot tell reachkit.app from reachkit.AI —
 * both contain "reachkit" — so a contested brand shipped another company's
 * reviews (prod scan 4093f1c9). Rule, per RESULT:
 *   1. A result referencing a same-brand DIFFERENT domain is dropped outright.
 *   2. If ANY result in the batch shows such a conflict, the brand is contested:
 *      every kept result must then reference the subject's own host explicitly.
 *   3. Otherwise (uncontested batch) the existing brand-token match stands, so
 *      genuine "Stripe is great" reviews survive (the 1-review-for-Stripe bug).
 * Errs toward dropping — grounding honesty (#11) over coverage.
 */
export function filterSubjectResults(body: unknown, subjectHost: string): string[] {
  const host = subjectHost.toLowerCase().replace(/^www\./, "");
  if (!host) return [];
  const brand = host.split(".")[0] ?? host;
  const results = ((body ?? {}) as { results?: TavilyResult[] }).results ?? [];

  const conflicts = (r: TavilyResult): boolean =>
    referencedDomains(r).some((d) => d !== host && (d.split(".")[0] ?? d) === brand);
  const referencesSubject = (r: TavilyResult): boolean => referencedDomains(r).includes(host);

  const contested = results.some(conflicts);
  const needle = brand.length >= 4 ? brand : host;
  return results
    .filter((r) => {
      if (conflicts(r)) return false;
      if (contested) return referencesSubject(r);
      return `${r.title ?? ""} — ${r.content ?? ""}`.toLowerCase().includes(needle);
    })
    .map((r) => `${r.title ?? ""} — ${r.content ?? ""}`.trim())
    .filter((s) => s.length > 3);
}
```

And in `fetchWebReviews` replace line 81:

```ts
    // Only keep snippets provably about THIS subject (domain-conflict rule, WS-A).
    return { snippets: filterSubjectResults(body, subject), raw: body };
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run lib/scan/adapters/web-reviews.test.ts`
Expected: PASS (all cases, plus any pre-existing cases in the file).

- [ ] **Step 6: Mutation-prove the guard**

Comment out the `if (conflicts(r)) return false;` line, run `git diff --stat` (must show the file changed), run the test — Expected: FAIL on the contested-batch case with the reachkit.ai snippets in the diff output. Revert, re-run — green.

- [ ] **Step 7: Class sweep — every other Tavily/SERP ingestion attributed to the subject**

Run: `grep -rln "tavily\|api.tavily" lib/scan --include="*.ts" | grep -v test`
For each hit, answer: "does this call's output get attributed TO the scanned subject (its reviews/buzz/identity), or is it deliberately ABOUT other products (competitor discovery)?" Subject-attributed ingestions get the same `referencedDomains` conflict check; discovery paths (e.g. `tools/find-competitors.ts`) are exempt (they want other products, and invariant #6 validation already gates them). Apply + test any found the same way as Steps 2–6. Record the swept list in the commit body.

- [ ] **Step 8: Downstream grounding assertion** — append to `lib/scan/grounding.test.ts`:

```ts
it("a contested-brand review batch yields ZERO snippets → empty sheet → no mirror (WS-A, scan 4093f1c9 class)", () => {
  expect(
    filterSubjectResults(
      { results: [{ url: "https://www.trustpilot.com/review/reachkit.ai", title: "Reachkit", content: "5/5" }] },
      "reachkit.app",
    ),
  ).toEqual([]);
});
```
(with `import { filterSubjectResults } from "./adapters/web-reviews";` added — adjust the relative path to the file's existing import style.)

- [ ] **Step 9: CLAUDE.md (Change Protocol — same commit)**

In invariant #11, after the sentence about the adapter layer, add: *"The adapter also SUBJECT-VALIDATES: a review result referencing a same-brand different domain (reachkit.app vs reachkit.ai, scan `4093f1c9` 2026-07-19) is dropped, and a contested batch requires explicit subject-host evidence per result (`filterSubjectResults`, guard: `web-reviews.test.ts`, mutation-proven)."*

- [ ] **Step 10: Full gates + commit**

Run: `pnpm test && pnpm check:arch`
Expected: green.

```bash
git checkout -b fix/ws-a-review-subject-validation
git add lib/scan/adapters/web-reviews.ts lib/scan/adapters/web-reviews.test.ts lib/scan/grounding.test.ts CLAUDE.md
git commit -m "fix(grounding): subject-validate web reviews — domain-conflict filter (WS-A)"
```
Open PR-1; after merge + deploy, run the Task 9 quick check for reachkit.app (mirror must be absent).

---

### Task 2: M1 — tiered market seeds from the lite synth

**Files:**
- Modify: `lib/llm/prompts.ts` (`SYNTH_SYSTEM_LITE` ~line 353–393, `buildSynthPromptLite` JSON shape ~line 386)
- Modify: `lib/llm/synth.ts` (lite parser ~line 160–174)
- Modify: `lib/scan/findings-pipeline.ts` (persist the new field — locate with `grep -n "categorySeeds" lib/scan/findings-pipeline.ts`)
- Test: `lib/llm/synth.test.ts` (extend; create the describe block if the file lacks one for parseLite)

**Interfaces:**
- Produces: `export type MarketTierSeeds = { broad: string[]; medium: string[]; niche: string[] }` (from `lib/llm/synth.ts`); the lite synth result gains `marketTiers?: MarketTierSeeds`; `findings_payload.marketTiers` persisted alongside `categorySeeds`. `categorySeeds` semantics UNCHANGED (back-compat: still 3–5 head terms feeding the demand hero).

- [ ] **Step 1: Write the failing parser test** (in `lib/llm/synth.test.ts`; import the lite parse function — find its exported name via `grep -n "export" lib/llm/synth.ts`; if parsing is internal, export a pure `parseLiteSynth(obj: unknown)` as part of this task):

```ts
it("parses marketTiers (broad/medium/niche) and caps each at 4", () => {
  const out = parseLiteSynth({
    positioningMirror: { listingSays: "x", reviewsValue: "", gap: "" },
    categorySeeds: ["rank tracking software"],
    marketTiers: {
      broad: ["marketing software", "marketing tools"],
      medium: ["seo tools", "rank tracking software", "seo analytics", "serp tracker", "extra-over-cap"],
      niche: ["seo tools for solo founders"],
    },
  });
  expect(out.marketTiers).toEqual({
    broad: ["marketing software", "marketing tools"],
    medium: ["seo tools", "rank tracking software", "seo analytics", "serp tracker"],
    niche: ["seo tools for solo founders"],
  });
});

it("legacy synth output without marketTiers parses with marketTiers undefined", () => {
  const out = parseLiteSynth({ positioningMirror: { listingSays: "x", reviewsValue: "", gap: "" }, categorySeeds: ["a"] });
  expect(out.marketTiers).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run lib/llm/synth.test.ts` → FAIL.

- [ ] **Step 3: Implement.** In `lib/llm/synth.ts`, next to the existing `const categorySeeds = strArray(obj["categorySeeds"], 5);` (line 160):

```ts
const tiersRaw = (obj["marketTiers"] ?? null) as Record<string, unknown> | null;
const marketTiers =
  tiersRaw && typeof tiersRaw === "object"
    ? {
        broad: strArray(tiersRaw["broad"], 4),
        medium: strArray(tiersRaw["medium"], 4),
        niche: strArray(tiersRaw["niche"], 4),
      }
    : undefined;
```
Return `marketTiers` from the lite result (extend the return at line 174 and its type). Export `MarketTierSeeds`.

In `lib/llm/prompts.ts`, extend the lite JSON contract (line ~386) to:

```
  "categorySeeds": ["<a real, broad head search phrase a buyer would type for this PRODUCT CATEGORY>", "..."],
  "marketTiers": {
    "broad": ["<the umbrella INDUSTRY head term, e.g. 'marketing software'>", "..."],
    "medium": ["<the product's TOOL-CATEGORY head terms, e.g. 'seo tools', 'rank tracking software'>", "..."],
    "niche": ["<the specific wedge incl. audience, e.g. 'seo tools for solo founders'>", "..."]
  }
```
and add to the rules block (after the categorySeeds rule, ~line 392):

```
- marketTiers: the SAME kind of real head search phrases, at three market altitudes — broad = the industry umbrella (1–2 phrases), medium = the tool category (2–4), niche = the specific wedge including the audience (1–3). NEVER volumes, NEVER the brand, NEVER a competitor name. If an altitude is genuinely unclear, return an empty array for it rather than guessing.
```

- [ ] **Step 4: Run to verify pass** — `pnpm vitest run lib/llm/synth.test.ts` → PASS.

- [ ] **Step 5: Persist.** In `lib/scan/findings-pipeline.ts`, where `categorySeeds` is written into `findings_payload`, write `marketTiers` beside it (same object spread). Verify with `grep -n "marketTiers" lib/scan/findings-pipeline.ts` → 1 hit in the persist payload.

- [ ] **Step 6: Commit**

```bash
git checkout -b feat/free-scan-wow-data
git add lib/llm/prompts.ts lib/llm/synth.ts lib/llm/synth.test.ts lib/scan/findings-pipeline.ts
git commit -m "feat(free-scan): lite synth emits broad/medium/niche market-tier seeds (M1)"
```

---

### Task 3: M2 — per-tier demand + standing, priced by the SAME single volumes call

**Files:**
- Modify: `lib/scan/search-visibility.ts` (interface + new pure fn + gather wiring)
- Modify: `lib/scan/free-report.ts` (thread `marketTiers` from `findings_payload` into the gather)
- Test: `lib/scan/search-visibility.test.ts`

**Interfaces:**
- Consumes: `MarketTierSeeds` from Task 2 (`findings_payload.marketTiers`).
- Produces: `export interface MarketTier { tier: "broad" | "medium"; phrases: DemandRow[]; demand: number; bestPosition: number | null }` and `SearchVisibility.marketTiers?: MarketTier[]`; `export function computeMarketTiers(...)`; `gatherFreeSearchVisibility(rawSelf, seedText, llmCategorySeeds, tierSeeds?)` gains an optional 4th param. **Only broad + medium are computed/rendered** — the niche rung IS the existing category-demand card (rendering a duplicate niche number would violate "one concept, one name").

- [ ] **Step 1: Write failing tests** (append to `lib/scan/search-visibility.test.ts`):

```ts
describe("computeMarketTiers (M2) — the broad/medium market ladder", () => {
  const volumes = new Map([
    ["marketing software", 550000],
    ["seo tools", 74000],
    ["rank tracking software", 1600],
  ]);
  const ranks = new Map([["seo tools", 12]]);

  it("each tier's demand reconciles EXACTLY to its rendered phrases (G4-per-tier)", () => {
    const tiers = computeMarketTiers(
      { broad: ["marketing software"], medium: ["seo tools", "rank tracking software"], niche: ["x"] },
      volumes,
      ranks,
    );
    for (const t of tiers) {
      expect(t.demand).toBe(t.phrases.reduce((s, p) => s + p.volume, 0));
      expect(t.phrases.length).toBeGreaterThan(0);
    }
    expect(tiers.map((t) => t.tier)).toEqual(["broad", "medium"]); // niche never emitted
  });

  it("standing comes from the REAL rank map — never invented", () => {
    const tiers = computeMarketTiers({ broad: ["marketing software"], medium: ["seo tools"], niche: [] }, volumes, ranks);
    expect(tiers.find((t) => t.tier === "broad")!.bestPosition).toBeNull();
    expect(tiers.find((t) => t.tier === "medium")!.bestPosition).toBe(12);
  });

  it("a tier whose phrases all price to 0 volume is omitted (degrade, never render a hollow rung)", () => {
    const tiers = computeMarketTiers({ broad: ["zzz unknown"], medium: ["seo tools"], niche: [] }, volumes, ranks);
    expect(tiers.map((t) => t.tier)).toEqual(["medium"]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run lib/scan/search-visibility.test.ts` → FAIL (`computeMarketTiers` not exported).

- [ ] **Step 3: Implement the pure function** (in `search-visibility.ts`, after `computeCategoryDemand`):

```ts
export interface MarketTier {
  tier: "broad" | "medium";
  phrases: DemandRow[];
  demand: number;
  bestPosition: number | null;
}

/**
 * M2 (2026-07-19): the broad/medium market ladder — "this is a big industry,
 * this is the category you compete in" — priced from the SAME single
 * search_volume request as the category seeds (the tier phrases are merged into
 * that one call's keyword list; request-billed, so phrase count is cost-free).
 * The NICHE rung is deliberately NOT computed here: it IS the existing
 * category-demand card (one concept, one name — G7). Standing per rung comes
 * only from the real rank map (the one ranked_keywords call) — never invented.
 * Feeds NOTHING into sv.score (invariant #1).
 */
export function computeMarketTiers(
  tierSeeds: { broad: string[]; medium: string[]; niche: string[] },
  volumesByKeyword: Map<string, number>,
  rankByKeyword: Map<string, number>,
): MarketTier[] {
  const mk = (tier: MarketTier["tier"], seeds: string[]): MarketTier => {
    const seen = new Set<string>();
    const phrases: DemandRow[] = [];
    for (const raw of seeds) {
      const keyword = raw.toLowerCase().trim();
      if (!keyword || seen.has(keyword)) continue;
      seen.add(keyword);
      const volume = volumesByKeyword.get(keyword) ?? 0;
      if (volume <= 0) continue;
      phrases.push({ keyword, volume, yourPosition: rankByKeyword.get(keyword) });
    }
    phrases.sort((a, b) => b.volume - a.volume);
    const positions = phrases.map((p) => p.yourPosition).filter((p): p is number => typeof p === "number");
    return {
      tier,
      phrases,
      demand: phrases.reduce((s, p) => s + p.volume, 0), // G4-per-tier by construction
      bestPosition: positions.length ? Math.min(...positions) : null,
    };
  };
  return [mk("broad", tierSeeds.broad), mk("medium", tierSeeds.medium)].filter((t) => t.phrases.length > 0);
}
```
Add to the `SearchVisibility` interface (after `categoryWonKeywords`, line ~114): `marketTiers?: MarketTier[];` with a doc comment noting it is broad/medium only, additive, absent on legacy payloads.

- [ ] **Step 4: Wire the gather.** In `gatherFreeSearchVisibility` (line 453): add the optional param `tierSeeds?: { broad: string[]; medium: string[]; niche: string[] }`. Replace the seed-volume block (lines 485–491) with:

```ts
    const seeds = buildCategorySeeds(sv, llmCategorySeeds);
    // ONE volumes request prices the category seeds AND the ladder's tier phrases
    // (request-billed — merging keywords adds no cost and no latency).
    const tierPhrases = tierSeeds ? [...tierSeeds.broad, ...tierSeeds.medium] : [];
    const allSeeds = [...new Set([...seeds, ...tierPhrases.map((s) => s.toLowerCase().trim())].filter(Boolean))].slice(0, 16);
    const seedVolumes = allSeeds.length > 0 ? await cachedKeywordVolumes(allSeeds).catch(() => []) : [];
    const volumesByKeyword = new Map(seedVolumes.map((r) => [r.keyword.toLowerCase(), r.volume]));
    // Demand hero (niche/category rung): UNCHANGED — only the ORIGINAL category
    // seeds feed it, so the persisted demand story doesn't move under the ladder.
    const catVolumes = seedVolumes.filter((r) => seeds.includes(r.keyword.toLowerCase()));
    const demand = computeCategoryDemand(catVolumes, rankByKeyword, sv.categoryRanked);
    const marketTiers = tierSeeds ? computeMarketTiers(tierSeeds, volumesByKeyword, rankByKeyword) : undefined;
    return { ...sv, ...demand, ...(marketTiers && marketTiers.length > 0 ? { marketTiers } : {}) };
```
(Confirm `buildCategorySeeds` returns lowercased phrases with `grep -n "buildCategorySeeds" lib/scan/search-visibility.ts` and read its body; if not lowercased, normalize `seeds` the same way before the `includes` comparison.)

- [ ] **Step 5: Thread from free-report.** In `lib/scan/free-report.ts`: extend the `fp` type (line 140–144) with `marketTiers?: { broad: string[]; medium: string[]; niche: string[] };`, read it like `categorySeeds`, and pass as the gather's 4th arg (line 196):

```ts
  const marketTierSeeds = fp?.marketTiers && typeof fp.marketTiers === "object"
    ? { broad: fp.marketTiers.broad ?? [], medium: fp.marketTiers.medium ?? [], niche: fp.marketTiers.niche ?? [] }
    : undefined;
  const searchVisibility = ctx.mode === "web"
    ? await gatherFreeSearchVisibility(ctx.storeUrl, seedText, categorySeeds, marketTierSeeds)
    : undefined;
```

- [ ] **Step 6 (PAID PARITY): thread the tier seeds through the deep pass too.** `grep -n "gatherFreeSearchVisibility" lib/scan/full-scan.ts` — the deep pass calls the SAME gather (~line 781 region). Read that call site: give it the same 4th argument, sourcing `marketTiers` from `findings_payload` exactly as `free-report.ts` does (read the scan row's `findings_payload` if not already in scope at that call site — follow the pattern the call site already uses for `categorySeeds`). Without this, a paid upgrade REGENERATES `searchVisibility` without `marketTiers` and the ladder silently vanishes on upgrade. Add a test in `search-visibility.test.ts` or the existing full-scan test file asserting the full-scan call site passes tier seeds (source tripwire via `expectCallsSymbol` if a behavioral test is impractical — never a naive substring match).

- [ ] **Step 6b: Run to verify pass** — `pnpm vitest run lib/scan/search-visibility.test.ts` → PASS (new + all existing G1–G7/corpus cases).

- [ ] **Step 7: Mutation-prove G4-per-tier** — in `computeMarketTiers` change `demand:` to `demand: phrases.reduce((s, p) => s + p.volume, 0) + 100,`; `git diff --stat` non-empty; test FAILS on reconciliation; revert; green.

- [ ] **Step 8: Commit**

```bash
git add lib/scan/search-visibility.ts lib/scan/search-visibility.test.ts lib/scan/free-report.ts
git commit -m "feat(free-scan): broad/medium market ladder — per-tier demand + standing from the same volumes call (M2)"
```

---

### Task 4: WS-C — deterministic opportunity-targeted actions with a score-model-derived delta

**Files:**
- Modify: `lib/scan/fallback-actions.ts`
- Modify: `lib/scan/search-visibility.ts` (export `CATEGORY_TARGET` if module-private)
- Modify: `lib/scan/free-report.ts` (reorder: actions built AFTER the gather; merge + cap)
- Test: `lib/scan/fallback-actions.test.ts`

**Interfaces:**
- Consumes: `SearchVisibility.categoryOpportunities` (`DemandRow[]` with optional `yourPosition`), `unifiedDiscoverability` (locate its export: `grep -n "export function unifiedDiscoverability\|export const unifiedDiscoverability" lib/scan/*.ts` — import from that module), `CATEGORY_TARGET` from `search-visibility.ts`.
- Produces: `export const MAX_OPPORTUNITY_ACTIONS = 2;` and `export function opportunityActionsFromSearch(input: { score: number; onPageReadiness: number; categoryOpportunities: DemandRow[] }, now?: Date): ActionCard[]`.

- [ ] **Step 1: Export the target constant.** `grep -n "CATEGORY_TARGET" lib/scan/search-visibility.ts` — if `const CATEGORY_TARGET = 6` is module-private, change to `export const CATEGORY_TARGET = 6;` (touch nothing else).

- [ ] **Step 2: Write failing tests** (append to `lib/scan/fallback-actions.test.ts`):

```ts
import { opportunityActionsFromSearch, MAX_OPPORTUNITY_ACTIONS } from "./fallback-actions";
import { CATEGORY_TARGET } from "./search-visibility";
// adjust this import to wherever unifiedDiscoverability is exported (see Task 4 interfaces)
import { unifiedDiscoverability } from "./registry-score";

describe("opportunityActionsFromSearch (WS-C)", () => {
  const sv = {
    score: 0,
    onPageReadiness: 89,
    categoryOpportunities: [
      { keyword: "rank tracking software", volume: 1600, yourPosition: undefined },
      { keyword: "competitor analysis tools", volume: 1300, yourPosition: 12 },
      { keyword: "seo analytics software", volume: 260, yourPosition: undefined },
    ],
  };

  it("emits ≤ MAX_OPPORTUNITY_ACTIONS cards, each naming the REAL phrase + real standing", () => {
    const cards = opportunityActionsFromSearch(sv, new Date("2026-07-19"));
    expect(cards).toHaveLength(MAX_OPPORTUNITY_ACTIONS);
    expect(cards[0].title).toContain('"rank tracking software"');
    expect(cards[0].why).toContain("1,600");
    expect(cards[1].why).toContain("#12");
    for (const c of cards) {
      expect(c.draft).toBeNull();
      expect(c.draftRequiresEdit).toBe(true);
      expect(c.basis).toBe("probability_based");
    }
  });

  it("delta is the score-model recomputation (one category win = one CATEGORY_TARGET step), never a free-chosen number (5a)", () => {
    const [card] = opportunityActionsFromSearch(sv, new Date("2026-07-19"));
    const expected = Math.max(
      1,
      Math.round(
        unifiedDiscoverability(89, Math.min(100, 0 + 100 / CATEGORY_TARGET)) -
          unifiedDiscoverability(89, Math.max(1, 0)),
      ),
    );
    expect(card.expectedOutcome.delta).toBe(expected);
  });

  it("no opportunities → no cards (degrade, never invent)", () => {
    expect(opportunityActionsFromSearch({ score: 50, onPageReadiness: 80, categoryOpportunities: [] })).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify failure** — `pnpm vitest run lib/scan/fallback-actions.test.ts` → FAIL.

- [ ] **Step 4: Implement** (append to `lib/scan/fallback-actions.ts`; add the two imports at the top, matching the paths found in Step 2's imports):

```ts
export const MAX_OPPORTUNITY_ACTIONS = 2;

/**
 * WS-C (2026-07-19): the free plan's #1 fix must speak to the page's own
 * diagnosis. These cards are DETERMINISTIC (no LLM, no new data): each names a
 * real category search the site doesn't win (keyword/volume/position already in
 * the payload). Impact honesty (invariant 5a): the delta is RECOMPUTED from the
 * score model — winning one category term moves the search-presence driver by
 * one CATEGORY_TARGET step, and the delta is the unified-gauge movement that
 * step produces. Never a free-chosen number.
 */
export function opportunityActionsFromSearch(
  input: { score: number; onPageReadiness: number; categoryOpportunities: Array<{ keyword: string; volume: number; yourPosition?: number }> },
  now: Date = new Date(),
): ActionCard[] {
  const { score, onPageReadiness } = input;
  if (onPageReadiness <= 0) return [];
  const opps = (input.categoryOpportunities ?? []).slice(0, MAX_OPPORTUNITY_ACTIONS);
  const deadline = new Date(now.getTime() + 21 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const before = unifiedDiscoverability(onPageReadiness, Math.max(1, score));
  const after = unifiedDiscoverability(onPageReadiness, Math.min(100, score + 100 / CATEGORY_TARGET));
  const delta = Math.max(1, Math.round(after - before));
  return opps.map((o) => ({
    category: "seo_aso",
    title: `Create or strengthen a page targeting "${o.keyword}"`,
    why: `${o.volume.toLocaleString()} searches/mo in your category — ${
      typeof o.yourPosition === "number" ? `you're #${o.yourPosition} today; top 3 is the goal` : "you don't rank for it yet"
    }. Winning it lifts the Search-presence half of your score.`,
    evidenceIds: [],
    evidence: [],
    effortMin: 120,
    suggestedDeadline: deadline,
    expectedOutcome: { scoreComponent: "seo", delta },
    draft: null,
    draftRequiresEdit: true,
    verification: { method: "self_report", state: "pending" },
    basis: "probability_based",
    confidence: 0.5,
    target: null,
    signalKeys: [],
  }));
}
```

- [ ] **Step 5: Run to verify pass** — `pnpm vitest run lib/scan/fallback-actions.test.ts` → PASS.

- [ ] **Step 6: Wire into the free report.** In `lib/scan/free-report.ts`: DELETE the `const actions = fillDeterministicDrafts(...)` block at lines 175–180, and insert AFTER the v5 block (after line 206):

```ts
  // Plan: opportunity-targeted cards FIRST (they speak to the search story the
  // page just told), then the weakest-signal baseline fixes; capped at the floor
  // max so the free plan stays 3–5 tight cards.
  const opportunityCards =
    searchVisibility
      ? opportunityActionsFromSearch({
          score: searchVisibility.score,
          onPageReadiness: searchVisibility.onPageReadiness ?? reg.total,
          categoryOpportunities: searchVisibility.categoryOpportunities ?? [],
        })
      : [];
  const actions = fillDeterministicDrafts(
    [...opportunityCards, ...fallbackActionsFromSignals(signalRows)].slice(0, MAX_FALLBACK_ACTIONS),
    facts.listing,
    ctx.storeUrl,
    ctx.mode,
  );
```
Add the import: `import { fallbackActionsFromSignals, opportunityActionsFromSearch, MAX_FALLBACK_ACTIONS } from "./fallback-actions";` (merge with the existing import line). `MAX_FALLBACK_ACTIONS` remains the TOTAL cap.

- [ ] **Step 7: Full unit suite** — `pnpm vitest run lib/scan` → all green (registry-score, corpus, G-family untouched).

- [ ] **Step 8: Commit**

```bash
git add lib/scan/fallback-actions.ts lib/scan/fallback-actions.test.ts lib/scan/free-report.ts lib/scan/search-visibility.ts
git commit -m "feat(free-scan): opportunity-targeted actions with score-model-derived delta (WS-C)"
```
Open PR-2 (Tasks 2–4). Gates: `pnpm test && pnpm check:arch && pnpm eval` (eval needs local Supabase).

---

### Task 5: WS-B + opportunity rows — honest teaser count, visible rows 2–4

**Files:**
- Modify: `app/(funnel)/scan/[id]/public-report.tsx:56-57`
- Modify: `components/report/captured/results-screen.tsx:419-468`
- Modify: `components/report/captured/to-results-props.ts` (no logic change needed for rows — `gapRows` already carries 4; verify)
- Test: `components/report/captured/results-screen.render.test.tsx`

**Interfaces:**
- Consumes: `gapRows: GapRow[]` (up to 4, already passed), `gapTotal` (now = the same collection the rows come from).

- [ ] **Step 1: Write the failing render test** (append; use the file's existing `sv()`/`report()` helpers — read the file's helper signatures first):

```tsx
it("teaser count derives from the SAME rows rendered — 'Unlock all 0' is impossible (WS-B)", () => {
  // 0-ranking site: categoryGap is empty by construction, categoryOpportunities has 4.
  const payload = report({
    searchVisibility: sv({
      keywordsRanked: 0,
      categoryGap: [],
      categoryOpportunities: [
        { keyword: "rank tracking software", volume: 1600 },
        { keyword: "competitor analysis tools", volume: 1300 },
        { keyword: "marketing analytics platform", volume: 320 },
        { keyword: "seo analytics software", volume: 260 },
      ],
    }),
  });
  const html = renderPublicReport(payload); // use the file's existing render harness for the free/public path
  expect(html).not.toMatch(/all\s+0\s+category/i);
  expect(html).toContain("competitor analysis tools"); // row 2 is VISIBLE now
});
```
(Adapt helper names to the file's actual ones — the test must go through the same `toResultsProps` + `ResultsScreen` path the page uses, with `fullGapQueries` computed as in `public-report.tsx`.)

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run components/report/captured/results-screen.render.test.tsx` → FAIL (both assertions).

- [ ] **Step 3: Fix the count.** In `public-report.tsx` replace lines 56–57 with:

```ts
  // The teaser count must be the SAME collection the opportunity section renders
  // (paid rival gap when present, else the free category opportunities) — the old
  // categoryGap source is empty by construction for 0-ranking sites, which
  // rendered "Unlock all 0 category opportunities" live (scan 4093f1c9, WS-B).
  const fullGapQueries =
    (payload.market?.gap?.keywordGap?.length ?? 0) ||
    (payload.searchVisibility?.categoryOpportunities?.length ?? 0) ||
    (payload.searchVisibility?.categoryGap?.length ?? 0);
```

- [ ] **Step 4: Render rows 2–4 + conditional unlock line.** In `results-screen.tsx`, inside the opportunity IIFE: after the explainer `<div>` (ends line 460), insert before the unlock block:

```tsx
                {p.gapRows.length > 1 && (
                  <div style={{ marginTop: 14, borderTop: "1px solid var(--c-line2)", paddingTop: 4 }}>
                    {p.gapRows.slice(1, 4).map((row) => (
                      <div key={row.query} style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--c-line2)", fontSize: 13.5 }}>
                        <span style={{ fontFamily: SG, fontWeight: 600, flex: "1 1 160px", minWidth: 0 }} className="rk-wrap-any">{row.query}</span>
                        <span style={{ fontFamily: JM, color: "var(--c-muted)" }}>{row.volume}/mo</span>
                        <span style={{ fontFamily: JM, fontWeight: 700, color: row.ranked ? "#C98A12" : "#E5484D" }}>{row.rank}</span>
                      </div>
                    ))}
                  </div>
                )}
```
Replace the unlock block (lines 461–465) with:

```tsx
                {!p.hideUnlock && p.gapTotal > 0 && (
                  <div style={{ marginTop: 14, textAlign: "center", fontSize: 14, fontWeight: 600 }}>
                    <UnlockLink scanId={p.scanId}>
                      🔒 Unlock the plan to win {p.gapTotal === 1 ? "this opportunity" : `all ${p.gapTotal} opportunities`} — pages, drafts, and weekly tracking →
                    </UnlockLink>
                  </div>
                )}
```
And update line 438's "more like it" count to reflect what is now visible: `const more = Math.max(0, p.gapTotal - Math.min(p.gapRows.length, 4));`

- [ ] **Step 5: Run to verify pass** — `pnpm vitest run components/report/captured/results-screen.render.test.tsx` → PASS.

- [ ] **Step 6: Mutation-prove** — revert the `public-report.tsx` count line to the old `categoryGap` source; `git diff --stat` non-empty; test FAILS on `/all\s+0/`; restore; green.

- [ ] **Step 7: Commit**

```bash
git checkout -b feat/free-scan-wow-render
git add app/\(funnel\)/scan/\[id\]/public-report.tsx components/report/captured/results-screen.tsx components/report/captured/results-screen.render.test.tsx
git commit -m "fix(free-report): teaser count from the rendered rows + visible opportunity rows 2-4 (WS-B/WS-D)"
```

---### Task 6: WS-D + M3 + R1 — market ladder, wins strip, off-topic examples, identity strip

**Files:**
- Modify: `components/report/captured/to-results-props.ts` (map new fields, all defaulted)
- Modify: `components/report/captured/results-screen.tsx` (props + three render additions)
- Test: `components/report/captured/results-screen.render.test.tsx` (legacy scenario + new-field cases)

**Interfaces:**
- Consumes (all optional on the payload): `sv.marketTiers` (Task 3), `sv.categoryRanked`, `sv.offTopicExamples`, `report.whatYouOffer.positioningMirror.listingSays`.
- Produces on `ResultsScreenProps`: `identityLine?: string`; and on the `searchVisibility` prop object: `marketTiers: { tier: "broad" | "medium"; label: string; demand: number; bestPosition: number | null }[]`, `winsRows: { keyword: string; volume: number; yourPosition: number }[]`, `offTopicExamples: string[]`.

- [ ] **Step 1: Write failing render tests** (append):

```tsx
it("renders the broad/medium market ladder with per-rung standing (M3)", () => {
  const html = renderPublicReport(report({ searchVisibility: sv({
    marketTiers: [
      { tier: "broad", phrases: [{ keyword: "marketing software", volume: 550000 }], demand: 550000, bestPosition: null },
      { tier: "medium", phrases: [{ keyword: "seo tools", volume: 74000, yourPosition: 12 }], demand: 74000, bestPosition: 12 },
    ],
  }) }));
  expect(html).toContain("marketing software");
  expect(html).toContain("550,000");
  expect(html).toContain("#12");
});

it("renders the 'you already win' strip from categoryRanked top-3 (WS-D)", () => {
  const html = renderPublicReport(report({ searchVisibility: sv({
    categoryRanked: [{ keyword: "discoverability tool", volume: 2400, yourPosition: 2 }],
    categoryWins: 1,
  }) }));
  expect(html).toContain("discoverability tool");
  expect(html).toContain("#2");
});

it("names the off-topic examples inside the warning (WS-D)", () => {
  const html = renderPublicReport(report({ searchVisibility: sv({
    keywordsRanked: 900, offTopicPct: 60, categoryPct: 15, brandPct: 25,
    offTopicExamples: ["spanglish translator", "cometly"],
  }) }));
  expect(html).toContain("spanglish translator");
});

it("renders the identity strip from listingSays (R1)", () => {
  const html = renderPublicReport(report({ whatYouOffer: { positioningMirror: { listingSays: "SEO analytics for solo founders.", reviewsValue: "", gap: "" } } }));
  expect(html).toContain("SEO analytics for solo founders.");
});
```

- [ ] **Step 2: Extend the LEGACY scenario in the same file:** the legacy payload's omitted set must now also OMIT `marketTiers`, `categoryRanked`, `offTopicExamples` (and any pre-existing omissions) and the test must still render without throwing. Run: `pnpm vitest run components/report/captured/results-screen.render.test.tsx` → new cases FAIL, legacy case still PASSES.

- [ ] **Step 3: Map in `to-results-props.ts`.** Inside the `searchVisibility` mapping object (after `categoryPhrases: sv.categoryPhrases ?? [],` line 158):

```ts
        // WS-D/M3 (2026-07-19) — all additive, all legacy-defaulted (?? [] rule):
        marketTiers: (sv.marketTiers ?? []).map((t) => ({
          tier: t.tier,
          label: t.phrases[0]?.keyword ?? "",
          demand: t.demand,
          bestPosition: t.bestPosition,
        })),
        winsRows: (sv.categoryRanked ?? [])
          .filter((r) => typeof r.yourPosition === "number" && r.yourPosition <= 3)
          .slice(0, 3)
          .map((r) => ({ keyword: r.keyword, volume: r.volume, yourPosition: r.yourPosition as number })),
        offTopicExamples: (sv.offTopicExamples ?? []).slice(0, 3),
```
And in the returned object add: `identityLine: (pm.listingSays ?? "").trim().slice(0, 160),`

- [ ] **Step 4: Render in `results-screen.tsx`.**
(a) Props: add `identityLine?: string;` to `ResultsScreenProps` and `marketTiers`, `winsRows`, `offTopicExamples` to its `searchVisibility` shape (types exactly as produced above).
(b) **Identity strip (R1)** — after the logo/host block (line ~246, immediately before the `<h1>`):

```tsx
              {p.identityLine ? (
                <div style={{ fontSize: 12.5, color: "var(--c-faint)", margin: "0 0 8px", lineHeight: 1.5 }} className="rk-wrap-any">{p.identityLine}</div>
              ) : null}
```
(c) **Market ladder (M3)** — inside the category-demand card, BEFORE the hero-number row (before line 351's flex div):

```tsx
                {(sv.marketTiers ?? []).length > 0 && (
                  <div style={{ marginBottom: 14, borderBottom: "1px solid var(--c-line2)", paddingBottom: 12 }}>
                    {(sv.marketTiers ?? []).map((t) => (
                      <div key={t.tier} style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, fontSize: 13, padding: "3px 0" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-faint)", width: 58 }}>{t.tier}</span>
                        <span style={{ fontWeight: 600, flex: "1 1 140px", minWidth: 0 }} className="rk-wrap-any">{t.label}</span>
                        <span style={{ fontFamily: JM, color: "var(--c-muted)" }}>{t.demand.toLocaleString()} searches/mo</span>
                        <span style={{ fontFamily: JM, fontWeight: 700, color: t.bestPosition != null ? "#C98A12" : "#E5484D" }}>{t.bestPosition != null ? `best #${t.bestPosition}` : "not ranking"}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: "var(--c-faint)", marginTop: 6 }}>Your niche, where the plan below starts:</div>
                  </div>
                )}
```
(d) **Wins strip (WS-D)** — inside the same card, after the wins/red line `</div>` (line 361):

```tsx
                {(sv.winsRows ?? []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", fontSize: 12.5, fontFamily: JM, marginBottom: 10 }}>
                    {(sv.winsRows ?? []).map((w) => (
                      <span key={w.keyword} style={{ background: "var(--c-tint-green)", color: "#0E7A48", borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                        #{w.yourPosition} {w.keyword} <span style={{ fontWeight: 700 }}>{w.volume.toLocaleString()}</span>
                      </span>
                    ))}
                  </div>
                )}
```
(e) **Off-topic examples (WS-D)** — inside the ≥40% warning `<div>` (line 411–415), append after "…is your own category.":

```tsx
                    {(sv.offTopicExamples ?? []).length > 0 && (
                      <> e.g. you rank for <strong>{(sv.offTopicExamples ?? []).join('", "').replace(/^/, '"').concat('"')}</strong>.</>
                    )}
```
(Simpler equivalent acceptable: <code>e.g. you rank for &quot;{(sv.offTopicExamples ?? []).join('", "')}&quot;.</code>)

- [ ] **Step 5: Run to verify pass** — `pnpm vitest run components/report/captured/results-screen.render.test.tsx` → all PASS (incl. legacy).

- [ ] **Step 6: Commit**

```bash
git add components/report/captured/to-results-props.ts components/report/captured/results-screen.tsx components/report/captured/results-screen.render.test.tsx
git commit -m "feat(free-report): market ladder + wins strip + named off-topic examples + identity strip (M3/WS-D/R1)"
```

---

### Task 7: WS-E + R2 — rivalry both states + per-stage tease vocabulary

**Files:**
- Modify: `components/report/captured/results-screen.tsx:373-377` (rivals-found line) and the category card (no-rivals line)
- Test: `components/report/captured/results-screen.render.test.tsx`

- [ ] **Step 1: Write failing render tests** (append):

```tsx
it("rivals found → names them and teases per-rival intel (WS-E)", () => {
  const html = renderPublicReport(report({ competitors: ["SavvyCal", "Calendly"] }));
  expect(html).toContain("SavvyCal");
  expect(html).toMatch(/how each one ranks/i);
});

it("no rivals found → honest degrade tease, no invention (WS-E)", () => {
  const html = renderPublicReport(report({ competitors: [] }));
  expect(html).toMatch(/discovers who('|’)s winning these searches/i);
  expect(html).not.toMatch(/Buyers compare you to\s*</); // no empty comma-list sentence
});
```
(`competitors` reaches the screen via `whereTheyAre.competitorGap` in `toResultsProps` — build the payload accordingly with the file's helpers.)

- [ ] **Step 2: Run to verify failure** — `pnpm vitest run components/report/captured/results-screen.render.test.tsx` → FAIL.

- [ ] **Step 3: Implement.** Replace lines 373–377 with BOTH states:

```tsx
                {comps.length > 0 ? (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--c-line2)", fontSize: 13, color: "var(--c-muted)" }}>
                    Buyers compare you to <strong style={{ color: "var(--c-ink)" }}>{comps.join(", ")}</strong> — and rivals are taking the searches above.{" "}
                    <UnlockLink scanId={p.scanId}>Unlock to see how each one ranks, why they win, and how much of your category each takes →</UnlockLink>
                  </div>
                ) : !p.hideUnlock ? (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--c-line2)", fontSize: 13, color: "var(--c-muted)" }}>
                    Someone is winning these searches today.{" "}
                    <UnlockLink scanId={p.scanId}>The full scan discovers who&apos;s winning them and what they do to rank →</UnlockLink>
                  </div>
                ) : null}
```

- [ ] **Step 4: R2 vocabulary sweep.** In the SAME file, align the remaining teases to the one vocabulary (*free = what's true; paid = what rivals do about it + your verified next steps*): the no-top-row tease at line 430 keeps its text but ends `…ranked by opportunity. <UnlockLink…>Unlock to see who wins them and how →`; the locked-fixes band (line ~505-514) and unlock band defaults (lines ~555-560) are already aligned — verify wording, change only if they promise data the paid tier doesn't ship. List every changed string in the commit body (label-drift gate will check the DS cards in Task 8).

- [ ] **Step 5: Run to verify pass** — `pnpm vitest run components/report/captured/results-screen.render.test.tsx` → PASS.

- [ ] **Step 6: Commit**

```bash
git add components/report/captured/results-screen.tsx components/report/captured/results-screen.render.test.tsx
git commit -m "feat(free-report): rivalry line both states + one tease vocabulary (WS-E/R2)"
```

---

### Task 8: DS mirrors + parity + docs (Change Protocol)

**Files:**
- Modify: the `ds-src` card(s) mirroring `results-screen.tsx` (find them: `grep -rln "results-screen" .design-sync/ds-src/`)
- Modify: `CLAUDE.md` (G-family additions), `docs/plans/2026-07-19-free-scan-wow.md` (mark implemented items)

- [ ] **Step 1:** Update each mirroring `ds-src` card to render the new/changed labels (ladder rows, wins strip, off-topic examples sentence, identity strip, both rivalry lines, new unlock copy) — diff card vs live section by section (a bless verifies nothing; diff first).
- [ ] **Step 2:** Rebuild + relock: `node .design-sync/ds-src/build.mjs && node .design-sync/ds-src/layout.mjs && node scripts/gen-card-labels.mjs && pnpm check:design` → Expected: PASS (label drift baseline may SHRINK — re-pin with `node scripts/check-design-parity.mjs --pin-drift` only if it shrinks).
- [ ] **Step 3:** `pnpm bless:design -- <the results-screen card names>` (scoped, only after the Step-1 diff).
- [ ] **Step 4:** CLAUDE.md, number-honesty rule paragraph: append *"G10 (2026-07-19): a locked-content teaser count derives from the SAME collection its adjacent section renders (never a sibling metric — 'Unlock all 0' class); the market ladder's per-tier demand reconciles to its rendered phrases (G4-per-tier). Guards: `results-screen.render.test.tsx` (mutation-proven) + `search-visibility.test.ts`."*
- [ ] **Step 5:** Run the full ratchet: `pnpm test && pnpm lint && pnpm check:arch && pnpm check:design` → green. Commit:

```bash
git add .design-sync CLAUDE.md docs/plans/2026-07-19-free-scan-wow.md
git commit -m "chore(ds+docs): mirror free-report changes + G10 teaser-count guard (Change Protocol)"
```
Open PR-3. CI must show `eval-integration` + `mobile-smoke` green (the report route is in the mobile route set; the new ladder/wins rows use flex-wrap + `rk-wrap-any`, but the gate is the proof).

---

### Task 9: E2E verification — the seamless A→Z proof (after each deploy; full pass after PR-3)

**Samples:** `reachkit.app` (0-ranking + contested brand), `savvycal.com` (normal SaaS with real rankings), `getapp.com` (directory/aggregator, off-topic-heavy).

- [ ] **Step 1: Scan all three against prod** (repeat per domain):

```bash
curl -sS -X POST https://reachkit.app/api/scan -H 'content-type: application/json' -d '{"store_url":"https://savvycal.com"}'
```
Note: the 14-day dedupe returns existing scans — if `"deduped":true` and the scan predates the deploy, wait for the dedupe window or test on a preview deployment (`--base-url` pattern of `scripts/score-calibration.mts`).

- [ ] **Step 2: Speed + cost gate** (per scan id, prod DB):

```sql
select id, extract(epoch from (completed_at - started_at))::int as secs,
       round(cost_cents::numeric + run_dataforseo_cost_cents::numeric + run_tavily_cost_cents::numeric, 1) as run_cents,
       external_cap_hit_at
from scans where id = '<scan-id>';
```
Acceptance: `secs` ≤ 30 (target 20–30), `run_cents` ≤ 25 (expected ≤ ~18), `external_cap_hit_at` NULL.

- [ ] **Step 3: Render + read** (per slug):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --dump-dom --virtual-time-budget=15000 "https://reachkit.app/scan/<slug>" > /tmp/scan-<slug>.html
```
Read the ACTUAL text (strip tags) and check per-stage acceptance:

| Stage | reachkit.app | savvycal.com | getapp.com |
|---|---|---|---|
| Recognition | identity strip renders; **NO Positioning Mirror** (contested-brand reviews dropped) | identity strip; mirror only if genuinely grounded | identity strip |
| Market | ladder shows broad+medium rungs with real volumes + "not ranking"; niche hero ≥ today's 3,480 framing | ladder rungs show a real `best #N` | ladder renders or degrades silently (no hollow rung) |
| Position | zero-state banner; no wins strip (honest) | wins strip shows real top-3 terms | off-topic warning NAMES example brands |
| Rivalry | no-rivals tease renders ("discovers who's winning…") | "Buyers compare you to …" + per-rival tease | either state, never an empty sentence |
| Action | fix #1 names a real category phrase + derived delta; **no "Unlock all 0"** | fix #1 names a phrase with `#N` position | fixes render; counts reconcile |
| Bridge | one vocabulary; every lock reads as its stage's continuation | same | same |

- [ ] **Step 4: Number reconciliation on the live DOM:** every rendered demand number equals the sum of its adjacent chips (hero + each rung); the teaser count equals the opportunity-collection size from the DB payload.
- [ ] **Step 5: Mobile:** `BASE_URL=https://reachkit.app pnpm test:mobile` → no overflow on the report route.
- [ ] **Step 6:** File the results (per-domain secs/cents + per-stage pass/fail table) in the PR-3 description or a follow-up comment; any FAIL loops back to its task — do not hand-wave a partial pass.

---

## Self-Review (done at authoring)

- Spec coverage: WS-A→Task 1, M1→2, M2→3, WS-C→4, WS-B→5, WS-D/M3/R1→6, WS-E/R2→7, DS+docs+G10→8, E2E+speed+cost→9. D1(a) honored (no SERP task). Niche rung intentionally = existing demand card (no duplicate number).
- Placeholders: none — every code step carries code; the three "locate with grep" steps specify the exact command and what to do with the result.
- Type consistency: `DemandRow` reused for tier phrases; `MarketTier.tier` narrowed to `"broad" | "medium"`; props produced in Task 6 Step 3 match the shapes consumed in Step 4 and the tests.
