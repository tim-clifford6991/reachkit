# Reverse-Referral Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Discover the non-obvious third-party platforms that funnel customers to a user's competitors but not to the user — by mining the inbound backlink graph, traffic-weighting each referrer, classifying it into a channel type, and surfacing the cross-competitor intersection as a ranked, actionable "channels you're missing" panel for paid users.

**Architecture:** A new paid-only scan step calls DataForSEO's **`backlinks/domain_intersection`** with the user's competitors as targets — getting, server-side, the referring domains that feed multiple rivals at once. It separately fetches the subject's own referring domains (`backlinks/backlinks`, `one_per_domain`), then computes the opportunity set = `(domains feeding ≥minCompetitors rivals) − (subject's own referrers)`. Each surviving host runs through a **noise gate** (ubiquitous sites, customer-embed TLDs like `.edu`/`.gov`, generic mega-authority, and the cohort's own domains), is weighted by the referring host's own organic traffic (`bulk_traffic_estimation`), classified into a channel type, and ranked by `traffic × competitor coverage`. Results persist into the existing report payload as a new deep section and render as a dashboard panel gated behind `isPaid()`.

> **The noise gate is the product.** Live validation proved that without it, the top results are amazon/stanford.edu/craigslist (useless); with it, the top results are Zapier/n8n/beehiiv/dev.to/podcast networks (the "secret channels"). Anyone can pull the intersection data — the curation is the defensible value.

**Tech Stack:** TypeScript, Next.js App Router (`/app/report/[slug]`), Inngest (scan orchestration), Supabase/Postgres (`raw_documents`, `scans.report_payload`), DataForSEO Backlinks API, Vitest.

## Global Constraints

- **Never fabricate.** An empty referral result is honest and routes to the existing Cold Start path. Never invent a referrer or a traffic estimate. Follow the existing `competitor-filter.ts` "honesty bar" philosophy.
- **Paid-only.** The full engine runs only when `entitlementsFor(userId).active === true` (Solo + Growth). Free tier never triggers a Backlinks API call.
- **Budget-bounded.** Every external call charges `ScanBudget.charge({ toolCalls, cents })`. The referral step must respect the per-scan budget cap (`env.scanBudgetCents`, default 50¢; `maxToolCalls` 60) and degrade to a partial/empty result rather than throw on `BudgetExceededError`.
- **Degrade, never throw.** Mirror `tavily.ts` / `seo.ts`: any adapter failure returns `[]` or `null`, never propagates. A failed referral step must not fail the scan.
- **Prerequisite (out of build scope):** DataForSEO Backlinks subscription must be active. Until then `wantBacklinks = false` in `lib/scan/profile/seo.ts` and the engine returns empty by design.
- **DataForSEO endpoints used:** `backlinks/domain_intersection/live` (cross-competitor intersection — the core primitive), `backlinks/backlinks/live` (subject's own referrers, `one_per_domain`), `dataforseo_labs/google/bulk_traffic_estimation/live` (referrer traffic weight).

---

## Validation Status (2026-06-25) — Tasks 1–6 BUILT & LIVE-VERIFIED

The data spine is implemented on branch `feat/no-trial-and-skeletons` (uncommitted) and validated live against the DataForSEO Backlinks 14-day trial.

**Implemented & green:**
- `lib/scan/referral/{types,classify,intersect,discover}.ts`, `lib/scan/adapters/dataforseo-{backlinks,traffic}.ts`
- `tests/unit/referral-intersect.test.ts` — 11 passing (classify noise predicates, `rankOpportunities`, injected `discoverReferralChannels`)
- `tests/integration/referral-discovery.test.ts` — live harness (re-point via `REF_SELF` / `REF_COMPETITORS`)

**What the live run proved (savvycal.com vs cal.com/calendly/acuityscheduling):**
- The naive `backlinks one_per_domain` + client-side intersection from the original plan was WRONG — top-by-rank referrers barely overlap → returned only `bit.ly`. Replaced with `domain_intersection` (server-side). **The original Task 4 design is superseded; see below.**
- `domain_intersection` returns the FULL intersection of all targets → including the subject as a target makes it always-present (0 opportunities). Correct design targets **competitors only**, then subtracts the subject's own referrers.
- Naive ranking surfaces noise; the noise gate (now in `classify.ts`) is what makes it useful.
- Engine is most valuable for an UNDERDOG subject; a dominant incumbent legitimately yields ~0 opportunities.
- Cost ≈ 3 DataForSEO calls/scan (intersection + self referrers + traffic) — pennies.

**Known limitation (→ v2):** `domain_intersection` returns domains linking to ALL targets, so competitor coverage is effectively N/N; "feeds 2 of 3" is missed. Partial coverage needs pairwise/union intersections.

**Remaining gap before action-ready output (new Task 6b):** results are domain-level, so classification is starved (`other` dominates). Enriching the top ~20 candidates with the actual referring page (via `backlinks/backlinks` per host or Tavily extract) is required to label "integration directory" vs "community" and emit a concrete action.

---

## File Structure

**New files (✅ = built & validated):**
- ✅ `lib/scan/referral/types.ts` — `Referrer`, `ClassifiedReferrer`, `ChannelType`, `ReferralOpportunity`, `CompetitorReferralChannels` interfaces.
- ✅ `lib/scan/referral/classify.ts` — pure classifier (host/URL → `ChannelType`) **plus the noise gate**: `isUbiquitousHost`, `isCustomerEmbedTld`, `isGenericAuthority`, `isNoiseHost(host, exclude)`.
- ✅ `lib/scan/referral/intersect.ts` — `rankOpportunities(rows, ctx)`: noise-filter + traffic-weight + rank pre-intersected rows into opportunities/shared (the intersection itself is server-side now).
- ✅ `lib/scan/adapters/dataforseo-backlinks.ts` — `fetchDomainIntersection` (+ `parseDomainIntersection`) for the cross-competitor primitive, and `fetchBacklinks` (+ `parseBacklinks`) for the subject's own referrers.
- ✅ `lib/scan/adapters/dataforseo-traffic.ts` — bulk traffic estimation for referrer weighting.
- ✅ `lib/scan/referral/discover.ts` — orchestrates: `domain_intersection(competitors)` ∥ `fetchBacklinks(self)` → resolve competitor hosts → traffic-weight → `rankOpportunities`.
- `lib/scan/tools/find-referrals.ts` — `ToolDefinition` wrapper with budget charging + `raw_documents` persistence.
- `components/report/competitor-referral-channels-section.tsx` — dashboard panel.

**Modified files:**
- `lib/scan/profile/seo.ts` — add `fetchBacklinksLive()` alongside existing `parseBacklinksSummary`.
- `lib/scan/report.ts` — extend `ReportPayload` with `competitorReferralChannels?` + assemble it.
- `lib/billing/entitlements.ts` — add `competitorReferralChannels` to the redaction lock-list for free tier.
- `lib/inngest/functions/scan-requested.ts` — add `step.run("referral-discovery")` inside the paid (`tier === "full"`) branch.
- `app/report/[slug]/page.tsx` — render the new section wrapped in the deep-section tier shell.

---

## The Paid-User Experience (what this ships)

A Solo/Growth user runs a scan. After the standard report, a new dashboard panel appears:

**"Channels feeding your competitors (that you're missing)"** — a ranked table where each row is a *specific named platform*, not a generic channel:

| Platform | Type | Competitors using it | Est. reach | Your status | Action |
|---|---|---|---|---|---|
| `r/nocode` wiki | Community | 3 of 4 | High | Absent | Get listed / post |
| `latenode.com/integrations` | Partner/Directory | 2 of 4 | Medium | Absent | Request integration listing |
| `bettertech.beehiiv.com` | Newsletter | 2 of 4 | Medium | Absent | Pitch the editor |

The differentiator vs. "post on YouTube": every row is a real URL already sending traffic to ≥2 competitors, ranked by `traffic weight × competitor coverage`, with the user provably absent. Free tier sees a teaser (locked count + blurred rows) via the existing `DeepSectionShell` pattern.

---

## Task 1: Referral domain types — ✅ DONE (as specified)

**Files:**
- Create: `lib/scan/referral/types.ts`
- Test: (no test — pure type declarations, validated by consumers)

**Interfaces:**
- Produces: `ChannelType`, `Referrer`, `ClassifiedReferrer`, `ReferralOpportunity`, `CompetitorReferralChannels` (consumed by every later task).

- [ ] **Step 1: Write the type module**

```typescript
// lib/scan/referral/types.ts

/** The kind of distribution surface a referring page represents. */
export type ChannelType =
  | "community"      // subreddit, forum, HN, Discord/Slack directory
  | "directory"      // listing/aggregator that is a real funnel (not noise)
  | "marketplace"    // G2, Capterra, AppSumo, Product Hunt category pages
  | "newsletter"     // beehiiv/Substack issue, mailing-list archive
  | "partner"        // integration page, "works with X", partner directory
  | "review"         // independent review / comparison site
  | "listicle"       // "best X tools" roundup
  | "podcast"        // show notes / episode page
  | "resource"       // docs, wikis, curated resource pages
  | "other";

/** One referring page pointing at a target domain (raw from DataForSEO). */
export interface Referrer {
  referringUrl: string;   // the page that links out
  referringHost: string;  // normalized host of referringUrl
  targetUrl: string;      // the competitor/user page being linked to
  anchorText: string;
}

/** A referrer after classification + traffic weighting. */
export interface ClassifiedReferrer extends Referrer {
  channel: ChannelType;
  /** Estimated monthly organic traffic of the referring host (DataForSEO). null if unknown. */
  refererTraffic: number | null;
}

/** A discovered opportunity: a platform feeding competitors, ranked. */
export interface ReferralOpportunity {
  host: string;                  // the platform host
  exampleUrl: string;            // a representative referring page
  channel: ChannelType;
  competitorsUsing: number;      // how many of the cohort it refers
  competitorHosts: string[];     // which competitors (for evidence)
  reachWeight: number;           // traffic-weighted score (sort key)
  selfPresent: boolean;          // does it already refer the user?
}

/** The assembled report section. */
export interface CompetitorReferralChannels {
  /** Ranked opportunities the user is absent from. */
  opportunities: ReferralOpportunity[];
  /** Platforms the user already shares with competitors (parity, for context). */
  shared: ReferralOpportunity[];
  /** True if any backlink data was available at all. */
  measured: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/scan/referral/types.ts
git commit -m "feat(referral): add reverse-referral type model"
```

---

## Task 2: Referrer classifier — ✅ DONE (extended)

> Built as specified, **plus the noise gate** that live validation proved is essential: `isCustomerEmbedTld` (.edu/.gov), `isGenericAuthority` (mega-sites), and `isNoiseHost(host, exclude)` (combines all + the cohort's own domains). See `lib/scan/referral/classify.ts`.

**Files:**
- Create: `lib/scan/referral/classify.ts`
- Test: `lib/scan/referral/classify.test.ts`

**Interfaces:**
- Consumes: `ChannelType` from Task 1.
- Produces: `classifyReferrer(host: string, url: string): ChannelType`, `isUbiquitousHost(host: string): boolean`, `normalizeHost(url: string): string`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/scan/referral/classify.test.ts
import { describe, it, expect } from "vitest";
import { classifyReferrer, isUbiquitousHost, normalizeHost } from "./classify";

describe("normalizeHost", () => {
  it("strips protocol, www, and path", () => {
    expect(normalizeHost("https://www.reddit.com/r/nocode/wiki")).toBe("reddit.com");
  });
});

describe("isUbiquitousHost", () => {
  it("flags search engines and big socials as noise", () => {
    expect(isUbiquitousHost("google.com")).toBe(true);
    expect(isUbiquitousHost("twitter.com")).toBe(true);
    expect(isUbiquitousHost("facebook.com")).toBe(true);
  });
  it("does not flag a niche forum", () => {
    expect(isUbiquitousHost("indiehackers.com")).toBe(false);
  });
});

describe("classifyReferrer", () => {
  it("classifies reddit as community", () => {
    expect(classifyReferrer("reddit.com", "https://reddit.com/r/nocode")).toBe("community");
  });
  it("classifies g2 as marketplace", () => {
    expect(classifyReferrer("g2.com", "https://g2.com/products/x")).toBe("marketplace");
  });
  it("classifies a beehiiv issue as newsletter", () => {
    expect(classifyReferrer("foo.beehiiv.com", "https://foo.beehiiv.com/p/issue")).toBe("newsletter");
  });
  it("classifies an /integrations path as partner", () => {
    expect(classifyReferrer("latenode.com", "https://latenode.com/integrations/x")).toBe("partner");
  });
  it("classifies a 'best tools' title path as listicle", () => {
    expect(classifyReferrer("blog.example.com", "https://blog.example.com/best-crm-tools-2026")).toBe("listicle");
  });
  it("falls back to other for an unknown host", () => {
    expect(classifyReferrer("randomsite.xyz", "https://randomsite.xyz/page")).toBe("other");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/scan/referral/classify.test.ts`
Expected: FAIL — `classifyReferrer` not defined.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/scan/referral/classify.ts
import type { ChannelType } from "./types";

export function normalizeHost(url: string): string {
  try {
    const h = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return h.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

/** Hosts so common their backlink is meaningless as a "discovered channel". */
const UBIQUITOUS = new Set([
  "google.com", "bing.com", "duckduckgo.com",
  "twitter.com", "x.com", "facebook.com", "instagram.com",
  "linkedin.com", "youtube.com", "t.co", "pinterest.com",
  "wikipedia.org", "gravatar.com", "gstatic.com", "googleusercontent.com",
]);

export function isUbiquitousHost(host: string): boolean {
  return UBIQUITOUS.has(host);
}

const MARKETPLACE_HOSTS = new Set([
  "g2.com", "capterra.com", "getapp.com", "softwareadvice.com",
  "producthunt.com", "appsumo.com", "alternativeto.net", "betalist.com",
]);
const COMMUNITY_HOSTS = new Set([
  "reddit.com", "news.ycombinator.com", "ycombinator.com",
  "quora.com", "stackoverflow.com", "stackexchange.com",
  "indiehackers.com", "dev.to", "lobste.rs",
]);
const PODCAST_HOSTS = new Set([
  "podcasts.apple.com", "spotify.com", "podbean.com", "buzzsprout.com",
]);

export function classifyReferrer(host: string, url: string): ChannelType {
  const u = url.toLowerCase();
  if (MARKETPLACE_HOSTS.has(host)) return "marketplace";
  if (COMMUNITY_HOSTS.has(host)) return "community";
  if (PODCAST_HOSTS.has(host)) return "podcast";
  if (/\.(beehiiv|substack)\.com$/.test(host) || /\/(newsletter|issues?)\//.test(u)) return "newsletter";
  if (/\/integrations?\//.test(u) || /\/partners?\//.test(u) || /works-with/.test(u)) return "partner";
  if (/\b(best|top)-[\w-]*\b/.test(u) && /\b(tools?|apps?|software|alternatives?)\b/.test(u)) return "listicle";
  if (/\b(review|comparison|vs)\b/.test(u)) return "review";
  if (/\/(docs?|wiki|resources?|awesome)\b/.test(u)) return "resource";
  if (/directory|listing/.test(u)) return "directory";
  return "other";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/scan/referral/classify.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/scan/referral/classify.ts lib/scan/referral/classify.test.ts
git commit -m "feat(referral): classify referring pages into channel types"
```

---

## Task 3: Cross-competitor intersection algorithm — ✅ DONE (design changed)

> **SUPERSEDED — do not follow the draft code below.** The intersection is now computed **server-side** by `domain_intersection` (Task 4), so this module no longer does set-difference over per-competitor referrer lists. It is implemented as **`rankOpportunities(rows: ReferralRow[], ctx)`** — noise-filter + traffic-weight + rank pre-intersected rows into `{ opportunities, shared }`. `ReferralRow = { host, competitorHosts: string[], exampleUrl }`. See `lib/scan/referral/intersect.ts` and `tests/unit/referral-intersect.test.ts` (11 passing). The draft below is retained for history only.

This is the core insight. Pure function, no I/O, heavily tested.

**Files:**
- Create: `lib/scan/referral/intersect.ts`
- Test: `lib/scan/referral/intersect.test.ts`

**Interfaces:**
- Consumes: `ClassifiedReferrer`, `ReferralOpportunity` from Task 1; `normalizeHost`, `isUbiquitousHost` from Task 2.
- Produces: `computeOpportunities(self: ClassifiedReferrer[], competitors: Array<{ host: string; referrers: ClassifiedReferrer[] }>, opts?: { minCompetitors?: number; limit?: number }): { opportunities: ReferralOpportunity[]; shared: ReferralOpportunity[] }`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/scan/referral/intersect.test.ts
import { describe, it, expect } from "vitest";
import { computeOpportunities } from "./intersect";
import type { ClassifiedReferrer } from "./types";

const ref = (host: string, traffic: number | null, channel = "community" as const): ClassifiedReferrer => ({
  referringUrl: `https://${host}/page`, referringHost: host,
  targetUrl: "https://target.com", anchorText: "x", channel, refererTraffic: traffic,
});

describe("computeOpportunities", () => {
  it("surfaces a platform feeding 2+ competitors that the user lacks", () => {
    const self: ClassifiedReferrer[] = [ref("ownsite-only.com", 100)];
    const competitors = [
      { host: "a.com", referrers: [ref("nicheforum.com", 5000)] },
      { host: "b.com", referrers: [ref("nicheforum.com", 5000)] },
    ];
    const { opportunities } = computeOpportunities(self, competitors, { minCompetitors: 2 });
    expect(opportunities.map((o) => o.host)).toContain("nicheforum.com");
    const opp = opportunities.find((o) => o.host === "nicheforum.com")!;
    expect(opp.competitorsUsing).toBe(2);
    expect(opp.selfPresent).toBe(false);
  });

  it("excludes platforms the user already shares (puts them in `shared`)", () => {
    const self: ClassifiedReferrer[] = [ref("nicheforum.com", 5000)];
    const competitors = [
      { host: "a.com", referrers: [ref("nicheforum.com", 5000)] },
      { host: "b.com", referrers: [ref("nicheforum.com", 5000)] },
    ];
    const { opportunities, shared } = computeOpportunities(self, competitors, { minCompetitors: 2 });
    expect(opportunities.map((o) => o.host)).not.toContain("nicheforum.com");
    expect(shared.map((o) => o.host)).toContain("nicheforum.com");
  });

  it("drops platforms below the minCompetitors threshold", () => {
    const competitors = [{ host: "a.com", referrers: [ref("solo.com", 9000)] }];
    const { opportunities } = computeOpportunities([], competitors, { minCompetitors: 2 });
    expect(opportunities.map((o) => o.host)).not.toContain("solo.com");
  });

  it("ranks by traffic weight x competitor coverage", () => {
    const competitors = [
      { host: "a.com", referrers: [ref("big.com", 100000), ref("small.com", 100)] },
      { host: "b.com", referrers: [ref("big.com", 100000), ref("small.com", 100)] },
    ];
    const { opportunities } = computeOpportunities([], competitors, { minCompetitors: 2 });
    expect(opportunities[0].host).toBe("big.com");
  });

  it("never returns ubiquitous hosts", () => {
    const competitors = [
      { host: "a.com", referrers: [ref("google.com", 999999)] },
      { host: "b.com", referrers: [ref("google.com", 999999)] },
    ];
    const { opportunities } = computeOpportunities([], competitors, { minCompetitors: 2 });
    expect(opportunities.map((o) => o.host)).not.toContain("google.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/scan/referral/intersect.test.ts`
Expected: FAIL — `computeOpportunities` not defined.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/scan/referral/intersect.ts
import type { ClassifiedReferrer, ReferralOpportunity } from "./types";
import { isUbiquitousHost } from "./classify";

interface CompetitorReferrers {
  host: string;
  referrers: ClassifiedReferrer[];
}

interface Opts {
  minCompetitors?: number;
  limit?: number;
}

/** log1p traffic weight so one huge referrer doesn't dwarf everything. */
function weight(traffic: number | null): number {
  return Math.log1p(Math.max(0, traffic ?? 0));
}

export function computeOpportunities(
  self: ClassifiedReferrer[],
  competitors: CompetitorReferrers[],
  opts: Opts = {},
): { opportunities: ReferralOpportunity[]; shared: ReferralOpportunity[] } {
  const minCompetitors = opts.minCompetitors ?? 2;
  const limit = opts.limit ?? 25;

  const selfHosts = new Set(self.map((r) => r.referringHost));

  // Aggregate per referring host across the competitor cohort.
  const byHost = new Map<string, {
    host: string; exampleUrl: string; channel: ClassifiedReferrer["channel"];
    traffic: number | null; competitorHosts: Set<string>;
  }>();

  for (const comp of competitors) {
    const seenForThisComp = new Set<string>();
    for (const r of comp.referrers) {
      if (isUbiquitousHost(r.referringHost)) continue;
      if (r.referringHost === comp.host) continue; // self-links
      if (seenForThisComp.has(r.referringHost)) continue; // count each comp once per host
      seenForThisComp.add(r.referringHost);

      const cur = byHost.get(r.referringHost);
      if (cur) {
        cur.competitorHosts.add(comp.host);
        if ((r.refererTraffic ?? 0) > (cur.traffic ?? 0)) {
          cur.traffic = r.refererTraffic;
          cur.exampleUrl = r.referringUrl;
        }
      } else {
        byHost.set(r.referringHost, {
          host: r.referringHost, exampleUrl: r.referringUrl, channel: r.channel,
          traffic: r.refererTraffic, competitorHosts: new Set([comp.host]),
        });
      }
    }
  }

  const all: ReferralOpportunity[] = [...byHost.values()]
    .filter((h) => h.competitorHosts.size >= minCompetitors)
    .map((h) => ({
      host: h.host,
      exampleUrl: h.exampleUrl,
      channel: h.channel,
      competitorsUsing: h.competitorHosts.size,
      competitorHosts: [...h.competitorHosts],
      reachWeight: weight(h.traffic) * h.competitorHosts.size,
      selfPresent: selfHosts.has(h.host),
    }))
    .sort((a, b) => b.reachWeight - a.reachWeight);

  return {
    opportunities: all.filter((o) => !o.selfPresent).slice(0, limit),
    shared: all.filter((o) => o.selfPresent).slice(0, limit),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/scan/referral/intersect.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/scan/referral/intersect.ts lib/scan/referral/intersect.test.ts
git commit -m "feat(referral): cross-competitor intersection + ranking"
```

---

## Task 4: DataForSEO backlinks adapter — ✅ DONE (primitive changed)

> **SUPERSEDED — do not follow the draft code below.** Live testing showed `backlinks/backlinks` + client-side intersection returns noise (only `bit.ly`). The validated primitive is **`fetchDomainIntersection(targets, opts)`** → `{ rows: IntersectionRow[] }` calling `backlinks/domain_intersection/live` with the **competitors as targets**, parsed by `parseDomainIntersection(body, targetCount)` (referrer host = the `target` field inside `item.domain_intersection["N"]` cells; present numeric keys = linked targets, 0-based). `fetchBacklinks(domain, { limit })` is retained but used only for the **subject's own referrers**. See `lib/scan/adapters/dataforseo-backlinks.ts`. The draft below is retained for history only.

### (original draft) DataForSEO backlinks adapter (referring pages)

**Files:**
- Create: `lib/scan/adapters/dataforseo-backlinks.ts`
- Test: `lib/scan/adapters/dataforseo-backlinks.test.ts`

**Interfaces:**
- Consumes: `Referrer` from Task 1; `normalizeHost` from Task 2; existing `env` from `lib/config/env.ts`; existing DataForSEO `post()` auth pattern from `lib/scan/profile/seo.ts:45-64`.
- Produces: `parseBacklinks(body: unknown): Referrer[]`, `fetchBacklinks(domain: string, opts?: { limit?: number }): Promise<Referrer[]>`.

- [ ] **Step 1: Write the failing test (parser only — pure, no network)**

```typescript
// lib/scan/adapters/dataforseo-backlinks.test.ts
import { describe, it, expect } from "vitest";
import { parseBacklinks } from "./dataforseo-backlinks";

describe("parseBacklinks", () => {
  it("extracts referring pages from a DataForSEO backlinks response", () => {
    const body = {
      tasks: [{ result: [{ items: [
        { url_from: "https://www.reddit.com/r/nocode/x", url_to: "https://target.com/p", anchor: "great tool" },
        { url_from: "https://g2.com/products/target", url_to: "https://target.com", anchor: "Target" },
      ] }] }],
    };
    const out = parseBacklinks(body);
    expect(out).toHaveLength(2);
    expect(out[0].referringHost).toBe("reddit.com");
    expect(out[0].targetUrl).toBe("https://target.com/p");
    expect(out[0].anchorText).toBe("great tool");
  });

  it("returns [] for an empty / malformed body", () => {
    expect(parseBacklinks(null)).toEqual([]);
    expect(parseBacklinks({ tasks: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/scan/adapters/dataforseo-backlinks.test.ts`
Expected: FAIL — `parseBacklinks` not defined.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/scan/adapters/dataforseo-backlinks.ts
import { env } from "@/lib/config/env";
import { normalizeHost } from "@/lib/scan/referral/classify";
import type { Referrer } from "@/lib/scan/referral/types";

const BACKLINKS_LIVE = "https://api.dataforseo.com/v3/backlinks/backlinks/live";

export function parseBacklinks(body: unknown): Referrer[] {
  const items = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  return items.flatMap((i) => {
    const referringUrl = String(i["url_from"] ?? "");
    if (!referringUrl) return [];
    return [{
      referringUrl,
      referringHost: normalizeHost(referringUrl),
      targetUrl: String(i["url_to"] ?? ""),
      anchorText: String(i["anchor"] ?? ""),
    }];
  });
}

/** One backlink page per referring domain, best-link mode, capped. Returns [] on any failure. */
export async function fetchBacklinks(domain: string, opts: { limit?: number } = {}): Promise<Referrer[]> {
  if (!env.dataForSeoLogin || !env.dataForSeoPassword) return [];
  const auth = Buffer.from(`${env.dataForSeoLogin}:${env.dataForSeoPassword}`).toString("base64");
  try {
    const res = await fetch(BACKLINKS_LIVE, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{
        target: domain,
        mode: "one_per_domain",      // one strongest backlink per referring domain
        limit: opts.limit ?? 200,
        order_by: ["rank,desc"],     // strongest referrers first
        backlinks_status_type: "live",
      }]),
    });
    if (!res.ok) return [];
    return parseBacklinks(await res.json());
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/scan/adapters/dataforseo-backlinks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scan/adapters/dataforseo-backlinks.ts lib/scan/adapters/dataforseo-backlinks.test.ts
git commit -m "feat(referral): DataForSEO backlinks (referring pages) adapter"
```

---

## Task 5: Referrer traffic-estimation adapter — ✅ DONE (as specified)

**Files:**
- Create: `lib/scan/adapters/dataforseo-traffic.ts`
- Test: `lib/scan/adapters/dataforseo-traffic.test.ts`

**Interfaces:**
- Consumes: `env`, DataForSEO auth pattern.
- Produces: `parseTrafficEstimation(body: unknown): Map<string, number>` (host → est. monthly organic traffic), `fetchTrafficForHosts(hosts: string[]): Promise<Map<string, number>>`.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/scan/adapters/dataforseo-traffic.test.ts
import { describe, it, expect } from "vitest";
import { parseTrafficEstimation } from "./dataforseo-traffic";

describe("parseTrafficEstimation", () => {
  it("maps each target host to its estimated organic ETV/traffic", () => {
    const body = { tasks: [{ result: [{ items: [
      { target: "reddit.com", metrics: { organic: { etv: 12345, count: 50 } } },
      { target: "small.com", metrics: { organic: { etv: 7, count: 1 } } },
    ] }] }] };
    const m = parseTrafficEstimation(body);
    expect(m.get("reddit.com")).toBe(12345);
    expect(m.get("small.com")).toBe(7);
  });
  it("returns empty map for malformed body", () => {
    expect(parseTrafficEstimation(null).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/scan/adapters/dataforseo-traffic.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/scan/adapters/dataforseo-traffic.ts
import { env } from "@/lib/config/env";

const BULK_TRAFFIC = "https://api.dataforseo.com/v3/dataforseo_labs/google/bulk_traffic_estimation/live";

export function parseTrafficEstimation(body: unknown): Map<string, number> {
  const items = ((body ?? {}) as {
    tasks?: Array<{ result?: Array<{ items?: Array<Record<string, unknown>> }> }>;
  }).tasks?.[0]?.result?.[0]?.items;
  const out = new Map<string, number>();
  if (!Array.isArray(items)) return out;
  for (const i of items) {
    const host = String(i["target"] ?? "");
    const etv = (i["metrics"] as { organic?: { etv?: number } })?.organic?.etv;
    if (host) out.set(host, typeof etv === "number" ? etv : 0);
  }
  return out;
}

/** Up to 1000 hosts per call. Returns empty map on any failure. */
export async function fetchTrafficForHosts(hosts: string[]): Promise<Map<string, number>> {
  if (hosts.length === 0 || !env.dataForSeoLogin || !env.dataForSeoPassword) return new Map();
  const auth = Buffer.from(`${env.dataForSeoLogin}:${env.dataForSeoPassword}`).toString("base64");
  try {
    const res = await fetch(BULK_TRAFFIC, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ targets: hosts.slice(0, 1000) }]),
    });
    if (!res.ok) return new Map();
    return parseTrafficEstimation(await res.json());
  } catch {
    return new Map();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/scan/adapters/dataforseo-traffic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scan/adapters/dataforseo-traffic.ts lib/scan/adapters/dataforseo-traffic.test.ts
git commit -m "feat(referral): bulk traffic estimation adapter for referrer weighting"
```

---

## Task 6: Discovery orchestrator — ✅ DONE (flow changed)

> **SUPERSEDED — do not follow the draft code below.** Implemented as the validated flow: `domain_intersection(competitors)` ∥ `fetchBacklinks(self)` → resolve each row's `targetIdxs` to competitor hostnames → traffic-weight non-excluded hosts → `rankOpportunities`. Signature: `discoverReferralChannels({ selfDomain, competitorDomains, fetchIntersectionFn?, fetchSelfReferrersFn?, fetchTrafficFn?, minCompetitors?, limit? })`. Returns `measured: false` when <2 competitors or no data. See `lib/scan/referral/discover.ts`. The draft below is retained for history only.

Wires adapters + classifier + intersection into one cohort-level call.

**Files:**
- Create: `lib/scan/referral/discover.ts`
- Test: `lib/scan/referral/discover.test.ts`

**Interfaces:**
- Consumes: `fetchBacklinks` (Task 4), `fetchTrafficForHosts` (Task 5), `classifyReferrer` (Task 2), `computeOpportunities` (Task 3), `CompetitorReferralChannels` (Task 1).
- Produces: `discoverReferralChannels(input: { selfDomain: string; competitorDomains: string[]; fetchBacklinksFn?: ...; fetchTrafficFn?: ... }): Promise<CompetitorReferralChannels>` (adapter fns injectable for testing).

- [ ] **Step 1: Write the failing test (inject fakes — no network)**

```typescript
// lib/scan/referral/discover.test.ts
import { describe, it, expect } from "vitest";
import { discoverReferralChannels } from "./discover";
import type { Referrer } from "./types";

const r = (host: string, target: string): Referrer => ({
  referringUrl: `https://${host}/p`, referringHost: host, targetUrl: target, anchorText: "x",
});

describe("discoverReferralChannels", () => {
  it("returns ranked opportunities the self domain lacks", async () => {
    const backlinks: Record<string, Referrer[]> = {
      "self.com": [r("ownsite.com", "self.com")],
      "compA.com": [r("nicheforum.com", "compA.com")],
      "compB.com": [r("nicheforum.com", "compB.com")],
    };
    const out = await discoverReferralChannels({
      selfDomain: "self.com",
      competitorDomains: ["compA.com", "compB.com"],
      fetchBacklinksFn: async (d) => backlinks[d] ?? [],
      fetchTrafficFn: async () => new Map([["nicheforum.com", 8000]]),
    });
    expect(out.measured).toBe(true);
    expect(out.opportunities.map((o) => o.host)).toContain("nicheforum.com");
    expect(out.opportunities[0].channel).toBe("community");
  });

  it("reports measured=false when no backlinks anywhere", async () => {
    const out = await discoverReferralChannels({
      selfDomain: "self.com", competitorDomains: ["compA.com"],
      fetchBacklinksFn: async () => [],
      fetchTrafficFn: async () => new Map(),
    });
    expect(out.measured).toBe(false);
    expect(out.opportunities).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/scan/referral/discover.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/scan/referral/discover.ts
import { fetchBacklinks as realFetchBacklinks } from "@/lib/scan/adapters/dataforseo-backlinks";
import { fetchTrafficForHosts as realFetchTraffic } from "@/lib/scan/adapters/dataforseo-traffic";
import { classifyReferrer } from "./classify";
import { computeOpportunities } from "./intersect";
import type { ClassifiedReferrer, CompetitorReferralChannels, Referrer } from "./types";

interface Input {
  selfDomain: string;
  competitorDomains: string[];
  fetchBacklinksFn?: (domain: string) => Promise<Referrer[]>;
  fetchTrafficFn?: (hosts: string[]) => Promise<Map<string, number>>;
}

export async function discoverReferralChannels(input: Input): Promise<CompetitorReferralChannels> {
  const fetchBl = input.fetchBacklinksFn ?? realFetchBacklinks;
  const fetchTr = input.fetchTrafficFn ?? realFetchTraffic;

  const selfRaw = await fetchBl(input.selfDomain);
  const compRaw = await Promise.all(
    input.competitorDomains.map(async (d) => ({ host: d, referrers: await fetchBl(d) })),
  );

  const anyData = selfRaw.length > 0 || compRaw.some((c) => c.referrers.length > 0);
  if (!anyData) return { opportunities: [], shared: [], measured: false };

  // One traffic call for every unique referring host across the cohort.
  const allHosts = new Set<string>();
  for (const r of selfRaw) allHosts.add(r.referringHost);
  for (const c of compRaw) for (const r of c.referrers) allHosts.add(r.referringHost);
  const traffic = await fetchTr([...allHosts]);

  const classify = (rs: Referrer[]): ClassifiedReferrer[] =>
    rs.map((r) => ({
      ...r,
      channel: classifyReferrer(r.referringHost, r.referringUrl),
      refererTraffic: traffic.get(r.referringHost) ?? null,
    }));

  const { opportunities, shared } = computeOpportunities(
    classify(selfRaw),
    compRaw.map((c) => ({ host: c.host, referrers: classify(c.referrers) })),
    { minCompetitors: 2, limit: 25 },
  );

  return { opportunities, shared, measured: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/scan/referral/discover.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scan/referral/discover.ts lib/scan/referral/discover.test.ts
git commit -m "feat(referral): cohort discovery orchestrator"
```

---

## Task 6b: Page-level classification enrichment (NEW — required for action-ready output)

**Why:** `domain_intersection` yields domain-level rows only, so `classifyReferrer` is starved and most opportunities land as `other`. To turn `zapier.com — other` into `zapier.com — partner/integration → "get listed"`, enrich the top ~20 ranked opportunities with the actual referring page.

**Files:**
- Modify: `lib/scan/referral/discover.ts` (enrich the top-N opportunities before returning)
- Create: `lib/scan/referral/enrich.ts` — `enrichChannel(host, competitorDomains): Promise<{ channel: ChannelType; exampleUrl: string }>`
- Test: `lib/scan/referral/enrich.test.ts`

**Interfaces:**
- Consumes: `fetchBacklinks` (a real referring *page* per host: call `backlinks/backlinks` filtered to `target` = a competitor, `filters` on the referring domain) OR `tavilyExtract` on `https://<host>`; `classifyReferrer` from Task 2.
- Produces: opportunities whose `channel` is derived from the real page URL/content, and `exampleUrl` is the actual linking page (not `https://<host>`).

**Steps (TDD):**
- [ ] Write a test that, given a fake page URL `https://latenode.com/integrations/calendly`, `enrichChannel` returns `channel: "partner"` and that exact `exampleUrl`.
- [ ] Run → fails.
- [ ] Implement `enrichChannel` (fetch one real referring page for the host, classify on its URL + title).
- [ ] In `discover.ts`, run `enrichChannel` over the top `limit` opportunities (bounded fan-out, budget-aware), replacing `channel`/`exampleUrl`.
- [ ] Run → passes; re-run the live harness and confirm the top opportunities now carry real channel labels.
- [ ] Commit: `feat(referral): page-level channel classification for top opportunities`

**Budget:** ~1 call per enriched host (cap at top 20) — keep behind the same `ScanBudget.charge`; on exhaustion, return the domain-level classification rather than throwing.

---

## Task 7: Scan tool wrapper (budget + persistence)

**Files:**
- Create: `lib/scan/tools/find-referrals.ts`
- Test: `lib/scan/tools/find-referrals.test.ts`

**Interfaces:**
- Consumes: `discoverReferralChannels` (Task 6); existing `ScanBudget` (`lib/tools/registry.ts`), `upsertRawDocument` (`lib/db/raw-documents.ts`), `BudgetExceededError`.
- Produces: `runReferralDiscovery(args: { selfDomain: string; competitorDomains: string[]; mode: string; budget: ScanBudget }): Promise<CompetitorReferralChannels>`.

Cost model: 1 backlinks call per domain (self + up to 5 competitors) + 1 traffic call ≈ `(1 + N) ¢`. Charge before fetching; on `BudgetExceededError` return `measured:false` empty rather than throw.

- [ ] **Step 1: Write the failing test**

```typescript
// lib/scan/tools/find-referrals.test.ts
import { describe, it, expect, vi } from "vitest";
import { runReferralDiscovery } from "./find-referrals";
import { ScanBudget } from "@/lib/tools/registry";

vi.mock("@/lib/db/raw-documents", () => ({ upsertRawDocument: vi.fn(async () => {}) }));
vi.mock("@/lib/scan/referral/discover", () => ({
  discoverReferralChannels: vi.fn(async () => ({
    opportunities: [{ host: "nicheforum.com", exampleUrl: "https://nicheforum.com/p", channel: "community",
      competitorsUsing: 2, competitorHosts: ["a.com", "b.com"], reachWeight: 18, selfPresent: false }],
    shared: [], measured: true,
  })),
}));

describe("runReferralDiscovery", () => {
  it("charges budget and returns opportunities", async () => {
    const budget = new ScanBudget({ maxToolCalls: 60, budgetCents: 50 });
    const out = await runReferralDiscovery({
      selfDomain: "self.com", competitorDomains: ["a.com", "b.com"], mode: "web", budget,
    });
    expect(out.measured).toBe(true);
    expect(out.opportunities).toHaveLength(1);
  });

  it("returns empty measured=false when budget is exhausted", async () => {
    const budget = new ScanBudget({ maxToolCalls: 1, budgetCents: 0 });
    const out = await runReferralDiscovery({
      selfDomain: "self.com", competitorDomains: ["a.com", "b.com"], mode: "web", budget,
    });
    expect(out.measured).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/scan/tools/find-referrals.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

```typescript
// lib/scan/tools/find-referrals.ts
import { ScanBudget, BudgetExceededError } from "@/lib/tools/registry";
import { upsertRawDocument } from "@/lib/db/raw-documents";
import { discoverReferralChannels } from "@/lib/scan/referral/discover";
import type { CompetitorReferralChannels } from "@/lib/scan/referral/types";

const EMPTY: CompetitorReferralChannels = { opportunities: [], shared: [], measured: false };

export async function runReferralDiscovery(args: {
  selfDomain: string;
  competitorDomains: string[];
  mode: string;
  budget: ScanBudget;
}): Promise<CompetitorReferralChannels> {
  const competitorDomains = args.competitorDomains.slice(0, 5);
  const cents = 1 + competitorDomains.length + 1; // backlinks per domain + 1 traffic call
  try {
    args.budget.charge({ toolCalls: 1, cents });
  } catch (e) {
    if (e instanceof BudgetExceededError) return EMPTY;
    throw e;
  }

  const result = await discoverReferralChannels({
    selfDomain: args.selfDomain,
    competitorDomains,
  });

  if (result.measured) {
    await upsertRawDocument({
      subjectType: "web",
      subjectKey: args.selfDomain,
      sourceType: "referral_channels",
      body: result as unknown as Record<string, unknown>,
      mode: args.mode as "web" | "ios" | "android",
    });
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/scan/tools/find-referrals.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scan/tools/find-referrals.ts lib/scan/tools/find-referrals.test.ts
git commit -m "feat(referral): budgeted scan-tool wrapper with raw_documents persistence"
```

---

## Task 8: Report payload integration

**Files:**
- Modify: `lib/scan/report.ts` (add field to `ReportPayload`; thread through `assembleReport`)
- Test: `lib/scan/report.test.ts` (extend existing)

**Interfaces:**
- Consumes: `CompetitorReferralChannels` (Task 1).
- Produces: `ReportPayload.competitorReferralChannels?: CompetitorReferralChannels`; `assembleReport` accepts a new optional input `referralChannels`.

- [ ] **Step 1: Write the failing test (extend existing report test)**

```typescript
// lib/scan/report.test.ts — add this case
it("includes competitorReferralChannels when provided", () => {
  const payload = assembleReport({
    ...baseAssembleInput, // existing fixture used by other tests in this file
    referralChannels: {
      opportunities: [{ host: "nicheforum.com", exampleUrl: "https://nicheforum.com/p",
        channel: "community", competitorsUsing: 2, competitorHosts: ["a.com", "b.com"],
        reachWeight: 18, selfPresent: false }],
      shared: [], measured: true,
    },
  });
  expect(payload.competitorReferralChannels?.opportunities[0].host).toBe("nicheforum.com");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/scan/report.test.ts`
Expected: FAIL — `referralChannels` not accepted / field missing.

- [ ] **Step 3: Implement — add to interface and assembler**

In `lib/scan/report.ts`, add to the `ReportPayload` interface (near the other deep sections around line 120):

```typescript
  // Reverse-referral discovery (paid; teaser-locked)
  competitorReferralChannels?: import("./referral/types").CompetitorReferralChannels;
```

Add `referralChannels` to the `assembleReport` input type and pass it through (in the assembled return object):

```typescript
    competitorReferralChannels: input.referralChannels,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/scan/report.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scan/report.ts lib/scan/report.test.ts
git commit -m "feat(referral): thread referral channels into report payload"
```

---

## Task 9: Tier gating (free-tier redaction)

**Files:**
- Modify: `lib/billing/entitlements.ts` (`redactReportForTier`)
- Test: `lib/billing/entitlements.test.ts` (extend)

**Interfaces:**
- Consumes: `ReportPayload` with the new field.
- Produces: free-tier payload has `competitorReferralChannels` stripped (or reduced to a locked teaser shape consistent with other deep sections).

- [ ] **Step 1: Write the failing test**

```typescript
// lib/billing/entitlements.test.ts — add this case
it("strips competitorReferralChannels for free tier", () => {
  const full = { ...baseReportPayload, competitorReferralChannels: {
    opportunities: [{ host: "x.com", exampleUrl: "https://x.com", channel: "community",
      competitorsUsing: 2, competitorHosts: ["a", "b"], reachWeight: 1, selfPresent: false }],
    shared: [], measured: true } };
  const redacted = redactReportForTier(full, "free");
  expect(redacted.competitorReferralChannels).toBeUndefined();
});

it("keeps competitorReferralChannels for solo tier", () => {
  const full = { ...baseReportPayload, competitorReferralChannels: { opportunities: [], shared: [], measured: true } };
  const redacted = redactReportForTier(full, "solo");
  expect(redacted.competitorReferralChannels).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/billing/entitlements.test.ts`
Expected: FAIL — field still present for free.

- [ ] **Step 3: Implement — add to the existing free-tier strip block**

In `redactReportForTier`, where other deep sections (`competitiveLandscape`, `channelOpportunities`, `creatorsToReach`) are deleted for non-paid tiers, add:

```typescript
  if (!isPaid(tier)) {
    delete clone.competitorReferralChannels;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/billing/entitlements.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/entitlements.ts lib/billing/entitlements.test.ts
git commit -m "feat(referral): gate referral channels behind paid tiers"
```

---

## Task 10: Wire into the paid scan step

**Files:**
- Modify: `lib/scan/full-scan.ts` (call `runReferralDiscovery` in stage 7, pass to `assembleReport`)
- Modify: `lib/inngest/functions/scan-requested.ts` (no new step needed — runs inside existing `tier === "full"` branch via `runFullScan`)

**Interfaces:**
- Consumes: `runReferralDiscovery` (Task 7), the scan's `ScanBudget`, the persisted competitor list, `assembleReport` input (Task 8).

- [ ] **Step 1: Add the discovery call in `runFullScan` before `assembleReport`**

In `lib/scan/full-scan.ts`, stage 7 (where `icpSignals` / `surfaces` / `competitorGap` are gathered, ~line 500), add:

```typescript
  // Reverse-referral discovery: where competitors get traffic that we don't (web mode only).
  const referralChannels =
    mode === "web"
      ? await runReferralDiscovery({
          selfDomain: storeUrl,
          competitorDomains: facts.competitors.map((c) => c.url).filter(Boolean).slice(0, 5),
          mode,
          budget,
        })
      : { opportunities: [], shared: [], measured: false };
```

Then pass it into the existing `assembleReport({...})` call:

```typescript
    referralChannels,
```

- [ ] **Step 2: Add the import at the top of `full-scan.ts`**

```typescript
import { runReferralDiscovery } from "@/lib/scan/tools/find-referrals";
```

- [ ] **Step 3: Run the full-scan test suite to verify nothing regresses**

Run: `pnpm vitest run lib/scan/full-scan.test.ts`
Expected: PASS (existing tests still green; referral defaults to empty when adapters return nothing in test env).

- [ ] **Step 4: Commit**

```bash
git add lib/scan/full-scan.ts
git commit -m "feat(referral): run reverse-referral discovery in paid full scan"
```

---

## Task 11: Dashboard section component

**Files:**
- Create: `components/report/competitor-referral-channels-section.tsx`
- Modify: `app/report/[slug]/page.tsx` (import + render inside `DeepSectionShell`)

**Interfaces:**
- Consumes: `ReportPayload.competitorReferralChannels`; existing `DeepSectionShell` (tier teaser wrapper used by other deep sections).

- [ ] **Step 1: Create the section component**

```tsx
// components/report/competitor-referral-channels-section.tsx
import type { CompetitorReferralChannels, ChannelType } from "@/lib/scan/referral/types";

const CHANNEL_LABEL: Record<ChannelType, string> = {
  community: "Community", directory: "Directory", marketplace: "Marketplace",
  newsletter: "Newsletter", partner: "Partner / Integration", review: "Review site",
  listicle: "Roundup", podcast: "Podcast", resource: "Resource page", other: "Other",
};

function reachBadge(weight: number): string {
  if (weight >= 20) return "High";
  if (weight >= 8) return "Medium";
  return "Low";
}

export function CompetitorReferralChannelsSection({
  data,
}: { data: CompetitorReferralChannels | undefined }) {
  if (!data || !data.measured || data.opportunities.length === 0) return null;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Channels feeding your competitors (that you're missing)</h2>
        <p className="text-sm text-muted-foreground">
          Specific platforms already sending traffic to your rivals — where you're absent.
          Ranked by reach × how many competitors rely on them.
        </p>
      </header>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3">Platform</th>
              <th className="p-3">Type</th>
              <th className="p-3">Competitors using it</th>
              <th className="p-3">Est. reach</th>
            </tr>
          </thead>
          <tbody>
            {data.opportunities.map((o) => (
              <tr key={o.host} className="border-t">
                <td className="p-3">
                  <a href={o.exampleUrl} target="_blank" rel="noopener noreferrer"
                     className="font-medium underline-offset-2 hover:underline">{o.host}</a>
                </td>
                <td className="p-3">{CHANNEL_LABEL[o.channel]}</td>
                <td className="p-3">{o.competitorsUsing} of {o.competitorHosts.length}</td>
                <td className="p-3">{reachBadge(o.reachWeight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render it in the report page**

In `app/report/[slug]/page.tsx`, alongside the other deep sections (wrap in the same `DeepSectionShell` used for `competitiveLandscape` so free tier sees the teaser):

```tsx
import { CompetitorReferralChannelsSection } from "@/components/report/competitor-referral-channels-section";
// ...
<DeepSectionShell unlocked={isPaid(tier)} title="Channels feeding your competitors">
  <CompetitorReferralChannelsSection data={payload.competitorReferralChannels} />
</DeepSectionShell>
```

- [ ] **Step 3: Verify the build + typecheck**

Run: `pnpm tsc --noEmit`
Expected: PASS (no type errors). Do NOT run `pnpm build` while `next dev` is running.

- [ ] **Step 4: Commit**

```bash
git add components/report/competitor-referral-channels-section.tsx app/report/[slug]/page.tsx
git commit -m "feat(referral): dashboard panel for competitor referral channels"
```

---

## Task 12: Data-source activation + live verification — ✅ DONE (engine); ⏳ SEO-signal flip remains

**Live verification of the engine is complete** via `tests/integration/referral-discovery.test.ts` on the DataForSEO Backlinks 14-day trial (savvycal.com vs cal.com/calendly/acuityscheduling): `measured: true`, noise-gated opportunities surfaced real non-obvious channels (Zapier/n8n/beehiiv/dev.to/podcast networks), honesty bar held (no ubiquitous hosts, no self-domain, no .edu/.gov embeds after filtering).

**Re-run the live harness any time:**
```bash
REF_SELF=<domain> REF_COMPETITORS="a.com,b.com,c.com" \
  npx vitest run --config vitest.integration.config.ts --disable-console-intercept \
  tests/integration/referral-discovery.test.ts
```

**Remaining (separate from the engine):**
- [ ] **Flip `wantBacklinks = true`** in `lib/scan/profile/seo.ts` so the existing `referring_domains` SEO signal also populates (now that Backlinks billing is live). Commit: `feat(seo): activate referring-domains signal (backlinks live)`.
- [ ] **Trial-window note:** the Backlinks trial started ~2026-06-25 (14 days). Decide on the $100/mo PAYG minimum before it lapses, or gate the feature off if not converting.

---

## Deferred to v2 (explicitly out of scope)

- **Partial competitor coverage (feeds 2 of 3).** `domain_intersection` returns only domains linking to ALL targets, so a platform feeding 2 of 3 rivals is currently missed. Add pairwise/union intersection passes to capture partial coverage and rank by exact coverage fraction.
- **Similarweb / measured channel-split.** Replace the log-weighted traffic proxy with measured referral/social/direct/paid percentages per competitor. Upgrades `traffic-mix.ts` from estimate to measured.
- **Action-card generation.** Turn each opportunity into a concrete ActionCard ("Get listed on X", "Pitch newsletter Y") routed through the existing Critic Gate, so opportunities flow into "What to do this week".
- **Weekly monitor.** Seed a 5th monitor that re-runs referral discovery on the weekly refresh and flags newly-appeared competitor channels (a `delta-collect.ts`-style diff).
- **Anchor-text intent clustering.** Use anchor text + the referring page's content to infer *why* the link exists (review vs. tutorial vs. directory) for sharper actions.

---

## Self-Review

- **Spec coverage:** backlink fetch (T4), traffic weighting (T5), classification (T2), intersection (T3), discovery wiring (T6), budget+persistence (T7), report shape (T8), tier gate (T9), scan wiring (T10), dashboard (T11), activation+live verify (T12). All covered.
- **Placeholder scan:** every code step contains complete code; live-scan entrypoint in T12 is the one project-specific command to confirm against the actual repo script name.
- **Type consistency:** `CompetitorReferralChannels`, `ReferralOpportunity`, `ClassifiedReferrer`, `Referrer`, `ChannelType` used identically across T1–T11. `computeOpportunities`, `discoverReferralChannels`, `runReferralDiscovery`, `fetchBacklinks`, `fetchTrafficForHosts` signatures match their consumers.
- **Open item to verify at execution:** exact `assembleReport` input fixture name (`baseAssembleInput`) and `DeepSectionShell` prop names — confirm against `lib/scan/report.test.ts` and the existing deep-section render in `app/report/[slug]/page.tsx`.
