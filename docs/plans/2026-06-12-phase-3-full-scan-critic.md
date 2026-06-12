# ReachKit Phase 3 (Cycle 3) — Full Scan + Critic Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

> **⛔ UI DEFERRED (owner directive):** Cycle 3 builds the **engine, data, and API only**. Do NOT build or modify any UI (no competitor-confirm UI, no report rendering, no funnel changes, no app shell). The spec-specified UI/UX (§20–23) is a dedicated later phase. Everything customer-facing this cycle is a typed **payload/JSON** the future UI will consume — never a component.

**Goal:** Turn the Cycle-2 preliminary findings into the **full scan**: the complete Stage 0–4 pipeline (over-generate → critic-filter), action cards with drafts across the 3 MVP modules (Content/Outreach/SEO-ASO), the Critic Gate v2 enforcing evidence + quality + algorithm-safety, a verified Discoverability Score, the four-question report payload, the pgvector semantic layer, and a golden-set eval harness that scores pipeline quality pre-deploy (the R1 mitigation). All fixture-aware (keyless dev mode preserved).

**Architecture:** The pipeline gains the full data tools (`find_communities`, `find_creators`, `search_keywords` wired into a *full collect*), Stage 4 FORMAT (Haiku → action cards in the founder's voice), Stage 3 CRITIC (Sonnet → the 10-rule Critic Gate v2 with a reject/revise loop, `check_link` entailment, and the §11 algorithm-safety scan), bounded agentic loops (§9.5) with budgets/stop-rules, the pgvector semantic layer (embeddings for reviews/findings/drafts via a fixture-aware embed provider), and the four-question report assembled as a JSON payload. The golden-set harness scores output against the 5 reference analyses before deploy.

**Tech (new):** `find_communities` (HN Algolia / Bluesky / SERP) · `find_creators` (YouTube Data API / SERP) · embedding provider (Voyage `voyage-3`, 1024-dim — fixture-aware) · the eval harness.

**Spec refs:** §6 (modules 1/2/5), §7 (Score, anti-vanity), §9.1–9.5 (pipeline, Critic Gate v2 verbatim, tool registry, bounded loops), §9.3 (quality-bar risk + golden-set), §10 (schemas), §11 (algorithm safety), §5.6 (four questions), §5.7 (pgvector, shared cache TTL). Decomposition §3.3.

**Acceptance gate (Cycle 3):** a full scan produces a four-question report payload with a verified Score and a top-10 action plan (Content/Outreach/SEO) where **every action passes Critic Gate v2**; golden-set mean quality ≥ threshold (harness runs + reports); cost/scan logged (Stage 3+4 LLM cost in `pipeline_runs`); the whole thing runs keyless in fixtures mode. (Live runs need Anthropic + the vendor keys; the UI to render the report is a later phase.)

---

## Cycle 0–2 Learnings — apply throughout
Inngest v4 (`eventType`/`staticSchema`/`onFailure`); Next 16 (n/a — no UI this cycle); migrations via `supabase migration new` + `db reset` + regen types (strip CLI noise); `pnpm add` works at root; integration tests local-only (`.env.local` value for every key, but paid keys may be blank under `REACHKIT_USE_FIXTURES=true` per the superRefine); `noUncheckedIndexedAccess`, no `!`; **fixtures-aware**: every paid/keyed call (LLM via `callModel`, embeddings, DataForSEO/Tavily/PH/YouTube) checks `fixturesEnabled()` and short-circuits to canned data; `callModel` logs `pipeline_runs`; Sonnet reads fact sheets only (§13); the lint rule forbids `use*` non-hook names.

---

## File Structure (created/modified — NO `app/` or `components/` UI files)

```
lib/scan/adapters/
  hn-algolia.ts  bluesky.ts  youtube.ts     # CREATE community/creator sources (fixture-aware)
lib/scan/tools/
  find-communities.ts  find-creators.ts     # CREATE D-tools; register in tools/index.ts
lib/scan/full-collect.ts                     # CREATE the full collect (keywords + communities + creators) feeding actions
lib/llm/
  embed.ts                                   # CREATE embedding provider (Voyage, fixture-aware) + callEmbed
  actions.ts                                 # CREATE Stage 4 — action-card generation (Haiku, founder_voice)
  critic.ts                                  # CREATE Stage 3 — Critic Gate v2 (10 rules, reject/revise loop)
  check-link.ts                              # CREATE check_link L-tool (fetch + Haiku entailment)
  prompts.ts                                 # MODIFY add action + critic prompt builders
lib/scan/
  embeddings.ts                              # CREATE upsert/search embeddings (pgvector) + populate
  algorithm-safety.ts                        # CREATE §11 generic-tell + cross-customer similarity + cadence
  score-full.ts                              # CREATE verified Discoverability Score (§7) + radar data
  loops.ts                                   # CREATE bounded agentic loops (§9.5) budgets/stop-rules
  report.ts                                  # CREATE four-question report payload assembler (§5.6 — JSON, not UI)
  full-scan.ts                               # CREATE orchestrates the full Stage 0-4 (actions→critic→score→report)
lib/email/resend.ts                          # MODIFY implement sendScanReadyEmail (report link)
lib/eval/golden-set.ts  lib/eval/fixtures/*  # CREATE eval harness + the 5 reference fixtures
supabase/migrations/<ts>_actions_cols.sql    # CREATE action-card cols + report_payload + indexes
lib/inngest/functions/scan-requested.ts      # MODIFY add the full-scan stage (gated/after findings)
lib/config/env.ts                            # MODIFY add YOUTUBE_API_KEY, VOYAGE_API_KEY (fixtures-optional)
lib/dev/fixtures.ts                          # MODIFY add fixtures for communities/creators/embed/actions/critic
```

---

## Milestone A — The rest of the data layer (full collect)

### Task 1: `find_communities` D-tool (HN Algolia + Bluesky + SERP)
**Files:** `lib/scan/adapters/hn-algolia.ts` (+ `bluesky.ts`) + tests, `lib/scan/tools/find-communities.ts`, fixtures, register.
- [ ] TDD pure parsers: HN Algolia (`https://hn.algolia.com/api/v1/search?query=...` → `{title, url, points, num_comments}`), Bluesky search (public AppView `app.bsky.feed.searchPosts` → posts). `find_communities` D-tool (klass D): given the product/topic, returns `Community[] { source; title; url; engagement; }`; charges `{1, 0}` (HN/Bluesky free); fixture-aware (`fixtureCommunities`); persists raw, logs telemetry. Mocked contract tests. Register in `tools/index.ts`. **Commit** `feat: find_communities D-tool (HN Algolia + Bluesky, fixture-aware)`.

### Task 2: `find_creators` D-tool (YouTube Data API + SERP)
**Files:** `lib/scan/adapters/youtube.ts` + test, `lib/scan/tools/find-creators.ts`, env (`YOUTUBE_API_KEY` — fixtures-optional), fixtures, register.
- [ ] TDD `parseYouTube` (search.list → `{channelTitle, videoTitle, url, viewCount}`). `find_creators` (klass D): creators who covered a competitor → `Creator[] { name; url; audienceProxy; coveredCompetitor }`; charges `{1, 0}` (YouTube quota, not $); fixture-aware (`fixtureCreators`); `res.ok` guard; persists raw + telemetry. (Apple Podcasts stays demoted — §6.) **Commit** `feat: find_creators D-tool (YouTube Data API, fixture-aware)`.

### Task 3: Embedding provider + pgvector semantic layer
**Files:** `lib/llm/embed.ts` (+ test), `lib/scan/embeddings.ts` (+ integration test), env (`VOYAGE_API_KEY` — fixtures-optional), fixtures.
- [ ] `callEmbed(texts: string[]): Promise<number[][]>` — Voyage `voyage-3` (1024-dim) when real; `fixtureEmbed` (deterministic pseudo-vectors from a hash, 1024-dim, normalized) when `fixturesEnabled()` — so semantic ops work keyless in dev. `lib/scan/embeddings.ts`: `upsertEmbeddings(rows)` + `searchSimilar(queryVec, {subjectType, appId?, k})` (uses the Cycle-0 `match_embeddings` RPC / HNSW). Integration test: embed two texts, search returns the nearer. **Commit** `feat: embedding provider (Voyage, fixture-aware) + pgvector upsert/search`.

### Task 4: Full collect (wire keywords + communities + creators)
**Files:** `lib/scan/full-collect.ts` (+ integration test), modify nothing in the <10s `collect.ts`.
- [ ] `runFullCollect(ctx, facts): Promise<void>` — the heavier collect that feeds findings/actions (runs AFTER the <10s facts): calls `search_keywords` (seeds = product + top competitors), `find_communities`, `find_creators`, persisting their raw_documents (so extract's `keyword_data`/community/creator sheets populate). Per-source `.catch` isolation. Fixture-aware end-to-end. Integration test (fixtures): writes the keyword/community/creator raw_documents for a scan. **Commit** `feat: full collect (keywords + communities + creators) feeding findings/actions`.

---

## Milestone B — Action cards + Critic Gate v2

### Task 5: migration — action-card columns + report payload
**Files:** `supabase/migrations/<ts>_actions_report.sql`; regen types.
- [ ] `actions` already exists (Cycle 0). Add any missing cols for §10.2: `why text`, `expected_outcome jsonb` (exists), `draft_requires_edit bool default true`, `verification jsonb`, `evidence_ids bigint[] default '{}'`, `scan_id uuid references scans`. Add `scans.report_payload jsonb`. FK indexes. **Commit** `feat: action-card + report_payload schema`.

### Task 6: Stage 4 FORMAT — action-card generation
**Files:** `lib/llm/actions.ts` (+ test), `lib/llm/prompts.ts` (action builders), fixtures (`fixtureActions`).
- [ ] `generateActions(ctx, factSheets, findings): Promise<ActionCard[]>` — Haiku, **over-generate 2–3×** (§9.1) candidate action cards across Content/Outreach/SEO (§6 modules 1/2/5) in the §10.2 shape: `{ category, title, why, evidence_ids, effort_min, suggested_deadline, expected_outcome: {score_component, delta, secondary}, draft, draft_requires_edit, verification: {method, state} }`. Drafts in `founder_voice` (from `users.founder_voice`, default neutral), each referencing ≥1 app-specific fact (a real review theme / competitor gap). Fixture-aware. JSON-mode, defensive parse. **Commit** `feat: Stage 4 action-card generation (Haiku, founder voice, over-generate)`.

### Task 7: `check_link` L-tool (entailment)
**Files:** `lib/llm/check-link.ts` (+ test), register in `tools/index.ts`.
- [ ] `checkLink(url, claim): Promise<{ entails: boolean; reason: string }>` — fetch the source (or read the cached `raw_documents`/`evidence`), Haiku entailment ("does this source actually say what the claim says?"). klass L. Fixture-aware (`fixtureCheckLink` → entails true for fixture evidence). Charges budget. **Commit** `feat: check_link entailment L-tool (fixture-aware)`.

### Task 8: Critic Gate v2 (the 10-rule enforcer)
**Files:** `lib/llm/critic.ts` (+ test), `lib/llm/prompts.ts` (critic builder).
- [ ] `runCritic(ctx, action, context): Promise<{ pass: boolean; failedRules: string[]; revised?: ActionCard }>` implementing §9.2 verbatim — an action PASSES only if ALL 10 hold: (1) ≥2 evidence links from ≥2 source types; (2) specificity (names the exact surface); (3) effort+deadline; (4) measurable expected outcome tied to a score_component; (5) draft present (Content/Outreach) referencing ≥1 app-specific fact; (6) source diversity at plan level (≤30% from one source type); (7) confidence calibration (`probability_based` capped 0.6; spot-check 2 random links via `check_link`); (8) audience honesty (newcomer-hostile communities → "participate first" only); (9) algorithm safety (§11); (10) score linkage (exactly one score_component). **Reject/revise loop, max 3 retries** (§9.5 evidence loop) — on rejection, ask Sonnet to revise; after 3, drop or downgrade to `probability_based`, **labeled, never silently padded** (§9.1 fallback). Log `pipeline_runs.critic_rejections`. The plan-level rules (6) run over the action SET. Fixture-aware (fixtures pass). **Commit** `feat: Critic Gate v2 — 10-rule reject/revise loop + critic_rejections telemetry`.

### Task 9: Algorithm-safety scan (§11)
**Files:** `lib/scan/algorithm-safety.ts` (+ test).
- [ ] `algorithmSafety(actions, ctx): Promise<ActionCard[]>` enforcing §11: (5) cross-customer draft-similarity via `searchSimilar` over draft embeddings — if two customers' drafts for the same surface exceed a threshold, flag for regenerate-with-divergence; (6) generic-tell scan (clichés/AI-isms regex + heuristics) → flag for regenerate; (3) ≤5 outreach drafts/founder/day cap; (4) per-platform cadence caps (≤2 posts/wk/community); enforce no-auto rule (drafts require an edit event — a `draft_requires_edit: true` flag, enforced in the future UI). Returns the safe/annotated action set. Fixture-aware. **Commit** `feat: algorithm-safety scan (generic-tell, cross-customer divergence, cadence caps)`.

---

## Milestone C — Full scan assembly

### Task 10: Bounded agentic loops (§9.5)
**Files:** `lib/scan/loops.ts` (+ test).
- [ ] Implement the 3 loops with `(maxRounds, noveltyThreshold, budgetCents)` + diminishing-returns early-exit: (1) **competitor-discovery loop** — find_competitors → reviews/listing on each → new names from review co-mentions + pgvector positioning neighbors → repeat; stop when a full round adds no new confirmed candidate; hard cap 3. (2) **evidence loop** — Critic rejects for thin proof → ≤2 targeted retrieval attempts → still thin = drop/downgrade. (3) **gap-chasing loop** — remaining budget reallocates to the weakest of the four questions; total 30–60 tool-call ceiling. Pure orchestration over the tools/budget; unit-test the stop-rules (novelty 0 → stop; budget exceeded → stop). **Commit** `feat: bounded agentic loops (competitor-discovery / evidence / gap-chasing) with stop-rules`.

### Task 11: Verified Discoverability Score + radar (§7)
**Files:** `lib/scan/score-full.ts` (+ test).
- [ ] `verifiedScore(ctx, components): ScoreResult & { radar: AxisDetail[] }` from **verified components only** (§7.1): SEO/ASO subscore = keywords ranking 40% + directories live 20% + comparison/landing pages live 20% + ASO coverage vs competitor median 20% (web mode excludes ASO; web-SEO components only). Content/Outreach subscores from verified surface counts. Anti-vanity (§7.2): self-reported-only items ≤20% of any subscore; removed/downvoted posts subtracted; outreach with no response after 21d leaves the count; low-authority directories contribute zero. Returns the score + the 7-axis radar data (locked axes for inactive modules). Pure + deterministic; TDD the weighting + anti-vanity rules. **Commit** `feat: verified Discoverability Score + radar (anti-vanity rules)`.

### Task 12: Four-question report payload (§5.6) — JSON, NOT UI
**Files:** `lib/scan/report.ts` (+ test).
- [ ] `assembleReport(ctx): Promise<ReportPayload>` — the §5.6 four-question structure as typed JSON the future UI consumes: `{ whatYouOffer: positioningMirror, whoItsFor: icpXray, whereTheyAre: { surfaces, competitorGap }, whatToDoThisWeek: { quickWins, medium, longPlay } (the Critic-passed actions, §10.3 horizon mix), score: verifiedScore+radar, evidence: per-claim evidence index }`. Reads findings + actions + score from the DB. Persist to `scans.report_payload`. Pure assembly over persisted data; TDD the shape. (NO rendering — this is the API contract for the deferred UI.) **Commit** `feat: four-question report payload assembler (§5.6 JSON contract)`.

### Task 13: Full-scan orchestration + wire into the pipeline
**Files:** `lib/scan/full-scan.ts` (+ integration test), modify `lib/inngest/functions/scan-requested.ts`.
- [ ] `runFullScan(ctx, facts): Promise<void>` = runFullCollect → (extract already ran) → generateActions (over-generate) → for each action `runCritic` (reject/revise) → `algorithmSafety` → verifiedScore → assembleReport → persist `actions` (Critic-passed only) + `report_payload` + final score → emit a `report` scan_event (payload = a pointer/summary; the full payload is in the DB). Add a `report` type to `scan_events`. Wire as a step in `scan-requested.ts` AFTER the findings step (the full scan is the post-gate deliverable; for Cycle 3, run it inline after findings — the gating is a UI concern, deferred). Integration test (fixtures, no keys): a full scan → ≥1 Critic-passed action per active module + a `report_payload` + a `report` event. **Commit** `feat: full-scan orchestration (collect→actions→critic→score→report) wired into the pipeline`.

---

## Milestone D — Quality gate + delivery

### Task 14: Golden-set eval harness (R1 mitigation)
**Files:** `lib/eval/golden-set.ts`, `lib/eval/fixtures/{bearable,opal,cardpointers,sofa,nudgi}.json` (+ test), `package.json` script `eval`.
- [ ] Digitize the 5 reference analyses (Bearable, Opal, CardPointers, Sofa app-mode; Nudgi web-mode — incl. ReachKit itself per R11) as fixtures: the input (store_url + canned raw data) + the expected-quality rubric (key findings/actions/score band that a good scan must surface). `runGoldenSet()` runs the pipeline (fixtures mode) over each fixture and **scores the output against the rubric** (coverage of expected findings, action specificity, evidence presence, score plausibility) → a mean quality number + per-fixture report. `pnpm eval` runs it; it must be runnable pre-deploy (this is the R1 quality gate — every pipeline change is scored). TDD the scorer; include at least the 5 fixtures (rubrics can be concise for now, expanded with real analyses). **Commit** `feat: golden-set eval harness (5 reference fixtures + quality scorer) — R1 gate`.

### Task 15: Scan-ready email delivery
**Files:** `lib/email/resend.ts` (implement `sendScanReadyEmail`), wire into the full-scan completion.
- [ ] `sendScanReadyEmail({ to, scanId, reportUrl }): Promise<void>` via Resend (the magic-link gate captured the email in Cycle 2). Fixture-aware (`fixturesEnabled()` → log instead of send). Called when the full scan completes for a claimed scan. A plain-text/simple HTML body (no design — the polished template is the UI phase). Unit test (mock Resend). **Commit** `feat: scan-ready email delivery (Resend, fixture-aware)`.

---

## Self-Review (plan author)
**Spec coverage (Cycle 3, decomposition §3.3):** full Stage 0–4 → Tasks 6,8,13 ✓ · Critic Gate v2 (10 rules, ≤3 retries, critic_rejections) → Task 8 ✓ · check_link → Task 7 ✓ · bounded loops → Task 10 ✓ · golden-set evals (5 fixtures, pre-deploy) → Task 14 ✓ · Stage 4 FORMAT (action cards, founder_voice, §11 safety) → Tasks 6,9 ✓ · full Score + radar (§7 anti-vanity) → Task 11 ✓ · four-question report (§5.6) → Task 12 (payload only — UI deferred) ✓ · fact-sheet shared cache → (the Cycle-2 `fact_sheets` TTL repo already shares subject-keyed; cross-customer reuse is inherent — no new task) ✓ · pgvector semantic layer → Task 3 ✓ · `find_communities`/`find_creators` → Tasks 1,2 ✓ · scan email → Task 15 ✓.
**UI deferral:** NO task creates/edits `app/**` or `components/**`. The report + actions + score are JSON/DB payloads for the future §20–23 UI.
**Fixture/keyless:** every paid call (LLM, embeddings, DataForSEO, YouTube) is `fixturesEnabled()`-gated → the full scan + golden-set run keyless in dev.
**Type seams:** `ActionCard` (Task 6) → critic (8) → algorithm-safety (9) → report (12); `callEmbed`/`searchSimilar` (3) → algorithm-safety (9) + loops (10); `ReportPayload` (12) is the deferred-UI contract.
**Confirm-at-build:** Voyage `voyage-3` dim/API + the YouTube/HN/Bluesky response shapes (mocked contract tests lock them); the Critic prompt + golden-set rubrics are quality-tuned against the real 5 analyses over time.

---
*Execution: subagent-driven, milestone-grouped, per-task review for Critic/loops/score/report/eval (judgment-heavy), batched for the thin data tools. Live LLM/vendor verification + the §20–23 UI are separate phases.*
