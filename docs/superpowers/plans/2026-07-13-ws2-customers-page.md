# WS2 — Customers Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the paid Customers page into an analytical, evidence-linked buyer-intel surface: keywords under themes, an intent×recency map over the complete buyer-thread feed (with real Reddit/HN engagement where available), pains as ranked frequency bars, and — the load-bearing requirement — every data point clickable into an evidence drawer.

**Architecture:** Data layer first (a new thread-activity adapter + pocket enrichment, and the review-extractor provenance rework), then client types, then the UI (four kit-composed components + one reusable drawer + the view rebuild), then Claude Design parity and live verification. New engagement fetches use the surfaces' free public APIs (Reddit `.json`, HN Firebase) inside the already-cost-contexted demand gather — no vendor spend.

**Tech Stack:** Next.js 16 RSC + client components, TypeScript, Vitest, the `@/components/app/intel/kit` (`--c-*`) design kit, `@/components/ui/dialog`, DataForSEO/Tavily (unchanged), Reddit/HN public read APIs.

**Visual spec:** the approved mockup (Artifact `5e5d7fd0-a919-4f55-b9bb-feaf99348936`) is the exact layout reference for the three rows and the interactive components. Build to it.

## Global Constraints

- **Honesty (CLAUDE.md "degrade, never invent"):** thread engagement counts come ONLY from a surface's real public API; a thread on a surface with no API (Quora, blogs) or a failed fetch shows **no count** — never a fabricated/zero one. Per-pain source links show the real extracted `sourceUrl`; where only a page-level source exists, show that, labelled — never invent a citation.
- **Cost (invariant #2):** the demand gather runs under `costedIntelStep` via `/api/app/intel?layer=demand`. The activity fetches are free (no vendor cost) but MUST stay inside the gather (so they're cached, not per-load), be **bounded** (only the shown top threads), use `fetchWithTimeout`, and run at concurrency ≤ 5. No unbounded fan-out.
- **Don't-cache-empties (invariant #3):** the `isEmpty`/`buyerInsightsEmpty` poison guards must keep working on the new `PainInsight[]` shape.
- **Brand-ambiguity (invariant #6):** buyer insights stay sourced from the category-validated cohort's reviews + the product's own community threads.
- **Additive / legacy-tolerant:** every new field is optional; a normaliser accepts BOTH the legacy `pains: string[]` and new `PainInsight[]` on read (older `demand_intel` rows + `report_payload` blobs predate the change). Read everything with `?? …`.
- **Bundle:** `/(app)/app/audience/customers/page` is pinned at 280 KB in `KNOWN_OVERAGES_KB`. The map/feed/bars/drawer MUST NOT grow it past the pin — use canvas (not a chart lib), and `dynamic()` the drawer if needed. Never raise/add a baseline.
- **Tokens only** (`--c-*` / kit props); no raw hex backgrounds, no non-existent band tokens (real ones: `--c-band-{invisible,hard,fair,findable,high}`).
- **Design parity:** any changed/new live component gets its `.design-sync/ds-src/` mirror + `INVENTORY.md` updated and `pnpm bless:design` re-pinned in the same change; the coverage ratchet hard-blocks a new unmirrored component, so add each mirror in the task that creates the component. `pnpm check:design` must stay green.
- **Live-test** with `REACHKIT_USE_FIXTURES=false` by RENDERING the page.

Commands: `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm check:arch` · `pnpm check:design` · `pnpm lint` · `node scripts/check-bundle.mjs` (needs a fresh `pnpm build`; never build while `next dev` runs).

---

### Task 1: Thread-activity adapter

Fetches real engagement (score + comment count) from a thread's own public API. Reddit + Hacker News; null for anything else or any failure.

**Files:**
- Create: `lib/scan/adapters/thread-activity.ts`
- Test: `lib/scan/adapters/thread-activity.test.ts`

**Interfaces:**
- Produces: `type ThreadActivity = { score: number; comments: number }`; `async function fetchThreadActivity(url: string): Promise<ThreadActivity | null>`. Reddit via `<url>.json`; HN via Firebase `item/<id>.json`. Returns `null` on unsupported host, non-200, malformed JSON, or timeout — never throws.

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/adapters/thread-activity.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchThreadActivity } from "./thread-activity";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}
afterEach(() => vi.unstubAllGlobals());

describe("fetchThreadActivity", () => {
  it("parses a Reddit thread's score + comments from <url>.json", async () => {
    vi.stubGlobal("fetch", mockFetch(200, [{ data: { children: [{ data: { score: 42, num_comments: 7 } }] } }, {}]));
    const a = await fetchThreadActivity("https://www.reddit.com/r/SaaS/comments/abc/title/");
    expect(a).toEqual({ score: 42, comments: 7 });
  });
  it("parses a Hacker News item's points + descendants from Firebase", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { score: 128, descendants: 33 }));
    const a = await fetchThreadActivity("https://news.ycombinator.com/item?id=12345");
    expect(a).toEqual({ score: 128, comments: 33 });
  });
  it("returns null for an unsupported host (never invents)", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {}));
    expect(await fetchThreadActivity("https://quora.com/q/xyz")).toBeNull();
  });
  it("returns null on non-200 and on malformed json, never throws", async () => {
    vi.stubGlobal("fetch", mockFetch(503, {}));
    expect(await fetchThreadActivity("https://www.reddit.com/r/x/comments/1/t/")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error("bad"); } } as unknown as Response));
    expect(await fetchThreadActivity("https://www.reddit.com/r/x/comments/1/t/")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/scan/adapters/thread-activity.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// lib/scan/adapters/thread-activity.ts
/**
 * Real engagement (score + comment count) for a buyer thread, from the surface's
 * OWN free public API — Reddit (`<permalink>.json`) and Hacker News (Firebase
 * `item/<id>.json`). Returns null for any other host, a non-200, malformed JSON,
 * or a timeout. NEVER throws and NEVER invents a number (honest degrade).
 */
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

export interface ThreadActivity {
  score: number;
  comments: number;
}

// Reddit requires a descriptive UA or it 429s the default agent.
const UA = "ReachKit/1.0 (+https://reachkit.app)";

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

async function reddit(url: string): Promise<ThreadActivity | null> {
  const jsonUrl = url.replace(/\/?(\?.*)?$/, "") + ".json";
  const res = await fetchWithTimeout(jsonUrl, { headers: { "user-agent": UA, accept: "application/json" } }, 6000);
  if (!res.ok) return null;
  const body = (await res.json()) as Array<{ data?: { children?: Array<{ data?: { score?: number; num_comments?: number } }> } }>;
  const d = body?.[0]?.data?.children?.[0]?.data;
  if (!d || typeof d.score !== "number") return null;
  return { score: d.score, comments: typeof d.num_comments === "number" ? d.num_comments : 0 };
}

async function hackerNews(url: string): Promise<ThreadActivity | null> {
  const id = new URL(url).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) return null;
  const res = await fetchWithTimeout(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { headers: { accept: "application/json" } }, 6000);
  if (!res.ok) return null;
  const d = (await res.json()) as { score?: number; descendants?: number } | null;
  if (!d || typeof d.score !== "number") return null;
  return { score: d.score, comments: typeof d.descendants === "number" ? d.descendants : 0 };
}

export async function fetchThreadActivity(url: string): Promise<ThreadActivity | null> {
  try {
    const h = hostOf(url);
    if (h === "reddit.com" || h.endsWith(".reddit.com")) return await reddit(url);
    if (h === "news.ycombinator.com") return await hackerNews(url);
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test — Expected: PASS (4 tests).** `pnpm vitest run lib/scan/adapters/thread-activity.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/scan/adapters/thread-activity.ts lib/scan/adapters/thread-activity.test.ts
git commit -m "feat(ws2): thread-activity adapter — real Reddit/HN engagement, null-degrade"
```

---

### Task 2: Enrich demand pockets with activity

Attach real engagement to the shown threads, bounded + inside the gather.

**Files:**
- Modify: `lib/scan/demand/types.ts` (add `activity` to `topThreads` item)
- Modify: `lib/scan/demand/index.ts` (`discoverDemand` — enrich after clustering; export a pure `attachActivity`)
- Test: `lib/scan/demand/activity-enrich.test.ts`

**Interfaces:**
- Consumes: `fetchThreadActivity` (Task 1), `DemandPocket` (types.ts).
- Produces: `DemandPocket["topThreads"][number]` gains `activity?: ThreadActivity | null`. New exported pure `attachActivity(pockets: DemandPocket[], byUrl: Map<string, ThreadActivity>): DemandPocket[]` (returns new objects). `discoverDemand` fetches activity for the union of shown top threads (concurrency ≤ 5) and applies it.

- [ ] **Step 1: Extend the type** — in `lib/scan/demand/types.ts`, change the `DemandPocket.topThreads` array element to:

```ts
  topThreads: Array<{ title: string; url: string; intent: number; publishedAt: string | null; theme: string; activity?: import("@/lib/scan/adapters/thread-activity").ThreadActivity | null }>;
```

- [ ] **Step 2: Write the failing test**

```ts
// lib/scan/demand/activity-enrich.test.ts
import { describe, it, expect } from "vitest";
import { attachActivity } from "./index";
import type { DemandPocket } from "./types";

const pocket = (urls: string[]): DemandPocket => ({
  surface: "r/SaaS", platform: "Reddit", subreddit: "r/SaaS", count: urls.length, intentSum: 1, score: 1,
  topThreads: urls.map((u) => ({ title: "t", url: u, intent: .8, publishedAt: null, theme: "x" })),
});

describe("attachActivity", () => {
  it("attaches activity by url and leaves unknown threads null (no invention)", () => {
    const out = attachActivity([pocket(["a", "b"])], new Map([["a", { score: 9, comments: 2 }]]));
    expect(out[0]!.topThreads[0]!.activity).toEqual({ score: 9, comments: 2 });
    expect(out[0]!.topThreads[1]!.activity).toBeNull();
  });
  it("does not mutate the input", () => {
    const input = [pocket(["a"])]; const snap = JSON.stringify(input);
    attachActivity(input, new Map([["a", { score: 1, comments: 1 }]]));
    expect(JSON.stringify(input)).toBe(snap);
  });
});
```

- [ ] **Step 3: Run — Expected: FAIL** (`attachActivity` not exported). `pnpm vitest run lib/scan/demand/activity-enrich.test.ts`

- [ ] **Step 4: Implement** — in `lib/scan/demand/index.ts` add the import, the pure helper, and the fetch step:

```ts
import { fetchThreadActivity, type ThreadActivity } from "@/lib/scan/adapters/thread-activity";
```

```ts
/** WS2 — attach pre-fetched engagement to each pocket's threads by URL. Pure;
 *  a thread absent from the map stays activity:null (never invented). */
export function attachActivity(pockets: DemandPocket[], byUrl: Map<string, ThreadActivity>): DemandPocket[] {
  return pockets.map((p) => ({
    ...p,
    topThreads: p.topThreads.map((t) => ({ ...t, activity: byUrl.get(t.url) ?? null })),
  }));
}

/** Bounded, best-effort engagement fetch for the shown top threads. Free (public
 *  APIs); concurrency-capped; every failure degrades to no-count. */
async function enrichPocketActivity(pockets: DemandPocket[]): Promise<DemandPocket[]> {
  const urls = [...new Set(pockets.flatMap((p) => p.topThreads.map((t) => t.url)))].slice(0, 40);
  const byUrl = new Map<string, ThreadActivity>();
  const CONCURRENCY = 5;
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((u) => fetchThreadActivity(u).catch(() => null)));
    chunk.forEach((u, j) => { const a = results[j]; if (a) byUrl.set(u, a); });
  }
  return attachActivity(pockets, byUrl);
}
```

Then in `discoverDemand`, replace `const pockets = clusterIntoPockets(classified);` with:

```ts
  const pockets = await enrichPocketActivity(clusterIntoPockets(classified));
```

- [ ] **Step 5: Run tests — Expected: PASS** (`pnpm vitest run lib/scan/demand` — new file + existing demand tests green).

- [ ] **Step 6: Commit**

```bash
git add lib/scan/demand/types.ts lib/scan/demand/index.ts lib/scan/demand/activity-enrich.test.ts
git commit -m "feat(ws2): enrich demand pockets with real thread activity (bounded, in-gather)"
```

---

### Task 3: Per-pain provenance in review extraction

Change `BuyerInsights.pains` to carry each pain's source URL + verbatim quote.

**Files:**
- Modify: `lib/scan/demand/reviews.ts`
- Test: `lib/scan/demand/reviews-shape.test.ts`

**Interfaces:**
- Produces: `interface PainInsight { text: string; quote?: string; sourceUrl?: string; mentions?: number }`; `BuyerInsights.pains: PainInsight[]` (other lists stay `string[]`; keep `sources: string[]`). Exported `normalizePains(raw: unknown): PainInsight[]` accepts legacy `string[]` OR `PainInsight[]` (used by consumers/UI).

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/demand/reviews-shape.test.ts
import { describe, it, expect } from "vitest";
import { normalizePains } from "./reviews";

describe("normalizePains", () => {
  it("passes through new PainInsight[] and back-fills text", () => {
    expect(normalizePains([{ text: "slow", sourceUrl: "https://g2.com/x", mentions: 3 }]))
      .toEqual([{ text: "slow", sourceUrl: "https://g2.com/x", mentions: 3 }]);
  });
  it("upgrades legacy string[] to PainInsight[] (no source)", () => {
    expect(normalizePains(["accuracy", "privacy"]))
      .toEqual([{ text: "accuracy" }, { text: "privacy" }]);
  });
  it("drops junk and empties", () => {
    expect(normalizePains([{ text: "" }, 3, null, { nope: 1 }, "  ok  "]))
      .toEqual([{ text: "ok" }]);
  });
});
```

- [ ] **Step 2: Run — Expected: FAIL.** `pnpm vitest run lib/scan/demand/reviews-shape.test.ts`

- [ ] **Step 3: Implement** — in `lib/scan/demand/reviews.ts`:
  1. Add `PainInsight` + change the interface:

```ts
export interface PainInsight { text: string; quote?: string; sourceUrl?: string; mentions?: number }

export interface BuyerInsights {
  pains: PainInsight[];
  lovedFeatures: string[];
  personas: string[];
  buyerLanguage: string[];
  sources: string[];
}
```

  2. Add the normaliser (also used on read-back):

```ts
export function normalizePains(raw: unknown): PainInsight[] {
  if (!Array.isArray(raw)) return [];
  const out: PainInsight[] = [];
  for (const item of raw) {
    if (typeof item === "string") { const t = item.trim(); if (t) out.push({ text: t }); }
    else if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
      const o = item as Record<string, unknown>;
      const text = String(o.text).trim(); if (!text) continue;
      out.push({
        text,
        quote: typeof o.quote === "string" && o.quote.trim() ? o.quote.trim() : undefined,
        sourceUrl: typeof o.sourceUrl === "string" && /^https?:\/\//i.test(o.sourceUrl) ? o.sourceUrl : undefined,
        mentions: typeof o.mentions === "number" ? o.mentions : undefined,
      });
    }
  }
  return out;
}
```

  3. Update `EMPTY` → `pains: []` (already `[]`, type now `PainInsight[]`).
  4. In the distill, build the review text as **per-URL labelled excerpts** and change the prompt to require per-pain provenance. Replace the `text` assembly + prompt + parse so pains carry sources:

```ts
    // Label each excerpt with a short [S#] tag → the LLM cites which the pain came from.
    const labelled = reviewResults.slice(0, 12).map((r, i) => ({ tag: `S${i + 1}`, url: r.url, text: `${r.title}\n${r.content}`.trim() }));
    const sourceByTag = new Map(labelled.map((l) => [l.tag, l.url]));
    const snippetText = labelled.filter((l) => l.text).map((l) => `[${l.tag}] ${l.text}`).join("\n\n");
    const extracted = await tavilyExtract(urls).catch(() => []);
    const extractText = extracted.map((e) => e.content).filter(Boolean).join("\n\n");
    const text = [snippetText, extractText].filter(Boolean).join("\n\n").slice(0, 14_000);
    if (!text.trim()) return { ...EMPTY, sources: urls };
```

  Prompt change — the pains element becomes objects with a `source` tag:

```
  "pains": [ { "text": "<unmet need / complaint>", "quote": "<short verbatim phrase>", "source": "<the [S#] tag of the excerpt it came from>" } ],
```

  Parse pains via the tag→url map (other lists unchanged):

```ts
      const rawPains = Array.isArray(p.pains) ? p.pains : [];
      const pains: PainInsight[] = rawPains.map((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        const text = String(o.text ?? "").trim();
        if (!text) return null;
        const tag = String(o.source ?? "").trim().toUpperCase();
        return { text, quote: typeof o.quote === "string" ? o.quote.trim() || undefined : undefined, sourceUrl: sourceByTag.get(tag) };
      }).filter(Boolean).slice(0, 8) as PainInsight[];
      return { pains, lovedFeatures: arr(p.lovedFeatures).slice(0, 8), personas: arr(p.personas).slice(0, 8), buyerLanguage: arr(p.buyerLanguage).slice(0, 8), sources: urls };
```

  5. Update the `isEmpty` predicate: `v.pains.length === 0 && …` still valid (`PainInsight[]`).

- [ ] **Step 4: Run tests — Expected: PASS.** `pnpm vitest run lib/scan/demand/reviews-shape.test.ts && pnpm vitest run lib/scan/demand`

- [ ] **Step 5: Commit**

```bash
git add lib/scan/demand/reviews.ts lib/scan/demand/reviews-shape.test.ts
git commit -m "feat(ws2): per-pain provenance — BuyerInsights.pains -> PainInsight[] with source + normaliser"
```

---

### Task 4: Update demand-gather consumers of the new pains shape

Make the gather's predicates + fallback work on `PainInsight[]`, and normalise legacy rows on read-back.

**Files:**
- Modify: `lib/scan/demand/gather.ts`
- Test: `lib/scan/demand/gather-pains.test.ts` (new — pure helper coverage)

**Interfaces:**
- Consumes: `PainInsight`, `normalizePains` (Task 3).
- Produces: `fallbackBuyerInsights` returns `pains: PainInsight[]`; `readDemandIntelFallback` runs `normalizePains` on the row's `buyer_insights.pains` so legacy `string[]` rows reassemble correctly. `buyerInsightsEmpty` unchanged semantics (`.pains.length`).

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/demand/gather-pains.test.ts
import { describe, it, expect } from "vitest";
import { fallbackBuyerInsights } from "./gather";

describe("fallbackBuyerInsights (pains shape)", () => {
  it("returns pains as PainInsight[] from brief problem + JTBD", () => {
    const bi = fallbackBuyerInsights(
      { brand: "x", problem: "manual notes", audience: "ops", valueProp: "auto", category: "c",
        seedKeywords: [], coreTerms: [], icp: { whoItsFor: "ops teams", jobsToBeDone: ["capture notes"], useCases: [] } } as never,
      [],
    );
    expect(bi.pains.every((p) => typeof p.text === "string")).toBe(true);
    expect(bi.pains.map((p) => p.text)).toContain("manual notes");
  });
});
```

- [ ] **Step 2: Run — Expected: FAIL** (fallback still returns `string[]`). `pnpm vitest run lib/scan/demand/gather-pains.test.ts`

- [ ] **Step 3: Implement** — in `lib/scan/demand/gather.ts`:
  - import `normalizePains, type PainInsight` from `./reviews`.
  - `fallbackBuyerInsights`: change the `pains` line to map to `PainInsight[]`:

```ts
    pains: dedupe([brief.problem, ...brief.icp.jobsToBeDone]).slice(0, 6).map((text) => ({ text })),
```

  - `readDemandIntelFallback`: after reassembling, normalise legacy pains:

```ts
    reassembled.buyerInsights = { ...reassembled.buyerInsights, pains: normalizePains(reassembled.buyerInsights.pains) };
```

  (place it before the `isEmptyDemandIntel`/`buyerInsightsEmpty` checks so both see the normalised shape).
  - `buyerInsightsEmpty` — unchanged (`bi.pains.length === 0` works for `PainInsight[]`).

- [ ] **Step 4: Run — Expected: PASS.** `pnpm vitest run lib/scan/demand/gather-pains.test.ts && pnpm vitest run lib/scan/demand && pnpm exec tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add lib/scan/demand/gather.ts lib/scan/demand/gather-pains.test.ts
git commit -m "feat(ws2): demand-gather consumers use PainInsight[]; normalise legacy rows on read"
```

---

### Task 5: Mirror new fields into the client Demand type + shared normaliser

**Files:**
- Modify: `components/app/intel/demand-view.tsx` (types `Pocket`, `Demand`; export a client `normalizePains`)

**Interfaces:**
- Produces: client `Pocket.topThreads[]` gains `activity?: { score: number; comments: number } | null`; `Demand.buyerInsights.pains: PainInsight[]` where `PainInsight = { text: string; quote?: string; sourceUrl?: string; mentions?: number }`; exported `normalizePains(raw): PainInsight[]` (same logic as server) + exported `PainInsight`, `ThreadActivity` client types.

- [ ] **Step 1: Edit the interfaces** in `components/app/intel/demand-view.tsx`:

```ts
export interface ThreadActivity { score: number; comments: number }
export interface PainInsight { text: string; quote?: string; sourceUrl?: string; mentions?: number }
export interface Pocket { surface: string; platform: string; count: number; intentSum?: number; topThreads: { title: string; url: string; intent?: number; publishedAt?: string | null; theme: string; activity?: ThreadActivity | null }[] }
export interface Demand {
  category: string;
  icp: { whoItsFor: string; jobsToBeDone: string[]; useCases: string[] };
  searchDemand: { totalAddressableVolume: number; themes: Theme[]; topKeywords: { keyword: string; volume: number; intent: string | null }[] };
  community: { pockets: Pocket[] };
  buyerInsights: { pains: PainInsight[]; lovedFeatures: string[]; personas: string[]; buyerLanguage: string[]; sources: string[] };
}

/** Accept legacy string[] pains AND new PainInsight[] (older report_payload/demand_intel blobs). */
export function normalizePains(raw: unknown): PainInsight[] {
  if (!Array.isArray(raw)) return [];
  const out: PainInsight[] = [];
  for (const it of raw) {
    if (typeof it === "string") { const t = it.trim(); if (t) out.push({ text: t }); }
    else if (it && typeof it === "object" && typeof (it as { text?: unknown }).text === "string") {
      const o = it as Record<string, unknown>; const text = String(o.text).trim(); if (!text) continue;
      out.push({ text, quote: typeof o.quote === "string" ? o.quote : undefined, sourceUrl: typeof o.sourceUrl === "string" ? o.sourceUrl : undefined, mentions: typeof o.mentions === "number" ? o.mentions : undefined });
    }
  }
  return out;
}
```

  Then in the EXISTING `DemandView` `Body` `Cluster` for pains (line ~84), map through text so the old view still compiles: `items={normalizePains(buyerInsights.pains).map((p) => p.text)}`.

- [ ] **Step 2: Typecheck — Expected: PASS.** `pnpm exec tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add components/app/intel/demand-view.tsx
git commit -m "feat(ws2): client Demand type — activity + PainInsight + normalizePains"
```

---

### Task 6: EvidenceDrawer — the universal drill-down surface

One reusable right-side drawer that opens for any data point and shows its evidence + context.

**Files:**
- Create: `components/app/intel/evidence-drawer.tsx`
- Create: `.design-sync/ds-src/EvidenceDrawer.tsx` (mirror; coverage ratchet)

**Interfaces:**
- Produces: a tagged-union subject + a context-provider hook so any child can open it:
```ts
export type EvidenceSubject =
  | { kind: "keyword"; keyword: string; volume: number; intent: string | null; theme?: string }
  | { kind: "theme"; theme: string; totalVolume: number; intent: string; keywords: { keyword: string; volume: number; intent: string | null }[] }
  | { kind: "thread"; title: string; url: string; surface: string; theme: string; publishedAt?: string | null; intent?: number; activity?: { score: number; comments: number } | null }
  | { kind: "pain"; text: string; quote?: string; sourceUrl?: string; mentions?: number };
export function useEvidenceDrawer(): { open: (s: EvidenceSubject) => void };
export function EvidenceDrawerProvider({ children }: { children: React.ReactNode }): JSX.Element;
```

- [ ] **Step 1: Implement** — a client component: a React context holding `subject|null`, a `Provider` that renders children + the drawer panel, and `useEvidenceDrawer()` returning `open`. Compose the panel from `@/components/ui/dialog` (or a fixed-position aside styled with `--c-*`); render a `renderSubject(subject)` switch — keyword/theme/thread/pain each show their fields + an `EvidenceLink` to the real source (`sourceUrl` for pain, `url` for thread, a Google-SERP link for keyword, the keyword list for theme). Every external link uses the intel kit's `EvidenceLink`. Respect `prefers-reduced-motion`; focus-trap the panel; `Esc` closes. Tokens only.

  Key contract detail (honesty): a `pain` with no `sourceUrl` shows "from N competitor review pages" + the page-level sources, NOT a fabricated deep link; a `thread` with `activity == null` shows date + intent only (no engagement line).

- [ ] **Step 2: Add the ds-src mirror** carrying `/* @mirrors components/app/intel/evidence-drawer.tsx */`; register in `.design-sync/ds-src/{index.tsx,build.mjs,layout.mjs}` as prior mirrors were; `node .design-sync/ds-src/build.mjs && node .design-sync/ds-src/layout.mjs`; `pnpm bless:design -- EvidenceDrawer`.

- [ ] **Step 3: Verify** `pnpm exec tsc --noEmit && pnpm check:design` (0 STALE for EvidenceDrawer, parity OK).

- [ ] **Step 4: Commit**

```bash
git add components/app/intel/evidence-drawer.tsx .design-sync/
git commit -m "feat(ws2): EvidenceDrawer — reusable drill-down surface for every data point"
```

---

### Task 7: IntentRecencyMap component

Canvas dot-plot: x = recency, y = intent, colour = surface, ring = high-intent; dot click opens the thread in the drawer.

**Files:**
- Create: `components/app/intel/intent-recency-map.tsx` + `.design-sync/ds-src/IntentRecencyMap.tsx`

**Interfaces:**
- Consumes: `Pocket[]` (flattened to threads), `useEvidenceDrawer`.
- Produces: `export function IntentRecencyMap({ pockets }: { pockets: Pocket[] }): JSX.Element` — a `<canvas>` sized to its container (devicePixelRatio-aware, redraw on resize + theme change), plotting each thread; a click-hit-test maps a click to the nearest thread and calls `open({ kind: "thread", … })`. Colour per surface from a stable palette. Axis labels + a small surface legend. Build to the mockup's map (Artifact reference). Guard empty pockets with a friendly empty state. Canvas only — no chart lib (bundle).

- [ ] **Step 2: ds-src mirror** (`@mirrors …/intent-recency-map.tsx`), register, build, `pnpm bless:design -- IntentRecencyMap`.
- [ ] **Verify** `tsc` + `check:design` green. **Commit** `feat(ws2): IntentRecencyMap — intent×recency dot plot, click→drawer`.

---

### Task 8: BuyerThreadFeed component

The complete grouped feed with filter chips; every row opens the thread in the drawer and shows engagement where present.

**Files:**
- Create: `components/app/intel/buyer-thread-feed.tsx` + `.design-sync/ds-src/BuyerThreadFeed.tsx`

**Interfaces:**
- Consumes: `Pocket[]`, `useEvidenceDrawer`, `relativeDate` (from demand-view.tsx).
- Produces: `export function BuyerThreadFeed({ pockets }: { pockets: Pocket[] }): JSX.Element` — flattens pockets→threads, sorts newest-first, filter chips (All / 🔥 high-intent (`intent >= .8`) / last-30d), a live "N shown" count. Each row: surface chip (colour) + title (button → drawer) + intent badge + date + **engagement `▲score · N comments` only when `activity` present**. Long list in a scroll container. Build to the mockup's feed.

- [ ] **ds-src mirror**, register, build, `pnpm bless:design -- BuyerThreadFeed`. **Verify** `tsc`+`check:design`. **Commit** `feat(ws2): BuyerThreadFeed — full filterable thread feed, engagement where available`.

---

### Task 9: PainBars component

Ranked frequency bars; each expands to quote + real source; the row opens the pain in the drawer.

**Files:**
- Create: `components/app/intel/pain-bars.tsx` + `.design-sync/ds-src/PainBars.tsx`

**Interfaces:**
- Consumes: `PainInsight[]`, `useEvidenceDrawer`.
- Produces: `export function PainBars({ pains }: { pains: PainInsight[] }): JSX.Element` — sort by `mentions ?? 0` desc; each row = label + count + a `--c-action` gradient bar (width = mentions / max), click expands the `quote` + an `EvidenceLink` to `sourceUrl` (or, if absent, a muted "no direct source" note) AND offers "details" → drawer. Animate width with `transition` (respect reduced-motion). Empty state when no pains. Build to the mockup's bars.

- [ ] **ds-src mirror**, register, build, `pnpm bless:design -- PainBars`. **Verify** `tsc`+`check:design`. **Commit** `feat(ws2): PainBars — mention-ranked pains with expandable evidence`.

---

### Task 10: Rebuild CustomersView

Compose the three rows and wrap everything in the EvidenceDrawer; wire every entry to open it.

**Files:**
- Modify: `components/app/intel/customers-view.tsx`

**Interfaces:**
- Consumes: `EvidenceDrawerProvider`/`useEvidenceDrawer` (T6), `IntentRecencyMap` (T7), `BuyerThreadFeed` (T8), `PainBars` (T9), `normalizePains` (T5), the kit.

- [ ] **Step 1: Restructure `CustomersBody`** to render, inside `<EvidenceDrawerProvider>`:
  1. **Row 1 (two columns)** — `Who your buyer is` (compact: `icp.whoItsFor` + `→` + `icp.jobsToBeDone[0]`, then `useCases` as chips — drop the descriptive sentence) | `Demand themes` where each theme renders name + `fmtCompact(totalVolume)/mo` + intent `Badge` AND **its `sampleKeywords` as chips beneath** (each keyword chip is a button → `open({ kind: "keyword", … })`); the theme header is a button → `open({ kind: "theme", …, keywords: <the theme's keywords resolved from `searchDemand.topKeywords` filtered to `sampleKeywords`> })`.
  2. **Row 2 (full width)** — `Where they hang out`: `<IntentRecencyMap pockets={community.pockets} />` then `<BuyerThreadFeed pockets={community.pockets} />`.
  3. **Row 3 (full width)** — `Top buyer pains`: `<PainBars pains={normalizePains(buyerInsights.pains)} />`. Attach `mentions` when the LLM provided it; else the bars fall back to equal weight (still ranked by array order) — do NOT fabricate counts.
  Keep the existing best-effort `synthesis` fetch ONLY if still needed for the "in your plan" pill; otherwise drop it. Remove `QuoteGroup`/`InfoBox` if now unused.

- [ ] **Step 2: Typecheck + build + bundle** — `pnpm exec tsc --noEmit && pnpm build && node scripts/check-bundle.mjs`. The customers page MUST stay ≤ 280 KB (its pin). If it grows, `dynamic()`-import the `EvidenceDrawer` and/or `IntentRecencyMap`. If it drops under 275, delete its `KNOWN_OVERAGES_KB` entry (the script instructs this).

- [ ] **Step 3: Commit** `feat(ws2): rebuild CustomersView — analytical rows + universal evidence drawer`.

---

### Task 11: Claude Design reconcile + parity

**Files:** `.design-sync/ds-src/**` (the customers screen mirror + the 4 new atomic mirrors already added in T6–T9), `.design-sync/INVENTORY.md`, `.design-sync/NOTES.md`.

- [ ] **Step 1** — reconcile the customers **screen** mirror (the ds-src card mirroring `customers-view.tsx`) to the rebuilt design; update `INVENTORY.md` (new atomic components + rebuilt customers screen); add a dated `NOTES.md` entry.
- [ ] **Step 2** — `node .design-sync/ds-src/build.mjs && node .design-sync/ds-src/layout.mjs && pnpm bless:design && pnpm check:design` → 0 STALE + parity OK.
- [ ] **Step 3: Commit** `design(ws2): reconcile customers DS mirrors + INVENTORY (0 STALE)`.

---

### Task 12: Full gates + live verification (fixtures=false) + PR

- [ ] **Step 1: All gates** — `pnpm test && pnpm check:arch && pnpm check:design && pnpm lint`; then a fresh `pnpm build && node scripts/check-bundle.mjs` (customers ≤ pin, no baseline raised).
- [ ] **Step 2: Live render (CLAUDE.md hard rule)** — bust nudgi's `demand-intel:*` + `demand:*` + `reviews:*` `search_cache` rows (so a fresh gather runs the new code), `REACHKIT_USE_FIXTURES=false`, open `/app/audience/customers`, and confirm from the rendered DOM: keywords show under themes; the intent map renders + a dot click opens the drawer; the feed lists ALL threads with real Reddit/HN counts where present and NO count elsewhere; pains are ranked bars each expanding to a quote + a real per-pain source (or an honest "page-level source" note); every keyword/theme/thread/pain opens the drawer with real evidence. Confirm `/app/diagnostics` shows the demand gather attributed + capped and NO new vendor spend from activity (it's free).
- [ ] **Step 3: PR** — push `feat/ws2-customers-redesign`; `gh pr create` describing the analytical rebuild, real-activity-where-available, per-pain provenance, and the universal evidence drawer; note the live-render was done on prod/preview.

---

## Self-Review

**Spec coverage:** de-wordified ICP + keywords-under-themes → T5/T10. Intent×recency map → T7. Full filterable feed + dates + real activity → T1/T2/T8. Ranked pain bars + per-pain evidence → T3/T9. Universal drill-down → T6 + wired in T7/T8/T9/T10. Legacy tolerance → normalisers T3/T4/T5. Cost/honesty → T1 (null-degrade), T2 (bounded, in-gather), constraints block. DS → T6–T9 (atomic) + T11 (screen). ✅

**Placeholder scan:** data-layer tasks (1–5) carry full TDD code. UI tasks (6–10) give exact prop contracts + composition + the approved Artifact as the pixel reference + the honesty rules per component — the pattern used successfully for WS1's UI tasks; no "TBD"/"handle edge cases".

**Type consistency:** `ThreadActivity` (T1) → `topThreads.activity` (T2) → client `Pocket` (T5) → map/feed (T7/T8) → drawer `thread` subject (T6). `PainInsight` (T3) → gather (T4) → client (T5) → `PainBars`/drawer (T9/T6). `normalizePains` defined server (T3) + client (T5), same semantics; used T4/T10. `EvidenceSubject` union (T6) consumed by T7/T8/T9/T10. Consistent.

**Verify-time confirmations (flagged, not placeholders):** exact `@/components/ui/dialog` API for the drawer (T6), `fmtCompact`/`Badge`/`EvidenceLink`/`intentTone` signatures from `kit.tsx`, and the ds-src registration mechanics (mirror the existing `CompetitorGapMap`/`ReferrerRow` setup) — confirm against source at implementation; never substitute a raw hex or a non-existent token.
