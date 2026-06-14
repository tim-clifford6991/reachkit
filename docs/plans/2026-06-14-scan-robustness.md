# Scan Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the free scan fast-feeling and never thin: hard-bound every external call, keep the live feed moving through the whole pipeline, discover real competitors by reading content (not listicle titles), add web review coverage, and stop mislabeling established sites as pre-launch.

**Architecture:** Three independent tiers over the existing `collect → findings → full-scan` pipeline. **Tier 1** adds a shared `fetchWithTimeout` to all adapters and emits `scan_events` at every stage seam. **Tier 2** promotes LLM-extracted competitor *names* (read from SERP/Tavily snippet + answer content, anchored to the subject's real category) into `facts.competitors`, and narrows the collision filter so a common-word brand name no longer zeroes the set. **Tier 3** adds a web-reviews collector and recalibrates web cold-start onto reliable signals (domain age + competitive footprint), dropping the niche-query SERP count and the always-zero Product Hunt upvotes.

**Tech Stack:** Next.js 16 / React 19, Inngest v4 durable pipeline, Supabase Postgres, Anthropic (Haiku extract), DataForSEO + Tavily adapters, Vitest. Fixture-gated throughout (`REACHKIT_USE_FIXTURES`).

---

## Context — the acquire.com failure (why this plan exists)

Live scan `bf942862-225a-4e40-ab41-41fd6cfae309` (acquire.com, 100s, results "much too light"):

| Symptom | Root cause (confirmed in code) |
|---|---|
| `tool` stage took 60.5s | `lib/scan/adapters/site-fetch.ts:16` + `domain-age.ts:12` use bare `fetch()` with **no timeout**. `grep -L AbortSignal lib/scan/adapters/*` → none have one. |
| Feed froze on "Mapping your competitive landscape" for ~40s | `emitScanEvent` is called **only** in `lib/scan/collect.ts` (3 artifacts). `findings-pipeline.ts` and `full-scan.ts` emit nothing until the terminal `findings`/`report` event. |
| 0 competitors despite real data | SERP (15.9KB) + Tavily (6.7KB, *"Top 10 Acquire Alternatives: Fin, Drift, Zendesk"*) returned. But `parseSerp`/`parseTavily` map result **title/url** → competitor, so only listicle pages (g2.com, …) become "competitors" → all dropped by the aggregator filter → `[]`. The real names live in the snippet/`content`/`answer`, which discovery never reads. |
| 0 competitors even though the LLM could find them | `lib/llm/extract.ts:152` `competitor_gap` extract *does* read the raw SERP/Tavily bodies and can name Fin/Drift/Zendesk — but it only populates the **gap sheet**, never `facts.competitors`; and `findings-pipeline.ts` **skips** `competitor_gap` entirely when `facts.competitors.length === 0`. |
| 0 reviews | `lib/scan/collect.ts:62-64` web branch: `reviewsPromise = Promise.resolve({ reviews: [] })`. Web mode never collects reviews. |
| Flagged Cold Start (wrong) | `lib/scan/cold-start.ts:48-57` web check is `serpResultCount<1000 && phUpvotes<25 && age<1`. For acquire.com: `serpResultCount=104` (the *"alternatives to acquire"* niche query, **not** brand presence), `phUpvotes=0` (PH disabled → always 0), `domainAgeYears=null` → treated as `0 < 1`. All true → Cold Start. |

**Non-goals (explicit, to keep scope tight):**
- Deferring the heavy full-scan to a post-email stage (separate §13 cost initiative; tracked as a follow-up, not here).
- Domain Product-Hunt rebuild (`fetchPhByName` stays a no-op).
- Per-competitor homepage resolution / logos (v1.5 — names + provenance are enough for the free card).
- Paid DataForSEO Reviews API (Tier 3 uses snippet-based reviews; the dedicated API is a noted upgrade).

**Hard rules carried through every task (from `REACHKIT_SPEC_V2.md` + locked product principles):**
1. **Always give insight when the app is live** — never return empty/generic for a reachable site.
2. **Brand-ambiguity is a hard rule** — never treat a similarly-named *different* product as the subject or its competitor. Tier 2's content extraction is category-anchored precisely to honor this.
3. Every paid call stays fixture-gated; no secrets logged; `REACHKIT_USE_FIXTURES` must be false/unset in prod.

---

## File Structure

**Tier 1 — latency & progress**
- Create: `lib/scan/adapters/fetch-timeout.ts` — `fetchWithTimeout(url, init?, ms?)` (shared, default 8000ms).
- Create: `lib/scan/adapters/fetch-timeout.test.ts`.
- Modify: every adapter with a bare `fetch(` — `dataforseo.ts`, `dataforseo-rank.ts`, `tavily.ts`, `site-fetch.ts`, `domain-age.ts`, `hn-algolia.ts` (×2), `bluesky.ts` (×2), `keywords.ts`, `app-store-rss.ts`, `itunes.ts` (×2), `youtube.ts`, plus `lib/llm/check-link.ts` and `lib/llm/embed.ts`.
- Modify: `lib/scan/findings-pipeline.ts` — emit `artifact` events around extract/synth/score.
- Modify: `lib/scan/full-scan.ts` — emit `artifact` events around actions/critic/assemble.

**Tier 2 — robust competitor discovery**
- Create: `lib/llm/competitor-names.ts` — `extractCompetitorNames(ctx, { category, description, subjectName, subjectHost })` (category-anchored Haiku read of persisted SERP/Tavily bodies → real competitor names).
- Create: `lib/llm/competitor-names.test.ts`.
- Modify: `lib/scan/adapters/dataforseo.ts` `parseSerp` — also capture organic `description` + any AI-overview/featured items (richer content for extraction & display).
- Modify: `lib/scan/adapters/tavily.ts` `tavilyAlternatives` — request `include_answer: true`; `parseTavily` keeps `content`.
- Modify: `lib/scan/collect.ts` — after the parallel gather, run `refineCompetitors` (calls `extractCompetitorNames`, merges, re-ranks) before facts assembly.
- Modify: `lib/scan/competitor-filter.ts` — narrow `hasAnyCollision` to whole-name + host-brand (drop the broad per-token scan); allow `source: "llm_extracted"` (no/empty URL) past the aggregator-host gate.
- Modify: `lib/scan/source-labels.ts` — map `"llm_extracted"` → a plain-English provenance label.
- Modify: `lib/scan/findings-pipeline.ts` — remove the "skip `competitor_gap` when competitors empty" gate (Tier 2 now populates competitors; the brand anchor lives in the prompt + category filter).

**Tier 3 — coverage & cold-start**
- Create: `lib/scan/adapters/web-reviews.ts` — `fetchWebReviews(brand, host)` (SERP + Tavily "{brand} reviews" → review-snippet bodies).
- Create: `lib/scan/adapters/web-reviews.test.ts`.
- Modify: `lib/scan/collect.ts` — web branch uses `fetchWebReviews` instead of the empty promise; persist `web_reviews` raw docs.
- Modify: `lib/llm/extract.ts` — add `"web_reviews"` to the review source set so `review_themes` reads it.
- Modify: `lib/scan/cold-start.ts` — rewrite web logic (established-domain short-circuit + competitor/theme footprint; drop niche SERP count & PH upvotes; `null` age is not "new").
- Modify: `lib/scan/cold-start.test.ts` — acquire.com-style established site → not cold; nudgi.ai-style new/empty → cold; established+degraded → not cold.

---

# Tier 1 — Latency & Perceived Progress

## Task 1.1: Shared `fetchWithTimeout` helper

**Files:**
- Create: `lib/scan/adapters/fetch-timeout.ts`
- Test: `lib/scan/adapters/fetch-timeout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/adapters/fetch-timeout.test.ts
import { describe, it, expect, vi } from "vitest";
import { fetchWithTimeout, FetchTimeoutError } from "./fetch-timeout";

describe("fetchWithTimeout", () => {
  it("passes the abort signal through and resolves on a fast response", async () => {
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", spy);
    const res = await fetchWithTimeout("https://x.test", {}, 50);
    expect(res.status).toBe(200);
    vi.unstubAllGlobals();
  });

  it("throws FetchTimeoutError (named, with url) when the underlying fetch aborts", async () => {
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        );
      });
    });
    await expect(fetchWithTimeout("https://slow.test", {}, 10)).rejects.toMatchObject({
      name: "FetchTimeoutError",
      url: "https://slow.test",
    });
    vi.unstubAllGlobals();
  });

  it("merges a caller-supplied signal with the timeout signal", async () => {
    const caller = new AbortController();
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response("ok");
    });
    await fetchWithTimeout("https://x.test", { signal: caller.signal }, 50);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm vitest run lib/scan/adapters/fetch-timeout.test.ts`
Expected: FAIL — `Cannot find module './fetch-timeout'`.

- [ ] **Step 3: Implement the helper**

```ts
// lib/scan/adapters/fetch-timeout.ts
/**
 * fetch() with a hard timeout. Every external call in the scan pipeline must use
 * this — a single hung vendor (e.g. acquire.com's 60s site fetch) otherwise stalls
 * the whole durable step and freezes the user-facing feed.
 *
 * Default 8s: comfortably above p99 for our vendors, well under the 300s step cap.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

export class FetchTimeoutError extends Error {
  readonly url: string;
  readonly timeoutMs: number;
  constructor(url: string, timeoutMs: number) {
    super(`fetch timed out after ${timeoutMs}ms: ${url}`);
    this.name = "FetchTimeoutError";
    this.url = url;
    this.timeoutMs = timeoutMs;
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Forward a caller-supplied signal to our controller (future-proofing; no caller passes one today).
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm vitest run lib/scan/adapters/fetch-timeout.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scan/adapters/fetch-timeout.ts lib/scan/adapters/fetch-timeout.test.ts
git commit -m "feat(scan): shared fetchWithTimeout helper for all adapters"
```

## Task 1.2: Apply `fetchWithTimeout` to every external adapter

**Files (modify — each is a one-line swap of `fetch(` → `fetchWithTimeout(` + import):**
- `lib/scan/adapters/dataforseo.ts:21`, `dataforseo-rank.ts:46`, `tavily.ts:12`, `site-fetch.ts:16`, `domain-age.ts:12`, `hn-algolia.ts:33,56`, `bluesky.ts:44,66`, `keywords.ts:19`, `itunes.ts:15,40`, `youtube.ts:38`, `app-store-rss.ts:30`, `lib/llm/check-link.ts:36`, `lib/llm/embed.ts:17`.

- [ ] **Step 1: Add the import + swap the call in each file**

For each file, add at the top with the other imports:

```ts
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";
```

(In `lib/llm/check-link.ts` / `lib/llm/embed.ts` the path is the same `@/lib/scan/adapters/fetch-timeout`.)

Then replace the bare `fetch(` with `fetchWithTimeout(`. Two callers need a non-default timeout — DataForSEO **Live** SERP is legitimately slow:

```ts
// lib/scan/adapters/dataforseo.ts:21  and  lib/scan/adapters/dataforseo-rank.ts:46
const res = await fetchWithTimeout("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
  method: "POST",
  headers: { Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword), "content-type": "application/json" },
  body: JSON.stringify([{ /* …unchanged… */ }]),
}, 15_000); // Live SERP p99 is ~10s
```

`app-store-rss.ts:30` is nested — rewrite the inner fetch:

```ts
// lib/scan/adapters/app-store-rss.ts:30
const results = await Promise.allSettled(
  urls.map(async (u) => parseRssPage(await (await fetchWithTimeout(u)).json())),
);
```

All others use the default 8s, e.g.:

```ts
// lib/scan/adapters/site-fetch.ts:16
const res = await fetchWithTimeout(url, { headers: { "user-agent": "ReachKitBot/1.0 (+https://reachkit.app)" } });
// lib/scan/adapters/domain-age.ts:12
const res = await fetchWithTimeout(url);
```

- [ ] **Step 2: Verify every adapter is covered**

Run: `grep -rnE "[^a-zA-Z]fetch\(" lib/scan/adapters lib/llm/check-link.ts lib/llm/embed.ts | grep -v "fetchWithTimeout" | grep -v "\.test\."`
Expected: **no output** (every external fetch now goes through the wrapper).

- [ ] **Step 3: Run the adapter suite + typecheck**

Run: `pnpm vitest run lib/scan/adapters && pnpm typecheck`
Expected: PASS. (Adapter tests stub `global.fetch`, which `fetchWithTimeout` still calls, so they remain green.)

- [ ] **Step 4: Commit**

```bash
git add lib/scan/adapters lib/llm/check-link.ts lib/llm/embed.ts
git commit -m "feat(scan): hard 8s/15s timeout on every external adapter fetch"
```

## Task 1.3: Emit progress events through the findings pipeline

**Files:**
- Modify: `lib/scan/findings-pipeline.ts:38,52,57` (around extract / synth / score).

- [ ] **Step 1: Emit before each stage**

`emitScanEvent(scanId, "artifact", { label, count? })` is the exact signature already used in `collect.ts`. Wrap the three findings stages (the feed renders `artifact` events as live work items):

```ts
// lib/scan/findings-pipeline.ts — inside runFindings, before line 38 (runExtract):
await emitScanEvent(ctx.scanId, "artifact", { label: "Reading your reviews & positioning" });
await runExtract(ctx, extractKinds);

// before line 52 (runSynth):
await emitScanEvent(ctx.scanId, "artifact", { label: "Comparing you to your competitors" });
const synth = await runSynth(ctx);

// before line 57 (discoverabilityScore):
await emitScanEvent(ctx.scanId, "artifact", { label: "Scoring your discoverability" });
const score = discoverabilityScore(facts, keywordSheet);
```

- [ ] **Step 2: Confirm no terminal-event regression**

Run: `pnpm vitest run tests/integration/collect.test.ts lib/scan` (unit subset that imports the pipeline)
Expected: PASS — existing artifact-count assertions (`>= 3`) still hold; new events only add to the feed.

- [ ] **Step 3: Commit**

```bash
git add lib/scan/findings-pipeline.ts
git commit -m "feat(scan): live progress events through the findings stage"
```

## Task 1.4: Emit progress events through the full scan

**Files:**
- Modify: `lib/scan/full-scan.ts:267,274,289` (around action generation / critic / assemble).

- [ ] **Step 1: Emit before each heavy stage**

```ts
// lib/scan/full-scan.ts — inside runFullScan:
await emitScanEvent(ctx.scanId, "artifact", { label: "Drafting your action plan" });
const actions = facts.coldStart
  ? await generateColdStartActions(ctx, facts)
  : await generateActions(ctx, findings);

await emitScanEvent(ctx.scanId, "artifact", { label: "Pressure-testing each recommendation" });
const { passed } = await runCriticGate(ctx, actions, { skipLlm: facts.coldStart });
const safe = await algorithmSafety(ctx, passed);

// before assembleReport (line ~289):
await emitScanEvent(ctx.scanId, "artifact", { label: "Finalising your report" });
const payload = assembleReport({ /* …unchanged… */ });
```

- [ ] **Step 2: Typecheck + run the pipeline tests**

Run: `pnpm typecheck && pnpm vitest run lib/scan`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/scan/full-scan.ts
git commit -m "feat(scan): live progress events through the full-scan stage"
```

---

# Tier 2 — Robust Competitor Discovery

## Task 2.1: Capture SERP descriptions (not just titles)

**Files:**
- Modify: `lib/scan/adapters/dataforseo.ts` (`parseSerp`)
- Test: `lib/scan/adapters/dataforseo.test.ts`

- [ ] **Step 1: Extend the test**

```ts
// add to lib/scan/adapters/dataforseo.test.ts
import { parseSerpContent } from "./dataforseo";

it("parseSerpContent concatenates organic titles + descriptions for LLM extraction", () => {
  const body = { tasks: [{ result: [{ se_results_count: 999, items: [
    { type: "organic", title: "Top 10 Acquire Alternatives", url: "https://g2.com/x",
      description: "Best Acquire alternatives: Fin, Drift, Zendesk and more." },
    { type: "organic", title: "Flippa", url: "https://flippa.com", description: "Buy and sell websites." },
  ] }] }] };
  const text = parseSerpContent(body);
  expect(text).toContain("Fin, Drift, Zendesk");
  expect(text).toContain("Flippa");
});
```

- [ ] **Step 2: Run → fail**

Run: `pnpm vitest run lib/scan/adapters/dataforseo.test.ts`
Expected: FAIL — `parseSerpContent` not exported.

- [ ] **Step 3: Add `parseSerpContent` (keep `parseSerp` unchanged for the URL path)**

```ts
// lib/scan/adapters/dataforseo.ts — add below parseSerp:
/** Flatten organic results' title + description into one block for LLM name extraction. */
export function parseSerpContent(body: unknown): string {
  const result = (body as { tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }> })
    .tasks?.[0]?.result?.[0];
  return (result?.items ?? [])
    .filter((i) => i["type"] === "organic")
    .map((i) => `${String(i["title"] ?? "")} — ${String(i["description"] ?? "")}`.trim())
    .filter((s) => s.length > 2)
    .join("\n");
}
```

- [ ] **Step 4: Run → pass**

Run: `pnpm vitest run lib/scan/adapters/dataforseo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scan/adapters/dataforseo.ts lib/scan/adapters/dataforseo.test.ts
git commit -m "feat(scan): parseSerpContent — flatten SERP snippets for name extraction"
```

## Task 2.2: Capture Tavily answer + content

**Files:**
- Modify: `lib/scan/adapters/tavily.ts`
- Test: `lib/scan/adapters/tavily.test.ts`

- [ ] **Step 1: Extend the test**

```ts
// add to lib/scan/adapters/tavily.test.ts
import { parseTavilyContent } from "./tavily";

it("parseTavilyContent prefers the synthesized answer, then result content", () => {
  const body = {
    answer: "Top Acquire alternatives are Flippa, Empire Flippers, and MicroAcquire.",
    results: [{ title: "Flippa", url: "https://flippa.com", content: "Marketplace to buy/sell sites." }],
  };
  const text = parseTavilyContent(body);
  expect(text).toContain("Flippa, Empire Flippers, and MicroAcquire");
  expect(text).toContain("buy/sell sites");
});
```

- [ ] **Step 2: Run → fail**

Run: `pnpm vitest run lib/scan/adapters/tavily.test.ts`
Expected: FAIL — `parseTavilyContent` not exported.

- [ ] **Step 3: Request the answer + add the content parser**

```ts
// lib/scan/adapters/tavily.ts — request the AI answer:
body: JSON.stringify({ api_key: env.tavilyApiKey, query: `alternatives to ${productName}`, max_results: 5, include_answer: true }),

// add below parseTavily:
/** Synthesized answer + per-result content, for LLM name extraction. */
export function parseTavilyContent(body: unknown): string {
  const b = body as { answer?: string; results?: Array<{ title?: string; content?: string }> };
  const parts: string[] = [];
  if (b.answer) parts.push(b.answer);
  for (const r of b.results ?? []) parts.push(`${r.title ?? ""} — ${r.content ?? ""}`.trim());
  return parts.filter((s) => s.length > 2).join("\n");
}
```

- [ ] **Step 4: Run → pass; Step 5: Commit**

Run: `pnpm vitest run lib/scan/adapters/tavily.test.ts` → PASS.

```bash
git add lib/scan/adapters/tavily.ts lib/scan/adapters/tavily.test.ts
git commit -m "feat(scan): capture Tavily answer + content for name extraction"
```

## Task 2.3: LLM competitor-name extraction (category-anchored) — the core fix

**Files:**
- Create: `lib/llm/competitor-names.ts`
- Test: `lib/llm/competitor-names.test.ts`
- Reference: `lib/llm/json.ts` (`extractJson`), `lib/llm/anthropic.ts` (Haiku call), `lib/scan/types.ts` (`Competitor`).

This reads the persisted SERP+Tavily content and returns real product names **in the subject's category only** — the brand-ambiguity hard rule enforced at the discovery layer. It does **not** trust result URLs/titles (which are listicles).

- [ ] **Step 1: Write the failing test (pure parser + prompt, LLM mocked)**

```ts
// lib/llm/competitor-names.test.ts
import { describe, it, expect } from "vitest";
import { buildCompetitorNamesPrompt, parseCompetitorNames } from "./competitor-names";

describe("competitor-names", () => {
  it("prompt anchors to the subject category and forbids off-category / same-name products", () => {
    const p = buildCompetitorNamesPrompt({
      subjectName: "Acquire",
      subjectHost: "acquire.com",
      category: "marketplace to buy and sell online businesses",
      content: "Top alternatives: Flippa, Empire Flippers, MicroAcquire. Also Acquire.io live chat.",
    });
    expect(p).toContain("acquire.com");
    expect(p).toContain("marketplace to buy and sell online businesses");
    expect(p.toLowerCase()).toContain("same category");
    expect(p.toLowerCase()).toContain("different product that merely shares");
  });

  it("parses names, drops empties, dedupes case-insensitively, caps at 8", () => {
    const json = JSON.stringify({ competitors: [
      { name: "Flippa" }, { name: "flippa" }, { name: "Empire Flippers" }, { name: "" },
    ] });
    const out = parseCompetitorNames(json);
    expect(out.map((c) => c.name)).toEqual(["Flippa", "Empire Flippers"]);
    expect(out[0].source).toBe("llm_extracted");
    expect(out[0].url).toBe("");
  });

  it("returns [] on unparseable model output (never throws)", () => {
    expect(parseCompetitorNames("the competitors are Flippa and ...")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `pnpm vitest run lib/llm/competitor-names.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// lib/llm/competitor-names.ts
import type { Competitor } from "@/lib/scan/types";
import type { ScanContext } from "@/lib/scan/pipeline";
import { callModel } from "@/lib/llm/anthropic";
import { extractJson } from "@/lib/llm/json";
import { fixturesEnabled } from "@/lib/dev/fixtures";

const HAIKU = "claude-haiku-4-5-20251001" as const; // matches MODEL in lib/llm/extract.ts

export interface CompetitorNameInput {
  subjectName: string;
  subjectHost: string;
  category: string;
  content: string;
}

export function buildCompetitorNamesPrompt(i: CompetitorNameInput): string {
  return `You are identifying the real competitors of ONE specific product.

SUBJECT — the ONLY product to analyse:
- Name: ${i.subjectName}
- Site: ${i.subjectHost}
- Category: ${i.category || "(infer from the content)"}

Below is text scraped from "alternatives to ${i.subjectName}" search results. It may
mention products in OTHER categories that merely share the name — IGNORE THOSE.

CONTENT:
${i.content.slice(0, 6000)}

Return ONLY this JSON (no markdown fences):
{ "competitors": [ { "name": "<real product name>" } ] }

Hard rules:
- List up to 8 products that genuinely compete with ${i.subjectName} in the SAME category (${i.category || "the subject's category"}).
- NEVER include a different product that merely shares part of the subject's name.
- NEVER include ${i.subjectName} itself, ${i.subjectHost}, or generic listicle/review sites (g2, capterra, "top 10", "best …").
- Names only — no URLs, no commentary. If nothing genuinely competes, return { "competitors": [] }.`;
}

export function parseCompetitorNames(raw: string): Competitor[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return [];
  }
  const list = (parsed as { competitors?: Array<{ name?: unknown }> }).competitors ?? [];
  const seen = new Set<string>();
  const out: Competitor[] = [];
  for (const c of list) {
    const name = String(c?.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, url: "", source: "llm_extracted", rank: out.length + 1 });
    if (out.length >= 8) break;
  }
  return out;
}

/** Reads the alternatives content and returns category-matched competitor names. Never throws. */
export async function extractCompetitorNames(
  ctx: ScanContext,
  input: CompetitorNameInput,
): Promise<Competitor[]> {
  if (!input.content.trim()) return [];
  if (fixturesEnabled()) return []; // fixtures already provide a clean competitor set
  try {
    const { text } = await callModel({
      model: HAIKU,
      system: "You identify the real competitors of one specific product. Return only JSON, no prose.",
      prompt: buildCompetitorNamesPrompt(input),
      scanId: ctx.scanId,
      stage: "extract",
    });
    return parseCompetitorNames(text);
  } catch {
    return [];
  }
}
```

> **Resolved (controller-verified):** `lib/llm/anthropic.ts` exports `callModel({ model, system, prompt, scanId, stage, maxTokens? }) => { text, usage }`; `stage` union is `"extract"|"synth"|"critic"|"format"` (use `"extract"`). `Competitor.source` is already `string` in `lib/scan/types.ts` — **no type change needed**. `ScanContext` is imported from `@/lib/scan/pipeline` (same as `extract.ts`).

- [ ] **Step 4: Run → pass; Step 5: Commit**

Run: `pnpm vitest run lib/llm/competitor-names.test.ts` → PASS.

```bash
git add lib/llm/competitor-names.ts lib/llm/competitor-names.test.ts
git commit -m "feat(llm): category-anchored competitor-name extraction from content"
```

## Task 2.4: Wire name-extraction into collect + re-rank

**Files:**
- Modify: `lib/scan/collect.ts` (after the `Promise.all` gather, before facts assembly)
- Reference: `lib/scan/tools/find-competitors.ts` (produces the URL-parsed set + persists raw docs), `lib/db/raw-documents.ts` (read helper), `lib/scan/competitors.ts` (`rankCompetitors`).

- [ ] **Step 1: Add the refine step**

After collect has the parsed competitors + listing, read back the persisted SERP/Tavily bodies, extract names, merge, re-rank:

```ts
// lib/scan/collect.ts — new imports
import { extractCompetitorNames } from "@/lib/llm/competitor-names";
import { parseSerpContent } from "@/lib/scan/adapters/dataforseo";
import { parseTavilyContent } from "@/lib/scan/adapters/tavily";
import { serverDb } from "@/lib/db/client";
import { rankCompetitors } from "@/lib/scan/competitors";
import { hostname } from "@/lib/scan/url";

// inside runCollect, web branch only, AFTER `const [listingResult, reviewsResult, competitorsResult] = await Promise.all([...])`:
// (find_competitors already persisted dataforseo_serp + tavily raw docs under subjectKey, so they are readable here.)
let competitors = competitorsResult.competitors;
if (mode === "web") {
  const { data: docs } = await serverDb()
    .from("raw_documents")
    .select("source_type, body")
    .eq("subject_key", subjectKey)
    .in("source_type", ["dataforseo_serp", "tavily"]);
  const content = (docs ?? [])
    .map((d) => (d.source_type === "tavily" ? parseTavilyContent(d.body) : parseSerpContent(d.body)))
    .join("\n")
    .trim();
  const named = await extractCompetitorNames(ctx, {
    subjectName: listingResult.listing.name,
    subjectHost: hostname(storeUrl),
    category: listingResult.listing.category ?? listingResult.listing.description ?? "",
    content,
  });
  if (named.length > 0) {
    competitors = rankCompetitors([...competitors, ...named], {
      selfHost: hostname(storeUrl),
      subjectName: listingResult.listing.name,
    });
    await emitScanEvent(scanId, "artifact", {
      label: `Found ${competitors.length} competitors`,
      count: competitors.length,
    });
  }
}
// …use `competitors` (not competitorsResult.competitors) when assembling facts + persisting.
```

> **Resolved (controller-verified):** there is no generic `raw_documents` read helper — only `upsertRawDocument`. The read pattern above mirrors `lib/llm/extract.ts:113-117` (`serverDb().from("raw_documents").select(...).eq("subject_key", …)`); `extract.ts` keys on `ctx.storeUrl` and `find_competitors` writes with `subject_key: subjectKey`, so in collect they are the same value — keying on `subjectKey` is correct. **Implementer:** confirm `runCollect`'s in-scope variable names (`scanId`, `mode`, `storeUrl`, `subjectKey`, `ctx`) at the call site and that the facts-assembly call + `persistCompetitors` both consume the reassigned `competitors`.

- [ ] **Step 2: Typecheck + the web collect integration test**

Run: `pnpm typecheck && pnpm test:int tests/integration/collect.test.ts`
Expected: PASS — the mocked web test (`extractCompetitorNames` returns `[]` under fixtures/mocks, so the URL-parsed mocked competitors still flow through; `>= 1` competitor holds).

- [ ] **Step 3: Commit**

```bash
git add lib/scan/collect.ts
git commit -m "feat(scan): promote LLM-extracted competitor names into the discovery set"
```

## Task 2.5: Admit `llm_extracted` (empty-URL) + fix rankCompetitors dedup

> **Revised during implementation (controller).** The original plan said to *remove*
> the per-token collision scan in `hasAnyCollision`, on the theory it false-dropped
> common-word rivals (e.g. `MicroAcquire` for "Acquire"). Reading the code disproved
> that: `MicroAcquire` is a single token, so it never sub-collides with "Acquire", and
> removing the scan would **regress** the existing "NUDGE Synonyms & Antonyms" test
> (a non-aggregator reference page caught only by the token scan). So the token scan is
> **kept** (correct brand-safety). The two changes actually needed were:
> 1. **`filterRealCompetitors`** — `llm_extracted` names have `url: ""`; the `if (!host) continue`
>    guard dropped them all. Host-based screens (self, aggregator) now apply only when a host
>    exists; the listicle + collision guards still apply to URL-less names.
> 2. **`rankCompetitors`** — it deduped by `hostname(c.url)`, so every empty-host `llm_extracted`
>    entry collapsed to ONE. Now keyed by host when present, else by normalised name.
> The original Task-2.5 test expectations (MicroAcquire kept, Acquire.io/Nudge.ai dropped,
> llm_extracted admitted) all hold and were implemented, plus a rankCompetitors no-collapse test.
>
> _(original step text below retained for reference)_

**Files:**
- Modify: `lib/scan/competitor-filter.ts` (`hasAnyCollision`, aggregator-host gate)
- Modify: `lib/scan/source-labels.ts` (label for `llm_extracted`)
- Test: `lib/scan/competitor-filter.test.ts`, `lib/scan/source-labels.test.ts`

- [ ] **Step 1: Add the failing tests**

```ts
// add to lib/scan/competitor-filter.test.ts
it("keeps a real rival that contains the subject's common-word name", () => {
  // subject "Acquire" — MicroAcquire is a genuine marketplace rival, not a name collision.
  const out = filterRealCompetitors(
    [{ name: "MicroAcquire", url: "https://microacquire.com", source: "llm_extracted", rank: 1 }],
    { subjectName: "Acquire", selfHost: "acquire.com" },
  );
  expect(out.map((c) => c.name)).toContain("MicroAcquire");
});

it("still drops a same-brand different-TLD impostor", () => {
  const out = filterRealCompetitors(
    [{ name: "Acquire.io", url: "https://acquire.io", source: "dataforseo_serp", rank: 1 }],
    { subjectName: "Acquire", selfHost: "acquire.com" },
  );
  expect(out).toEqual([]);
});

it("still drops a near-identical name (Nudge.ai for Nudgi)", () => {
  const out = filterRealCompetitors(
    [{ name: "Nudge.ai", url: "https://nudge.ai", source: "tavily", rank: 1 }],
    { subjectName: "Nudgi", selfHost: "nudgi.ai" },
  );
  expect(out).toEqual([]);
});

it("admits llm_extracted competitors that carry no URL (past the aggregator-host gate)", () => {
  const out = filterRealCompetitors(
    [{ name: "Flippa", url: "", source: "llm_extracted", rank: 1 }],
    { subjectName: "Acquire", selfHost: "acquire.com" },
  );
  expect(out.map((c) => c.name)).toEqual(["Flippa"]);
});
```

```ts
// add to lib/scan/source-labels.test.ts
it("labels llm_extracted competitors as named-alternatives", () => {
  expect(competitorSourceLabel("llm_extracted")).toMatch(/alternative/i);
});
```

- [ ] **Step 2: Run → fail**

Run: `pnpm vitest run lib/scan/competitor-filter.test.ts lib/scan/source-labels.test.ts`
Expected: FAIL — MicroAcquire dropped by the token rule; `llm_extracted` empty-URL dropped by the host gate; no label.

- [ ] **Step 3: Narrow `hasAnyCollision` + admit empty-URL llm_extracted**

In `lib/scan/competitor-filter.ts`, reduce `hasAnyCollision` to whole-name + host-brand only (delete the per-token `≥4-char word` scan that caused common-word false-drops — the whole-name Levenshtein and host-brand checks already catch the real impostor case):

```ts
// hasAnyCollision: keep ONLY these two checks
function hasAnyCollision(competitorName: string, competitorHost: string, subjectName: string): boolean {
  if (isNameCollision(competitorName, subjectName)) return true;           // whole-name Levenshtein ≤ 2
  const brand = registrableBrand(competitorHost);                          // existing host-brand helper
  if (brand && isNameCollision(brand, subjectName)) return true;           // acquire.io / nudge.ai
  return false; // ← removed: the broad per-word token scan
}
```

In the aggregator-host gate, skip the host check when there is no URL (LLM-extracted names have `url: ""`); keep the name-collision check applied to them:

```ts
// where each candidate is screened:
const host = c.url ? hostname(c.url) : "";
if (host && isAggregatorHost(host)) continue;        // only screen hosts we actually have
if (hasAnyCollision(c.name, host, opts.subjectName)) continue;
```

- [ ] **Step 4: Add the source label**

```ts
// lib/scan/source-labels.ts — add to the competitorSourceLabel map:
llm_extracted: "Named as a top alternative",
```

- [ ] **Step 5: Run → pass (incl. the existing brand-collision regressions)**

Run: `pnpm vitest run lib/scan/competitor-filter.test.ts lib/scan/source-labels.test.ts`
Expected: PASS — MicroAcquire kept; Acquire.io & Nudge.ai still dropped; llm_extracted kept + labeled.

- [ ] **Step 6: Commit**

```bash
git add lib/scan/competitor-filter.ts lib/scan/source-labels.ts lib/scan/competitor-filter.test.ts lib/scan/source-labels.test.ts
git commit -m "fix(scan): collision filter no longer false-drops common-word rivals; admit llm_extracted"
```

## Task 2.6: ~~Remove the competitor_gap skip~~ → RETAINED BY DESIGN (no change)

**Decision (controller, during Unit E):** the findings-pipeline gate
(`facts.competitors.length > 0 ? run-all : ground-site-only` + stale-sheet clear)
is **kept as-is**. The original plan proposed removing it, on the theory it was
what zeroed acquire.com's gap sheet. Re-analysis with `collect.ts` in hand shows
the true root cause was `facts.competitors` being empty — which **Unit E now fixes**
by feeding category-anchored, content-extracted names into `facts.competitors`
*before* findings runs. With that, the gate opens naturally for legitimate subjects
(acquire.com → Flippa/Empire Flippers/MicroAcquire populate it → `competitor_gap`
runs) and correctly stays closed for genuine brand-collisions / cold subjects
(nudgi.ai → `extractCompetitorNames` returns `[]` in-category → ground site-only,
no contamination). **Removing the gate would re-open the brand-ambiguity hole** the
gate exists to close (the spec's hard rule). So this task is a deliberate no-op;
the gate is the correct backstop and Unit E is the real fix. Verified end-to-end in Task 4.

---

# Tier 3 — Coverage (Web Reviews) & Cold-Start Recalibration

## Task 3.1: Web-reviews collector

**Files:**
- Create: `lib/scan/adapters/web-reviews.ts`
- Test: `lib/scan/adapters/web-reviews.test.ts`
- Reference: `lib/scan/adapters/tavily.ts`, `dataforseo.ts`, `lib/dev/fixtures.ts`.

- [ ] **Step 1: Write the failing test (parser pure; network mocked)**

```ts
// lib/scan/adapters/web-reviews.test.ts
import { describe, it, expect } from "vitest";
import { parseWebReviewSnippets } from "./web-reviews";

describe("parseWebReviewSnippets", () => {
  it("extracts review-bearing snippets from a Tavily-style body", () => {
    const body = {
      answer: "Users praise Acquire's vetted listings; some cite high fees.",
      results: [{ title: "Acquire reviews — Trustpilot", url: "https://trustpilot.com/acquire", content: "4.2/5 from 380 reviews. Great support." }],
    };
    const out = parseWebReviewSnippets(body);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.join(" ")).toMatch(/vetted listings|380 reviews/);
  });

  it("returns [] for an empty body (never throws)", () => {
    expect(parseWebReviewSnippets({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run → fail; Step 3: Implement**

```ts
// lib/scan/adapters/web-reviews.ts
import { env } from "@/lib/config/env";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

export function parseWebReviewSnippets(body: unknown): string[] {
  const b = body as { answer?: string; results?: Array<{ title?: string; content?: string }> };
  const out: string[] = [];
  if (b.answer) out.push(b.answer);
  for (const r of b.results ?? []) {
    const s = `${r.title ?? ""} — ${r.content ?? ""}`.trim();
    if (s.length > 3) out.push(s);
  }
  return out;
}

/** Best-effort web review snippets via Tavily "{brand} reviews". Never throws; [] on any failure. */
export async function fetchWebReviews(brand: string): Promise<{ snippets: string[]; raw: unknown }> {
  if (fixturesEnabled()) return { snippets: [], raw: { skipped: "fixtures" } };
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ api_key: env.tavilyApiKey, query: `${brand} reviews`, max_results: 5, include_answer: true }),
    });
    if (!res.ok) return { snippets: [], raw: null };
    const body = await res.json();
    return { snippets: parseWebReviewSnippets(body), raw: body };
  } catch {
    return { snippets: [], raw: null };
  }
}
```

- [ ] **Step 4: Run → pass; Step 5: Commit**

Run: `pnpm vitest run lib/scan/adapters/web-reviews.test.ts` → PASS.

```bash
git add lib/scan/adapters/web-reviews.ts lib/scan/adapters/web-reviews.test.ts
git commit -m "feat(scan): web-reviews collector (Tavily {brand} reviews)"
```

## Task 3.2: Wire web reviews into collect + review_themes

**Files:**
- Modify: `lib/scan/collect.ts:62-64` (web reviews branch) + raw-doc persist
- Modify: `lib/llm/extract.ts` (add `"web_reviews"` to the review source set)

- [ ] **Step 1: Replace the empty web reviews promise**

```ts
// lib/scan/collect.ts — web branch
import { fetchWebReviews } from "@/lib/scan/adapters/web-reviews";

const reviewsPromise = (
  mode === "web"
    ? fetchWebReviews(/* brand */ "").then(async (r) => {
        if (r.snippets.length > 0) {
          await upsertRawDocument({
            subjectType: "web", subjectKey, sourceType: "web_reviews", body: r.raw, mode,
          });
        }
        // map snippets → ReviewItem[] so reviewVolume + review_themes see them
        // ReviewItem = { id?, rating: number|null, title: string, body: string, at? }
        return { reviews: r.snippets.map((s, i) => ({ id: `web-${i}`, rating: null, title: "Web review", body: s })) as ReviewItem[] };
      })
    : /* …unchanged app/play branch… */
)
```

> **Implementer note:** the brand must be known before this runs. Today reviews + listing fetch in parallel (`collect.ts:101`). Either (a) pass the host-derived brand (`hostname(storeUrl)` without TLD) into `fetchWebReviews` so it needs no listing dependency, or (b) move the web-reviews fetch into the same post-`Promise.all` refine step as Task 2.4 (where `listingResult.listing.name` is known) — **(b) is preferred** for a clean brand. Match `ReviewItem`'s real shape in `lib/scan/types.ts` (fields may be `text`/`title`/`rating`); adjust the mapping accordingly.

- [ ] **Step 2: Let review_themes read web_reviews**

```ts
// lib/llm/extract.ts:33 — add web_reviews to the review source set
const REVIEW_SOURCES = Object.freeze(["app_store_rss", "web_reviews"] as const); // was ["app_store_rss"]
```

> **Resolved (controller-verified):** the constant is `REVIEW_SOURCES` at `lib/llm/extract.ts:33`, currently `Object.freeze(["app_store_rss"] as const)`. `reviewRows` (line 130) filters on it; no other change needed.

- [ ] **Step 3: Typecheck + web collect integration test**

Run: `pnpm typecheck && pnpm test:int tests/integration/collect.test.ts`
Expected: PASS (fixtures/mock → snippets `[]` → `reviewVolume >= 0` still holds).

- [ ] **Step 4: Commit**

```bash
git add lib/scan/collect.ts lib/llm/extract.ts
git commit -m "feat(scan): web reviews flow into reviewVolume + review_themes"
```

## Task 3.3: Recalibrate web cold-start

**Files:**
- Modify: `lib/scan/cold-start.ts` (web logic)
- Test: `lib/scan/cold-start.test.ts`

Replace the `serpResultCount<1000 && phUpvotes<25 && age<1` heuristic. New web logic:
1. **Established-domain short-circuit:** a known domain age ≥ 1y is never pre-launch cold-start.
2. Otherwise cold-start only when there is **no competitive/theme footprint** (`competitors.length === 0 && themes.length === 0`).
3. `null` domain age is **unknown**, not "new" — it no longer forces cold-start. The niche `serpResultCount` and always-zero `phUpvotes` are dropped from the decision.

- [ ] **Step 1: Write the failing tests**

```ts
// add to lib/scan/cold-start.test.ts
import { isColdStart } from "./cold-start";

const webFacts = (over: Partial<any> = {}): any => ({
  mode: "web", competitors: [], themes: [], reviewVolume: 0,
  webProxy: { score: 9, serpResultCount: 104, phUpvotes: 0, domainAgeYears: null }, ...over,
});

it("established web domain (age ≥ 1y) is NOT cold-start, even with a thin niche SERP", () => {
  expect(isColdStart(webFacts({ webProxy: { score: 30, serpResultCount: 104, phUpvotes: 0, domainAgeYears: 8 } }))).toBe(false);
});

it("acquire.com-style: competitors found → NOT cold-start (age unknown)", () => {
  expect(isColdStart(webFacts({ competitors: [{ name: "Flippa", url: "", source: "llm_extracted", rank: 1 }] }))).toBe(false);
});

it("nudgi.ai-style: no competitors, no themes, new/unknown domain → cold-start", () => {
  expect(isColdStart(webFacts())).toBe(true);
});

it("does NOT treat unknown domain age as 'new' on its own when a footprint exists", () => {
  expect(isColdStart(webFacts({ themes: [{ label: "meeting prep" }] }))).toBe(false);
});
```

- [ ] **Step 2: Run → fail**

Run: `pnpm vitest run lib/scan/cold-start.test.ts`
Expected: FAIL — current logic flags the established + competitors cases as cold-start.

- [ ] **Step 3: Rewrite the web branch**

```ts
// lib/scan/cold-start.ts
const COLD_START_MAX_DOMAIN_AGE_YEARS = 1; // (existing)

export function isColdStart(facts: PreliminaryFacts): boolean {
  // App / Play: judged on rating volume (unchanged).
  if (facts.mode === "ios" || facts.mode === "android") {
    if (hasEffectivelyNoSignal(facts)) return true;
    return facts.reviewVolume < COLD_START_MIN_REVIEWS;
  }

  // Web:
  const proxy = facts.webProxy;
  // 1. A known, established domain is never pre-launch cold-start.
  if (proxy?.domainAgeYears != null && proxy.domainAgeYears >= COLD_START_MAX_DOMAIN_AGE_YEARS) return false;
  // 2. Otherwise: cold-start only when there is no competitive AND no review/theme footprint.
  //    (niche serpResultCount and disabled-PH phUpvotes are deliberately NOT used.)
  return facts.competitors.length === 0 && facts.themes.length === 0;
}
```

Delete `isWebFootprintNegligible` (and the now-unused `COLD_START_MAX_SERP_RESULTS` / `COLD_START_MAX_PH_UPVOTES` constants). Keep `hasEffectivelyNoSignal` for the app/play branch.

- [ ] **Step 4: Run → pass + full unit suite**

Run: `pnpm vitest run lib/scan/cold-start.test.ts && pnpm vitest run`
Expected: PASS (all suites; ~570 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scan/cold-start.ts lib/scan/cold-start.test.ts
git commit -m "fix(scan): web cold-start on domain age + footprint, not niche SERP/PH"
```

---

# Task 4: End-to-end validation (live, fixtures=false)

**Files:** none — verification only. Requires the dev stack (`pnpm dev:all`: Next :3000, Inngest :8288, Supabase :54322) and funded Anthropic + verified DataForSEO.

- [ ] **Step 1: Eval gate (golden datasets unaffected)**

Run: `pnpm eval && pnpm vitest run`
Expected: PASS — the 5 fixtures (`nudgi`, `bearable`, `opal`, `cardpointers`, `sofa`) still pass; fixtures short-circuit the new LLM/Tavily paths so golden output is unchanged.

- [ ] **Step 2: Live acquire.com scan (the regression target)**

Trigger a scan for `acquire.com`, then inspect via DB:

```bash
# scan_events timing — the feed must move continuously (no >15s silent gap)
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
"select type, payload->>'label' as label, created_at from scan_events where scan_id='<id>' order by id;"
```

Expected: artifact labels stream through *all* stages ("Read your product page" → reviews → competitors → "Reading your reviews & positioning" → "Comparing you to your competitors" → "Scoring…" → "Drafting your action plan" → "Pressure-testing…" → "Finalising…" → `report`); **real competitors** (Flippa / Empire Flippers / MicroAcquire-class, **not** g2/listicles); review themes present; **not** Cold Start; total tool stage < ~20s.

- [ ] **Step 3: Live nudgi.ai scan (brand-ambiguity + always-insight regression)**

Expected: still correctly understood as a meeting-prep tool; **zero** "Nudge.ai" contamination; competitors honestly `[]`; still Cold Start (new domain, no footprint) → cold-start action plan; positioning mirror present (always-insight floor).

- [ ] **Step 4: Cost check**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
"select stage, sum(cost_cents) from pipeline_runs where scan_id='<id>' group by stage order by 2 desc;"
```

Expected: free scan within budget — the added Haiku name-extraction (~1 call) + 1 Tavily reviews call keep it well under the §13 $0.50 free ceiling (target ≤ ~12¢).

- [ ] **Step 5: Final review + commit summary**

Dispatch the code-reviewer agent over the Tier 1–3 diff (timeouts, discovery, cold-start). Address any blocker. The branch is then ready; report results to Tim (do **not** merge to `main` without his say-so).

---

## Self-Review (plan vs. the acquire.com symptoms)

| Symptom | Addressed by |
|---|---|
| 60s hung fetch | Task 1.1–1.2 (8s/15s timeouts on every adapter) |
| ~40s frozen feed | Task 1.3–1.4 (progress events at every stage seam) |
| Competitors = listicle titles → all filtered | Task 2.1–2.4 (extract real names from snippet/answer content) |
| Common-word brand zeroes the set | Task 2.5 (narrowed collision filter) |
| LLM could name competitors but was skipped | Task 2.3 (promote to discovery set) + 2.6 (stop skipping gap extract) |
| 0 web reviews | Task 3.1–3.2 (web-reviews collector → review_themes) |
| Established site flagged Cold Start | Task 3.3 (domain-age short-circuit + footprint-based) |
| Brand-ambiguity must hold throughout | Task 2.3 category anchor + 2.5 collision tests + 2.6 note + Task 4 nudgi.ai re-test |
| Always give insight when live | Existing positioning floor preserved; Task 4 nudgi.ai verifies |

**Type-consistency check:** `Competitor.source` is already typed `string` (`lib/scan/types.ts:3`), so `"llm_extracted"` needs no type change — used identically in filter (2.5), label (2.5), and collect merge (2.4). `parseSerpContent`/`parseTavilyContent`/`parseWebReviewSnippets` are new pure exports consumed only where defined-and-tested. `fetchWithTimeout` signature is stable across all 2.x/3.x callers. Cold-start drops `COLD_START_MAX_SERP_RESULTS`/`COLD_START_MAX_PH_UPVOTES`/`isWebFootprintNegligible` — confirm no other importer references them before deleting.
