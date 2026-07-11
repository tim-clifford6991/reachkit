# WS1 — Competitors Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the paid Competitors page into a browsing-first surface: a gap-map matrix that doubles as the competitor selector, one-line referrer rows with an honest "platform reach" signal, link-to-source (no more 404-on-click), and hide-noise/flag-borderline filtering.

**Architecture:** Data-layer first (pure, unit-tested helpers in `lib/scan/referral/`), threaded into `gatherFullFunnel` and mirrored into the client `Supply` type, then the UI rebuild (`competitors-view.tsx` + two new kit-composed components), then the Claude Design mirror + live verification. No new external call except reusing the existing `fetchTrafficForHosts` once per gather (already inside the `costedIntelStep` cost context via `/api/app/intel`).

**Tech Stack:** Next.js 16 RSC + client components, TypeScript, Vitest, the `@/components/app/intel/kit` (`--c-*`) design kit, DataForSEO adapters.

## Global Constraints

- **Honesty (CLAUDE.md "degrade, never invent"):** reach = the referrer host's own organic ETV, labelled "platform reach — that platform's own traffic, not measured click-through". When `fetchTrafficForHosts` returns nothing (fixtures / no keys / failure), reach is `null` and the UI shows the row without a number — never a fabricated one.
- **Cost (invariant #2):** the reach call must stay inside `gatherFullFunnel`, which runs under `costedIntelStep(appId, "intel", …)` in `app/api/app/intel/route.ts` — do not call `fetchTrafficForHosts` from anywhere outside that context. Guard: `app/api/costed-routes.test.ts`.
- **Brand-ambiguity (invariant #6):** the gap-map and "referrers to pursue" use only the category-validated cohort already in `FunnelResult` — never the raw alternatives extract.
- **Additive/null-coalesced:** every new field is optional and read with `?? …` — older `funnel2:*` cache blobs and `report_payload` predate them.
- **Bundle:** the audience pages are already pinned in `KNOWN_OVERAGES_KB` (`scripts/check-bundle.mjs`). Net JS must not grow the overage; compose from existing kit primitives, do not add heavy deps, do not add a baseline entry.
- **Design parity (CLAUDE.md Change Protocol):** any changed live component gets its `.design-sync/ds-src/` mirror + `INVENTORY.md` updated and `pnpm bless:design` re-pinned in the same change; `pnpm check:design` must stay green.
- **Tokens only:** `--c-*` / kit props — never raw hex or arbitrary Tailwind values.
- **Live-test:** verify with `REACHKIT_USE_FIXTURES=false` by RENDERING `/app/audience/competitors`, not by reading the DB.

Commands: `pnpm test` (unit, ~5s) · `pnpm check:arch` · `pnpm check:design` · `pnpm lint` · `pnpm build` (never while `next dev` runs).

---

### Task 1: Channel-group strength (pure module)

Rolls the 11 `ReferrerCategory` values into the 5 matrix channel groups and buckets each entity's presence.

**Files:**
- Create: `lib/scan/referral/channel-strength.ts`
- Test: `lib/scan/referral/channel-strength.test.ts`

**Interfaces:**
- Consumes: `ReferrerCategory`, `type ReferralBreakdown["byCategory"]` from `lib/scan/referral/classify-referrers.ts` / `funnel.ts`.
- Produces: `type ChannelGroup = "reviews" | "directories" | "community" | "media" | "partners"`; `const CHANNEL_GROUPS: ChannelGroup[]`; `type StrengthBucket = "hi" | "med" | "lo" | "absent"`; `function channelStrengthFor(byCategory: Partial<Record<ReferrerCategory, number>>): Record<ChannelGroup, StrengthBucket>`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/referral/channel-strength.test.ts
import { describe, it, expect } from "vitest";
import { channelStrengthFor, CHANNEL_GROUPS } from "./channel-strength";

describe("channelStrengthFor", () => {
  it("maps all 8 quality categories into the 5 groups and buckets by count", () => {
    const s = channelStrengthFor({
      marketplace: 8,        // reviews → hi (>=7)
      software_directory: 2, // directories → lo (1-2)
      blog: 3, newsletter: 1, media: 2, // media = 6 → med (3-6)
      community: 5, social: 1,          // community = 6 → med
      // partners: none → absent
    });
    expect(s.reviews).toBe("hi");
    expect(s.directories).toBe("lo");
    expect(s.media).toBe("med");
    expect(s.community).toBe("med");
    expect(s.partners).toBe("absent");
  });

  it("returns absent for every group on empty input, and is total over all groups", () => {
    const s = channelStrengthFor({});
    expect(CHANNEL_GROUPS.every((g) => s[g] === "absent")).toBe(true);
    expect(Object.keys(s).sort()).toEqual([...CHANNEL_GROUPS].sort());
  });

  it("ignores low-value categories (ai_directory/spam/other)", () => {
    const s = channelStrengthFor({ ai_directory: 50, spam: 20, other: 10 });
    expect(CHANNEL_GROUPS.every((g) => s[g] === "absent")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/scan/referral/channel-strength.test.ts`
Expected: FAIL — "Cannot find module './channel-strength'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scan/referral/channel-strength.ts
/**
 * Rolls the 11-value ReferrerCategory taxonomy into the 5 channel groups shown
 * on the Competitors gap-map, and buckets each entity's presence by referrer
 * count. Low-value categories (ai_directory/spam/other) are intentionally
 * excluded — the matrix shows QUALITY discovery channels only.
 */
import type { ReferrerCategory } from "@/lib/scan/referral/classify-referrers";

export type ChannelGroup = "reviews" | "directories" | "community" | "media" | "partners";
export const CHANNEL_GROUPS: ChannelGroup[] = ["reviews", "directories", "community", "media", "partners"];
export type StrengthBucket = "hi" | "med" | "lo" | "absent";

// Every QUALITY_CATEGORY maps to exactly one group (total coverage of the 8).
const CATEGORY_GROUP: Partial<Record<ReferrerCategory, ChannelGroup>> = {
  marketplace: "reviews",
  software_directory: "directories",
  community: "community",
  social: "community",
  blog: "media",
  media: "media",
  newsletter: "media",
  partner: "partners",
  // ai_directory / spam / other → intentionally unmapped (low-value)
};

function bucket(count: number): StrengthBucket {
  if (count <= 0) return "absent";
  if (count <= 2) return "lo";
  if (count <= 6) return "med";
  return "hi";
}

export function channelStrengthFor(
  byCategory: Partial<Record<ReferrerCategory, number>>,
): Record<ChannelGroup, StrengthBucket> {
  const counts: Record<ChannelGroup, number> = { reviews: 0, directories: 0, community: 0, media: 0, partners: 0 };
  for (const [cat, n] of Object.entries(byCategory)) {
    const g = CATEGORY_GROUP[cat as ReferrerCategory];
    if (g) counts[g] += n ?? 0;
  }
  return {
    reviews: bucket(counts.reviews),
    directories: bucket(counts.directories),
    community: bucket(counts.community),
    media: bucket(counts.media),
    partners: bucket(counts.partners),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/scan/referral/channel-strength.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scan/referral/channel-strength.ts lib/scan/referral/channel-strength.test.ts
git commit -m "feat(ws1): channel-group strength rollup for competitor gap-map"
```

---

### Task 2: Referrer reach + relevance (pure module)

Applies host-ETV to referrers as "platform reach" and tags borderline-relevance ones.

**Files:**
- Create: `lib/scan/referral/referrer-enrich.ts`
- Test: `lib/scan/referral/referrer-enrich.test.ts`

**Interfaces:**
- Consumes: `QualityReferrer` from `lib/scan/referral/funnel.ts` (extended in Task 3 to carry `etv`/`relevance`); a `Map<string, number>` host→ETV from `fetchTrafficForHosts`.
- Produces: `function enrichReferrers(refs: QualityReferrer[], reach: Map<string, number>): QualityReferrer[]` — returns new referrer objects with `etv` (from the map, or `null` when absent) and `relevance` (`"core"` | `"low"`). Also exports `REACH_FLOOR = 100`, `AUTHORITY_FLOOR = 150`.

Note: this module imports the `QualityReferrer` type from `funnel.ts`; that type gains `etv`/`relevance` in Task 3. Implement Task 3's type change first if your tooling flags the missing fields — the tests here only exercise runtime behaviour and pass regardless, but do Task 3's Step for the `QualityReferrer` interface edit before Task 2 Step 4 if you want a clean typecheck. (They commit separately; order 3-type-edit → 2 is fine, but the plan keeps 2 before 3's funnel wiring for test isolation.)

- [ ] **Step 1: Write the failing test**

```ts
// lib/scan/referral/referrer-enrich.test.ts
import { describe, it, expect } from "vitest";
import { enrichReferrers } from "./referrer-enrich";
import type { QualityReferrer } from "./funnel";

const ref = (over: Partial<QualityReferrer>): QualityReferrer => ({
  host: "g2.com", category: "marketplace", url: "https://g2.com/p", anchor: "x",
  target: "https://rival.com/a", authority: 800, dofollow: true, ...over,
});

describe("enrichReferrers", () => {
  it("attaches platform reach from the ETV map, null when the host is absent", () => {
    const out = enrichReferrers([ref({ host: "g2.com" }), ref({ host: "unknown.io" })],
      new Map([["g2.com", 95000]]));
    expect(out[0]!.etv).toBe(95000);
    expect(out[1]!.etv).toBeNull(); // never invents a number
  });

  it("tags a tiny, low-authority referrer as low relevance", () => {
    const out = enrichReferrers([ref({ host: "tiny.blog", authority: 40 })], new Map([["tiny.blog", 10]]));
    expect(out[0]!.relevance).toBe("low");
  });

  it("keeps a high-reach or high-authority referrer as core", () => {
    const strongReach = enrichReferrers([ref({ host: "g2.com", authority: 40 })], new Map([["g2.com", 95000]]));
    const strongAuth = enrichReferrers([ref({ host: "g2.com", authority: 800 })], new Map());
    expect(strongReach[0]!.relevance).toBe("core");
    expect(strongAuth[0]!.relevance).toBe("core");
  });

  it("does not mutate the input array/objects", () => {
    const input = [ref({ host: "g2.com" })];
    const snapshot = JSON.stringify(input);
    enrichReferrers(input, new Map([["g2.com", 95000]]));
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/scan/referral/referrer-enrich.test.ts`
Expected: FAIL — "Cannot find module './referrer-enrich'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scan/referral/referrer-enrich.ts
/**
 * Enriches quality referrers with "platform reach" (the referring host's own
 * organic ETV — how big the venue is, NOT measured click-through to the rival)
 * and a borderline-relevance flag. Reach comes from fetchTrafficForHosts; a host
 * missing from the map keeps etv = null (we never invent a number).
 */
import type { QualityReferrer } from "@/lib/scan/referral/funnel";

/** A referrer with near-zero reach AND weak authority is marginal → "low". */
export const REACH_FLOOR = 100;      // monthly organic visits
export const AUTHORITY_FLOOR = 150;  // domain_from_rank (0–1000)

export function enrichReferrers(
  refs: QualityReferrer[],
  reach: Map<string, number>,
): QualityReferrer[] {
  return refs.map((r) => {
    const etv = reach.has(r.host) ? (reach.get(r.host) ?? 0) : null;
    const weakReach = (etv ?? 0) < REACH_FLOOR;
    const weakAuthority = (r.authority ?? 0) < AUTHORITY_FLOOR;
    const relevance: QualityReferrer["relevance"] = weakReach && weakAuthority ? "low" : "core";
    return { ...r, etv, relevance };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run lib/scan/referral/referrer-enrich.test.ts`
Expected: PASS (4 tests). (If TS complains that `etv`/`relevance` are not on `QualityReferrer`, apply Task 3 Step 1 first.)

- [ ] **Step 5: Commit**

```bash
git add lib/scan/referral/referrer-enrich.ts lib/scan/referral/referrer-enrich.test.ts
git commit -m "feat(ws1): platform-reach + borderline-relevance enrichment for referrers"
```

---

### Task 3: Wire reach, relevance, and channel-strength into the funnel

Extends the server types and `gatherFullFunnel` to attach the new fields — one bulk reach call, inside the existing cost context.

**Files:**
- Modify: `lib/scan/referral/funnel.ts` (types `QualityReferrer`, `FunnelResult`; body of `gatherFullFunnel`)
- Test: `lib/scan/referral/funnel-enrich.test.ts` (new — tests the enrichment wiring via the extracted helper)

**Interfaces:**
- Consumes: `channelStrengthFor` (Task 1), `enrichReferrers` (Task 2), `fetchTrafficForHosts` from `@/lib/scan/adapters/dataforseo-traffic`.
- Produces: `QualityReferrer` gains `etv?: number | null` and `relevance?: "core" | "low"`. `FunnelResult` gains `channelStrength: Record<string, Record<ChannelGroup, StrengthBucket>>` (keyed by domain, incl. the subject). A new exported pure helper `applyFunnelEnrichment(result, reach)` so the wiring is unit-testable without hitting the network.

- [ ] **Step 1: Extend the types**

In `lib/scan/referral/funnel.ts`, add to the `QualityReferrer` interface (after `dofollow`):

```ts
  /** WS1 — the referring host's own organic ETV ("platform reach"), null when
   *  the reach call is unavailable (fixtures/no keys/failure). NOT click-through. */
  etv?: number | null;
  /** WS1 — "low" = tiny + low-authority referrer (shown muted), else "core". */
  relevance?: "core" | "low";
```

Add the import near the top:

```ts
import { channelStrengthFor, type ChannelGroup, type StrengthBucket } from "@/lib/scan/referral/channel-strength";
import { enrichReferrers } from "@/lib/scan/referral/referrer-enrich";
import { fetchTrafficForHosts } from "@/lib/scan/adapters/dataforseo-traffic";
```

Add to the `FunnelResult` interface:

```ts
  /** WS1 — per-domain quality-channel strength for the gap-map matrix (incl. subject). */
  channelStrength: Record<string, Record<ChannelGroup, StrengthBucket>>;
```

- [ ] **Step 2: Write the failing test for the extracted helper**

```ts
// lib/scan/referral/funnel-enrich.test.ts
import { describe, it, expect } from "vitest";
import { applyFunnelEnrichment } from "./funnel";
import type { FunnelResult } from "./funnel";

function baseResult(): FunnelResult {
  const bd = (byCategory: Record<string, number>, hosts: string[]) => ({
    sampled: hosts.length, byCategory,
    topQualityReferrers: hosts.map((h) => ({ host: h, category: "marketplace" as const, url: `https://${h}/p`, anchor: "a", target: "https://x.com", authority: 800, dofollow: true })),
    qualityShare: 1,
  });
  return {
    subject: { domain: "you.com", isSubject: true, monthlyTraffic: 0, score: 10, band: "b", mix: null, paidEtv: 0, brandedSearchVolume: 0, topPagesCount: 0, lens: null, category: "notetaking", backlinks: bd({ marketplace: 1 }, ["g2.com"]) },
    category: "notetaking",
    competitors: [{ domain: "rival.com", isSubject: false, monthlyTraffic: 100, score: 50, band: "b", mix: null, paidEtv: 0, brandedSearchVolume: 0, topPagesCount: 0, lens: null, closeness: 1, reason: "", backlinks: bd({ marketplace: 8 }, ["g2.com", "capterra.com"]) }],
    discoveryChannels: {}, channelsMissing: [], keyActions: [],
    channelStrength: {},
  };
}

describe("applyFunnelEnrichment", () => {
  it("attaches reach+relevance to every entity's referrers and a channelStrength row per domain", () => {
    const out = applyFunnelEnrichment(baseResult(), new Map([["g2.com", 95000], ["capterra.com", 60000]]));
    expect(out.subject.backlinks.topQualityReferrers[0]!.etv).toBe(95000);
    expect(out.competitors[0]!.backlinks.topQualityReferrers[0]!.relevance).toBe("core");
    expect(out.channelStrength["you.com"]!.reviews).toBe("lo");   // 1 marketplace
    expect(out.channelStrength["rival.com"]!.reviews).toBe("hi"); // 8 marketplace
  });

  it("leaves etv null for hosts missing from the reach map (no invented number)", () => {
    const out = applyFunnelEnrichment(baseResult(), new Map());
    expect(out.subject.backlinks.topQualityReferrers[0]!.etv).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run lib/scan/referral/funnel-enrich.test.ts`
Expected: FAIL — `applyFunnelEnrichment` is not exported.

- [ ] **Step 4: Implement the extracted helper + call it in the funnel**

Add this exported helper to `lib/scan/referral/funnel.ts` (pure — no network):

```ts
/** WS1 — attach platform reach + relevance to every entity's referrers and
 *  compute the per-domain channel-strength matrix. Pure; reach is pre-fetched. */
export function applyFunnelEnrichment(result: FunnelResult, reach: Map<string, number>): FunnelResult {
  const enrichBreakdown = (bd: ReferralBreakdown): ReferralBreakdown => ({
    ...bd,
    topQualityReferrers: enrichReferrers(bd.topQualityReferrers, reach),
  });
  const subject = { ...result.subject, backlinks: enrichBreakdown(result.subject.backlinks) };
  const competitors = result.competitors.map((c) => ({ ...c, backlinks: enrichBreakdown(c.backlinks) }));
  const channelStrength: FunnelResult["channelStrength"] = {};
  for (const e of [subject, ...competitors]) channelStrength[e.domain] = channelStrengthFor(e.backlinks.byCategory);
  return { ...result, subject, competitors, channelStrength };
}
```

Then, inside `gatherFullFunnel`, replace the final assembly (currently the block building `funnelSubject` and the `return { subject: funnelSubject, … }` at lines ~267-269) with a fetch-then-enrich:

```ts
  const preliminary: FunnelResult = {
    subject: { ...subjectWithLens, category: closest.category, backlinks: selfBacklinks },
    category: closest.category,
    competitors: competitorsWithLens,
    discoveryChannels,
    channelsMissing,
    keyActions,
    channelStrength: {},
  };

  // WS1 — one bulk reach call for every quality-referrer host across the cohort.
  // Runs inside costedIntelStep (the /api/app/intel cost context); fixtures/no-keys
  // → empty map → etv stays null (degrade, never invent).
  const reachHosts = [...new Set(
    [preliminary.subject, ...preliminary.competitors].flatMap((e) => e.backlinks.topQualityReferrers.map((r) => r.host)),
  )];
  const reach = await fetchTrafficForHosts(reachHosts);
  return applyFunnelEnrichment(preliminary, reach);
```

(Remove the now-unused `funnelSubject` local.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run lib/scan/referral/funnel-enrich.test.ts && pnpm vitest run lib/scan/referral`
Expected: PASS (new file + existing referral tests still green).

- [ ] **Step 6: Confirm the reach call stays inside the cost context**

Run: `pnpm vitest run app/api/costed-routes.test.ts`
Expected: PASS — `/api/app/intel/route.ts` still wraps the gather in `costedIntelStep` (unchanged); `fetchTrafficForHosts` is only reached through `gatherFullFunnel`. Also: `grep -rn "fetchTrafficForHosts" lib app` shows only `funnel.ts` and `discover.ts` (the pre-existing missing-channel caller) — no new out-of-context caller.

- [ ] **Step 7: Commit**

```bash
git add lib/scan/referral/funnel.ts lib/scan/referral/funnel-enrich.test.ts
git commit -m "feat(ws1): attach platform-reach + channel-strength in gatherFullFunnel (one bulk call, in cost context)"
```

---

### Task 4: Mirror the new fields into the client Supply type

Type-only change so the UI can read `etv`, `relevance`, and `channelStrength`.

**Files:**
- Modify: `components/app/intel/supply-view.tsx` (interfaces `Backlinks`, `Supply`)

**Interfaces:**
- Produces: client `Backlinks.topQualityReferrers[]` items gain `etv?: number | null` and `relevance?: "core" | "low"`; `Supply["funnel"]` gains `channelStrength?: Record<string, Record<string, "hi" | "med" | "lo" | "absent">>`.

- [ ] **Step 1: Edit the interfaces**

In `components/app/intel/supply-view.tsx`, change the `Backlinks` interface's referrer item to include the two fields:

```ts
interface Backlinks { topQualityReferrers: { host: string; category: string; url: string; anchor?: string; target?: string; authority?: number | null; dofollow?: boolean | null; etv?: number | null; relevance?: "core" | "low" }[]; byCategory: Record<string, number>; qualityShare: number; sampled: number }
```

And extend `Supply["funnel"]`:

```ts
export interface Supply {
  funnel: { subject: Entity & { category: string; backlinks?: Backlinks }; category: string; competitors: CompetitorDeep[]; discoveryChannels: Record<string, number>; channelsMissing: Channel[]; channelStrength?: Record<string, Record<string, "hi" | "med" | "lo" | "absent">> };
  keywords: { gaps: Gap[] };
  content?: ContentIntel;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS — no type errors (fields are optional; existing `SupplyView` code untouched).

- [ ] **Step 3: Commit**

```bash
git add components/app/intel/supply-view.tsx
git commit -m "feat(ws1): mirror etv/relevance/channelStrength into client Supply type"
```

---

### Task 5: Gap-map matrix component (selector)

The at-a-glance "where am I absent" grid whose columns are the competitor selector.

**Files:**
- Create: `components/app/intel/competitor-gap-map.tsx`

**Interfaces:**
- Consumes: `ChannelGroup`/`StrengthBucket` shapes as plain strings from `Supply["funnel"]["channelStrength"]`; the ordered entity list (subject first) and a `selected`/`onSelect` pair from the parent.
- Produces: `export function CompetitorGapMap(props: { entities: { domain: string; isSubject?: boolean }[]; channelStrength: Record<string, Record<string, string>>; selected: string; onSelect: (domain: string) => void }): JSX.Element`.

- [ ] **Step 1: Implement the component**

```tsx
// components/app/intel/competitor-gap-map.tsx
"use client";
/**
 * WS1 — the Competitors gap-map. Rows = the 5 quality channel groups, columns =
 * you + rivals, colour = strength; a RED/absent cell in the "you" column where a
 * rival is strong is the honest "you're not here" signal. Column headers ARE the
 * competitor selector (click to focus) — this replaces the old left rail.
 */
import { Eyebrow } from "@/components/app/intel/kit";

const GROUPS: { key: string; label: string }[] = [
  { key: "reviews", label: "Reviews & launch" },
  { key: "directories", label: "Directories" },
  { key: "community", label: "Community" },
  { key: "media", label: "Media & blogs" },
  { key: "partners", label: "Partners" },
];

const CELL: Record<string, { bg: string; fg: string; txt: string }> = {
  hi: { bg: "var(--c-band-strong)", fg: "#fff", txt: "Strong" },
  med: { bg: "var(--c-band-fair)", fg: "#1b1b1b", txt: "Some" },
  lo: { bg: "var(--c-soft)", fg: "var(--c-muted)", txt: "Thin" },
  absent: { bg: "var(--c-band-weak)", fg: "#fff", txt: "None" },
};

export function CompetitorGapMap(props: {
  entities: { domain: string; isSubject?: boolean }[];
  channelStrength: Record<string, Record<string, string>>;
  selected: string;
  onSelect: (domain: string) => void;
}) {
  const { entities, channelStrength, selected, onSelect } = props;
  const cols = `120px repeat(${entities.length}, minmax(64px, 1fr))`;
  return (
    <div>
      <Eyebrow>Gap map — where you&apos;re absent · click a rival to focus</Eyebrow>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, marginTop: 8 }}>
        <span />
        {entities.map((e) => (
          <button
            key={e.domain}
            type="button"
            onClick={() => onSelect(e.domain)}
            aria-pressed={e.domain === selected}
            title={e.isSubject ? "You" : e.domain}
            style={{
              fontFamily: "Plus Jakarta Sans", fontSize: 11.5, fontWeight: e.domain === selected ? 700 : 600,
              padding: "6px 4px", borderRadius: "8px 8px 0 0", cursor: "pointer", textAlign: "center",
              border: "1px solid " + (e.domain === selected ? "var(--c-action)" : "transparent"), borderBottom: "none",
              color: e.domain === selected ? "#fff" : e.isSubject ? "var(--c-action)" : "var(--c-muted)",
              background: e.domain === selected ? "var(--c-action)" : "transparent",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {e.isSubject ? "You" : e.domain.replace(/^www\./, "")}
          </button>
        ))}
        {GROUPS.map((g) => (
          <GroupRow key={g.key} g={g} entities={entities} channelStrength={channelStrength} selected={selected} />
        ))}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--c-faint)", marginTop: 6 }}>
        Red in <b>your</b> column where a rival is strong = the highest-value channels to enter.
      </p>
    </div>
  );
}

function GroupRow(props: {
  g: { key: string; label: string };
  entities: { domain: string; isSubject?: boolean }[];
  channelStrength: Record<string, Record<string, string>>;
  selected: string;
}) {
  const { g, entities, channelStrength, selected } = props;
  return (
    <>
      <span style={{ fontSize: 11.5, color: "var(--c-muted)", display: "flex", alignItems: "center" }}>{g.label}</span>
      {entities.map((e) => {
        const bucket = channelStrength[e.domain]?.[g.key] ?? "absent";
        const c = CELL[bucket] ?? CELL.absent!;
        return (
          <div
            key={e.domain}
            title={`${e.isSubject ? "You" : e.domain} · ${g.label}: ${c.txt}`}
            style={{
              height: 24, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9.5, color: c.fg, background: c.bg,
              outline: e.domain === selected ? "2px solid var(--c-action)" : "none", outlineOffset: -2,
            }}
          >
            {c.txt}
          </div>
        );
      })}
    </>
  );
}
```

Note: confirm `--c-band-strong` / `--c-band-fair` / `--c-band-weak` exist in `app/globals.css` (they are the `--c-band-*` score-band tokens). If the exact names differ, use the actual band tokens from `lib/scan/score-bands.ts` — never a raw hex.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/app/intel/competitor-gap-map.tsx
git commit -m "feat(ws1): gap-map matrix component (doubles as competitor selector)"
```

---

### Task 6: Compact ReferrerRow component

One dense line per referrer, honest reach, link-to-source, expandable detail, muted when low-relevance.

**Files:**
- Create: `components/app/intel/referrer-row.tsx`

**Interfaces:**
- Consumes: a referrer item `{ host; category; url; target?; anchor?; authority?; dofollow?; etv?; relevance? }` (the `Supply` `Backlinks.topQualityReferrers[number]` shape) and `maxEtv` for bar scaling.
- Produces: `export function ReferrerRow(props: { r: ReferrerLike; maxEtv: number }): JSX.Element`, `export type ReferrerLike = …`.

- [ ] **Step 1: Implement the component**

```tsx
// components/app/intel/referrer-row.tsx
"use client";
/**
 * WS1 — one-line referrer row for the Competitors detail. The host links to its
 * SOURCE page (where the backlink lives) so a click never lands on a rival's dead
 * target (the fellow.ai→producthunt 404 case). "Platform reach" is the referring
 * host's own organic traffic (info-tip clarifies: not measured click-through).
 * Low-relevance referrers render muted but are never dropped.
 */
import { useState } from "react";
import { Badge, Bar, EvidenceLink } from "@/components/app/intel/kit";
import { InfoTip } from "@/components/ui/info-tip";
import { fmtCompact } from "@/components/app/intel/shared";

export type ReferrerLike = {
  host: string; category: string; url: string; target?: string; anchor?: string;
  authority?: number | null; dofollow?: boolean | null; etv?: number | null; relevance?: "core" | "low";
};

export function ReferrerRow({ r, maxEtv }: { r: ReferrerLike; maxEtv: number }) {
  const [open, setOpen] = useState(false);
  const low = r.relevance === "low";
  return (
    <div style={{ opacity: low ? 0.6 : 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 84px 64px 16px", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 6, cursor: "pointer" }}
           onClick={() => setOpen((o) => !o)}>
        {/* host → SOURCE page (never the rival's target) */}
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <EvidenceLink href={r.url}>{r.host.replace(/^www\./, "")}</EvidenceLink>
          <Badge tone="neutral">{r.category}</Badge>
          {low && <Badge tone="neutral">low relevance</Badge>}
        </span>
        {/* platform reach bar (honest) */}
        <span>{typeof r.etv === "number" ? <Bar value={r.etv} max={Math.max(1, maxEtv)} /> : <span style={{ fontSize: 10, color: "var(--c-faint)" }}>—</span>}</span>
        <span style={{ fontSize: 11, fontFamily: "JetBrains Mono", textAlign: "right", color: "var(--c-muted)" }}>
          {typeof r.etv === "number" ? `~${fmtCompact(r.etv)}` : ""}
          {typeof r.etv === "number" && <InfoTip>Platform reach — that site&apos;s own monthly organic traffic (how big the venue is), not measured click-through to this rival.</InfoTip>}
        </span>
        <span title={r.dofollow ? "dofollow" : "nofollow"} style={{ fontSize: 11, color: r.dofollow ? "var(--c-band-strong)" : "var(--c-faint)" }}>●</span>
      </div>
      {open && (
        <div style={{ padding: "2px 6px 8px 6px", fontSize: 11.5, color: "var(--c-muted)", display: "flex", flexDirection: "column", gap: 2 }}>
          <span>Source: <EvidenceLink href={r.url}>{r.url}</EvidenceLink></span>
          {r.target && <span>Links to: {r.target}</span>}
          {r.anchor && <span>Anchor: “{r.anchor}”</span>}
          <span>Authority {r.authority ?? "—"} · {r.dofollow ? "dofollow" : "nofollow"}</span>
        </div>
      )}
    </div>
  );
}
```

Note: verify `Bar` accepts `{ value, max }` and `InfoTip` is exported from `@/components/ui/info-tip` (both used elsewhere in the kit). If `Bar`'s prop names differ, match its real signature from `kit.tsx`. Use the real band token name for the dofollow dot.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/app/intel/referrer-row.tsx
git commit -m "feat(ws1): compact ReferrerRow — link-to-source, honest platform reach, expandable"
```

---

### Task 7: Rebuild CompetitorsView around matrix-selector + full-width detail

Replace the two-rail layout with: gap-map (selector) on top, full-width focused detail beneath.

**Files:**
- Modify: `components/app/intel/competitors-view.tsx` (the `CompetitorsBody` structure; keep `useActionPlan`, keyword-gap chips, pages/keywords helpers)

**Interfaces:**
- Consumes: `CompetitorGapMap` (Task 5), `ReferrerRow` (Task 6), `Supply["funnel"].channelStrength`, and the existing `useActionPlan` / pages / keyword-gap helpers already in the file.

- [ ] **Step 1: Restructure `CompetitorsBody`**

Rework the body so it:
1. Builds the ordered entity list `all = [{...subject, isSubject:true}, ...competitors]`.
2. Holds `const [selected, setSelected] = useState(subject.domain)` and resolves `sel = all.find((e) => e.domain === selected) ?? subject`.
3. Renders, top to bottom, inside the existing `Card`/kit idiom (NO second rail — delete the sticky left `CompetitorRow` column):

```tsx
<CompetitorGapMap
  entities={all.map((e) => ({ domain: e.domain, isSubject: e.isSubject }))}
  channelStrength={data.funnel.channelStrength ?? {}}
  selected={selected}
  onSelect={setSelected}
/>

{/* 4-stat strip for `sel` — reuse the existing EntityStatStrip values:
    monthlyTraffic, mix.referringDomains, mix.organicKeywords, brandedSearchVolume */}
<EntityStatStrip e={sel} />

{/* Referrer table — the hero */}
<Card title={`Where ${sel.isSubject ? "you get" : sel.domain + " gets"} found`}>
  {/* sort + category filter controls (local useState) */}
  {(() => {
    const refs = (sel.backlinks?.topQualityReferrers ?? []);
    const maxEtv = Math.max(1, ...refs.map((r) => r.etv ?? 0));
    return refs
      .slice()
      .sort((a, b) => (b.etv ?? 0) - (a.etv ?? 0))
      .map((r, i) => <ReferrerRow key={i} r={r} maxEtv={maxEtv} />);
  })()}
</Card>

{/* Referrers to pursue — gaps, noise-filtered, core-relevance only, +plan chip */}
{/* Their edge → your move — keep existing edgeText/channelsMissing, tightened */}
{/* Top pages + Top keyword gaps — keep existing PagesEdgeList / KeywordGapRow */}
```

For "referrers to pursue", keep the existing gap logic but filter to core relevance:

```tsx
const subjectRefHosts = new Set((subject.backlinks?.topQualityReferrers ?? []).map((r) => r.host));
const pursue = (sel.backlinks?.topQualityReferrers ?? [])
  .filter((r) => !subjectRefHosts.has(r.host) && r.relevance !== "low")
  .sort((a, b) => (b.etv ?? 0) - (a.etv ?? 0))
  .slice(0, 8);
```

Keep `EntityStatStrip`, `PagesEdgeList`, `KeywordGapRow`, `EdgeMoves`, and the `useActionPlan` "+ plan" chips exactly as they are — only their placement changes (now full-width under the matrix, not in a right panel). Delete the left `CompetitorRow` rail and its two-column flex wrapper.

- [ ] **Step 2: Typecheck + build**

Run: `pnpm exec tsc --noEmit && pnpm build`
Expected: PASS. (Do NOT run `pnpm build` while `next dev` is running.)

- [ ] **Step 3: Bundle check**

Run: `node scripts/check-bundle.mjs`
Expected: the audience/competitors page stays within its pinned `KNOWN_OVERAGES_KB` entry (does not grow). If it grew, `dynamic()`-import the heaviest sub-panel rather than raising the baseline.

- [ ] **Step 4: Commit**

```bash
git add components/app/intel/competitors-view.tsx
git commit -m "feat(ws1): rebuild CompetitorsView — matrix selector + full-width detail, one nav"
```

---

### Task 8: Claude Design mirror + parity

Keep the DS 1:1 with the rebuilt live components (Change Protocol).

**Files:**
- Create/Modify: `.design-sync/ds-src/**` mirrors for the changed/added components (`competitors-view`, `competitor-gap-map`, `referrer-row`) with resolving `/* @mirrors <live-path> */` tags.
- Modify: `.design-sync/INVENTORY.md`, `.design-sync/coverage-baseline.json` (only if coverage improves — lower the number), `.design-sync/mirror-lock.json` (via bless).

- [ ] **Step 1: Add/update the ds-src mirrors**

For each new/changed live component, create or update its `.design-sync/ds-src/` mirror carrying `/* @mirrors components/app/intel/<file>.tsx */`. Note in `INVENTORY.md`. Follow `.design-sync/NOTES.md`.

- [ ] **Step 2: Rebuild + check parity**

Run: `node .design-sync/ds-src/build.mjs && node .design-sync/ds-src/layout.mjs && pnpm check:design`
Expected: no token/band drift; every active mirror resolves; coverage baseline not grown.

- [ ] **Step 3: Re-bless the mirror-lock**

Run: `pnpm bless:design -- CompetitorsView CompetitorGapMap ReferrerRow`
Expected: enumerates the re-pinned mirrors; `pnpm check:design` green.

- [ ] **Step 4: Commit**

```bash
git add .design-sync/
git commit -m "design(ws1): mirror competitors redesign into Claude Design + re-bless"
```

---

### Task 9: Full gates + live verification (fixtures=false)

**Files:** none (verification only).

- [ ] **Step 1: All gates green**

Run: `pnpm test && pnpm check:arch && pnpm check:design && pnpm lint`
Expected: all PASS (unit incl. the 3 new test files; arch 0 violations; design parity; lint incl. env rule).

- [ ] **Step 2: Live render (the CLAUDE.md hard rule)**

With `REACHKIT_USE_FIXTURES=false`, run a real deep scan for a SaaS with a rich backlink profile (a note-taking / meeting-tool rival set is ideal), select competitors, then headless-render `/app/audience/competitors` and read the actual DOM:

```bash
# after a scan + competitor selection for a paid app on the running instance
chrome --headless --dump-dom --virtual-time-budget=8000 "http://localhost:3000/app/audience/competitors"
```

Confirm in the rendered output:
- Referrers are **one line** each with a reach bar + `~<compact>` number where reach resolved, and **no number** (not a fake one) where it didn't.
- The **gap-map** shows red/absent cells in the "You" column where a rival is strong; clicking a column header switches the focused detail.
- Clicking a referrer host opens its **source** page (no rival-404).
- Low-relevance referrers render **muted with the tag**, not missing.
- There is **only one left nav** (no second rail).
- `/app/diagnostics` shows the intel spend attributed (the one bulk reach call) — cost stayed inside the context and under the cap.

- [ ] **Step 3: Open the PR**

```bash
git push -u origin feat/ws1-competitors-redesign
gh pr create --title "WS1: Competitors page redesign — browsing-first, honest referrer reach, husk/noise filtering" --body "$(cat <<'EOF'
Implements docs/superpowers/specs/2026-07-11-ws1-competitors-page-design.md.

- Gap-map matrix doubles as competitor selector (one nav, no second rail)
- One-line referrer rows; honest "platform reach" (host ETV, null-degraded, never invented)
- Link-to-source fixes 404-on-click; hide-noise + flag-borderline filtering
- Reach = one bulk fetchTrafficForHosts inside costedIntelStep (invariant #2)
- DS mirror + parity re-blessed

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- Compact 1-line referrers, more visible → Task 6 + Task 7. ✅
- Honest platform reach → Task 2/3 (`etv`, null-degrade) + Task 6 (info-tip). ✅
- Filter ambiguous/illogical (hide noise, flag borderline) → Task 2 (`relevance`) + Task 6 (muted) + Task 7 (pursue excludes low). ✅ (Clear-noise hiding is the pre-existing `isNoiseHost` in `rawReferrers`, unchanged — Task 7 note.)
- 404-husk link fix → Task 6 (host links to source `url`). ✅
- Browsing-first, single-nav, gap-map selector → Task 5 + Task 7. ✅
- Top pages / keyword gaps / edge kept, tightened → Task 7 (reuse existing helpers). ✅
- Cost inside context → Task 3 Step 6 + Task 9 Step 2. ✅
- DS parity → Task 8. ✅

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". UI Tasks 5-7 carry real component code; the one structural directive (Task 7 Step 1) shows the exact JSX composition + the concrete `pursue`/`maxEtv` snippets, and reuses named existing helpers (`EntityStatStrip`, `PagesEdgeList`, `KeywordGapRow`, `EdgeMoves`, `useActionPlan`) that already exist in the file.

**Type consistency:** `QualityReferrer.etv`/`relevance` defined in Task 3 Step 1, consumed by `enrichReferrers` (Task 2), mirrored client-side in Task 4, read by `ReferrerRow` (Task 6). `channelStrengthFor` → `Record<ChannelGroup, StrengthBucket>` (Task 1) → `FunnelResult.channelStrength` keyed by domain (Task 3) → `Supply.funnel.channelStrength` (Task 4) → `CompetitorGapMap` (Task 5). `ChannelGroup` keys (`reviews/directories/community/media/partners`) match between Task 1 impl and Task 5 `GROUPS`. Consistent.

**Known verify-time confirmations (called out inline, not placeholders):** exact `--c-band-*` token names (Task 5/6 notes), `Bar`/`InfoTip`/`EntityStatStrip` prop signatures (Task 6/7 notes) — confirm against `kit.tsx`/`globals.css` at implementation and match the real names; never substitute a raw hex.
