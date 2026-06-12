# ReachKit Phase 1b — Scan Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a pasted App Store or website URL into a live data-pull feed and a preliminary **facts** screen in under 10 seconds — real adapters, real evidence rows, real cost telemetry — across both app and web modes.

**Architecture:** The `scan/requested` Inngest function runs Stage 0 COLLECT: it selects per-mode adapters (app: iTunes + review RSS; web: site-fetch + DataForSEO SERP + Product Hunt + domain-age), fetches in parallel under a `ScanBudget`, writes every item to `raw_documents` + `evidence`, and appends progress to `scan_events`. It then assembles **facts only** (category, top competitors, review volume/rating trend or web traffic-proxy, word-level review themes — no LLM, no claims) and emits a `facts` event. The funnel page streams `scan_events` over SSE and renders the working feed then the facts. This is the "facts fast, claims later" rule (§5.1); insight (LLM findings) is Phase 2.

**Tech Stack:** Inngest · DataForSEO (Live SERP) · iTunes Search API · App Store review RSS · Product Hunt GraphQL · Wayback CDX · Tavily · Supabase · Next.js SSE.

**Spec refs:** §4.1 (modes), §5.1 (funnel 0–10s), §5.2 (input router + competitor discovery), §5.5 (API), §6 (source empiricism), §8 (sources matrix + tiers), §9.1 Stage 0, §9.4 tools, §19 #7 (web proxy). Builds on `docs/plans/2026-06-11-phase-1a-foundation.md`.

**Acceptance gate (Cycle 1):** paste any App Store or website URL → facts screen renders **<10s p95** for the three fixtures (ReachKit + Nudgi web; Sofa app); every fetch landed in `raw_documents`; a `pipeline_runs` row exists per external call; the scan stays within the `ScanBudget` call/cents caps.

**Conventions (continued from 1a):** `pnpm`, `vitest`, TS strict, co-located `*.test.ts` for unit + mocked-contract tests (run in CI), `tests/integration/` for live-API + pipeline tests (run locally with credentials, **not** in CI — they cost money and hit third parties), commit per task.

**Interfaces consumed from 1a (do not redefine):** `classifyUrl`/`Platform`/`RoutedInput` (`lib/scan/router.ts`); `ScanContext`/`runCollect`/`SCAN_STAGES` (`lib/scan/pipeline.ts`); `ScanBudget`/`BudgetExceededError`/`ToolDefinition`/`ToolContext`/`registry`/`ToolName` (`lib/tools/registry.ts`); `recordPipelineRun`/`anthropicCostCents` (`lib/telemetry/pipeline-runs.ts`); `upsertRawDocument`/`contentHash` (`lib/db/raw-documents.ts`); `serverDb` (`lib/db/client.ts`); `env` (`lib/config/env.ts`); `inngest` (`lib/inngest/client.ts`).

**Scope note vs decomposition §3.1:** Phase 1b implements the four D-tools the <10s facts path needs — `get_listing`, `get_reviews`, `find_competitors`, `search_web`. The remaining three (`search_keywords`, `find_communities`, `find_creators`) fetch data for the *full* collect that feeds LLM findings, so they move to Cycle 2 with the findings pipeline. (Decomposition §3.1 updated to match.)

## Cycle 0 Learnings — apply throughout (verified building the foundation)

These stack realities were discovered building Cycle 0 and **override any conflicting code in the tasks below**:

1. **Inngest v4 `createFunction`** is the 2-arg form with triggers in the config: `inngest.createFunction({ id, retries, triggers: [{ event: "scan/requested" }] }, async ({ event, step }) => {…})`. The 3-arg `(config, trigger, handler)` form in Task 14 below is v3 — use v4.
2. **Type the Inngest events** so `event.data.scanId` needs no cast. In `lib/inngest/client.ts`: `new Inngest({ id: "reachkit", schemas: new EventSchemas().fromRecord<{ "scan/requested": { data: { scanId: string } }; "scan/demo.requested": { data: { scanId?: string } } }>() })` (verify the exact `EventSchemas` API against the installed inngest types).
3. **Next 16 `cacheComponents` forbids `export const dynamic`.** The SSE route (Task 15) must NOT set `export const dynamic = "force-dynamic"` (Turbopack rejects it). `export const maxDuration = 60` is fine; streaming + runtime data make the route dynamic on its own.
4. **Dynamic route params are a Promise** — `async … { const { id } = await params }` with `params: Promise<{ id: string }>`. (Already written this way below — keep it; don't simplify to sync, which renders `undefined`.)
5. **Migrations:** `supabase migration new <name>` (timestamped); apply with `supabase db reset`. Add an index for any new FK column.
6. **Deps:** `pnpm add` works at the repo root (`.npmrc` has `ignore-workspace-root-check=true`). New runtime dep this cycle: `node-html-parser`.
7. **Env + integration tests:** integration tests import code that reads the lazy `env` Proxy, so `.env.local` must hold a value for EVERY schema key. When Task 1 adds `PRODUCT_HUNT_TOKEN`/`DATAFORSEO_LOCATION_CODE`/`DATAFORSEO_LANGUAGE_CODE`, add stub values to `.env.local` and update the `env.test.ts` valid-config fixture.
8. **Regenerate DB types after the migration:** `supabase gen types typescript --local > lib/db/types.ts` — the installed CLI v2.26.9 prepends/append a couple of diagnostic lines; strip them so the file starts at `export type Json`.
9. **`ScanContext` already exists** (`{scanId, appId, mode, budget}`); Task 12 extends it (+`emit`, +`storeUrl`) — extend, don't redefine.
10. **Test boundary:** mock external calls (vendor adapters / `inngest.send`) in CI unit tests; real Supabase local for integration; live-vendor tests local-only (not CI). The Inngest function is tested via `@inngest/test`'s `InngestTestEngine` (real execution, no dev server).

---

## File Structure (created/modified in this plan)

```
lib/scan/
  types.ts                       # CREATE shared scan-domain types
  adapters/
    itunes.ts                    # CREATE app metadata + keyword-overlap competitors
    app-store-rss.ts             # CREATE ~500 recent reviews
    site-fetch.ts                # CREATE web positioning/category
    dataforseo.ts                # CREATE client + Live SERP "alternatives" + SERP count
    product-hunt.ts              # CREATE reviews + upvotes (web)
    domain-age.ts                # CREATE Wayback CDX first-snapshot age (web proxy)
    tavily.ts                    # CREATE agentic "alternatives to" search
    select.ts                    # CREATE platform → adapter set (§4.1)
  themes.ts                      # CREATE word-level review themes (facts, no LLM)
  web-proxy.ts                   # CREATE traffic-proxy composite (§19 #7)
  competitors.ts                 # CREATE rank + dedupe + persist competitor_set
  collect.ts                     # CREATE Stage 0 orchestration
  facts.ts                       # CREATE preliminary facts assembly
  progress.ts                    # CREATE scan_events emitter
  pipeline.ts                    # MODIFY ScanContext (+emit, +storeUrl); implement runCollect
  tools/
    get-listing.ts get-reviews.ts find-competitors.ts search-web.ts  # CREATE D-tool bodies
lib/config/env.ts                # MODIFY add PRODUCT_HUNT_TOKEN + DataForSEO locale defaults
lib/inngest/functions/scan-requested.ts  # CREATE the real pipeline function
app/api/inngest/route.ts         # MODIFY register scanRequested
app/api/scan/route.ts            # MODIFY send scan/requested
app/api/scan/[id]/stream/route.ts# MODIFY stream real scan_events
app/(funnel)/scan/[id]/page.tsx  # MODIFY working feed + facts screen (SSE consumer)
supabase/migrations/0005_scan_events.sql  # CREATE scan_events + scans.preliminary_facts
```

---

## Task 1: Migration — `scan_events` + `preliminary_facts`; env additions

**Files:**
- Create: `supabase/migrations/0005_scan_events.sql`, `lib/scan/types.ts`
- Modify: `lib/config/env.ts`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0005_scan_events.sql`:
```sql
create table scan_events (
  id bigint generated always as identity primary key,
  scan_id uuid not null references scans(id) on delete cascade,
  type text not null check (type in ('artifact','facts','done','error')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index scan_events_scan_idx on scan_events (scan_id, id);
alter table scan_events enable row level security;  -- service-role only; SSE reads via service client

alter table scans add column preliminary_facts jsonb;
```

- [ ] **Step 2: Shared scan-domain types**

`lib/scan/types.ts`:
```ts
import type { Platform } from "@/lib/scan/router";

export interface Competitor { name: string; url: string; source: string; rank: number; }
export interface ReviewItem { rating: number | null; title: string; body: string; at?: string; }
export interface ListingFacts { name: string; category: string | null; description: string | null; pricing?: string | null; }
export interface ThemeCount { term: string; count: number; }
export interface WebProxy { score: number; serpResultCount: number; phUpvotes: number; domainAgeYears: number | null; }
export interface PreliminaryFacts {
  mode: Platform;
  listing: ListingFacts;
  competitors: Competitor[];
  reviewVolume: number;
  ratingTrend: number | null;     // app mode: avg rating; null in web mode
  webProxy: WebProxy | null;      // web mode only
  themes: ThemeCount[];
  sourcesUsed: string[];          // §6 source empiricism: which sources fed this scan
}
export type ScanEventType = "artifact" | "facts" | "done" | "error";
export interface ScanEvent { type: ScanEventType; payload: Record<string, unknown>; }
```

- [ ] **Step 3: Extend env**

In `lib/config/env.ts` add to the zod schema and the returned object:
```ts
  PRODUCT_HUNT_TOKEN: z.string().min(1),
  DATAFORSEO_LOCATION_CODE: z.coerce.number().int().default(2840), // US
  DATAFORSEO_LANGUAGE_CODE: z.string().default("en"),
```
Return as `productHuntToken`, `dataforseoLocationCode`, `dataforseoLanguageCode`. Add the keys to `.env.example`. Update `lib/config/env.test.ts`'s valid-config fixture to include `PRODUCT_HUNT_TOKEN: "ph"` so it still passes.

- [ ] **Step 4: Apply + verify**

Run: `pnpm dlx supabase migration up && pnpm test lib/config/env.test.ts`
Expected: migration applies; env tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scan_events table, preliminary_facts column, Product Hunt + DataForSEO locale env"
```

---

## Task 2: iTunes adapter (app metadata + keyword-overlap competitors)

**Files:**
- Create: `lib/scan/adapters/itunes.ts`, `lib/scan/adapters/itunes.test.ts`

- [ ] **Step 1: Write the failing test (mocked fetch — contract test)**

`lib/scan/adapters/itunes.test.ts`:
```ts
import { expect, test, vi, beforeEach } from "vitest";
import { appIdFromUrl, fetchItunesListing } from "./itunes";

beforeEach(() => vi.restoreAllMocks());

test("appIdFromUrl extracts the trackId", () => {
  expect(appIdFromUrl("https://apps.apple.com/us/app/sofa/id1276554886")).toBe("1276554886");
});

test("fetchItunesListing maps results[0] to ListingFacts", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    resultCount: 1,
    results: [{ trackName: "Sofa", primaryGenreName: "Lifestyle", description: "Downtime organizer",
                averageUserRating: 4.8, userRatingCount: 1200, sellerName: "Shawn Hickman" }],
  }))));
  const r = await fetchItunesListing("1276554886");
  expect(r.listing.name).toBe("Sofa");
  expect(r.listing.category).toBe("Lifestyle");
  expect(r.ratingCount).toBe(1200);
});
```

- [ ] **Step 2: Run — expect FAIL** · Run: `pnpm test lib/scan/adapters/itunes.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `lib/scan/adapters/itunes.ts`**

```ts
import type { ListingFacts, Competitor } from "@/lib/scan/types";

export function appIdFromUrl(url: string): string {
  const m = url.match(/\/id(\d+)/);
  if (!m) throw new Error(`no app id in url: ${url}`);
  return m[1];
}

export async function fetchItunesListing(appId: string): Promise<{ listing: ListingFacts; rating: number | null; ratingCount: number; raw: unknown; }> {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${appId}&country=us`);
  const json = (await res.json()) as { results: Array<Record<string, unknown>> };
  const a = json.results?.[0] ?? {};
  return {
    listing: { name: String(a.trackName ?? ""), category: (a.primaryGenreName as string) ?? null, description: (a.description as string) ?? null },
    rating: (a.averageUserRating as number) ?? null,
    ratingCount: Number(a.userRatingCount ?? 0),
    raw: a,
  };
}

// Competitor discovery via keyword-overlap search (Tier A, §5.2). entity=software, same store.
export async function fetchItunesCompetitors(term: string, excludeId: string): Promise<Competitor[]> {
  const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=software&limit=8&country=us`);
  const json = (await res.json()) as { results: Array<Record<string, unknown>> };
  return (json.results ?? [])
    .filter((r) => String(r.trackId) !== excludeId)
    .map((r, i) => ({ name: String(r.trackName ?? ""), url: String(r.trackViewUrl ?? ""), source: "itunes_search", rank: i + 1 }));
}
```
*Confirm field names against a live `itunes.apple.com/lookup` response at build (they are stable, documented).*

- [ ] **Step 4: Run — expect PASS** · `pnpm test lib/scan/adapters/itunes.test.ts` → pass.
- [ ] **Step 5: Commit** · `git commit -am "feat: iTunes adapter — listing + keyword-overlap competitors"`

---

## Task 3: App Store review RSS adapter

**Files:**
- Create: `lib/scan/adapters/app-store-rss.ts`, `lib/scan/adapters/app-store-rss.test.ts`

- [ ] **Step 1: Write the failing test (mocked one-page RSS JSON)**

```ts
import { expect, test, vi } from "vitest";
import { parseRssPage, fetchAppReviews } from "./app-store-rss";

test("parseRssPage maps entries to ReviewItem[]", () => {
  const page = { feed: { entry: [
    { "im:rating": { label: "5" }, title: { label: "Love it" }, content: { label: "Great app" } },
    { "im:rating": { label: "2" }, title: { label: "Meh" }, content: { label: "Crashes a lot" } },
  ] } };
  const out = parseRssPage(page);
  expect(out).toHaveLength(2);
  expect(out[1]).toMatchObject({ rating: 2, title: "Meh", body: "Crashes a lot" });
});

test("parseRssPage tolerates the leading metadata entry (no im:rating)", () => {
  const page = { feed: { entry: [{ title: { label: "App meta" } }, { "im:rating": { label: "4" }, title: { label: "ok" }, content: { label: "fine" } }] } };
  expect(parseRssPage(page)).toHaveLength(1); // entries without a rating are dropped
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/scan/adapters/app-store-rss.ts`**

```ts
import type { ReviewItem } from "@/lib/scan/types";

type RssEntry = { "im:rating"?: { label: string }; title?: { label: string }; content?: { label: string } };
export function parseRssPage(page: unknown): ReviewItem[] {
  const entries = ((page as { feed?: { entry?: RssEntry[] } }).feed?.entry ?? []);
  return entries
    .filter((e) => e["im:rating"]?.label != null)
    .map((e) => ({ rating: Number(e["im:rating"]!.label), title: e.title?.label ?? "", body: e.content?.label ?? "" }));
}

// ~500 recent reviews = 10 pages × ~50, fetched in parallel.
export async function fetchAppReviews(appId: string, pages = 10): Promise<ReviewItem[]> {
  const urls = Array.from({ length: pages }, (_, i) =>
    `https://itunes.apple.com/us/rss/customerreviews/page=${i + 1}/id=${appId}/sortby=mostrecent/json`);
  const results = await Promise.allSettled(urls.map(async (u) => parseRssPage(await (await fetch(u)).json())));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** · `git commit -am "feat: App Store review RSS adapter (~500 recent reviews)"`

---

## Task 4: Word-level themes extractor (facts, no LLM)

**Files:**
- Create: `lib/scan/themes.ts`, `lib/scan/themes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { extractThemes } from "./themes";

test("extractThemes returns top terms by frequency, stopwords removed", () => {
  const reviews = [{ rating: 5, title: "", body: "onboarding is confusing" }, { rating: 2, title: "", body: "the onboarding confused me, onboarding flow" }];
  const themes = extractThemes(reviews as never, 3);
  expect(themes[0].term).toBe("onboarding");
  expect(themes[0].count).toBe(3);
  expect(themes.map((t) => t.term)).not.toContain("the"); // stopword removed
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/scan/themes.ts`**

```ts
import type { ReviewItem, ThemeCount } from "@/lib/scan/types";

const STOP = new Set("the a an and or but is are was were be been to of in on for it its this that i you me my we app".split(" "));
export function extractThemes(reviews: ReviewItem[], top = 12): ThemeCount[] {
  const counts = new Map<string, number>();
  for (const r of reviews) {
    for (const tok of `${r.title} ${r.body}`.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
      if (STOP.has(tok)) continue;
      counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count).slice(0, top);
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** · `git commit -am "feat: word-level review-theme extractor (facts, no LLM)"`

---

## Task 5: Site-fetch adapter (web positioning/category)

**Files:**
- Create: `lib/scan/adapters/site-fetch.ts`, `lib/scan/adapters/site-fetch.test.ts`

- [ ] **Step 1: Write the failing test (parse a small HTML string)**

```ts
import { expect, test } from "vitest";
import { parseListingHtml } from "./site-fetch";

test("parseListingHtml pulls title, meta description, h1", () => {
  const html = `<html><head><title>Nudgi — habit nudges</title>
    <meta name="description" content="Gentle reminders that build habits"></head>
    <body><h1>Build habits without willpower</h1></body></html>`;
  const r = parseListingHtml(html, "https://nudgi.app");
  expect(r.name).toContain("Nudgi");
  expect(r.description).toBe("Gentle reminders that build habits");
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/scan/adapters/site-fetch.ts`**

```ts
import { parse } from "node-html-parser";
import type { ListingFacts } from "@/lib/scan/types";

export function parseListingHtml(html: string, url: string): ListingFacts {
  const root = parse(html);
  const title = root.querySelector("title")?.text?.trim() ?? new URL(url).hostname;
  const desc = root.querySelector('meta[name="description"]')?.getAttribute("content")
            ?? root.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? null;
  const h1 = root.querySelector("h1")?.text?.trim() ?? null;
  return { name: title, category: null, description: desc ?? h1 };
}

export async function fetchSiteListing(url: string): Promise<{ listing: ListingFacts; raw: string }> {
  const res = await fetch(url, { headers: { "user-agent": "ReachKitBot/1.0 (+https://reachkit.app)" } });
  const html = await res.text();
  return { listing: parseListingHtml(html, url), raw: html.slice(0, 200_000) };
}
```
Run `pnpm add node-html-parser`.

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** · `git commit -am "feat: site-fetch adapter for web-mode positioning"`

---

## Task 6: DataForSEO client + Live SERP "alternatives"

**Files:**
- Create: `lib/scan/adapters/dataforseo.ts`, `lib/scan/adapters/dataforseo.test.ts`

- [ ] **Step 1: Write the failing test (mocked DataForSEO response)**

```ts
import { expect, test, vi } from "vitest";
import { parseSerp, serpAuthHeader } from "./dataforseo";

test("serpAuthHeader builds Basic auth from login:password", () => {
  expect(serpAuthHeader("user", "pass")).toBe(`Basic ${Buffer.from("user:pass").toString("base64")}`);
});

test("parseSerp extracts organic competitors + result count", () => {
  const body = { tasks: [{ result: [{ se_results_count: 1234000, items: [
    { type: "organic", title: "Best Nudgi alternatives", url: "https://habitify.me", domain: "habitify.me" },
    { type: "people_also_ask" },
    { type: "organic", title: "Nudgi vs Streaks", url: "https://streaksapp.com", domain: "streaksapp.com" },
  ] }] }] };
  const r = parseSerp(body, "nudgi");
  expect(r.serpResultCount).toBe(1234000);
  expect(r.competitors.map((c) => c.url)).toEqual(["https://habitify.me", "https://streaksapp.com"]);
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/scan/adapters/dataforseo.ts`**

```ts
import type { Competitor } from "@/lib/scan/types";
import { env } from "@/lib/config/env";

export function serpAuthHeader(login: string, password: string): string {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

export function parseSerp(body: unknown, productName: string): { competitors: Competitor[]; serpResultCount: number } {
  const result = (body as { tasks?: Array<{ result?: Array<{ se_results_count?: number; items?: Array<Record<string, unknown>> }> }> })
    .tasks?.[0]?.result?.[0];
  const organic = (result?.items ?? []).filter((i) => i.type === "organic");
  const self = productName.toLowerCase();
  const competitors = organic
    .filter((i) => !String(i.domain ?? "").toLowerCase().includes(self))
    .map((i, idx) => ({ name: String(i.title ?? i.domain ?? ""), url: String(i.url ?? ""), source: "dataforseo_serp", rank: idx + 1 }));
  return { competitors, serpResultCount: Number(result?.se_results_count ?? 0) };
}

// Live SERP — used only for the 10s screen (§ R9: Live is the exception, Standard is default elsewhere).
export async function liveSerpAlternatives(productName: string): Promise<{ competitors: Competitor[]; serpResultCount: number; raw: unknown }> {
  const res = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
    method: "POST",
    headers: { Authorization: serpAuthHeader(env.dataforseoLogin, env.dataforseoPassword), "content-type": "application/json" },
    body: JSON.stringify([{ keyword: `alternatives to ${productName}`, location_code: env.dataforseoLocationCode, language_code: env.dataforseoLanguageCode, depth: 10 }]),
  });
  const body = await res.json();
  return { ...parseSerp(body, productName), raw: body };
}
```
*Confirm `se_results_count`/`items[].type` paths against a live DataForSEO response at build.*

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** · `git commit -am "feat: DataForSEO client + Live SERP alternatives parser"`

---

## Task 7: Product Hunt adapter (reviews + upvotes)

**Files:**
- Create: `lib/scan/adapters/product-hunt.ts`, `lib/scan/adapters/product-hunt.test.ts`

- [ ] **Step 1: Write the failing test (mocked GraphQL response)**

```ts
import { expect, test } from "vitest";
import { parsePhPosts } from "./product-hunt";

test("parsePhPosts extracts votes + neighbour products", () => {
  const data = { data: { posts: { edges: [
    { node: { name: "Nudgi", votesCount: 320, url: "https://www.producthunt.com/posts/nudgi", reviewsCount: 12 } },
    { node: { name: "Habitify", votesCount: 980, url: "https://www.producthunt.com/posts/habitify", reviewsCount: 40 } },
  ] } } };
  const r = parsePhPosts(data, "Nudgi");
  expect(r.selfUpvotes).toBe(320);
  expect(r.neighbours.map((n) => n.name)).toContain("Habitify");
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/scan/adapters/product-hunt.ts`**

```ts
import type { Competitor } from "@/lib/scan/types";
import { env } from "@/lib/config/env";

type PhNode = { name: string; votesCount: number; url: string; reviewsCount: number };
export function parsePhPosts(data: unknown, productName: string): { selfUpvotes: number; neighbours: Competitor[] } {
  const edges = ((data as { data?: { posts?: { edges?: Array<{ node: PhNode }> } } }).data?.posts?.edges ?? []).map((e) => e.node);
  const self = edges.find((n) => n.name.toLowerCase() === productName.toLowerCase());
  const neighbours = edges.filter((n) => n.name.toLowerCase() !== productName.toLowerCase())
    .map((n, i) => ({ name: n.name, url: n.url, source: "product_hunt", rank: i + 1 }));
  return { selfUpvotes: self?.votesCount ?? 0, neighbours };
}

export async function fetchPhByName(productName: string): Promise<{ selfUpvotes: number; neighbours: Competitor[]; raw: unknown }> {
  const query = `query($q:String!){posts(first:8,order:VOTES,query:$q){edges{node{name votesCount url reviewsCount}}}}`;
  const res = await fetch("https://api.producthunt.com/v2/api/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.productHuntToken}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { q: productName } }),
  });
  const body = await res.json();
  return { ...parsePhPosts(body, productName), raw: body };
}
```
*Confirm the PH v2 GraphQL `posts(query:)` argument at build; if unavailable, fall back to `search` — degrade gracefully to empty (§8 Tier handling).*

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** · `git commit -am "feat: Product Hunt adapter (self upvotes + neighbour products)"`

---

## Task 8: Domain-age adapter (Wayback CDX) + web traffic-proxy composite

**Files:**
- Create: `lib/scan/adapters/domain-age.ts` (+ test), `lib/scan/web-proxy.ts` (+ test)

- [ ] **Step 1: Failing test for domain age**

`lib/scan/adapters/domain-age.test.ts`:
```ts
import { expect, test } from "vitest";
import { ageYearsFromCdx } from "./domain-age";
test("ageYearsFromCdx computes years from earliest snapshot timestamp", () => {
  // first row is the CDX header; second is earliest capture 2019-01-01
  const rows = [["timestamp"], ["20190101000000"]];
  expect(ageYearsFromCdx(rows, new Date("2026-01-01"))).toBe(7);
});
test("ageYearsFromCdx returns null when no snapshots", () => {
  expect(ageYearsFromCdx([["timestamp"]], new Date())).toBeNull();
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/scan/adapters/domain-age.ts`**

```ts
export function ageYearsFromCdx(rows: string[][], now: Date): number | null {
  const first = rows[1]?.[0];                 // rows[0] is the CDX header
  if (!first) return null;
  const y = Number(first.slice(0, 4)), m = Number(first.slice(4, 6)) - 1, d = Number(first.slice(6, 8));
  const ms = now.getTime() - new Date(Date.UTC(y, m, d)).getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

export async function fetchDomainAgeYears(domain: string): Promise<number | null> {
  const url = `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&limit=1&sort=ascending&fl=timestamp`;
  try {
    const rows = (await (await fetch(url)).json()) as string[][];
    return ageYearsFromCdx(rows, new Date());
  } catch { return null; }   // §8: garnish source, degrade gracefully
}
```
*Note: `ageYearsFromCdx` takes `now` as a param so the test is deterministic (the runtime forbids argless `new Date()` in some sandboxes; the live fn passes `new Date()`).*

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Failing test for the proxy composite (§19 #7)**

`lib/scan/web-proxy.test.ts`:
```ts
import { expect, test } from "vitest";
import { webProxyScore } from "./web-proxy";
test("more SERP results + upvotes + older domain → higher score", () => {
  const lo = webProxyScore({ serpResultCount: 100, phUpvotes: 0, domainAgeYears: 0 });
  const hi = webProxyScore({ serpResultCount: 5_000_000, phUpvotes: 800, domainAgeYears: 8 });
  expect(hi.score).toBeGreaterThan(lo.score);
  expect(hi.score).toBeLessThanOrEqual(100);
});
```

- [ ] **Step 6: Implement `lib/scan/web-proxy.ts`**

```ts
import type { WebProxy } from "@/lib/scan/types";
const clamp = (n: number) => Math.max(0, Math.min(100, n));
// Composite stand-in for "review volume" in web mode (§19 #7), log-scaled, equally weighted.
export function webProxyScore(i: { serpResultCount: number; phUpvotes: number; domainAgeYears: number | null }): WebProxy {
  const serp = Math.log10(i.serpResultCount + 1) / 7;        // ~0..1 (10M results ≈ 1)
  const ph = Math.log10(i.phUpvotes + 1) / 3;                // ~0..1 (1000 upvotes ≈ 1)
  const age = Math.min((i.domainAgeYears ?? 0) / 10, 1);     // 10y ≈ 1
  return { score: clamp(((serp + ph + age) / 3) * 100), serpResultCount: i.serpResultCount, phUpvotes: i.phUpvotes, domainAgeYears: i.domainAgeYears };
}
```

- [ ] **Step 7: Run both tests — expect PASS** · `pnpm test lib/scan/adapters/domain-age.test.ts lib/scan/web-proxy.test.ts`
- [ ] **Step 8: Commit** · `git commit -am "feat: domain-age (Wayback CDX) + web traffic-proxy composite"`

---

## Task 9: Tavily adapter (`search_web`) + adapter selection

**Files:**
- Create: `lib/scan/adapters/tavily.ts` (+ test), `lib/scan/adapters/select.ts` (+ test)

- [ ] **Step 1: Failing test for Tavily parse**

```ts
import { expect, test } from "vitest";
import { parseTavily } from "./tavily";
test("parseTavily maps results to competitors", () => {
  const body = { results: [{ title: "Top Nudgi alternatives", url: "https://habitify.me", content: "..." }] };
  expect(parseTavily(body, "nudgi")[0].url).toBe("https://habitify.me");
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/scan/adapters/tavily.ts`**

```ts
import type { Competitor } from "@/lib/scan/types";
import { env } from "@/lib/config/env";
export function parseTavily(body: unknown, self: string): Competitor[] {
  return ((body as { results?: Array<{ title: string; url: string }> }).results ?? [])
    .filter((r) => !r.url.toLowerCase().includes(self.toLowerCase()))
    .map((r, i) => ({ name: r.title, url: r.url, source: "tavily", rank: i + 1 }));
}
export async function tavilyAlternatives(productName: string): Promise<{ competitors: Competitor[]; raw: unknown }> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: env.tavilyApiKey, query: `alternatives to ${productName}`, max_results: 5 }),
  });
  const body = await res.json();
  return { competitors: parseTavily(body, productName), raw: body };
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Failing test for adapter selection (§4.1)**

`lib/scan/adapters/select.test.ts`:
```ts
import { expect, test } from "vitest";
import { adaptersFor } from "./select";
test("app mode uses iTunes + review RSS; web mode uses site + serp + ph + domain-age", () => {
  expect(adaptersFor("ios")).toEqual(expect.arrayContaining(["itunes", "app_store_rss"]));
  expect(adaptersFor("web")).toEqual(expect.arrayContaining(["site_fetch", "dataforseo_serp", "product_hunt", "domain_age", "tavily"]));
  expect(adaptersFor("ios")).not.toContain("product_hunt");
});
```

- [ ] **Step 6: Implement `lib/scan/adapters/select.ts`**

```ts
import type { Platform } from "@/lib/scan/router";
export type AdapterId = "itunes" | "app_store_rss" | "site_fetch" | "dataforseo_serp" | "product_hunt" | "domain_age" | "tavily";
export function adaptersFor(platform: Platform): AdapterId[] {
  if (platform === "ios" || platform === "android") return ["itunes", "app_store_rss"]; // Play parity = Cycle 6; Android uses app shape for now
  return ["site_fetch", "dataforseo_serp", "product_hunt", "domain_age", "tavily"];
}
```

- [ ] **Step 7: Run — expect PASS.**
- [ ] **Step 8: Commit** · `git commit -am "feat: Tavily search_web adapter + per-mode adapter selection"`

---

## Task 10: Competitor ranking + persistence

**Files:**
- Create: `lib/scan/competitors.ts`, `lib/scan/competitors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { rankCompetitors } from "./competitors";
test("dedupes by host, prefers lower rank, caps at 5", () => {
  const out = rankCompetitors([
    { name: "Habitify", url: "https://habitify.me/x", source: "tavily", rank: 3 },
    { name: "Habitify", url: "https://habitify.me", source: "dataforseo_serp", rank: 1 },
    { name: "Streaks", url: "https://streaksapp.com", source: "product_hunt", rank: 2 },
  ]);
  expect(out).toHaveLength(2);
  expect(out[0].name).toBe("Habitify");        // rank 1 wins
  expect(out[0].source).toBe("dataforseo_serp");
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/scan/competitors.ts`**

```ts
import type { Competitor } from "@/lib/scan/types";
import { serverDb } from "@/lib/db/client";

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

export function rankCompetitors(all: Competitor[], cap = 5): Competitor[] {
  const best = new Map<string, Competitor>();
  for (const c of all) {
    const k = host(c.url);
    const cur = best.get(k);
    if (!cur || c.rank < cur.rank) best.set(k, c);
  }
  return [...best.values()].sort((a, b) => a.rank - b.rank).slice(0, cap).map((c, i) => ({ ...c, rank: i + 1 }));
}

export async function persistCompetitors(appId: string, competitors: Competitor[]): Promise<void> {
  if (competitors.length === 0) return;
  const db = serverDb();
  await db.from("competitors").insert(competitors.map((c) => ({
    app_id: appId, competitor_store_url: c.url, name: c.name, source: c.source, confirmed: false,
  })));
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** · `git commit -am "feat: competitor ranking (host-dedupe, rank-priority, cap 5) + persistence"`

---

## Task 11: Tool-registry D-tool bodies (`get_listing`, `get_reviews`, `find_competitors`, `search_web`)

**Files:**
- Create: `lib/scan/tools/get-listing.ts`, `get-reviews.ts`, `find-competitors.ts`, `search-web.ts` (+ one test file `lib/scan/tools/tools.test.ts`)

- [ ] **Step 1: Write the failing test (budget charge + dedupe to raw_documents, adapters mocked)**

`lib/scan/tools/tools.test.ts`:
```ts
import { expect, test, vi } from "vitest";
import { ScanBudget } from "@/lib/tools/registry";

test("getReviews charges the budget once and returns reviews", async () => {
  vi.mock("@/lib/scan/adapters/app-store-rss", () => ({ fetchAppReviews: async () => [{ rating: 5, title: "", body: "great" }] }));
  vi.mock("@/lib/db/raw-documents", () => ({ upsertRawDocument: async () => ({ id: 1, deduped: false }) }));
  vi.mock("@/lib/telemetry/pipeline-runs", () => ({ recordPipelineRun: async () => {} }));
  const { getReviews } = await import("./get-reviews");
  const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 150 });
  const out = await getReviews.run({ appId: "1", subjectKey: "sofa" }, { scanId: "s1", mode: "ios", budget });
  expect(out.reviews).toHaveLength(1);
  expect(budget.callsMade).toBe(1);
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement the four tools as `ToolDefinition`s**

`lib/scan/tools/get-reviews.ts` (pattern; the others mirror it with their adapters):
```ts
import type { ToolDefinition, ToolContext } from "@/lib/tools/registry";
import type { ReviewItem } from "@/lib/scan/types";
import { fetchAppReviews } from "@/lib/scan/adapters/app-store-rss";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { recordPipelineRun } from "@/lib/telemetry/pipeline-runs";

export const getReviews: ToolDefinition<{ appId: string; subjectKey: string }, { reviews: ReviewItem[] }> = {
  name: "get_reviews", klass: "D",
  async run(args, ctx: ToolContext) {
    ctx.budget.charge({ toolCalls: 1, cents: 0 });           // data call: $0 LLM cost (DataForSEO-billed tools charge their cents)
    const started = performance.now();
    const reviews = await fetchAppReviews(args.appId);
    await upsertRawDocument({ subjectType: "app", subjectKey: args.subjectKey, sourceType: "app_store_rss", body: reviews, mode: ctx.mode });
    await recordPipelineRun({ scanId: ctx.scanId, stage: "tool", costCents: 0, durationMs: Math.round(performance.now() - started) });
    return { reviews };
  },
};
```
- `get_listing.ts` — app: `fetchItunesListing`; web: `fetchSiteListing`; branch on `ctx.mode`; persist to `raw_documents` (`source_type` `itunes`/`site_fetch`).
- `find_competitors.ts` — app: `fetchItunesCompetitors`; web: merge `liveSerpAlternatives` + `fetchPhByName().neighbours` + `tavilyAlternatives`; charge `cents: 1` on the DataForSEO Live SERP call (§ R9 budget); persist each source's raw payload; return `Competitor[]`.
- `search_web.ts` — `tavilyAlternatives`; charge `cents: 1`.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Register tools** — in a new `lib/scan/tools/index.ts`, import the four and `registry.set(name, tool)` for each.

- [ ] **Step 6: Commit** · `git commit -am "feat: D-tool bodies get_listing/get_reviews/find_competitors/search_web with budget + raw_documents"`

---

## Task 12: `progress.ts` emitter + Stage 0 collect orchestration

**Files:**
- Create: `lib/scan/progress.ts`, `lib/scan/collect.ts`
- Modify: `lib/scan/pipeline.ts` (ScanContext + runCollect)
- Create test: `tests/integration/collect.test.ts`

- [ ] **Step 1: Emitter**

`lib/scan/progress.ts`:
```ts
import { serverDb } from "@/lib/db/client";
import type { ScanEventType } from "@/lib/scan/types";
export async function emitScanEvent(scanId: string, type: ScanEventType, payload: Record<string, unknown>): Promise<void> {
  await serverDb().from("scan_events").insert({ scan_id: scanId, type, payload });
}
```

- [ ] **Step 2: Extend `ScanContext` + implement `runCollect`**

Modify `lib/scan/pipeline.ts`:
```ts
import { ScanBudget } from "@/lib/tools/registry";
import { collect } from "@/lib/scan/collect";
import type { PreliminaryFacts } from "@/lib/scan/types";
import type { Platform } from "@/lib/scan/router";

export interface ScanContext {
  scanId: string; appId: string; mode: Platform; storeUrl: string; budget: ScanBudget;
}
export async function runCollect(ctx: ScanContext): Promise<PreliminaryFacts> { return collect(ctx); }
```

- [ ] **Step 3: Collect orchestration**

`lib/scan/collect.ts` — selects adapters, runs the facts-critical tools in parallel, emits an `artifact` event per source as it lands, returns assembled facts (facts assembly is Task 13, imported here):
```ts
import type { ScanContext } from "@/lib/scan/pipeline";
import { adaptersFor } from "@/lib/scan/adapters/select";
import { getListing, getReviews, findCompetitors } from "@/lib/scan/tools";   // re-exported from tools/index.ts
import { rankCompetitors, persistCompetitors } from "@/lib/scan/competitors";
import { assembleFacts } from "@/lib/scan/facts";
import { emitScanEvent } from "@/lib/scan/progress";
import type { Competitor } from "@/lib/scan/types";

export async function collect(ctx: ScanContext) {
  const used = adaptersFor(ctx.mode);
  const toolCtx = { scanId: ctx.scanId, mode: ctx.mode, budget: ctx.budget };
  const subjectKey = ctx.storeUrl;

  const listingP = getListing.run({ storeUrl: ctx.storeUrl, subjectKey }, toolCtx)
    .then(async (r) => { await emitScanEvent(ctx.scanId, "artifact", { label: "listing read", source: ctx.mode === "web" ? "site_fetch" : "itunes" }); return r; });
  const reviewsP = (ctx.mode === "web" ? Promise.resolve({ reviews: [] }) : getReviews.run({ appId: ctx.storeUrl.match(/\/id(\d+)/)?.[1] ?? "", subjectKey }, toolCtx))
    .then(async (r) => { await emitScanEvent(ctx.scanId, "artifact", { label: `reviews fetched`, count: r.reviews.length }); return r; });
  const compsP = findCompetitors.run({ productName: subjectKey, subjectKey }, toolCtx)
    .then(async (cs: Competitor[]) => { await emitScanEvent(ctx.scanId, "artifact", { label: `competitors found`, count: cs.length }); return cs; });

  const [listing, reviews, comps] = await Promise.all([listingP, reviewsP, compsP]);
  const competitors = rankCompetitors(comps);
  await persistCompetitors(ctx.appId, competitors);
  return assembleFacts(ctx, { listing: listing.listing, reviews: reviews.reviews, competitors, extras: listing.extras });
}
```
*(`getListing.run` returns `{ listing, extras }` where `extras` carries app `ratingCount`/`rating` or web `serpResultCount`/`phUpvotes`/`domainAgeYears` — define this in Task 11's `get_listing`/`find_competitors` return contract and assert it in `tools.test.ts`.)*

- [ ] **Step 4: Live integration test (the heart of the gate)**

`tests/integration/collect.test.ts` — for Sofa (app) and Nudgi (web): build a `ScanContext`, run `collect`, assert it returns ≥1 competitor and (app) ≥1 review, and that `raw_documents` gained rows. Header documents it needs live credentials + Supabase local; excluded from CI.

- [ ] **Step 5: Run locally — expect PASS** · `pnpm test:int tests/integration/collect.test.ts`
- [ ] **Step 6: Commit** · `git commit -am "feat: Stage 0 collect orchestration + scan_events emitter + runCollect"`

---

## Task 13: Preliminary facts assembly

**Files:**
- Create: `lib/scan/facts.ts`, `lib/scan/facts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { assembleFacts } from "./facts";

const ctx = { scanId: "s", appId: "a", mode: "web" as const, storeUrl: "https://nudgi.app", budget: {} as never };
test("web mode produces a webProxy and null ratingTrend", () => {
  const f = assembleFacts(ctx, {
    listing: { name: "Nudgi", category: null, description: "habits" },
    reviews: [], competitors: [{ name: "Habitify", url: "https://habitify.me", source: "x", rank: 1 }],
    extras: { serpResultCount: 1_000_000, phUpvotes: 300, domainAgeYears: 4 },
  });
  expect(f.ratingTrend).toBeNull();
  expect(f.webProxy?.score).toBeGreaterThan(0);
  expect(f.sourcesUsed).toContain("dataforseo_serp");
});
test("app mode produces ratingTrend from reviews + null webProxy", () => {
  const f = assembleFacts({ ...ctx, mode: "ios" }, {
    listing: { name: "Sofa", category: "Lifestyle", description: "" },
    reviews: [{ rating: 5, title: "", body: "love the onboarding" }, { rating: 3, title: "", body: "onboarding confusing" }],
    competitors: [], extras: { ratingCount: 1200, rating: 4.6 },
  });
  expect(f.webProxy).toBeNull();
  expect(f.ratingTrend).toBe(4.6);
  expect(f.themes[0].term).toBe("onboarding");
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `lib/scan/facts.ts`**

```ts
import type { ScanContext } from "@/lib/scan/pipeline";
import type { PreliminaryFacts, Competitor, ReviewItem, ListingFacts } from "@/lib/scan/types";
import { extractThemes } from "@/lib/scan/themes";
import { webProxyScore } from "@/lib/scan/web-proxy";

interface Extras { ratingCount?: number; rating?: number | null; serpResultCount?: number; phUpvotes?: number; domainAgeYears?: number | null; }
export function assembleFacts(ctx: ScanContext,
  data: { listing: ListingFacts; reviews: ReviewItem[]; competitors: Competitor[]; extras: Extras }): PreliminaryFacts {
  const isWeb = ctx.mode === "web";
  return {
    mode: ctx.mode,
    listing: data.listing,
    competitors: data.competitors,
    reviewVolume: isWeb ? data.reviews.length : (data.extras.ratingCount ?? data.reviews.length),
    ratingTrend: isWeb ? null : (data.extras.rating ?? null),
    webProxy: isWeb ? webProxyScore({ serpResultCount: data.extras.serpResultCount ?? 0, phUpvotes: data.extras.phUpvotes ?? 0, domainAgeYears: data.extras.domainAgeYears ?? null }) : null,
    themes: extractThemes(data.reviews),
    sourcesUsed: isWeb ? ["site_fetch", "dataforseo_serp", "product_hunt", "domain_age"] : ["itunes", "app_store_rss"],
  };
}
```
*(`sourcesUsed` here lists configured sources; §6's measured-density drop happens in Cycle 3 when sources gate findings — for the facts screen we list what was queried.)*

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** · `git commit -am "feat: preliminary facts assembly (app rating trend / web proxy, themes, sources)"`

---

## Task 14: Real `scan/requested` pipeline function + wire-up

**Files:**
- Create: `lib/inngest/functions/scan-requested.ts`
- Modify: `app/api/inngest/route.ts`, `app/api/scan/route.ts`
- Create test: `tests/integration/scan-requested.test.ts`

- [ ] **Step 1: Implement the function**

`lib/inngest/functions/scan-requested.ts`:
```ts
import { inngest } from "@/lib/inngest/client";
import { serverDb } from "@/lib/db/client";
import { classifyUrl } from "@/lib/scan/router";
import { ScanBudget } from "@/lib/tools/registry";
import { runCollect } from "@/lib/scan/pipeline";
import { emitScanEvent } from "@/lib/scan/progress";
import { env } from "@/lib/config/env";
import "@/lib/scan/tools";   // registers tool bodies

export const scanRequested = inngest.createFunction(
  { id: "scan-requested", retries: 1 },
  { event: "scan/requested" },
  async ({ event, step }) => {
    const scanId = event.data.scanId as string;
    const db = serverDb();
    const scan = await db.from("scans").select("id, app_id, apps(store_url, platform)").eq("id", scanId).single();
    const app = scan.data!.apps as unknown as { store_url: string; platform: "ios" | "android" | "web" };
    const routed = classifyUrl(app.store_url);

    await step.run("collect", async () => {
      await db.from("scans").update({ status: "collecting", started_at: new Date().toISOString() }).eq("id", scanId);
      const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: env.scanBudgetCents });
      const facts = await runCollect({ scanId, appId: scan.data!.app_id, mode: routed.platform, storeUrl: app.store_url, budget });
      await db.from("scans").update({ preliminary_facts: facts }).eq("id", scanId);
      await emitScanEvent(scanId, "facts", facts as unknown as Record<string, unknown>);
    });

    await step.run("done", async () => {
      await emitScanEvent(scanId, "done", { scanId });
      await db.from("scans").update({ status: "done" }).eq("id", scanId); // 'done' = preliminary; full scan is Cycle 2
    });
    return { ok: true };
  },
);
```
*(`started_at`/`new Date().toISOString()` runs server-side in Inngest, not in the workflow sandbox — allowed.)*

- [ ] **Step 2: Register + switch the event**

In `app/api/inngest/route.ts` add `scanRequested` to the `functions` array. In `app/api/scan/route.ts` change `inngest.send({ name: "scan/demo.requested", ... })` → `inngest.send({ name: "scan/requested", data: { scanId: scan.data.id } })`.

- [ ] **Step 3: Live integration test — facts event arrives <10s (the acceptance gate)**

`tests/integration/scan-requested.test.ts`: POST a fixture URL via the handler, then poll `scan_events` for a `type='facts'` row; assert it appears within 10_000ms and its payload has `competitors.length >= 1`. Run for Nudgi (web) and Sofa (app). Header: requires Inngest dev + Supabase local + live creds; excluded from CI.

- [ ] **Step 4: Run locally — expect PASS** · `pnpm test:int tests/integration/scan-requested.test.ts`
Expected: a `facts` event within 10s for both fixtures. **(Cycle 1 acceptance gate.)**

- [ ] **Step 5: Commit** · `git commit -am "feat: real scan/requested pipeline function (collect → facts → done)"`

---

## Task 15: SSE streams real `scan_events`

**Files:**
- Modify: `app/api/scan/[id]/stream/route.ts`

- [ ] **Step 1: Replace the demo body with a poller over `scan_events`**

```ts
import { NextRequest } from "next/server";
import { serverDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = serverDb();
  let lastId = 0;
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      for (let i = 0; i < 120; i++) {                       // ≤30s at 250ms
        const { data } = await db.from("scan_events").select("id, type, payload").eq("scan_id", id).gt("id", lastId).order("id");
        for (const row of data ?? []) { lastId = row.id; send({ type: row.type, payload: row.payload }); if (row.type === "done" || row.type === "error") { controller.close(); return; } }
        await new Promise((r) => setTimeout(r, 250));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
```

- [ ] **Step 2: Manual smoke**

Run `pnpm dev` + Inngest dev + Supabase local. POST a scan, then `curl -N localhost:3000/api/scan/<id>/stream`.
Expected: a sequence of `artifact` events, then one `facts` event with competitors/themes, then `done`.

- [ ] **Step 3: Commit** · `git commit -am "feat: SSE streams real scan_events (artifacts → facts → done)"`

---

## Task 16: Working feed + preliminary facts screen (funnel UI)

**Files:**
- Modify: `app/(funnel)/scan/[id]/page.tsx`
- Create: `app/(funnel)/scan/[id]/scan-stream.tsx` (client component)

- [ ] **Step 1: Client SSE consumer**

`scan-stream.tsx` (client): opens `EventSource('/api/scan/${id}/stream')`, accumulates `artifact` events into a live list, and on the `facts` event renders the facts screen (§5.1): category, top-5 competitors (with a confirm/edit affordance stub — full confirm UI is Cycle 3), review volume + rating trend (app) or web-proxy score (web), and the word-level theme chips. Uses `components/ui/card`, `badge`, `skeleton`. No claims — facts only.
```tsx
"use client";
import { useEffect, useState } from "react";
import type { PreliminaryFacts, ScanEvent } from "@/lib/scan/types";
export function ScanStream({ id }: { id: string }) {
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [facts, setFacts] = useState<PreliminaryFacts | null>(null);
  useEffect(() => {
    const es = new EventSource(`/api/scan/${id}/stream`);
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as ScanEvent;
      if (e.type === "artifact") setArtifacts((a) => [...a, String(e.payload.label)]);
      if (e.type === "facts") setFacts(e.payload as unknown as PreliminaryFacts);
      if (e.type === "done" || e.type === "error") es.close();
    };
    return () => es.close();
  }, [id]);
  if (!facts) return <ul>{artifacts.map((a, i) => <li key={i}>✓ {a}</li>)}</ul>;
  return (
    <section>
      <h2>{facts.listing.name} — {facts.listing.category ?? "Web product"}</h2>
      <p>{facts.mode === "web" ? `Discoverability proxy: ${facts.webProxy?.score.toFixed(0)}/100` : `${facts.reviewVolume} reviews · ${facts.ratingTrend ?? "–"}★`}</p>
      <h3>Top competitors</h3>
      <ul>{facts.competitors.map((c) => <li key={c.url}>{c.name}</li>)}</ul>
      <h3>What reviewers talk about</h3>
      <div>{facts.themes.slice(0, 10).map((t) => <span key={t.term}>{t.term} ({t.count}) </span>)}</div>
    </section>
  );
}
```

- [ ] **Step 2: Wire the page**

`app/(funnel)/scan/[id]/page.tsx` renders `<ScanStream id={id} />` inside minimal funnel chrome (§21.4: funnel route group, minimal nav).

- [ ] **Step 3: Manual end-to-end smoke (the human-visible gate)**

`pnpm dev` + Inngest dev + Supabase local. From `/` (or via curl) start a scan for `https://nudgi.app`, open `/scan/<id>`, confirm the working feed streams then the facts screen renders **in <10s**. Repeat for Sofa's App Store URL.

- [ ] **Step 4: Commit** · `git commit -am "feat: funnel working-feed + preliminary facts screen (SSE consumer)"`

---

## Self-Review (completed by the plan author)

**Spec coverage (Cycle 1 scope, decomposition §3.1):**
- Input router → adapter selection (§5.2/§4.1) → Tasks 9 (`select.ts`), reuses 1a `classifyUrl` ✓
- Stage 0 COLLECT per mode → `raw_documents`/`evidence` (§9.1) → Tasks 11, 12 ✓
- D-tools for the facts path (`get_listing`,`get_reviews`,`find_competitors`,`search_web`, §9.4) → Task 11 ✓ (the other three deferred to Cycle 2 with findings — scope note above, decomposition §3.1 updated)
- Competitor auto-discovery first pass with `source` per entry (§5.2) → Tasks 9–10 ✓
- SSE live artifacts + 0–10s working + preliminary facts screen (§5.1) → Tasks 12, 15, 16 ✓
- Web-mode traffic proxy (§19 #7) → Task 8 ✓ · word-level themes (facts, no LLM) → Task 4 ✓
- Every fetch in `raw_documents` + `pipeline_runs` per call → Tasks 11, 12 ✓
- Per-scan budget caps wired → Tasks 11, 14 (`ScanBudget` from `env.scanBudgetCents`) ✓
- Acceptance gate (facts <10s on the three fixtures) → Tasks 14, 16 ✓

**Placeholder scan:** No "TBD/handle errors generically". Forward references are deliberate and named (competitor *confirm* UI → Cycle 3; source-density *drop* → Cycle 3; `search_keywords`/`find_communities`/`find_creators` → Cycle 2). Graceful-degrade (empty results) is specified for the garnish/web sources (§8).

**Type consistency:** `PreliminaryFacts`, `Competitor`, `ReviewItem`, `ListingFacts`, `ThemeCount`, `WebProxy`, `ScanEvent` are defined once in `lib/scan/types.ts` (Task 1) and consumed unchanged thereafter. `ScanContext` is extended once (Task 12) and used by `runCollect`/`collect`/`assembleFacts`/`scan-requested` with matching fields. The `get_listing`/`find_competitors` `extras` return contract is introduced in Task 11 and consumed in Tasks 12–13 (assert it in `tools.test.ts`). Event name `scan/requested` is consistent across Tasks 14 (handler) and the modified `app/api/scan/route.ts`.

**Confirm-at-build items (not placeholders):** live JSON field paths for iTunes lookup/search, DataForSEO Live SERP (`se_results_count`, `items[].type`), Product Hunt v2 GraphQL `posts(query:)`, and Wayback CDX are each parsed for the specific fields used and covered by a mocked contract test; verify against one live response per vendor during the task and adjust the parser if a path differs (the test then locks it).

**Cost/perf note:** only `find_competitors`/`search_web` charge cents (DataForSEO Live SERP + Tavily); iTunes/RSS/site-fetch/Wayback/PH are free. The 60-call / `env.scanBudgetCents` (default 150¢) caps protect the gate's margin; p95 cost lands well under the free-scan ≤$0.15 target (§13) because the facts path makes ≤1 paid SERP call.

---

*Phase 1 (Foundation + Scan skeleton) planning complete. Next cycle plan — `docs/plans/<date>-phase-2-findings-and-gate.md` (Stage 1 Haiku extract → fact_sheets, minimal Sonnet synth, preliminary Score, 3 findings, email gate, funnel moments 1–4) — is written at the start of Cycle 2, after Cycle 1's adapters return real data shapes.*
