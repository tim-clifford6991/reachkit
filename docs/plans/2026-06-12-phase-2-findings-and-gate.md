# ReachKit Phase 2 (Cycle 2) — Findings + Email Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Take a completed Cycle-1 scan further — Haiku compresses the raw evidence into shared `fact_sheets`, Sonnet synthesizes a preliminary Discoverability Score + positioning mirror + 3 evidence-linked findings + 1 blurred sample action, and the funnel reveals them (Score count-up, blur-locked sections with real headlines) behind a single-field magic-link **email gate**.

**Architecture:** The `scan/requested` Inngest pipeline gains two stages after collect: **Stage 1 EXTRACT** (Haiku 4.5 reads `raw_documents` → typed `fact_sheets`) and **Stage 2 SYNTH** (Sonnet 4.6 reads *fact sheets only* — never raw text, §13 — → Score + findings + sample action). It persists `findings`/`scans.score_*` and emits a `findings` scan_event. The funnel page consumes it; the email gate (`POST /api/scan/:id/claim`) sends a Supabase magic link, a DB trigger creates `public.users(id = auth.uid())`, and PostHog instruments the funnel.

**Tech Stack (new this cycle):** `@anthropic-ai/sdk` (Haiku/Sonnet) · Supabase Auth magic link + auth trigger · Resend (email) · Motion (funnel animation, §20.3 tier 2) · PostHog funnel events.

**Spec refs:** §5.1 (90–120s findings + gate), §5.6 (four questions), §7 (Score), §9.1 (Stages 1–2), §10.1/§10.2 (schemas), §11 (algorithm safety — drafts), §13 (Sonnet reads fact sheets only), §23 (funnel moments 1–4), D42 (magic link). Decomposition: `docs/specs/2026-06-11-reachkit-execution-decomposition.md` §3.2.

**Acceptance gate (Cycle 2):** a completed scan → preliminary Score + positioning mirror + 3 evidence-linked findings + 1 blurred sample action, rendered with a Score reveal and blur-locked headlines, behind a working magic-link email gate that creates `public.users` with `id = auth.uid()`; funnel conversion measurable in PostHog. Cost/scan logged (Stage 1+2 add LLM cost to `pipeline_runs`). App-mode runs live (free APIs) with the Anthropic key; web-mode needs the vendor keys.

---

## Cycle 0/1 Learnings — apply throughout (verified building Cycles 0–1)

1. **Inngest v4:** `createFunction({ id, retries, triggers: [eventType(...)], onFailure }, handler)`; typed events via `eventType()`/`staticSchema()` in `lib/inngest/client.ts` (already wired for `scan/requested`). Extend the existing `scanRequested` function — don't add a new one.
2. **Next 16 `cacheComponents`:** no `export const dynamic`; `async … await params`. SSE/streaming routes use `maxDuration`.
3. **Migrations:** `supabase migration new <name>` → `supabase db reset`; FK columns get explicit indexes; regenerate `lib/db/types.ts` after (strip CLI stdout noise so it starts at `export type Json`).
4. **Deps:** `pnpm add` works at root (`.npmrc`). New: `@anthropic-ai/sdk`, `resend`, `motion`.
5. **Env + integration tests:** integration tests are local-only (Docker/Supabase + `.env.local`); EVERY env key needs a `.env.local` value (lazy `env` Proxy parses all on first access). New keys this cycle → add stubs to `.env.local` + the `env.test.ts` fixture.
6. **`noUncheckedIndexedAccess`, no `!`:** guard indexed/optional access; `result[0]?.x`.
7. **Auth contract (Cycle 0 RLS):** `public.users.id` MUST equal `auth.uid()` — Task 8's trigger enforces it. The owner RLS policies depend on this.
8. **Cost telemetry:** every LLM call writes a `pipeline_runs` row (model + tokens_in/out + `anthropicCostCents`). Sonnet reads fact sheets only (§13).
9. **Test boundary:** mock the Anthropic SDK / Resend / vendor adapters in CI unit tests; real Supabase for integration; live-LLM/live-vendor tests local-only. The Inngest function is tested via `@inngest/test` `InngestTestEngine`.

---

## File Structure (created/modified)

```
lib/llm/
  anthropic.ts            # CREATE Haiku/Sonnet call wrapper → {text, usage}; logs pipeline_runs
  extract.ts              # CREATE Stage 1: raw_documents → fact_sheets (Haiku)
  synth.ts                # CREATE Stage 2: fact_sheets → Score + findings + sample action (Sonnet)
  prompts.ts              # CREATE extract + synth prompt builders (typed, fact-sheet-only for synth)
lib/scan/
  fact-sheets.ts          # CREATE upsert/read fact_sheets (TTL, shared, subject-keyed)
  score.ts                # CREATE preliminary Discoverability Score (3-axis) from facts+synth
  adapters/keywords.ts    # CREATE DataForSEO Keywords Data adapter
  tools/search-keywords.ts# CREATE search_keywords D-tool body
  findings-pipeline.ts    # CREATE orchestrates extract→synth→persist→emit (called by scanRequested)
lib/auth/profile.ts       # CREATE helper: link scan/app to the authed user
lib/email/resend.ts       # CREATE Resend client + sendMagicLink / templates
app/api/scan/[id]/claim/route.ts   # CREATE POST claim → magic link
app/(funnel)/scan/[id]/scan-stream.tsx  # MODIFY add findings reveal + Score count-up + blur-lock + email gate
app/(funnel)/scan/[id]/email-gate.tsx   # CREATE the single-field gate (client)
app/(marketing)/page.tsx  # MODIFY add a minimal scan input (funnel moment 1)
components/motion/         # CREATE NumberTicker + stagger primitives (Motion)
lib/analytics.ts          # MODIFY add funnel event helpers
lib/inngest/functions/scan-requested.ts  # MODIFY add extract→synth stages after collect
supabase/migrations/<ts>_findings_and_auth.sql  # CREATE findings cols + auth trigger + fact_sheets index
lib/config/env.ts         # MODIFY add RESEND_API_KEY usage (already in schema) + ANTHROPIC model ids (in telemetry)
```

---

## Task 1: Anthropic call wrapper (Haiku/Sonnet) + cost telemetry

**Files:** `lib/llm/anthropic.ts`, `lib/llm/anthropic.test.ts`.

- [ ] **Step 1 — Failing test** (mock the SDK; assert it returns text + logs a `pipeline_runs` row with model+tokens):
```ts
import { expect, test, vi } from "vitest";
test("callModel returns text and records a pipeline_runs row with token cost", async () => {
  vi.doMock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: async () => ({ content: [{ type: "text", text: "hello" }], usage: { input_tokens: 1000, output_tokens: 200 } }) }; } }));
  const recorded: unknown[] = [];
  vi.doMock("@/lib/telemetry/pipeline-runs", async (orig) => ({ ...(await orig() as object), recordPipelineRun: async (r: unknown) => { recorded.push(r); } }));
  const { callModel } = await import("./anthropic");
  const out = await callModel({ model: "claude-haiku-4-5-20251001", system: "s", prompt: "p", scanId: "s1", stage: "extract" });
  expect(out.text).toBe("hello");
  expect((recorded[0] as { model: string }).model).toBe("claude-haiku-4-5-20251001");
});
```

- [ ] **Step 2 — Run → FAIL.**

- [ ] **Step 3 — Implement `lib/llm/anthropic.ts`** (`pnpm add @anthropic-ai/sdk`). It builds a client from `env.anthropicApiKey`, calls `messages.create`, extracts the text block, computes cost via `anthropicCostCents(model, usage.input_tokens, usage.output_tokens)`, and `recordPipelineRun({ scanId, stage, model, tokensIn, tokensOut, costCents, durationMs })`. Returns `{ text, usage }`. Signature:
```ts
export async function callModel(args: {
  model: "claude-haiku-4-5-20251001" | "claude-sonnet-4-6";
  system: string; prompt: string;
  scanId: string | null; stage: "extract" | "synth" | "critic" | "format";
  maxTokens?: number;
}): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }>
```
Confirm the exact `@anthropic-ai/sdk` message shape + model ids against the **`claude-api` skill** during the task (do NOT guess pricing/limits — read it). `MODEL_PRICES` in `pipeline-runs.ts` is the placeholder to reconcile.

- [ ] **Step 4 — Run → PASS. Step 5 — Commit** `feat: Anthropic call wrapper (Haiku/Sonnet) with per-call cost telemetry`.

---

## Task 2: `fact_sheets` repository (TTL, shared, subject-keyed)

**Files:** `lib/scan/fact-sheets.ts`, `lib/scan/fact-sheets.test.ts`, `tests/integration/fact-sheets.test.ts`.

- [ ] **Step 1 — Failing unit test** for `factSheetTtl(kind)` (returns the spec TTL: keyword 30d, competitor 14d, community 30d, serp 7d, review_themes 14d) and the body/shape typing.
- [ ] **Step 2 — FAIL. Step 3 — Implement**:
```ts
export type FactSheetKind = "review_themes" | "positioning" | "competitor_gap" | "keyword_data";
export function factSheetTtlMs(kind: FactSheetKind): number { /* §5.7 TTLs */ }
export async function upsertFactSheet(input: { subjectType: string; subjectKey: string; kind: FactSheetKind; body: unknown; evidenceIds?: number[]; modelVersion: string; }): Promise<{ id: number }>
export async function getFreshFactSheet(subjectType: string, subjectKey: string, kind: FactSheetKind): Promise<{ body: unknown } | null> // returns null if absent or expired
```
`upsertFactSheet` sets `expires_at = now + factSheetTtlMs(kind)`, `shared = true`; on conflict `(subject_type, subject_key, kind)` updates body+expiry (a unique index is added in Task 7's migration). `getFreshFactSheet` returns null when `expires_at < now`.
- [ ] **Step 4 — Integration test:** upsert then get returns the body; an expired sheet returns null. **Step 5 — Commit** `feat: fact_sheets repo (TTL, shared cache, subject-keyed upsert)`.

---

## Task 3: `search_keywords` adapter + D-tool (DataForSEO Keywords Data)

**Files:** `lib/scan/adapters/keywords.ts` (+ test), `lib/scan/tools/search-keywords.ts`; register in `lib/scan/tools/index.ts`.

- [ ] TDD the pure `parseKeywords(body)` → `{ keyword, volume, cpc, competition }[]`; `keywordsData(seeds: string[])` POSTs DataForSEO Keywords Data (`res.ok` guard). The `searchKeywords` tool charges `{toolCalls:1, cents:1}` (DataForSEO), persists raw, logs telemetry, returns the keyword rows. Mocked contract test. **Commit** `feat: search_keywords adapter + D-tool (DataForSEO Keywords Data)`.

*(Scope note: `find_communities`/`find_creators` move to Cycle 3 with the Content/Outreach action cards — Cycle 2's 3 findings + Score come from reviews/competitors/SERP/keywords. Update decomposition §3.2 to match.)*

---

## Task 4: Stage 1 EXTRACT (Haiku → fact_sheets)

**Files:** `lib/llm/prompts.ts` (extract builders), `lib/llm/extract.ts` (+ test).

- [ ] TDD `extractReviewThemes`/`extractPositioning`/`extractCompetitorGap` (mock `callModel` to return canned JSON; assert the parsed typed fact-sheet shape + that `upsertFactSheet` is called with the right kind/subject). Then `runExtract(scanId, ctx)`: reads the scan's `raw_documents` (reviews, listing, competitors, keywords), runs Haiku per source-group to produce compressed `fact_sheets` (review themes with sentiment + representative quotes + `evidence_ids`; positioning claims; competitor-gap; keyword clusters), persisting each via `upsertFactSheet`. JSON-mode prompts; parse defensively (degrade to a minimal sheet on parse failure, never throw the scan). **Commit** `feat: Stage 1 EXTRACT — Haiku compresses raw evidence into fact_sheets`.

---

## Task 5: Stage 2 SYNTH (Sonnet → Score + findings + sample action)

**Files:** `lib/llm/prompts.ts` (synth builder), `lib/llm/synth.ts` (+ test), `lib/scan/score.ts` (+ test).

- [ ] **`lib/scan/score.ts`** — TDD a preliminary `discoverabilityScore(facts, synthSignals)` → `{ total: number; breakdown: { content; outreach; seo } }` (0–100; heuristic from competitor-gap depth, review volume/sentiment, keyword presence — the *verified* score is Cycle 3/4; label it preliminary). Weights per §7.1 (content .30 / outreach .25 / seo .45; web mode excludes ASO).
- [ ] **`lib/llm/synth.ts`** — TDD `runSynth(scanId, ctx)`: reads ONLY `fact_sheets` (never raw — §13), one Sonnet call, returns the §10.1 shape: `{ positioningMirror: {listingSays, reviewsValue, gap}, findings: Finding[3] (evidence_based, confidence, evidence_ids), sampleAction: ActionCard (§10.2, draft present but the funnel blurs it) }`. Mock `callModel`; assert 3 findings, each with ≥1 `evidence_id`, and a sample action. Combine with `discoverabilityScore` for the Score. **Commit** `feat: Stage 2 SYNTH — Sonnet synthesizes Score + findings + sample action from fact sheets`.

---

## Task 6: Findings pipeline orchestration + persistence

**Files:** `lib/scan/findings-pipeline.ts` (+ integration test).

- [ ] `runFindings(scanId, ctx)`: `await runExtract(...)` then `await runSynth(...)`, then persist — insert `findings` rows (category, basis, confidence, body, evidence_ids), update `scans.score_total`/`score_breakdown`, store the positioning mirror + sample action in a `scans.findings_payload jsonb` (added in Task 7), and `emitScanEvent(scanId, "findings", { score, positioningMirror, findings, sampleAction })`. Integration test (mock the LLM via the `callModel` boundary; real Supabase): assert `findings` rows + `score_total` set + a `findings` scan_event emitted. **Commit** `feat: findings pipeline (extract→synth→persist→emit findings event)`.

---

## Task 7: Migration — findings payload, fact_sheets unique index, auth trigger

**Files:** `supabase/migrations/<ts>_findings_and_auth.sql`; regenerate `lib/db/types.ts`.

- [ ] `supabase migration new findings_and_auth`:
```sql
alter table scans add column findings_payload jsonb;          -- positioning mirror + sample action
create unique index fact_sheets_subject_kind_uniq on fact_sheets (subject_type, subject_key, kind);  -- upsert key (Task 2)

-- Auth contract: public.users.id MUST equal auth.uid(). Create the profile row on signup.
create or replace function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
```
Apply via `supabase db reset`; regenerate types; confirm `pnpm typecheck`. Integration test: inserting into `auth.users` (via the admin client) creates a `public.users` row with the same id. **Commit** `feat: findings_payload, fact_sheets upsert index, auth user→profile trigger (users.id = auth.uid())`.

---

## Task 8: Wire extract→synth into the scan pipeline

**Files:** MODIFY `lib/inngest/functions/scan-requested.ts`; MODIFY `tests/integration/scan-requested.test.ts`.

- [ ] After the existing `collect` step + `facts` event, add a step `findings` that calls `runFindings(scanId, ctx)` (building the same `ScanContext`), then keep the `done` step. The `onFailure` already covers terminal errors. Update the acceptance test: after `facts`, assert a `findings` scan_event arrives with `findings.length === 3` and a numeric `score.total`, and `scans.score_total` is set. App-mode (Sofa) live; mock `callModel` so CI/no-Anthropic-key runs deterministically (the live-LLM assertion is gated behind a real key — note it). **Commit** `feat: wire EXTRACT→SYNTH findings stage into scan/requested`.

---

## Task 9: Email gate API — magic link + scan claim

**Files:** `lib/email/resend.ts`, `lib/auth/profile.ts`, `app/api/scan/[id]/claim/route.ts` (+ integration test).

- [ ] `POST /api/scan/:id/claim {email}` (zod-validated): call Supabase `auth.signInWithOtp({ email, options: { emailRedirectTo: <SITE>/scan/:id/results } })` (sends the magic link; Supabase uses its configured email — Resend SMTP in prod, the local Inbucket in dev). Record the pending claim (set `scans.claim_email`, added inline or store a `claims` row) so the scan can be linked to the user on confirm. `lib/auth/profile.ts` exposes `linkScanToUser(scanId, userId)` (adds the scan's `app_id` to `users.app_ids`) for the post-confirm callback (a `/scan/:id/results` server action or route that runs when the authed user lands). `lib/email/resend.ts` wraps the Resend client for the later scan-ready email (Cycle 3). Integration test: POST claim returns 200 and records the pending email; mock the Supabase auth call. **Commit** `feat: email-gate claim endpoint (magic link via Supabase OTP) + scan→user linking`.

---

## Task 10: Motion primitives — NumberTicker + stagger

**Files:** `components/motion/number-ticker.tsx`, `components/motion/stagger.tsx`.

- [ ] `pnpm add motion`. `NumberTicker` (client) animates 0→value with a spring (the Score count-up, §20.3 tier 2, §23 moment 3 — the signature moment), honoring `prefers-reduced-motion` (no animation when set). `Stagger` wraps a list with `AnimatePresence` + staggered entrance for the scan-theater artifacts. Keep them small + compositor-friendly (animate opacity/transform only). Build-verify (no unit test needed for thin animation wrappers, but confirm `prefers-reduced-motion` guards are present). **Commit** `feat: Motion NumberTicker + stagger primitives (reduced-motion safe)`.

---

## Task 11: Funnel reveal — Score + findings + blur-locked sections

**Files:** MODIFY `app/(funnel)/scan/[id]/scan-stream.tsx`.

- [ ] Extend the SSE consumer to handle the `findings` event. On `findings`: render moment 3 — the **Score count-up** (`NumberTicker` + a radial sweep), the **top finding in full** with evidence links, and the **remaining sections blur-locked with REAL headlines** (§23 — honest curiosity gap, e.g. "3 communities where your users are asking for this — locked"), plus the **sample action card visible-but-blurred**. Scan-theater artifacts animate in via `Stagger`. Facts (Cycle 1) stay above. No fake teasers — headlines are real. Keep the `(funnel)` bundle under 200KB (it's at ~195KB — lazy-load Motion if needed). **Commit** `feat: funnel reveal — Score count-up + top finding + blur-locked real-headline sections`.

---

## Task 12: Email gate UI (moment 4)

**Files:** `app/(funnel)/scan/[id]/email-gate.tsx`; MODIFY `scan-stream.tsx` to mount it.

- [ ] A single-field client component: "Send my full report." → `POST /api/scan/:id/claim`. On success, "Check your email" state (resend + change-email affordances). One field only (§23 moment 4 — every removed field helps the ≥35% conversion target). Appears at the findings reveal. **Commit** `feat: single-field magic-link email gate (funnel moment 4)`.

---

## Task 13: Landing scan input (moment 1) + PostHog funnel events

**Files:** MODIFY `app/(marketing)/page.tsx`, `lib/analytics.ts`; MODIFY funnel components to fire events.

- [ ] **Landing (moment 1):** a minimal hero with a single autofocused input ("Paste your App Store URL or website") that `POST`s `/api/scan` and routes to `/scan/:id`. Functional, not polished (full marketing is Cycle 5). **PostHog funnel events** (`lib/analytics.ts` helpers): `scan_started` (land→scan), `scan_facts_shown`, `scan_findings_shown`, `email_gate_viewed`, `email_submitted` — fired from the funnel client components. These are the §14 Phase-0 numbers measured in the real funnel. **Commit** `feat: landing scan input + PostHog funnel instrumentation`.

---

## Task 14: Cost + acceptance verification

**Files:** MODIFY `tests/integration/scan-requested.test.ts` (or a new `findings-cost.test.ts`).

- [ ] Assert the findings stage logs `pipeline_runs` rows with `model` set (extract = Haiku, synth = Sonnet) and non-zero token counts when `callModel` is exercised (mock returns a usage), and that total scan cost is computed. Confirm the per-scan budget isn't busted. Run the whole suite (`pnpm test`, `pnpm test:int`, `pnpm typecheck`, `pnpm build`, `pnpm check:bundle`). **Commit** `test: findings-stage cost telemetry + full acceptance pass`.

---

## Self-Review (plan author)

**Spec coverage (Cycle 2, decomposition §3.2):** Stage 1 EXTRACT → Task 4 ✓ · Stage 2 SYNTH → Task 5 ✓ · fact_sheets (shared, TTL) → Task 2 ✓ · preliminary Score (§7) → Task 5 ✓ · 3 evidence-linked findings + sample action (§10) → Tasks 5–6 ✓ · email gate magic link + silent account (D42) + users.id=auth.uid() (§5.7) → Tasks 7, 9 ✓ · funnel moments 1–4 (§23) → Tasks 10–13 ✓ · PostHog funnel (§14) → Task 13 ✓ · Sonnet reads fact sheets only (§13) → Task 5 ✓ · LLM cost telemetry → Tasks 1, 14 ✓ · `search_keywords` (remaining D-tool the findings need) → Task 3 ✓ (communities/creators deferred to Cycle 3 with action cards — noted).

**Placeholder scan:** none — forward refs (`find_communities`/`find_creators` → Cycle 3; verified Score → Cycle 3/4; scan-ready email → Cycle 3) are deliberate and named.

**Type consistency:** `callModel` (Task 1) consumed by extract/synth (4,5); `FactSheetKind` + `upsertFactSheet`/`getFreshFactSheet` (Task 2) consumed by extract/synth (4,5) with the unique index from Task 7; the `findings` scan_event payload (Task 6) consumed by the funnel (Task 11); `discoverabilityScore` (Task 5) feeds Task 6's persist.

**Confirm-at-build:** the exact `@anthropic-ai/sdk` API + Haiku/Sonnet model ids/pricing (Task 1 — read the `claude-api` skill, don't guess); Supabase `signInWithOtp` options (Task 9); Motion's reduced-motion API (Task 10).

**Credential note:** app-mode + mocked LLM run in CI/locally with no keys; the **live findings** (Haiku/Sonnet) need Tim's `ANTHROPIC_API_KEY`, and live **web-mode** still needs DataForSEO/Tavily/PH. Escalate at the live gate, as in Cycle 1.

---

*Execution: subagent-driven, milestone-grouped (LLM infra 1–3 · findings pipeline 4–8 · gate+funnel 9–13 · verify 14), per-task review for the LLM/pipeline/auth tasks, batched for the thin adapters/UI.*
