# Grounding Honesty + Feature-Flag Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop ReachKit inventing evidence it never gathered, and remove `REACHKIT_USE_FIXTURES` from production entirely so the shipped app has exactly one path and zero feature flags.

**Architecture:** These are one problem, not two. Fixtures return uniformly clean canned data (`FIXTURE_REVIEW_THEMES` always has 4 themes; no fixture function takes a scenario argument), so the degenerate path — *zero reviews* — is structurally untestable. That is why `runSynth` invents reviews for an unlaunched product and no test caught it. Converting the flag from a runtime `if` into an injected test seam makes "zero reviews" a case you can *inject*, which is what makes the grounding guard possible. Phase 0 fixes the bug and unblocks the launch video; Phase 1 removes the production blast radius cheaply; Phases 2–3 build the seam and delete the flag; Phase 4 collects the payoff.

**Tech Stack:** TypeScript, Next.js 16 App Router, Vitest, Zod (`lib/config/env.ts`), dependency-cruiser (`pnpm check:arch`).

---

## Ruling — 2026-07-17 (Tim)

Recorded per the **Feedback Protocol** (`CLAUDE.md`), which requires that a contradiction be surfaced and ruled on rather than silently resolved, and that the ruling then go through the Change Protocol.

**The contradiction.** `CLAUDE.md` states *"`REACHKIT_USE_FIXTURES` is the only product feature flag"* and, as a hard rule, *"Always live-test with `REACHKIT_USE_FIXTURES=false` before trusting a change."* Tim's instruction (2026-07-17): *"I don't really want any feature flags in this application… all feature flags effectively should be removed and deleted. The productive application is a productive application."*

**The ruling: it is a test seam, not a feature flag — and production gets zero flags.** Tim's instruction wins on the point that matters: no flag may change production behavior, and the shipped app has one path. It does not win as a literal deletion, because deleting the flag outright would delete the CI eval job's ability to run without spending real DataForSEO/Anthropic money per PR. Resolution: convert the runtime branch into an injected seam (Phases 2–3). Production stops reading the flag; tests inject fakes at a real boundary; `check:arch` forbids production → `tests/fakes` so it cannot regress.

**Change Protocol consequences (Phase 3 owns these, same commit as the code):**
- `CLAUDE.md` — delete *"the only product feature flag"*; rewrite the *"always live-test with `REACHKIT_USE_FIXTURES=false`"* hard rule into its successor (*"prod ships one path; live-test against real adapters"*).
- `docs/architecture.md` — record the ports/composition-root boundary.
- New `check:arch` rule is the guard. Without it this ruling is a promise, not a ratchet.

**Why the ruling is right on the evidence, not just the preference.** `fixturesEnabled()` is `return env.useFixtures` with **no** `NODE_ENV` check anywhere. One mistyped Vercel env var yields, in production: free upgrades to any tier (`lib/billing/checkout.ts:89` writes `tier: plan, subscription_status: "active"` straight to the users row), rate limiting off (`lib/scan/abuse.ts:134`), Stripe cancellation skipped on account delete (`lib/account/delete.ts:72`), magic links printed to logs (`lib/email/resend.ts:25`). `docs/deploy/2026-06-13-go-live-runbook.md:78` calls this *"the single most important prod env check"* — and nothing enforces it. Not `check:live`, not `/api/health`, not the parse.

## Global Constraints

Copied verbatim from `CLAUDE.md`; every task below inherits these.

- **Change Protocol** — to change an invariant on purpose, update in the SAME commit: (1) the source constant/rule, (2) its guard/parity check, (3) `CLAUDE.md`, (4) `docs/architecture.md` if structural. New invariant → it gets a guard *before* merge and the harness table is updated.
- **"A guard you have not SEEN FAIL is not a guard."** Every new guard must be mutation-proved: break the production code it guards, watch it fail *with real output*, revert, confirm green. **Verify the mutation actually applied (`git diff --stat` non-empty) before trusting the result.** A `replace()` with zero matches printing success is how a vacuous test was certified sound.
- **Source tripwires go through `expectCallsSymbol`** (`lib/testing/tripwire.ts`). Never hand-roll `readFileSync` + `toMatch`. The helper throws if asked to assert a symbol against a file that *defines* it.
- **Fix the CLASS, never the case.** Name the class before fixing: "what else fails this same way?"
- **Degrade, never invent.** When a call flakes, degrade (footprint/zero-state); never fabricate.
- **Env access only via `lib/config/env.ts`** (ESLint `no-restricted-syntax`). Only `NODE_ENV`, `NEXT_PUBLIC_*`, `VERCEL_*` may be read as literals. `lib/config/**`, `**/*.test.*`, `tests/**`, `scripts/**` are exempt.
- **Never run `pnpm build` while `next dev` is running.**
- **Baselines only ever shrink:** `KNOWN_CYCLES`, `coverage-baseline.json`, `label-drift-baseline.json`, `KNOWN_OVERAGES_KB`.

---

## Open Decisions (Phase 2+ blocked on these; Phase 0/1 are not)

The flag ruling above is made. These remain, because Tim's instruction was *"all feature flags"* and three things wear the costume without being one. Each needs an explicit yes/no before Phase 3.

| # | Question | Recommendation |
|---|---|---|
| D1 | `SCANNING_ENABLED` — delete as "a feature flag"? | **Keep.** An ops kill switch, not a product flag (`CLAUDE.md:59` says so explicitly). 5 fail-open entrypoint gates (`app/api/scan/route.ts:23`, `app/api/app/[id]/refresh/route.ts:65`, `lib/app/add-product.ts:71`, `lib/inngest/functions/score-pulse.ts:75`, `weekly-refresh.ts:204`). Deleting it means no way to stop runaway scan spend without a redeploy. |
| D2 | `REACHKIT_OWNER_EMAILS` — delete? | **Keep.** An authz gate, not a flag. Single read point `lib/auth/owner.ts:12-24`; gates `/app/diagnostics` (all-time + monthly per-user spend) and a dashboard element. Deleting it exposes that to every signed-in user — a security regression wearing a flag costume. |
| D3 | `PROFILE_DEBUG` | **Delete.** One consumer (`lib/scan/profile/discover.ts:40`, a `console.log`). Genuinely a flag. Free win. |
| D4 | `costAlertWebhookUrl` | **Keep.** A delivery channel, not a switch. Blank → no webhook. |
| D5 | Phase 2 order | **Billing/safety cluster first** (Task 2a). 6 sites, ~all the real risk. |

---

## File Structure

**Phase 0 — grounding honesty**
- Modify: `lib/scan/adapters/web-reviews.ts:15-24` — stop laundering Tavily's `answer` into review snippets
- Modify: `lib/llm/synth.ts` — empty-sheet short-circuit for `positioningMirror`
- Modify: `lib/llm/extract.ts:171-191` — stop caching `EMPTY_REVIEW_THEMES` (invariant #3)
- Modify: `components/report/captured/to-results-props.ts:88-89,174-176` — omit the mirror when ungrounded
- Modify: `components/report/captured/results-screen.tsx:473-489` — conditional render
- Create: `lib/scan/grounding.test.ts` — the new invariant's guard
- Modify: `lib/scan/documented-invariants.test.ts` — pin invariant #11
- Modify: `CLAUDE.md` — invariant #11 + harness table row
- Modify: `docs/architecture.md` — the synth-stage grounding contract

**Phase 1 — production blast radius**
- Modify: `lib/config/env.ts:104-117` — fixtures mode cannot parse in production
- Modify: `lib/config/env.test.ts` — guard

**Phase 2 — the seam** (~43 files)
- Create: `lib/ports/index.ts` — port interfaces
- Create: `lib/ports/live.ts` — the single production composition root
- Create: `tests/fakes/` — relocated from `lib/dev/fixtures.ts`
- Create: `lib/llm/cold-start-seed.ts` — relocate `coldStartActionsFrom` + `ColdStartSeed` (currently `lib/dev/fixtures.ts:568,585`, imported by the **live** path at `lib/llm/cold-start-actions.ts:21`)

**Phase 3 — deletion**
- Modify: `lib/config/env.ts` — remove `REACHKIT_USE_FIXTURES`, re-key `superRefine` on `NODE_ENV`
- Delete: `lib/dev/fixtures.ts`
- Modify: `.github/workflows/ci.yml:89-104` — drop the `ci-dummy-never-used` block
- Modify: `.dependency-cruiser.cjs` — production ✗→ `tests/fakes`
- Modify: `CLAUDE.md`, `docs/deploy/2026-06-13-go-live-runbook.md:78`, `.env.example:21`

---

## Phase 0 — Stop the fabrication (unblocks the video)

Independent of the flag work. Ship this alone if Phase 2 slips.

**The bug, for a fresh reader.** A live prod free scan of `reachkit.app` (`scan 6d49d58e`, 2026-07-16) — an **unlaunched product with zero users and zero reviews anywhere** — produced `positioningMirror.reviewsValue: "Users consistently praise ReachKit for being user-friendly, easy and fun to use, and for delivering strong customer support… though some friction exists around the subscription model pricing"` and `actualAudience: ["ease-seeking small founders", "support-sensitive early adopters", …]`. The audience tags **render on the free report** under the label **"Your page reads as"** (`results-screen.tsx:487`). None of it exists.

**The chain:** `fetchWebReviews` calls Tavily with `include_answer: true` (`web-reviews.ts:70`) → `parseWebReviewSnippets` pushes `b.answer` — Tavily's **LLM-synthesized prose**, not a review — as snippet #1 (`:18`) → `filterSubjectSnippets` passes it because it contains "reachkit" (`:33-44`) → `collect.ts:77` labels it `"Web review"` → feeds `extractThemes` (hence `whoItsFor.signals: ["reachkit","web","review"]` — token frequencies rendered as buyer values) and the `review_themes` sheet → `buildSynthPrompt` demands a non-optional `reviewsValue` (`prompts.ts:308`) → Sonnet writes plausible prose → no empty-guard, no grounding validation → `buildWhoSummary` (`report.ts:203-215`) prefixes **"Reviews confirm:"**, an assertion of evidentiary weight the code never verifies.

**Why it matters beyond correctness:** the landing hero says *"Every claim grounded in your live page"* and the comparison table's middle column attacks a chatbot prompt with the single word *"Hallucinates."*

**The class:** *any* synth field specified as unconditionally required while its input sheet may be empty. `reviewsValue` is the instance we caught. Task 0.5 sweeps the siblings — do not stop at reviews.

### Task 0.1: Tavily's `answer` is not a review

**Files:**
- Modify: `lib/scan/adapters/web-reviews.ts:15-24,64-80`
- Test: `lib/scan/adapters/web-reviews.test.ts`

**Interfaces:**
- Produces: `parseWebReviewSnippets(body: unknown): string[]` — unchanged signature, no longer includes `body.answer`.

- [ ] **Step 1: Write the failing test**

```ts
it("never treats Tavily's synthesized answer as a review snippet", () => {
  const out = parseWebReviewSnippets({
    answer: "Users consistently praise ReachKit for being user-friendly.",
    results: [{ content: "Real snippet from a real page about reachkit." }],
  });
  expect(out).not.toContain("Users consistently praise ReachKit for being user-friendly.");
  expect(out).toEqual(["Real snippet from a real page about reachkit."]);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm vitest run lib/scan/adapters/web-reviews.test.ts -t "synthesized answer"`
Expected: FAIL — the received array contains the answer string (current `:18` pushes it first).

- [ ] **Step 3: Implement**

Delete the `answer` ingestion at `:18`, and drop `include_answer: true` from the request at `:70` — we stop paying Tavily to generate prose we now discard.

```ts
const b = (body ?? {}) as { results?: Array<{ content?: string }> };
const out: string[] = [];
for (const r of b.results ?? []) {
  if (r.content) out.push(r.content);
}
return out;
```

- [ ] **Step 4: Run, verify pass.** `pnpm vitest run lib/scan/adapters/web-reviews.test.ts`
- [ ] **Step 5: Commit.** `git commit -m "fix(reviews): Tavily's generated answer is not a review snippet"`

### Task 0.2: Empty review sheet → empty mirror (never invented)

**Files:**
- Modify: `lib/llm/synth.ts` (near `:188-230`), `lib/llm/prompts.ts:308`
- Test: `lib/llm/synth.test.ts`

**Interfaces:**
- Consumes: `DEGRADED_MIRROR` (`lib/llm/synth.ts:33-37`) — already sets `reviewsValue: ""`. Reuse it; do not define a second shape.
- Produces: `runSynth(ctx)` returns `positioningMirror.reviewsValue === ""` and `actualAudience === []` whenever the `review_themes` sheet has zero themes.

- [ ] **Step 1: Write the failing test**

```ts
it("returns an empty mirror when the review sheet has zero themes — never invents", async () => {
  const out = await runSynth(ctxWithSheets({ review_themes: { themes: [] } }));
  expect(out.positioningMirror.reviewsValue).toBe("");
  expect(out.positioningMirror.actualAudience).toEqual([]);
});
```

- [ ] **Step 2: Run it, verify it fails.** Expected: FAIL — `reviewsValue` is a fabricated sentence.

- [ ] **Step 3: Implement.** In `runSynth`, after the fact-sheet reads (`:197-203`), before building the prompt: if `reviewThemesBody.themes.length === 0`, force `reviewsValue: ""` and `actualAudience: []` on the parsed result. This mirrors the guard the extract layer **already has** at `lib/llm/prompts.ts:62` (*"If there are no reviews, return `{ themes: [] }`"*). The asymmetry between the two layers *is* the bug's shape.

Also fix the schema instruction at `prompts.ts:308`, which actively pulls the other way by demanding a filled sentence:

```
"reviewsValue": "<1–2 sentences on what users praise or complain about — EMPTY STRING if the review sheet is empty. Never infer reviews from the listing.>",
```

The prompt change is defence-in-depth; **the code short-circuit is the guarantee.** Note `parseSynthResult` (`:130-165`) validates types only — `isValidPositioningMirror` (`:100-108`) just checks `typeof reviewsValue === "string"`, so a fabricated paragraph passes today. `strArray` (`:122-128`) sanitizes `actualAudience` by length only (2–60 chars), no grounding check.

- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.** `git commit -m "fix(synth): empty review sheet yields an empty mirror, never invented prose"`

### Task 0.3: Stop caching the empty review sheet (invariant #3)

**Files:**
- Modify: `lib/llm/extract.ts:171-191`
- Test: `lib/llm/extract.test.ts`

`extract.ts:191` upserts `EMPTY_REVIEW_THEMES` into `fact_sheets` when `docs.length === 0`. `CLAUDE.md` invariant #3: *"Never cache an LLM-failure `[]`; refuse stale blank rows on read-back."* Enforced for demand intel (`isEmptyDemandIntel`, `buyerInsightsEmpty` — `lib/scan/demand/gather.ts:139,153`) and **nowhere else**. Same class.

- [ ] **Step 1: Write the failing test** — `extract` with `docs: []` performs zero `fact_sheets` upserts.
- [ ] **Step 2: Run, verify it fails.**
- [ ] **Step 3: Implement** — early-return before the upsert at `:191` when `docs.length === 0`. Confirm `synth.ts:199`'s read-back fallback (`{ themes: [] }`) still holds when the row is absent — it does; that path already exists.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Commit.** `git commit -m "fix(extract): don't cache an empty review sheet (invariant #3)"`

### Task 0.4: An ungrounded mirror does not render

**Files:**
- Modify: `components/report/captured/to-results-props.ts:88-89,174-176`
- Modify: `components/report/captured/results-screen.tsx:473-489`
- Test: `components/report/captured/to-results-props.test.ts`

This is the part that was on screen. `results-screen.tsx:487` prints `actualTags.join(", ")` under **"Your page reads as"**, with `p.mirrorGap` in a red-bordered callout at `:479`.

- [ ] **Step 1: Write the failing test** — `toResultsProps` with `positioningMirror.actualAudience: []` returns `mirror: null`.
- [ ] **Step 2: Run, verify it fails.**
- [ ] **Step 3: Implement** — gate the section on grounded content; when absent, omit it entirely. **Do not invent a zero-state that asserts something** — "no reviews found" is a claim about the internet, not about our data. Omission is the honest degrade.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5: Check the label-drift gate.** `pnpm check:design`. A removed label may move `.design-sync/label-drift-baseline.json` — it only ever shrinks; re-pin with `node scripts/check-design-parity.mjs --pin-drift` if it drops. Do **not** `bless:design` to silence anything.
- [ ] **Step 6: Commit.**

**Note for the implementer:** `reviewsValue` and `whoItsFor.summary` are **not** currently rendered — `components/report/what-you-offer-section.tsx:86` and `who-its-for-section.tsx:61` render them but are dead (no importers outside their own files/tests). They are still **persisted and served**: `lib/billing/entitlements.ts:141` `redactReportForTier` leaves `whatYouOffer`/`whoItsFor` untouched for free tier, so the fabricated string ships over the API on any public scan response and is one re-import from being on screen. Tasks 0.1–0.3 stop it at the source, which is why they matter more than 0.4.

### Task 0.5: Invariant #11 + the guard, and sweep the class

**Files:**
- Create: `lib/scan/grounding.test.ts`
- Modify: `lib/scan/documented-invariants.test.ts`, `CLAUDE.md`, `docs/architecture.md`

- [ ] **Step 1: Sweep the siblings FIRST.** Read every field spec in `buildSynthPrompt` (`lib/llm/prompts.ts:279-340`). For each: *can its input sheet be empty while the schema demands a filled string?* Known candidates beyond `reviewsValue`: **`competitorGap`** (the reachkit.app payload's own `gap` text admits *"the competitor gap sheet contains no named rivals"* and then writes a paragraph anyway — near-certainly the same bug), `listingSays`, `whoItsFor.signals`. **List every one checked, and the verdict, in the commit body.** Fix each the same way or record why it is safe.
- [ ] **Step 2: Write the invariant guard** in `lib/scan/grounding.test.ts` — for each identified field: empty sheet in → empty/absent field out. **Behavioral, not source-matching.** If any part needs a source tripwire, it goes through `expectCallsSymbol`.
- [ ] **Step 3: MUTATION-PROVE THE GUARD.** Revert the `synth.ts` short-circuit from Task 0.2. Run `git diff --stat` and **confirm it is non-empty** — a no-op mutation that "passes" proves nothing, and that is exactly how a vacuous test got certified sound in this repo before. Run `pnpm test`. Watch `grounding.test.ts` FAIL with real output. **Paste that output into the PR body.** Restore. Confirm green.
- [ ] **Step 4: Add invariant #11 to `CLAUDE.md`:**

> 11. **Grounding honesty — degrade, never invent.** No synthesized field may assert evidence we did not gather. When an input fact sheet is empty, the dependent field is empty/absent and its UI section does not render — never a plausible synthesis. Enforced at three layers: the adapter never launders generated prose into evidence (`web-reviews.ts` drops Tavily's `answer`), the synth layer short-circuits on an empty sheet (mirroring the extract-layer guard at `prompts.ts:62`), and the renderer omits an ungrounded section. Guard: `lib/scan/grounding.test.ts`. **History:** shipped violation (scan `6d49d58e`, 2026-07-16) — a free scan of the unlaunched reachkit.app produced invented user reviews ("Users consistently praise ReachKit…") and an `actualAudience` rendered under "Your page reads as", on a product whose hero reads "Every claim grounded in your live page" and whose comparison table attacks chatbots for "Hallucinates". Root cause: Tavily `answer` ingested as review #1 (`web-reviews.ts:18`) + no empty-sheet guard at synth. Invisible to tests because `FIXTURE_REVIEW_THEMES` always has 4 themes and no fixture takes a scenario argument — see Phase 4.

- [ ] **Step 5: Add the harness-table row** in `CLAUDE.md` and the `documented-invariants.test.ts` pin.
- [ ] **Step 6: Commit** — rule + guard + docs in ONE commit, per the Change Protocol.

### Task 0.6: Live-verify, then record

- [ ] Rescan `reachkit.app` against **real adapters**. **Do not trust the DB payload** — `CLAUDE.md` is explicit: *"The free report is the conversion surface — verify it by RENDERING the live page, not the DB payload."* Headless-render it (`chrome --headless --dump-dom --virtual-time-budget`) and read the actual text.
- [ ] Confirm: no `"Reviews confirm:"` string in `report_payload`; no Positioning Mirror section on the page; **score still 9** (on-page 89 × search presence 0 → floored to 1 → `sqrt(89 × 1) ≈ 9`). The 9 is the launch-video story and nothing in this phase touches it.
- [ ] **Known cosmetics that survive Phase 0 and will be on camera** — decide before rolling:
  - Category resolves to **"seo tool"** (110k/mo), alongside "website seo checker" / "keyword research tool" — contradicts the anti-SEO-suite positioning the landing page sells ("For founders who'd rather ship than study SEO"; "An SEO suite" is a rival column).
  - **Outreach pillar reads 0 / `assessed: false`** — structurally unreachable, already documented in `CLAUDE.md` as a shipped anti-pattern instance.
  - Plan has **2 evidence-free floor cards** (`evidence: []`, `basis: probability_based`, `confidence: 0.5`) under the footnote *"every claim links to extracted evidence"*, while `MIN_ACTIONS = 5` (`lib/scan/action-linking.ts:30`) and `/pricing` promises *"Top 3 ranked fixes"*.
  - **Open question, not a finding:** whether the free path is meant to floor at 5. Not root-caused. Worth resolving regardless — it is a promise/delivery mismatch on a page that will be on screen.

---

## Phase 1 — Fixtures mode cannot exist in production (cheap; do regardless)

### Task 1.1: Hard-fail the parse

**Files:** Modify `lib/config/env.ts:104-117`; Test `lib/config/env.test.ts`

- [ ] **Step 1: Write the failing test** — `parseEnv({ ...valid, REACHKIT_USE_FIXTURES: "true", NODE_ENV: "production" })` throws with a message naming the flag.
- [ ] **Step 2: Run, verify it fails.**
- [ ] **Step 3: Implement** — add a clause to the existing `superRefine`. `lib/config/**` is exempt from the env lint rule, and `NODE_ENV` is a permitted literal regardless.
- [ ] **Step 4: MUTATION-PROVE IT.** Delete the new clause, `git diff --stat` non-empty, watch the test fail with real output, restore, confirm green.
- [ ] **Step 5: Commit.**

**Known limitation — record it in the PR body; do not paper over it.** `env` is a lazy memoizing Proxy (`lib/config/env.ts:154-157`), so this throws on *first property access*, not at boot. `middleware.ts` was deliberately made fail-open on an env throw (PR #50, after middleware 500s took down `/app`), so middleware swallows it; `/api/scan` and `/api/billing/checkout` will 500. That is the right trade for a stopgap — a 500 beats silently giving away Solo — but **Phase 1 is a stopgap, not the fix.** Phase 2 is the fix: production stops reading the flag at all.

---

## Phase 2 — Convert the flag to an injected seam

**The false premise to avoid:** *"fixtures = adapter seam, so just delete around it."* It is not one today. ~61 branch sites across 43 production files, roughly half in business logic. And **seven adapters have no fixtures path at all and hit the live network even with the flag on** — `site-fetch.ts` (HTML fetch), `app-store-rss.ts` (reviews), `itunes.ts`, `hn-algolia.ts`, `domain-age.ts`, `youtube.ts`, `thread-activity.ts`. `lib/scan/tools/get-reviews.ts:23` is unconditional — in "fixtures mode" reviews come from the live iTunes RSS feed. `lib/scan/profile/community.ts:7` *claims* "the gather is fixtures-aware"; it is not (`:64` is an error swallow, not a fixture gate). **The seam must be built, not deleted around.**

### Task 2a: The billing/safety cluster first (6 sites, ~all the risk)

`lib/billing/checkout.ts:38-47,89-100` · `lib/billing/portal.ts:37-39` · `lib/billing/stripe.ts:7` · `lib/scan/abuse.ts:134` · `lib/account/delete.ts:72` · `lib/email/resend.ts:25-28`

Pattern (establish once here, repeat per site): the module takes its dependency as a parameter with a live default; production never passes one; tests pass a fake. Delete the `fixturesEnabled()` call from each. Per site: write the test injecting the fake → verify it fails → implement → verify pass → **mutation-prove** → commit.

**Do not skip `createCheckout` (`checkout.ts:89`).** It writes `tier: plan, subscription_status: "active"` directly to the users row and returns `/app?billing=demo`. Single highest-value line in this plan.

### Task 2b: The LLM boundary
`lib/llm/anthropic.ts:33` (`callModel`) and `lib/llm/embed.ts:14` (`callEmbed`). Two sites, enormous leverage — most downstream fixture branches exist only because these two could not be faked.

### Task 2c: The data adapters (mechanical — already clean short-circuits)
`dataforseo.ts:49` · `tavily.ts:25,75,109` · `product-hunt.ts:16` · `keywords.ts:19` · `dataforseo-rank.ts:24` · `dataforseo-traffic.ts:31` · `dataforseo-keyword-ideas.ts:51` · `dataforseo-ranked-keywords.ts:107,122` · `dataforseo-backlinks.ts:39,126` · `web-reviews.ts:65`

### Task 2d: The business-logic branches (the ugly ones)
`synth.ts:190` · `actions.ts:258` · `cold-start-actions.ts:128` · `extract.ts:135,145` · `critic.ts:153` · `check-link.ts:77` · `verify-action.ts:31` · `search-keywords.ts:22` · `algorithm-safety.ts:159,222,240,282,310` · `refresh.ts:262,415,495` · `delta-collect.ts:114,148,183,217` · `content/gather.ts:143,252` · `profile/*` · `demand/*`

Each is "skip the real logic," not "fake a dependency" — so each becomes: inject the dependency, delete the branch, let the real logic run against a fake. **Give these three their own scrutiny:** `critic.ts:153` skips critic rules 2, 5b, 8 entirely; `check-link.ts:77` makes entailment always pass; `verify-action.ts:31` makes verification always succeed. Those three make the **verified action engine** — the thing the landing page sells as *"It checks your work"* — unconditionally return true under fixtures. **Any test asserting verification "works" in fixtures mode is vacuous today.** Audit them when the seam lands. Also note `algorithm-safety.ts:222,240,282` invert DB write ordering between fixtures and live, and `search-keywords.ts:22` makes cost accounting differ (`fixturesEnabled() ? 0 : 1`).

### Task 2e: Make fixtures hermetic for the first time
Add ports for the seven ungated adapters above. `lib/scan/adapters/fixtures-gating.test.ts` covers **3 of ~14** adapters (`dataforseo`, `tavily`, `product-hunt`). Extend it to assert every port has a fake and no test path reaches the network.

---

## Phase 3 — Delete the flag

- [ ] **Relocate `coldStartActionsFrom` + `ColdStartSeed`** out of `lib/dev/fixtures.ts:568,585` into `lib/llm/cold-start-seed.ts`. **The live path imports them** (`lib/llm/cold-start-actions.ts:21`; the comment at `:566-567` says they are shared "so the two never drift"). Deleting `lib/dev/fixtures.ts` without this **breaks the live cold-start path.** Do this first.
- [ ] Move `lib/dev/fixtures.ts` → `tests/fakes/`.
- [ ] **Add the `check:arch` rule: production ✗→ `tests/fakes`.** This is what makes "no flags in prod" machine-checked rather than a promise. Without it the ruling is undone by the first `import` someone adds.
- [ ] Remove `REACHKIT_USE_FIXTURES` from `lib/config/env.ts:103,137`.
- [ ] **Re-key the `superRefine` (`:104-117`) on `NODE_ENV === "production"` instead of `!useFixtures`.** The honest condition: prod needs real keys, CI does not. This lets `.github/workflows/ci.yml:98-103` drop the entire `ci-dummy-never-used` loop — a simplification, not a workaround.
- [ ] Migrate the ~25 test sites off the flag. **Three mechanisms are in use and all must go:** `vi.stubEnv` (~25 sites), a raw assignment (`tests/integration/referral-discovery.test.ts:13`), and `vi.doMock("@/lib/config/env")` (`lib/llm/actions.test.ts:706,732`, `critic.test.ts:849,889`, `embed.test.ts:103,137`).
- [ ] Rework `tests/integration/payment-first-funnel.test.ts:34` — gates on `!env.useFixtures && stripeSecretKey.startsWith("sk_")`.
- [ ] `tests/integration/degraded-paths.test.ts` needs **no change** — it deliberately runs fixtures-OFF (`:49`) and is mock-driven, so its coverage survives intact. **Confirm this rather than assuming it.**
- [ ] Delete `PROFILE_DEBUG` (pending D3) — `lib/config/env.ts:101`, `lib/scan/profile/discover.ts:40`.
- [ ] **Docs, same commit (Change Protocol):** `CLAUDE.md` — delete *"`REACHKIT_USE_FIXTURES` is the only product feature flag"*; rewrite the *"Always live-test with `REACHKIT_USE_FIXTURES=false`"* hard rule into its successor. `docs/architecture.md` — the ports/composition-root boundary. `docs/deploy/2026-06-13-go-live-runbook.md:78` calls this *"the single most important prod env check"* — it becomes structurally moot; say so rather than deleting silently. `.env.example:21`, `.env.local:20`, `.env.prodcheck:20`.

---

## Phase 4 — The payoff: fixtures gain the degenerate cases

This is why the refactor was worth doing. No adapter fixture takes a scenario argument today — every function returns one fixed shape, and the comment at `lib/dev/fixtures.ts:254-258` is explicit that deltas are *"**NON-EMPTY** canned deltas… so the refresh pipeline has something to process."* The empty path is never exercised. That is the mask that hid invariant #11's violation.

- [ ] Add scenario fakes: `zeroReviews`, `zeroRankedKeywords`, `fetchFailure` (the **linear.app SPA-fetch** case `CLAUDE.md` records as invisible to the fixture suite), `emptyDeltas`.
- [ ] Wire `zeroReviews` into the golden-set eval so invariant #11 gains an integration-level guard, not only a unit one. Note the eval already holds the repo's only genuinely degenerate fixture — `lib/eval/fixtures/nudgi.json` (`reviewVolume: 0`, `themes: []`, `scoreBand: [0,25]`) — but it feeds **pre-baked facts straight to `assembleReport`, bypassing the adapters entirely** (`lib/eval/golden-set.ts:94-131`). That is exactly why it never caught this.
- [ ] Lower `.design-sync/coverage-baseline.json` / `KNOWN_CYCLES` if the refactor improves them. Never raise.

---

## Self-Review

**Spec coverage.** (1) three fabrication fixes → Tasks 0.1–0.4, each guarded, plus 0.5 sweeping the class beyond reviews. (2) guards per Change Protocol → Task 0.5 ships rule + guard + docs in one commit and mutation-proves the guard. (3) remove feature flags → Phases 1–3, under the 2026-07-17 ruling above. (4) plan-only → nothing executed.

**Known gaps, stated rather than hidden.** Phase 2 is decomposed to file:line and shows the conversion pattern once, but does not write all ~43 files' code — that would be fabricated precision, since each site's fake depends on the seam's final shape. **Re-plan Phase 2b–2e once Task 2a fixes that shape.** Phase 0 and Phase 1 are fully executable as written. D1–D5 remain open.

**Type consistency.** `parseWebReviewSnippets` (0.1), `runSynth` / `DEGRADED_MIRROR` (0.2 — reusing the existing shape, not defining a second), `toResultsProps` (0.4) all match current signatures.
