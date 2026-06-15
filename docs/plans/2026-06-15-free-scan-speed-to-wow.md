# Free Scan: Speed-to-Wow + Credibility + UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Make the free scan reach its "wow" (competitor intelligence + score + positioning) as fast as possible, make that wow *credible* (no "1 review", no German, no "Ask HN", no absurd score for a giant), and make the reveal/unlock UX convert. Driving principle (Tim): **the free scan's job is speed-to-wow value.**

**Source:** the live Stripe scan `d52757a0` review. Timing was ~72s wall-clock; two sequential LLM calls (action-drafting 30s + synth 19s) dominated; the wow data (facts+findings) was ready at ~40s but the reveal waited for the whole pipeline.

**Architecture:** The free scan page reveals on the `findings` event (event-driven: facts+findings carry the entire wow — competitor card, score, positioning, themes), NOT on `done`. The heavy `full-scan` (action drafting + critic) keeps running in the background for the post-email results page. The live-narrative checklist is trimmed to the collect→findings steps. Data-credibility fixes make each surfaced fact trustworthy. The score stops scoring un-measured axes as 0. The reveal UX loads at the top, attaches an unlock CTA to every locked section, and the scan animation shows the real site.

> **Git note (read first):** This builds ON the unmerged `live-scan-narrative` branch (it revises the checklist + reveal gating). There is also unrelated uncommitted marketing/billing WIP in the working tree (Tim's parallel work) — do NOT touch, commit, or merge it. Branch this work from `live-scan-narrative` (or merge that to `main` first, then branch). Confirm the working tree is clean of the foreign WIP before switching branches, or stash it.

**Tech Stack:** Next.js 16 / React 19, Inngest, Supabase, Anthropic (Haiku/Sonnet), DataForSEO + Tavily, Vitest.

---

## Milestone 1 — Speed to wow (reveal at `findings`, full-scan in background)

### Task 1.1: Reveal the free scan on `findings`, not `done`

**Files:** Modify `app/(funnel)/scan/[id]/scan-stream.tsx`

The wow (FactsView competitor card + score + positioning) is fully available from the `facts` + `findings` events (emitted by collect + findings, ~40s). `full-scan` (actions) only feeds the post-email results page, so the scan page must not wait for it.

- [ ] **Step 1:** Change the reveal gate from `done` back to findings-ready. Replace:
```tsx
if ((done || failed) && facts) {
  return <FactsView facts={facts} findingsData={findingsData} scanId={id} />;
}
```
with:
```tsx
// Speed-to-wow: reveal as soon as the findings (the wow) are ready — the heavy
// full-scan (action drafting) continues in the background for the results page.
if ((findingsData || failed) && facts) {
  return <FactsView facts={facts} findingsData={findingsData} scanId={id} />;
}
```
- [ ] **Step 2:** The `done` state added in the prior branch is now only used to stop the SSE loop (keep `setDone(true)` in the handler so the connection closes), but it no longer gates the reveal. Leave the seed/`done` plumbing; it's harmless. The `failed`-after-facts path still shows the partial FactsView.
- [ ] **Step 3:** Verify: `pnpm typecheck`; trigger a live scan and confirm the reveal appears at the `findings` event (~40s), while `scan_events` still logs `report`/`done` afterward.
- [ ] **Step 4: Commit** — `feat(scan-ui): reveal free scan at findings (speed to wow), full-scan backgrounds`

### Task 1.2: Trim the checklist to the free-scan steps + a snapshot finalizer

**Files:** Modify `components/scan/scan-narrative.ts`, `components/scan/scan-narrative.test.ts`

Steps 9–11 (draft/critique/finalize) happen in the now-backgrounded full-scan and are never watched. End the visible checklist at the wow.

- [ ] **Step 1:** Replace the `draft`/`critique`/`finalize` steps with a single closer that completes when findings land:
```ts
// (remove the draft, critique, finalize steps)
  { id: "score",     optimistic: false, confirmBy: ["Scoring your discoverability"], label: () => "Scoring your discoverability" },
  { id: "snapshot",  optimistic: false, confirmBy: ["Scoring your discoverability", "__findings__"], label: () => "Building your snapshot" },
```
(`StepId` union: drop `"draft"|"critique"|"finalize"`, add `"snapshot"`.)
- [ ] **Step 2:** Update `ScanProgress` (`components/scan/scan-progress.tsx`) — it already adds `__findings__` to `confirmed` when `finished`; since the reveal now happens at findings, the checklist unmounts at reveal. The `snapshot` step's `__findings__` confirm makes it tick to done right as the reveal fires. No structural change needed beyond the script.
- [ ] **Step 3:** Update the coverage test (`scan-narrative.test.ts`) — remove assertions for the dropped milestone labels (`Drafting…`, `Pressure-testing…`, `Finalising…`); keep the collect→findings labels. Add: with all collect+findings milestones confirmed, every step is `done`.
- [ ] **Step 4:** `pnpm vitest run components/scan && pnpm typecheck`
- [ ] **Step 5: Commit** — `feat(scan-ui): trim checklist to the free-scan steps (collect→findings)`

### Task 1.3: Results page auto-refreshes while the report is still generating

**Files:** Modify `app/(funnel)/scan/[id]/results/page.tsx`; Create `app/(funnel)/scan/[id]/results/report-pending.tsx`

Revealing earlier means a fast user can reach `/results` before `full-scan` has persisted `report_payload`. Today that shows a static "Check back in a few seconds." Make it self-refresh.

- [ ] **Step 1:** Create a tiny client component that polls then reloads:
```tsx
"use client";
import { useEffect } from "react";
export function ReportPending() {
  useEffect(() => {
    const t = setInterval(() => window.location.reload(), 4000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--hairline)", background: "var(--color-surface)" }}>
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        Finalising your action plan — this refreshes automatically…
      </p>
    </div>
  );
}
```
- [ ] **Step 2:** In `ResultsContent`, replace the static `!data?.report_payload` block with `return <ReportPending />;`.
- [ ] **Step 3:** `pnpm typecheck`. Commit — `feat(results): auto-refresh while the report finishes generating`

> **Optional follow-up (cost, not speed — note only, do not build unless asked):** split `generateActions` into a fast cards-only pass (no drafts, ~8s) generated in the scan + lazy per-action draft generation only when a PAID viewer opens a card. This removes the 30s draft block from the backend entirely and stops paying to draft for users who never convert. Larger refactor (`lib/llm/actions.ts` + an on-demand draft route + the action-card UI); deferred.

---

## Milestone 2 — Credible data (the wow must be trustworthy)

### Task 2.1: Web-review filter — match the brand token, not the full host

**Files:** Modify `lib/scan/adapters/web-reviews.ts`, `lib/scan/adapters/web-reviews.test.ts`

Root cause of "1 review for Stripe": `filterSubjectSnippets` requires the literal host `stripe.com`; real reviews say "Stripe". Match the brand token (host minus TLD/www) so "Stripe" reviews are kept while nudgi's "Nudge AI" contamination ("Nudge" ≠ "nudgi") is still dropped.

- [ ] **Step 1: Add failing tests:**
```ts
it("keeps reviews that reference the brand name, not just the full host (Stripe)", () => {
  const out = filterSubjectSnippets(
    ["Stripe Reviews 2026 — verified pros & cons.", "My experience with Stripe has been positive."],
    "stripe.com",
  );
  expect(out).toHaveLength(2);
});
it("still drops a same-named different product (nudgi.ai vs 'Nudge AI')", () => {
  const out = filterSubjectSnippets(["Nudge AI automates clinical documentation."], "nudgi.ai");
  expect(out).toEqual([]);
});
it("falls back to the full host when the brand token is too short/common", () => {
  // brand token "go" (<4 chars) → require the full host to avoid matching everything
  const out = filterSubjectSnippets(["Go is a programming language."], "go.com");
  expect(out).toEqual([]);
});
```
- [ ] **Step 2: Implement:**
```ts
export function filterSubjectSnippets(snippets: string[], subjectHost: string): string[] {
  const host = subjectHost.toLowerCase().replace(/^www\./, "");
  if (!host) return [];
  const brand = host.split(".")[0] ?? host; // "stripe.com" → "stripe"; "nudgi.ai" → "nudgi"
  // Use the distinctive brand token when it's long enough to be safe; otherwise
  // require the full host (avoids a 2–3 char token matching everything).
  const needle = brand.length >= 4 ? brand : host;
  return snippets.filter((s) => s.toLowerCase().includes(needle));
}
```
- [ ] **Step 3:** `pnpm vitest run lib/scan/adapters/web-reviews.test.ts && pnpm typecheck`. Commit — `fix(scan): web-review filter matches brand token (restores real review coverage)`

### Task 2.2: Surface a real review count when present

**Files:** Modify `lib/scan/adapters/web-reviews.ts` (+test); Modify `lib/scan/collect.ts`

"5 snippets" still under-sells Stripe. Pull an actual review *count* from the snippet text (e.g. "from 380 reviews", "12,450 reviews") when present and use it for `reviewVolume`; fall back to snippet count.

- [ ] **Step 1: Add + test a parser:**
```ts
/** Largest "<n> reviews"/"<n> ratings" figure found in the snippets, else 0. */
export function reviewCountFromSnippets(snippets: string[]): number {
  let max = 0;
  const re = /([\d][\d,]{1,})\s*(?:verified\s+)?(?:reviews|ratings)/gi;
  for (const s of snippets) {
    for (const m of s.matchAll(re)) {
      const n = Number(m[1]!.replace(/,/g, ""));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}
```
Test: `["4.2/5 from 380 reviews", "G2: 1,240 reviews"]` → `1240`; `["great tool"]` → `0`.
- [ ] **Step 2:** In `collect.ts` web reviews branch, set `reviewVolume` from `reviewCountFromSnippets(snippets) || snippets.length` and pass it through facts. (Keep the snippet bodies feeding `review_themes`; the count is a separate honest figure.) Confirm `assembleFacts` web `reviewVolume` reflects it — simplest: store the count and the mapped `ReviewItem[]` such that `data.reviews.length` is the count, OR thread an explicit `reviewVolume` override. **Implementer:** check `facts.ts:17` (`reviewVolume: isWeb ? data.reviews.length : …`); the cleanest is to pad/accept an explicit count via `extras.ratingCount` and use it for web too, or add a `reviewVolume` field to the collect return. Pick the least-invasive that makes `facts.reviewVolume` = the real count.
- [ ] **Step 3:** `pnpm typecheck && pnpm vitest run lib/scan`. Commit — `feat(scan): surface real web review counts (not just snippet count)`

> **Honesty note for the implementer:** never fabricate a count. If no count is parseable, fall back to the snippet count and the UI should read "N review sources analysed" rather than "N reviews".

### Task 2.3: Exclude forum/community artifacts from competitor extraction

**Files:** Modify `lib/llm/competitor-names.ts` (+test)

"Ask HN" came from HN threads in the alternatives content.

- [ ] **Step 1:** Add to `buildCompetitorNamesPrompt` hard rules: `- NEVER include forum/community artifacts or thread titles (e.g. "Ask HN", "Show HN", "Reddit", "r/…", "Hacker News", "Quora").`
- [ ] **Step 2:** Add a denylist post-filter in `parseCompetitorNames` (defense-in-depth — the prompt isn't sufficient alone):
```ts
const NON_PRODUCTS = new Set(["ask hn", "show hn", "hacker news", "reddit", "quora", "producthunt", "product hunt", "g2", "capterra"]);
// inside the loop, after computing `name`:
if (NON_PRODUCTS.has(name.toLowerCase())) continue;
```
- [ ] **Step 3: Tests:** `parseCompetitorNames('{"competitors":[{"name":"Ask HN"},{"name":"PayPal"}]}')` → `["PayPal"]`; prompt contains "Ask HN".
- [ ] **Step 4:** `pnpm vitest run lib/llm/competitor-names.test.ts && pnpm typecheck`. Commit — `fix(llm): drop forum/community artifacts (Ask HN) from competitors`

### Task 2.4: Force English on the fetched site

**Files:** Modify `lib/scan/adapters/site-fetch.ts`; Modify `lib/llm/prompts.ts` (positioning extract)

Stripe served German because the fetch sent no `Accept-Language`.

- [ ] **Step 1:** `site-fetch.ts:16` — add the header:
```ts
const res = await fetchWithTimeout(url, { headers: { "user-agent": "ReachKitBot/1.0 (+https://reachkit.app)", "accept-language": "en-US,en;q=0.9" } });
```
- [ ] **Step 2:** Belt-and-braces — in the positioning extract prompt (`prompts.ts`, `positioningPrompt`), append: `Always respond in English, even if the source text is in another language.` (so a site that ignores Accept-Language still yields English facts).
- [ ] **Step 3:** `pnpm typecheck && pnpm vitest run lib/llm lib/scan`. Commit — `fix(scan): request English content + force English extraction`

---

## Milestone 3 — Credible score (stop scoring un-measured axes as 0)

**Files:** Modify `lib/scan/score-full.ts` (+ `lib/scan/score-full.test.ts` if present); Modify `components/report/*` score rendering + `app/(funnel)/scan/[id]/score-block.tsx`

Root cause of Stripe's 19: `verifiedScore` scores Content/Outreach as **0** on every first scan (they only grow from the user's *verified outcomes*). For Stripe that reads as broken. Fix: a first scan has only **assessed** the SEO/discoverability axis; the others are **not yet measured**, not zero. Reflect that honestly and make the headline number credible.

- [ ] **Step 1:** Introduce an `assessed` notion. In `verifiedScore`, an axis is `assessed` when we have evidence for it this scan: SEO/ASO is assessed (we ran SERP); Content/Outreach are assessed only when their surface counts came from real measurement (i.e. `contentSurfaces`/`outreachSurfaces` > 0 from verified outcomes) — on a first scan they are **not assessed**. Extend `RadarAxis` with `assessed: boolean` and set:
```ts
const seoAssessed = true; // SERP always runs
const contentAssessed = components.contentSurfaces > 0;
const outreachAssessed = components.outreachSurfaces > 0;
```
- [ ] **Step 2:** Compute the headline `total` over **assessed active axes only**, re-normalising the weights so an all-SEO first scan isn't dragged to ~19 by unmeasured zeros:
```ts
const parts: Array<{ w: number; v: number }> = [{ w: 0.45, v: seo }];
if (contentAssessed) parts.push({ w: 0.30, v: content });
if (outreachAssessed) parts.push({ w: 0.25, v: outreach });
const wsum = parts.reduce((a, p) => a + p.w, 0);
const total = Math.round(Math.min(100, Math.max(0, parts.reduce((a, p) => a + p.w * p.v, 0) / wsum)));
```
(Stripe → total ≈ `seo` ≈ 42, not 19; a startup with real content/outreach still blends them in.)
- [ ] **Step 3:** Radar axes carry `assessed`; unassessed axes render as **"Not measured in the free scan"** (locked), NOT a 0 bar. Update `score-block.tsx` + the radar component to show locked/“not assessed” styling for `assessed === false` and use them as an upgrade hook ("Unlock full-surface measurement"). The active-but-unassessed axes (Content/Outreach on a first scan) join the existing locked axes (Ads/Partnerships/PR/Positioning) visually.
- [ ] **Step 4:** Honest framing copy near the score: e.g. "Discoverability we could verify in ~90 seconds. Content, outreach, ads, PR & partnerships aren't measured in the free scan." (so a high number isn't over-claimed and a low number isn't an insult).
- [ ] **Step 5: Tests** (`score-full.test.ts`): first scan (contentSurfaces=0, outreachSurfaces=0, seo from keywordsRanking) → `total === seo` and Content/Outreach `assessed===false`; an app with verified content/outreach outcomes → blended total + `assessed===true`. Keep the anti-vanity cap tests green.
- [ ] **Step 6:** `pnpm vitest run lib/scan && pnpm typecheck`. Commit — `fix(score): don't score un-measured axes as 0; total over assessed axes + honest framing`

> **Deeper follow-up (note only):** the SEO axis itself is a weak proxy (`keywordsRanking` from theme count). Real DataForSEO keyword-rank data would make the number genuinely credible — larger, deferred.

---

## Milestone 4 — Reveal & unlock UX

### Task 4.1: Remove the email autofocus (page loads at the top)

**Files:** Modify `app/(funnel)/scan/[id]/email-gate.tsx:145`

`autoFocus` on the email input scrolls the results/reveal to the bottom on load.

- [ ] **Step 1:** Remove the `autoFocus` attribute from the email `<input>` (line ~145). Leave the dedicated input pages (`scan-input.tsx`, `login-form.tsx`) untouched — autofocus is correct there.
- [ ] **Step 2:** Verify the reveal/results page loads scrolled to the top (manual). `pnpm typecheck`. Commit — `fix(funnel): remove email-gate autofocus so the report loads at the top`

### Task 4.2: An unlock CTA on every locked section

**Files:** Create `components/report/unlock-cta.tsx`; Modify `components/report/{what-you-offer,who-its-for,where-they-are,action-plan}-section.tsx`; reference `app/(funnel)/scan/[id]/email-gate.tsx` (the capture flow)

Each locked (blurred) section should carry its own actionable CTA: analysis sections → "Unlock with your email" (opens the email capture → unlock); the action plan → "Upgrade to unlock drafts".

- [ ] **Step 1:** Build `UnlockCta({ kind, scanId })` where `kind: "email" | "paid"`. For `"email"` it triggers the existing email-capture flow (reuse `email-gate.tsx`'s submit → claim → on success the page re-renders unlocked); for `"paid"` it links to the upgrade/checkout CTA. Render it as an overlay button centred on the blurred section.
- [ ] **Step 2:** In each section component, when `unlocked === false`, render `<UnlockCta kind={…} scanId={…} />` over the blurred content (analysis sections pass `kind="email"`; `ActionPlanSection` passes `kind="paid"`). Thread `scanId` from `results/page.tsx`.
- [ ] **Step 3:** Confirm clicking an analysis-section CTA opens the email capture and, on submit, unlocks the report (the user is then a viewer). Keep the single top-level `UpgradeCta` too, or consolidate — implementer's judgment, but every locked section must have a reachable CTA.
- [ ] **Step 4:** `pnpm typecheck && pnpm vitest run` (entitlement redaction tests must stay green — the CTA is presentation only; it must NOT leak locked content). Commit — `feat(report): per-section unlock CTA wired to email capture / upgrade`

### Task 4.3: Show the real site in the scan animation

**Files:** Modify `components/scan/scan-animation.tsx`; thread the URL through `components/scan/scan-progress.tsx` + `app/(funnel)/scan/[id]/scan-stream.tsx`

Give the user a reference to the site being scanned — favicon + domain (reliable; live `<iframe>` of arbitrary sites is usually blocked by `X-Frame-Options`).

- [ ] **Step 1:** Accept a `storeUrl?: string` prop in `ScanAnimation`; render a small header inside the card: the favicon (`https://www.google.com/s2/favicons?domain=<host>&sz=64`) + the hostname, above the skeleton. Keep the sweep animation.
- [ ] **Step 2:** Thread `storeUrl` from `scan-stream.tsx` (`storeUrl` is derivable from `facts?.listing` or passed as a prop to `ScanStream` — pass the scan's URL into `ScanProgress` → `ScanAnimation`). If the URL isn't known until `facts`, show the skeleton header until then.
- [ ] **Step 3:** `pnpm typecheck`; manual render check. Commit — `feat(scan-ui): show the scanned site (favicon + domain) in the scan animation`

> **Optional polish (note only):** a real screenshot via a thumbnail service would be richer than a favicon, but adds an external dependency + latency on the critical path — skip for the speed goal unless asked.

---

## Self-Review

- **Speed to wow:** M1 reveals the wow at ~40s (findings) instead of ~72s (done); full-scan backgrounds; checklist trimmed to the watched steps. The 30s draft block leaves the critical path (its cost-deferral is an explicit optional follow-up).
- **Credible wow:** M2 fixes review coverage (brand-token), real counts, drops "Ask HN", forces English. M3 makes the score honest+credible for both giants and startups (assessed-only total; unmeasured ≠ 0).
- **Convert:** M4 loads at top, puts an unlock CTA on every locked section, and shows the real site during the scan.
- **No regressions:** entitlement redaction stays the gate of truth (Task 4.2 is presentation-only); brand-ambiguity preserved (Task 2.1 keeps the nudgi/Nudge-AI guard; 2.3 strengthens competitor honesty); the live-narrative honesty contract (LLM steps confirmed by real events) is intact — the trimmed steps are all real collect/findings milestones.
- **Order to build:** M1 (speed) → M2 (credible data) → M3 (credible score) → M4 (UX). M1 + M2 are the highest-impact for the wow.
