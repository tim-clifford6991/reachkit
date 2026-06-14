# Free → Email → Paid Funnel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (or executing-plans) to implement task-by-task. Steps use `- [ ]` checkboxes.

**Goal:** Make the free scan deliver a competitor-intelligence "wow", gate the *interpretation* behind an email, and gate the *weekly operating system* behind the paywall — grounded only in data the pipeline already produces.

**Architecture:** Three tiers. (1) FREE = the live scan page (`/scan/[id]`): competitive-landscape card + positioning mirror + finding[0] + teaser. (2) EMAIL = `/scan/[id]/results`: full analysis (positioning gap, full competitor gap with real positioning/gap strings, all surfaces, ICP) + 3 draft-less preview actions. (3) PAID = full action drafts + weekly engine (already built). The single highest-leverage backend fix is wiring the real competitor `positioning`/`gap` strings (already extracted) into the report, plus a free community-mention count to replace the `them:1, you:0` placeholder.

**Tech stack:** Next 16 (App Router, Cache Components), React 19, the existing scan pipeline (`lib/scan/*`, `lib/llm/*`), redaction in `lib/billing/entitlements.ts`, report components in `components/report/*`, funnel in `app/(funnel)/scan/[id]/*`.

**Design source:** `docs/design/2026-06-14-free-email-paid-value-ladder.md` (read it first).

## Decisions on the design's open questions (Q1–Q6)
- **Q1 (positioning gap at email):** YES — email tier shows the full positioning mirror incl. the red-accent `gap`. The gap is the intellectual insight; the *prescription* (action drafts) stays paid.
- **Q2 (name competitors free):** YES — name competitors on the free page, no gate (founder explicitly wants this).
- **Q3 (them/you score):** Use **community-mention count** first (free, real, existing `raw_documents`) — not keyword-overlap (deferred; adds API cost).
- **Q4 (teaser timing):** The full scan finishes after the email gate appears, so the pre-gate teaser uses `facts.competitors.length` as the immediate proxy ("and more in your full report").
- **Q5 (artifact labels):** Bundle the label rewrites with this redesign (M3).
- **Q6 (Growth competitive cadence):** Out of scope (v1.5); the upgrade pitch stays tier-agnostic.

---

## File structure (what each task touches)

- `lib/llm/types.ts` — extend `CompetitorGapSheet` consumers (no change to the sheet itself; it already has `positioning`/`gap`).
- `lib/scan/report.ts` — extend `ReportPayload.whereTheyAre.competitorGap[]` with `positioning?`, `gap?`.
- `lib/scan/full-scan.ts` — `GapRow` type + `readCompetitorGap()`: pass through `positioning`/`gap`; compute `them`/`you` from community mentions.
- `lib/scan/competitor-mentions.ts` (NEW) — pure helper that counts community-thread mentions of a name in `raw_documents`.
- `lib/billing/entitlements.ts` — confirm free/email/paid redaction boundaries (actions cap + drafts).
- `app/(funnel)/scan/[id]/results/page.tsx` — unlock the *analysis* sections at email tier.
- `components/report/where-they-are-section.tsx` — render `positioning`/`gap` strings; show all surfaces + full gap when unlocked.
- `components/report/what-you-offer-section.tsx` — full gap styling at email tier.
- `components/report/upgrade-cta.tsx` — data-driven continuity pitch.
- `app/(funnel)/scan/[id]/scan-stream.tsx` — the FREE competitive-landscape card (`FactsView`) + theme framing.
- `app/(funnel)/scan/[id]/findings-reveal.tsx` — pre-gate "what your report also contains" teaser + email-gate heading.
- `lib/scan/source-labels.ts` (NEW) — map `competitor.source` codes → plain-English distribution descriptions (shared free + email).
- `lib/scan/collect.ts` / `lib/scan/pipeline.ts` — reframe `emitScanEvent(..., "artifact", {label})` copy.
- Tests: `lib/scan/competitor-mentions.test.ts`, `lib/scan/source-labels.test.ts`, extend `tests/integration/full-collect.test.ts` (readCompetitorGap), `lib/billing/entitlements.test.ts`.

---

## Milestone 1 — Backend: real competitor gap (the unlock)

### Task 1.1 — Plain-English source labels (shared helper)
**Files:** Create `lib/scan/source-labels.ts`; Test `lib/scan/source-labels.test.ts`.

- [ ] **Step 1 — write the failing test**
```ts
import { expect, test } from "vitest";
import { competitorSourceLabel } from "./source-labels";
test.each([
  ["itunes_search", "ranks in your App Store category"],
  ["dataforseo_serp", "appears when buyers search for alternatives"],
  ["product_hunt", "launched in your Product Hunt category"],
  ["tavily", "mentioned alongside you in search results"],
  ["unknown_x", "found in your category"],
])("competitorSourceLabel(%s)", (src, expected) => {
  expect(competitorSourceLabel(src)).toBe(expected);
});
```
- [ ] **Step 2 — run it, confirm it fails** (`pnpm test lib/scan/source-labels.test.ts`).
- [ ] **Step 3 — implement**
```ts
const LABELS: Record<string, string> = {
  itunes_search: "ranks in your App Store category",
  dataforseo_serp: "appears when buyers search for alternatives",
  product_hunt: "launched in your Product Hunt category",
  tavily: "mentioned alongside you in search results",
};
export function competitorSourceLabel(source: string): string {
  return LABELS[source] ?? "found in your category";
}
```
- [ ] **Step 4 — run test, confirm pass. Step 5 — commit.**

### Task 1.2 — Community-mention counter (real `them`/`you`)
**Files:** Create `lib/scan/competitor-mentions.ts`; Test `lib/scan/competitor-mentions.test.ts`.

- [ ] **Step 1 — failing test:** a pure function `countMentions(name: string, communityBodies: unknown[]): number` that case-insensitively counts how many community items mention `name`.
```ts
import { expect, test } from "vitest";
import { countMentions } from "./competitor-mentions";
test("counts case-insensitive title mentions across community docs", () => {
  const docs = [
    [{ title: "Best Opal alternatives?" }, { title: "Forest vs Opal" }],
    [{ title: "unrelated thread" }],
  ];
  expect(countMentions("Opal", docs)).toBe(2);
  expect(countMentions("Forest", docs)).toBe(1);
  expect(countMentions("Nudgi", docs)).toBe(0);
});
```
- [ ] **Step 2 — run, confirm fail.**
- [ ] **Step 3 — implement** a pure counter (flatten community bodies → each item's `title`/`body` text → `toLowerCase().includes(name.toLowerCase())`; guard non-arrays). Keep it dependency-free and DB-free (the DB read happens in `readCompetitorGap`).
- [ ] **Step 4 — run, pass. Step 5 — commit.**

### Task 1.3 — Extend the report type
**File:** `lib/scan/report.ts` (lines 34–39).

- [ ] **Step 1 — extend the type** (additive, optional → no breakage):
```ts
competitorGap: Array<{
  competitor: string;
  dimension: string;
  them: number;
  you: number;
  positioning?: string; // how the competitor describes itself (from competitor_gap sheet)
  gap?: string;         // the specific gap vs the subject (from competitor_gap sheet)
}>;
```
Mirror the same optional fields on the local `competitorGap` param type used by `assembleReport` (line ~110).
- [ ] **Step 2 — `pnpm typecheck`** (expect clean — fields are optional).
- [ ] **Step 3 — commit.**

### Task 1.4 — `readCompetitorGap()`: wire strings + real scores
**File:** `lib/scan/full-scan.ts` (`GapRow` line 51, `readCompetitorGap` 146–172).

- [ ] **Step 1 — extend `GapRow`:**
```ts
type GapRow = { competitor: string; dimension: string; them: number; you: number; positioning?: string; gap?: string };
```
- [ ] **Step 2 — rewrite `readCompetitorGap`** to (a) pass through `positioning`/`gap` from the `competitor_gap` sheet, and (b) compute `them`/`you` from community mentions (read once, count per competitor + the subject). Replace the body:
```ts
async function readCompetitorGap(
  subjectType: string,
  subjectKey: string,
  facts: PreliminaryFacts,
): Promise<GapRow[]> {
  // Community bodies for mention counts (cheap real them/you signal).
  const communityBodies = await readCommunityBodies(subjectKey); // small helper: select body from raw_documents where subject_key=… and source_type='communities'
  const youMentions = countMentions(facts.listing.name ?? "", communityBodies);
  const rowFor = (name: string, positioning?: string, gap?: string): GapRow => ({
    competitor: name,
    dimension: "community presence",
    them: countMentions(name, communityBodies),
    you: youMentions,
    positioning,
    gap,
  });
  const fromFacts = (): GapRow[] =>
    facts.competitors.filter((c) => c.name?.length).map((c) => rowFor(c.name));
  try {
    const sheet = await getFreshFactSheet(subjectType, subjectKey, "competitor_gap");
    if (sheet === null) return fromFacts();
    const comps = Array.isArray((sheet.body as { competitors?: unknown }).competitors)
      ? (sheet.body as { competitors: Array<Record<string, unknown>> }).competitors : [];
    const gap = comps
      .filter((c) => typeof c["name"] === "string" && (c["name"] as string).length > 0)
      .map((c) => rowFor(c["name"] as string,
        typeof c["positioning"] === "string" ? (c["positioning"] as string) : undefined,
        typeof c["gap"] === "string" ? (c["gap"] as string) : undefined));
    return gap.length > 0 ? gap : fromFacts();
  } catch { return fromFacts(); }
}
```
Add the tiny `readCommunityBodies` helper next to `readSurfaces` (it already queries `raw_documents` for `communities`). Import `countMentions`.
- [ ] **Step 3 — `pnpm typecheck`.**
- [ ] **Step 4 — integration test:** extend `tests/integration/full-collect.test.ts` (or a new `tests/integration/competitor-gap.test.ts`) to seed a `competitor_gap` fact sheet with `positioning`/`gap` strings + a `communities` raw_document, run `readCompetitorGap` (export it or test via `runFullScan` report), and assert the row carries `positioning`, `gap`, and `them` reflecting the mention count. Run with `pnpm test:int`.
- [ ] **Step 5 — commit.**

---

## Milestone 2 — Tier boundaries (redaction + results page)

### Task 2.1 — Confirm redaction boundary
**Files:** `lib/billing/entitlements.ts`, `lib/billing/entitlements.test.ts`.

- [ ] **Step 1** — Confirm `redactReportForTier(report, "free")` keeps full `whatYouOffer`/`whoItsFor`/`whereTheyAre` (incl. the new `positioning`/`gap` strings) and only caps `whatToDoThisWeek` to `FREE_PREVIEW_ACTIONS=3` with `draft:null`. (Per the design, the analysis is the email-tier value; drafts/full actions are paid.) No code change expected — add an assertion test that the new `competitorGap[].positioning`/`.gap` survive free redaction.
- [ ] **Step 2** — `pnpm test lib/billing/entitlements.test.ts`. **Step 3 — commit.**

### Task 2.2 — Unlock the analysis sections at email tier
**File:** `app/(funnel)/scan/[id]/results/page.tsx`.

- [ ] **Step 1** — Pass `unlocked={true}` to `WhatYouOfferSection`, `WhoItsForSection`, and `WhereTheyAreSection` for *all* authenticated (email) viewers — the analysis is the email-tier payoff. Keep the action plan gated by `redactReportForTier` (3 actions, no drafts unless paid). (Today it passes `unlocked={isPaid}`, which wrongly dims the email tier's analysis.)
- [ ] **Step 2** — Verify the public `/report/[slug]` page still redacts to a teaser (regression: the earlier paywall-bypass fix must hold — `redactReportForTier(payload,"free")` + `unlocked={false}` there).
- [ ] **Step 3** — `pnpm typecheck`. **Step 4 — commit.**

### Task 2.3 — Render competitor positioning/gap strings
**File:** `components/report/where-they-are-section.tsx`.

- [ ] **Step 1** — When `unlocked`, render the full `competitorGap` (remove the `slice(0,2)`) and all surfaces (remove `previewSurfaceCount`). For each gap row, show `competitor` + `positioning` blurb + `gap` string; render the `them`/`you` bars (`GapScorePair`) only when `them>0 || you>0` (hide the meaningless 0/0).
- [ ] **Step 2** — Render-check via `pnpm test:render` after M3 (needs a server). **Step 3 — commit.**

---

## Milestone 3 — Free-scan "wow" (the scan page)

### Task 3.1 — Competitive-landscape card (`FactsView`)
**File:** `app/(funnel)/scan/[id]/scan-stream.tsx`.

- [ ] **Step 1** — Replace the "Competitors found" numbered list with a "Your competitive landscape" card: for each of `facts.competitors.slice(0,5)`, show the name + `competitorSourceLabel(c.source)` (Task 1.1) as the plain-English distribution insight, then "+ N more competitors mapped in your full report" when `>5`.
- [ ] **Step 2** — Render-check (M5). **Step 3 — commit.**

### Task 3.2 — Theme chips framing
**File:** `app/(funnel)/scan/[id]/scan-stream.tsx`.

- [ ] **Step 1** — Lead the theme chips with: `From {reviewVolume} reviews in your category — what buyers say they care about:` (and the cold-start variant when `facts.coldStart`). No data change. **Step 2 — commit.**

### Task 3.3 — Artifact label reframe
**Files:** `lib/scan/collect.ts`, `lib/scan/pipeline.ts`/`full-collect` (wherever `emitScanEvent(..., "artifact", {label})` is called).

- [ ] **Step 1** — Rewrite labels to intelligence-framing (e.g. `competitors found` → `Found {n} competitors — reading their positioning`; `reviews fetched` → `Pulled {n} reviews — mapping what buyers value`; `listing read` → `Read your listing`). Keep payload `count` fields. The client (`ScanStream.handle`) already renders `payload.label`.
- [ ] **Step 2** — `pnpm test` (collect/full-collect tests assert artifact labels — update assertions). **Step 3 — commit.**

### Task 3.4 — Pre-gate teaser + email-gate heading
**File:** `app/(funnel)/scan/[id]/findings-reveal.tsx`, `app/(funnel)/scan/[id]/email-gate.tsx`.

- [ ] **Step 1** — Insert a "What your report also contains" card before the `EmailGate`: `{facts.competitors.length} competitors mapped`, `communities where your buyers gather`, `a prioritized action plan across content, outreach & SEO` (use `facts.competitors.length`; copy "and more in your full report" for not-yet-computed surface counts per Q4).
- [ ] **Step 2** — Change the gate heading to "See who's ahead — and exactly what to do about it." **Step 3 — commit.**

---

## Milestone 4 — Email → Paid pitch

### Task 4.1 — Data-driven `UpgradeCta`
**File:** `components/report/upgrade-cta.tsx`.

- [ ] **Step 1** — Lead with the temporal differentiator using `report.generatedAt`: "Your report is a snapshot from {relativeTime}. Competitors don't stand still." Then the continuity bullets (weekly queue, drafts, score that moves on verified outcomes, competitor-move alerts) + "$29/mo · cancel anytime". Add a trivial `relativeDaysAgo(generatedAt)` util (pure, testable).
- [ ] **Step 2** — `pnpm typecheck`. **Step 3 — commit.**

---

## Milestone 5 — Verification (full gate)

- [ ] `pnpm typecheck` clean.
- [ ] `pnpm test` (unit) green — incl. new source-labels, competitor-mentions, updated artifact-label + entitlements tests.
- [ ] `REACHKIT_USE_FIXTURES=true pnpm eval` green (golden set unaffected; nudgi fixture already carries `positioning`/`gap`).
- [ ] `pnpm test:int` green (readCompetitorGap integration).
- [ ] `pnpm build` + `pnpm check:bundle` (with dev server stopped) — funnel/report bundles in budget.
- [ ] `pnpm test:render` (server up) — 9 routes clean, incl. `/scan/[id]/results` + `/report/[slug]`.
- [ ] **Live e2e:** real scan of `nudgi.ai` → confirm: free scan shows the competitive-landscape card; results page shows full competitor gap with `positioning`/`gap` strings + real `them`/`you`; `/report/[slug]` still redacted; upgrade pitch shows the snapshot age.

---

## Out of scope (flag for later)
- Keyword-overlap `them/you` scores (Gap 2 — adds DataForSEO cost; v1.5).
- Competitor review counts on the free card (Gap 4).
- Growth-tier differentiated competitive cadence (Q6 — v1.5).
- The ~3-min full-scan latency for the free preview (separate cost/architecture question; the funnel preview already shows ~10s/~2min).
