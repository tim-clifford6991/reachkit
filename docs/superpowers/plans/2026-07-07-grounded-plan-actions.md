# Grounded, Actionable Plan Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every plan action directly actionable and grounded in the real data the scan already collected — named competitors (with community-mention counts), engaged communities, and named creators — and give each outreach action a concrete target (WHO/WHERE), so nothing surfaces as a recipient-less email.

**Architecture:** Three coordinated changes. (1) A new structured `ActionTarget` on `ActionCard`, persisted to the `actions` table and threaded through `action-board` → `mergePlanEntries` → the plan card's existing `inferExecutionRoute` (which already reads `entry.channel`/`entry.target`/`entry.targetUrl` — they are currently always null for tracked actions). (2) The action generators (`generateActions` for the standard path, `generateColdStartActions` for cold-start subjects) are fed the rich grounding data — competitor names + mention counts, communities-by-engagement, creators — which today is gathered *after* generation and only feeds the report; we reorder `runFullScan` to gather it *before* generation and pass it in. (3) The generation prompt is rewritten to demand a concrete `target` on every outreach card, drawn from that grounding.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres), Vitest. LLM calls via `lib/llm/anthropic.ts` (`callModel`).

## Global Constraints

- **Backwards compatible:** `ActionCard.target` is nullable everywhere. Legacy persisted actions (no target) must still render — an entry with `target: null` keeps today's behavior (route from the title). No migration backfill; only a re-scan improves an old scan.
- **Degrade-safe:** every new read/parse path must degrade to empty/null and never throw — a completed scan must never fail because grounding was missing (matches the existing `readCompetitorGap`/`readCreatorDocs`/`readChannelOpportunities` try/catch → `[]` convention).
- **§11 invariants unchanged:** `draftRequiresEdit` always true; `evidenceIds` always `[]` from generation; `verification.state` always `"pending"`; effort stays within the `clampEffort` 5–90 window (already shipped in `lib/llm/actions.ts`).
- **Brand-ambiguity hard rule preserved:** actions are generated ONLY for the subject product from its fact sheets/grounding; never introduce outside competitors. Grounding data is already brand-validated upstream (`readCompetitorGap` filters to `facts.competitors`).
- **No new external calls:** the grounding readers read already-collected `raw_documents`/fact sheets. Reordering must not add DataForSEO/YouTube/LLM spend.
- **Reuse `inferExecutionRoute` verbatim** (`lib/scan/distribute/platform-map.ts`) — do not fork routing. The `ActionTarget.channel` values must be ones that map already understands: `community | creator | directory | media | podcast | newsletter | partner | x`.

## File Structure

- `lib/llm/types.ts` — add `ActionTarget` interface + `ActionCard.target: ActionTarget | null`.
- `lib/llm/actions.ts` — validate/coerce `target`; add `ActionGrounding` type; thread grounding into `generateActions` + `buildActionsPrompt`.
- `lib/llm/prompts.ts` — extend `ActionsPromptInput` + `buildActionsPrompt` + `ACTIONS_SYSTEM` with grounding sections and the target requirement.
- `lib/llm/cold-start-actions.ts` — feed real communities/creators into `deriveSeed`; pass grounding through.
- `lib/dev/fixtures.ts` — `coldStartActionsFrom` sets `target` on each card; `ColdStartSeed` carries real community handles.
- `lib/scan/full-scan.ts` — reorder grounding gather before generation; pass grounding in; `persistActions` writes `target`.
- `lib/scan/action-board.ts` — read `target` into `BoardAction`.
- `lib/scan/plan-schedule.ts` — `mergePlanEntries` maps a tracked action's `target` → `PlanEntry.channel`/`target`/`targetUrl`.
- `app/api/action/route.ts` — accept + persist `target` on the POST body (so tracking a suggestion keeps its venue).
- `components/app/intel/plan-entry-card.tsx` — send the entry's `channel`/`target`/`targetUrl` when tracking.
- `supabase/migrations/20260707170000_actions_target.sql` — add `actions.target jsonb`.
- `lib/db/types.ts` — add `target` to the `actions` Row/Insert/Update.

---

## Task 1: `ActionTarget` type + validation/coercion

**Files:**
- Modify: `lib/llm/types.ts` (after the `ActionCard` interface, ~line 103)
- Modify: `lib/llm/actions.ts` (`isValidActionCard` ~line 78-108, `coerceCard` ~line 114-136)
- Test: `lib/llm/actions.test.ts`

**Interfaces:**
- Produces: `ActionTarget { channel: ActionTargetChannel; label: string; url?: string }`; `ActionCard.target: ActionTarget | null`. `coerceCard` guarantees `target` is either a valid `ActionTarget` or `null`.

- [ ] **Step 1: Add the type** to `lib/llm/types.ts`, immediately after the `ActionCard` interface:

```ts
/** Routing channels an ActionTarget can name — a subset that inferExecutionRoute
 *  (lib/scan/distribute/platform-map.ts) already understands. */
export type ActionTargetChannel =
  | "community" | "creator" | "directory" | "media" | "podcast" | "newsletter" | "partner" | "x";

/** WHO/WHERE an action is aimed at — the concrete venue or recipient, so an
 *  outreach card never surfaces as a recipient-less email. */
export interface ActionTarget {
  channel: ActionTargetChannel;
  /** Human venue/recipient name, e.g. "r/productivity", "Thomas Frank", "AlternativeTo". */
  label: string;
  /** Direct venue/profile URL when known (subreddit, creator channel, directory). */
  url?: string;
}
```

Then add to the `ActionCard` interface (after `confidence`):

```ts
  /** WHO/WHERE to execute this action (esp. outreach). Null when not applicable
   *  (e.g. an on-site SEO task) or for legacy cards generated before this field. */
  target: ActionTarget | null;
```

- [ ] **Step 2: Write the failing test** in `lib/llm/actions.test.ts` (add a new `describe` block):

```ts
import { coerceCardForTest } from "./actions"; // add this export in Step 4

describe("ActionCard target coercion", () => {
  const base = {
    category: "outreach" as const, title: "t", why: "w", evidenceIds: [], evidence: [],
    effortMin: 30, suggestedDeadline: "2026-07-20",
    expectedOutcome: { scoreComponent: "outreach", delta: 3 },
    draft: null, draftRequiresEdit: true,
    verification: { method: "url" as const, state: "pending" as const },
    basis: "probability_based" as const, confidence: 0.5,
  };
  test("keeps a well-formed target", () => {
    const c = coerceCardForTest({ ...base, target: { channel: "community", label: "r/productivity", url: "https://reddit.com/r/productivity" } });
    expect(c.target).toEqual({ channel: "community", label: "r/productivity", url: "https://reddit.com/r/productivity" });
  });
  test("drops a malformed target to null", () => {
    expect(coerceCardForTest({ ...base, target: { channel: "bogus", label: "" } as never }).target).toBeNull();
    expect(coerceCardForTest({ ...base, target: null }).target).toBeNull();
    expect(coerceCardForTest({ ...base }).target).toBeNull(); // absent → null
  });
});
```

- [ ] **Step 3: Run it, expect FAIL** — `pnpm test lib/llm/actions.test.ts` → fails (`coerceCardForTest` not exported).

- [ ] **Step 4: Implement.** In `lib/llm/actions.ts`:

  a. Add a target validator + coercion helper near `coerceCard`:

```ts
const TARGET_CHANNELS = new Set([
  "community", "creator", "directory", "media", "podcast", "newsletter", "partner", "x",
]);

/** Coerce a raw target to a valid ActionTarget or null (unknown channel / empty label → null). */
function coerceTarget(raw: unknown): import("@/lib/llm/types").ActionTarget | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const channel = o["channel"];
  const label = o["label"];
  if (typeof channel !== "string" || !TARGET_CHANNELS.has(channel)) return null;
  if (typeof label !== "string" || label.trim().length === 0) return null;
  const url = typeof o["url"] === "string" && o["url"].trim().length > 0 ? o["url"].trim() : undefined;
  return { channel: channel as import("@/lib/llm/types").ActionTargetChannel, label: label.trim(), ...(url ? { url } : {}) };
}
```

  b. In `coerceCard`, add `target` to the returned object:

```ts
    target: coerceTarget((raw as unknown as { target?: unknown }).target),
```

  c. Add a test-only export at the bottom of the file:

```ts
/** Test seam — exercises coerceCard's normalization in isolation. */
export const coerceCardForTest = (raw: unknown): ActionCard => coerceCard(raw as ActionCard);
```

  Note: `isValidActionCard` does NOT need to require `target` (it's optional/nullable). Leave `isValidActionCard` unchanged — a card without `target` is still valid, and `coerceCard` defaults it to null.

- [ ] **Step 5: Run tests, expect PASS** — `pnpm test lib/llm/actions.test.ts`.

- [ ] **Step 6: Commit** — `git add lib/llm/types.ts lib/llm/actions.ts lib/llm/actions.test.ts && git commit -m "feat(actions): add structured ActionTarget to ActionCard + coercion"`

---

## Task 2: DB migration — `actions.target` column

**Files:**
- Create: `supabase/migrations/20260707170000_actions_target.sql`
- Modify: `lib/db/types.ts` (`actions` Row ~line 38-60, Insert ~line 61-83, Update ~line 84+)

**Interfaces:**
- Produces: `actions.target` jsonb nullable column; `Database["public"]["Tables"]["actions"]` Row/Insert/Update carry `target: Json | null` (Insert/Update optional).

- [ ] **Step 1: Write the migration** `supabase/migrations/20260707170000_actions_target.sql`:

```sql
-- Structured execution target (WHO/WHERE) for an action, so outreach actions
-- carry a concrete venue/recipient instead of defaulting to a blank email.
-- Nullable + no backfill: legacy actions keep today's title-derived routing.
alter table public.actions add column if not exists target jsonb;

comment on column public.actions.target is
  'ActionTarget { channel, label, url? } — the concrete venue/recipient an action executes against. Null for on-site tasks and legacy rows.';
```

- [ ] **Step 2: Apply locally** — `supabase migration up` (or the project's apply command). Expected: applies clean; `\d public.actions` shows `target | jsonb`.

- [ ] **Step 3: Update `lib/db/types.ts`** — add `target: Json | null` to the `actions` **Row**, and `target?: Json | null` to **Insert** and **Update** (keep alphabetical ordering used in the file — insert `target` right before `title`):

Row (after `status: string`, before `title: string`):
```ts
          target: Json | null
```
Insert (after `status?: string`, before `title: string`):
```ts
          target?: Json | null
```
Update (after `status?: string`, before `title?: string`):
```ts
          target?: Json | null
```

- [ ] **Step 4: Typecheck** — `pnpm typecheck`. Expected: clean.

- [ ] **Step 5: Commit** — `git add supabase/migrations/20260707170000_actions_target.sql lib/db/types.ts && git commit -m "feat(db): add actions.target jsonb column"`

---

## Task 3: Persist + read `target` (full-scan → action-board)

**Files:**
- Modify: `lib/scan/full-scan.ts` (`persistActions` ~line 456-472)
- Modify: `lib/scan/action-board.ts` (`BoardAction` ~line 49-65, `actionBoard` select ~line 99 + mapping ~line 121-133)
- Test: `lib/scan/action-board.test.ts`

**Interfaces:**
- Consumes: `ActionCard.target` (Task 1), `actions.target` column (Task 2).
- Produces: `BoardAction.target: ActionTarget | null`.

- [ ] **Step 1: Persist the target.** In `lib/scan/full-scan.ts` `persistActions`, add to the `rows` map object (after `effort_min: a.effortMin,`):

```ts
    target: (a.target ?? null) as unknown as Json,
```

- [ ] **Step 2: Write the failing test** in `lib/scan/action-board.test.ts` — assert a row with a `target` column surfaces on `BoardAction.target`. Follow the file's existing mock-`serverDb` pattern; the actions row includes `target: { channel: "community", label: "r/foo", url: "https://reddit.com/r/foo" }` and the assertion is:

```ts
expect(board.open[0]?.target).toEqual({ channel: "community", label: "r/foo", url: "https://reddit.com/r/foo" });
```

(Read the existing tests in the file first to match the exact mock shape — the select string and the row keys must include `target`.)

- [ ] **Step 3: Run it, expect FAIL** — `pnpm test lib/scan/action-board.test.ts`.

- [ ] **Step 4: Implement.** In `lib/scan/action-board.ts`:

  a. Import the type at the top:
```ts
import type { ActionTarget } from "@/lib/llm/types";
```
  b. Add to `BoardAction` (after `effortMin: number | null;`):
```ts
  /** Structured execution target (venue/recipient), null for legacy/on-site actions. */
  target: ActionTarget | null;
```
  c. Add `target` to the `.select(...)` string in `actionBoard` (line 99) — append `, target`.
  d. Add to the pushed object (after `effortMin: ...`):
```ts
      target: (a.target as ActionTarget | null) ?? null,
```

- [ ] **Step 5: Run tests, expect PASS** — `pnpm test lib/scan/action-board.test.ts`.

- [ ] **Step 6: Commit** — `git add lib/scan/full-scan.ts lib/scan/action-board.ts lib/scan/action-board.test.ts && git commit -m "feat(actions): persist + read ActionTarget through the action board"`

---

## Task 4: `mergePlanEntries` maps a tracked action's target onto the plan entry

**Files:**
- Modify: `lib/scan/plan-schedule.ts` (`mergePlanEntries`, the `openActions` loop ~line 108-129)
- Test: `lib/scan/plan-schedule.test.ts` (or the existing test file for this module)

**Interfaces:**
- Consumes: `BoardAction.target` (Task 3).
- Produces: tracked `PlanEntry` whose `channel`/`target`/`targetUrl` reflect the action's `ActionTarget` (falling back to today's `null`/`verifyUrl` when there is no target).

- [ ] **Step 1: Write the failing test** in the plan-schedule test file:

```ts
test("a tracked action's ActionTarget populates the plan entry's channel/target/targetUrl", () => {
  const entries = mergePlanEntries({
    openActions: [{
      id: "a1", title: "Post in r/productivity", category: "outreach", why: null,
      predictedDelta: 3, actualDelta: null, createdAt: "2026-07-01", verifiedAt: null,
      draft: null, verifyUrl: null, effortMin: 30,
      target: { channel: "community", label: "r/productivity", url: "https://reddit.com/r/productivity" },
    }],
    allActionTitles: new Set(["Post in r/productivity"]),
    content: [], distribution: [],
  });
  const e = entries[0]!;
  expect(e.channel).toBe("community");
  expect(e.target).toBe("r/productivity");
  expect(e.targetUrl).toBe("https://reddit.com/r/productivity");
});

test("a tracked action without a target keeps today's behavior", () => {
  const entries = mergePlanEntries({
    openActions: [{
      id: "a2", title: "Fix title tag", category: "seo", why: null,
      predictedDelta: null, actualDelta: null, createdAt: "2026-07-01", verifiedAt: null,
      draft: null, verifyUrl: "https://example.com", effortMin: 20, target: null,
    }],
    allActionTitles: new Set(["Fix title tag"]),
    content: [], distribution: [],
  });
  const e = entries[0]!;
  expect(e.channel).toBeNull();
  expect(e.target).toBeNull();
  expect(e.targetUrl).toBe("https://example.com");
});
```

- [ ] **Step 2: Run it, expect FAIL** — `pnpm test lib/scan/plan-schedule` (target type missing on the mock + channel/target still null).

- [ ] **Step 3: Implement.** In `lib/scan/plan-schedule.ts`, in the `openActions` loop, replace the three lines:

```ts
      channel: null,
      target: null,
      targetUrl: a.verifyUrl,
```

with:

```ts
      // A tracked action's structured target (Task: ActionTarget) drives routing;
      // fall back to the legacy title-derived route (null channel/target) + verifyUrl
      // when the action predates targets or is an on-site task.
      channel: a.target?.channel ?? null,
      target: a.target?.label ?? null,
      targetUrl: a.target?.url ?? a.verifyUrl,
```

Note: `plan-schedule.ts` is PURE and imports only `BoardAction` (type). `BoardAction` now carries `target` (Task 3), so no new import is needed.

- [ ] **Step 4: Run tests, expect PASS** — `pnpm test lib/scan/plan-schedule`.

- [ ] **Step 5: Commit** — `git add lib/scan/plan-schedule.ts lib/scan/plan-schedule.test.ts && git commit -m "feat(plan): route tracked actions from their ActionTarget"`

---

## Task 5: `/api/action` accepts + persists `target`; the plan card sends it

**Files:**
- Modify: `app/api/action/route.ts` (`Body` schema ~line 38-50, insert ~line 112-127)
- Modify: `components/app/intel/plan-entry-card.tsx` (`track` fetch body ~line 90-101)
- Test: an integration/route test if one exists for `/api/action`; else assert the `Body` schema parses a target (unit test on the exported schema — export it if not already).

**Interfaces:**
- Consumes: `ActionTarget` (Task 1). Produces: a tracked-from-plan action row that carries its `target`.

- [ ] **Step 1: Extend the POST body schema** in `app/api/action/route.ts`. Add to the `z.object({...})`:

```ts
  target: z
    .object({
      channel: z.enum(["community", "creator", "directory", "media", "podcast", "newsletter", "partner", "x"]),
      label: z.string().trim().min(1).max(300),
      url: z.string().url().max(2048).optional(),
    })
    .nullish(),
```

- [ ] **Step 2: Persist it.** Destructure `target` from `parsed.data` (line 63) and add to the `.insert({...})` object (after `effort_min: ...`):

```ts
      target: (target ?? null) as Json | null,
```

Also enrich on the dedupe path (the `openMatch` branch, ~line 96-102) so tracking an already-open action fills a missing target:

```ts
    // (add to the `patch` type and the fills block)
    if (target && openMatch.target == null) patch.target = target as Json;
```

To read `openMatch.target`, add `target` to the dedupe `.select("id, status, draft, verify_url, effort_min")` → `.select("id, status, draft, verify_url, effort_min, target")`, and add `target?: Json` to the `patch` type declaration.

- [ ] **Step 3: Send the target from the plan card.** In `components/app/intel/plan-entry-card.tsx`, the `track` callback builds the POST body (~line 93-100). Add a `target` field derived from the entry:

```ts
        target: entry.channel && entry.target
          ? { channel: entry.channel, label: entry.target, ...(entry.targetUrl ? { url: entry.targetUrl } : {}) }
          : undefined,
```

Note: `entry.channel` is a free-form string on `PlanEntry`; the API `z.enum` will reject non-matching channels, so guard by only sending when it is a known channel. Wrap with a whitelist check:

```ts
        target: KNOWN_CHANNELS.has(entry.channel ?? "") && entry.target
          ? { channel: entry.channel as ActionTargetChannel, label: entry.target, ...(entry.targetUrl ? { url: entry.targetUrl } : {}) }
          : undefined,
```

and add near the top of the file:

```ts
import type { ActionTargetChannel } from "@/lib/llm/types";
const KNOWN_CHANNELS = new Set(["community", "creator", "directory", "media", "podcast", "newsletter", "partner", "x"]);
```

- [ ] **Step 4: Typecheck + test** — `pnpm typecheck && pnpm test`. Expected: clean/green. If a `/api/action` route test exists, extend it to assert a posted `target` round-trips onto the inserted row.

- [ ] **Step 5: Commit** — `git add app/api/action/route.ts components/app/intel/plan-entry-card.tsx && git commit -m "feat(action): carry ActionTarget when tracking a plan suggestion"`

---

## Task 6: Ground the standard generator — feed competitors/communities/creators into `generateActions`

**Files:**
- Modify: `lib/llm/actions.ts` (`generateActions` ~line 228-278, add `ActionGrounding` type + param)
- Modify: `lib/llm/prompts.ts` (`ACTIONS_SYSTEM` ~line 141-158, `ActionsPromptInput` ~line 160-169, `buildActionsPrompt` ~line 171-233)
- Modify: `lib/scan/full-scan.ts` (`runFullScan` ~line 481-553 — reorder grounding gather before generation, pass in, reuse in report)
- Test: `lib/llm/actions.test.ts`

**Interfaces:**
- Consumes: `EngagedCommunity`, `CreatorReach` from `lib/scan/report.ts`; `GapRow` (private in full-scan) mapped to a flat competitor shape.
- Produces: `ActionGrounding` (exported from `lib/llm/actions.ts`); `generateActions(ctx, findings, grounding)` (3rd param optional, defaults to empty grounding).

- [ ] **Step 1: Define the grounding type** at the top of `lib/llm/actions.ts` (after imports):

```ts
import type { EngagedCommunity, CreatorReach } from "@/lib/scan/report";

/** The already-collected market data the action generator must ground in.
 *  Competitors carry real community-mention counts; communities are ranked by
 *  engagement; creators are named YouTubers who covered a competitor. */
export interface ActionGrounding {
  competitors: { name: string; positioning: string | null; themMentions: number; youMentions: number }[];
  communities: EngagedCommunity[];
  creators: CreatorReach[];
}

export const EMPTY_GROUNDING: ActionGrounding = { competitors: [], communities: [], creators: [] };
```

- [ ] **Step 2: Write the failing test** in `lib/llm/actions.test.ts` — assert `buildActionsPrompt` output contains the grounding sections and the target instruction:

```ts
import { buildActionsPrompt } from "./prompts";

test("buildActionsPrompt embeds grounding + demands a target", () => {
  const p = buildActionsPrompt({
    storeUrl: "https://nudgi.ai", reviewThemes: "{}", positioning: "{}",
    competitorGap: "{}", keywordData: "{}", findings: "[]", founderVoice: null,
    today: "2026-07-07",
    grounding: {
      competitors: [{ name: "Fathom", positioning: "AI notetaker", themMentions: 12, youMentions: 0 }],
      communities: [{ source: "reddit", title: "r/productivity", url: "https://reddit.com/r/productivity", engagement: 340 }],
      creators: [{ name: "Thomas Frank", url: "https://youtube.com/@thomasfrank", coveredCompetitor: "Fathom", audienceProxy: 0 }],
    },
  });
  expect(p).toContain("Fathom");
  expect(p).toContain("r/productivity");
  expect(p).toContain("Thomas Frank");
  expect(p).toMatch(/target/i);
});
```

- [ ] **Step 3: Run it, expect FAIL** — `pnpm test lib/llm/actions.test.ts` (`grounding` not on `ActionsPromptInput`).

- [ ] **Step 4: Extend the prompt** in `lib/llm/prompts.ts`:

  a. Add `grounding` to `ActionsPromptInput`:
```ts
import type { ActionGrounding } from "@/lib/llm/actions";
// ...
export interface ActionsPromptInput {
  storeUrl: string;
  reviewThemes: string;
  positioning: string;
  competitorGap: string;
  keywordData: string;
  findings: string;
  founderVoice: string | null;
  today: string;
  grounding: ActionGrounding;
}
```
  (If this creates an import cycle actions.ts ↔ prompts.ts — actions.ts imports `ACTIONS_SYSTEM`/`buildActionsPrompt` from prompts.ts — define `ActionGrounding` in a leaf module `lib/llm/grounding.ts` instead and import it in both. Choose the leaf-module approach to avoid the cycle; update Step 1's location accordingly.)

  b. In `buildActionsPrompt`, build a grounding block and insert it before the `Return ONLY a JSON array` line:

```ts
  const g = input.grounding;
  const competitorsBlock = g.competitors.length
    ? g.competitors.map((c) => `- ${c.name}${c.positioning ? ` — ${c.positioning}` : ""} (mentioned ${c.themMentions}× in tracked communities; you: ${c.youMentions}×)`).join("\n")
    : "(none discovered)";
  const communitiesBlock = g.communities.length
    ? g.communities.map((c) => `- ${c.title} [${c.source}] ${c.url} (engagement ${c.engagement})`).join("\n")
    : "(none discovered)";
  const creatorsBlock = g.creators.length
    ? g.creators.map((c) => `- ${c.name} ${c.url}${c.coveredCompetitor ? ` (covered ${c.coveredCompetitor})` : ""}`).join("\n")
    : "(none discovered)";

  const groundingSection = `=== NAMED COMPETITORS (real, brand-validated — mention counts from tracked communities) ===
${competitorsBlock}

=== COMMUNITIES RANKED BY ENGAGEMENT (real venues to post in — use these exact names/URLs) ===
${communitiesBlock}

=== NAMED CREATORS WHO COVERED A COMPETITOR (real outreach targets — use these exact names/URLs) ===
${creatorsBlock}
`;
```

  Insert `${groundingSection}` into the returned template (right after the `=== SYNTHESIS FINDINGS ===` block).

  c. Extend the JSON shape in the prompt to include `target`, and add the requirement. In the shape array element, after `"confidence": <0.0–1.0>` add:

```
    ,"target": { "channel": "community" | "creator" | "directory" | "media" | "podcast" | "newsletter" | "partner" | "x", "label": "<exact venue/recipient name from the grounding, e.g. 'r/productivity' or 'Thomas Frank'>", "url": "<direct URL if known, else omit>" } | null
```

  d. In `ACTIONS_SYSTEM`, add rules:

```
16. GROUNDING: every outreach card MUST set "target" to a REAL venue or person drawn from the COMMUNITIES or CREATORS lists in the prompt — never invent a community or creator. Use the exact label and URL given. If no suitable named venue exists, set target to null and do NOT fabricate one.
17. Every seo_aso comparison/alternative card MUST name a real competitor from the NAMED COMPETITORS list; if that list is empty, frame the action around the category keyword, not a made-up rival.
18. "target.channel" must be one of: community, creator, directory, media, podcast, newsletter, partner, x.
```

  e. Update the "Rules recap" bullets to reference the grounding lists (replace the illustrative "e.g. r/habittracking / Thomas Frank" examples with: "use a venue from the COMMUNITIES list" / "use a creator from the CREATORS list").

- [ ] **Step 5: Thread grounding through `generateActions`** in `lib/llm/actions.ts`:

```ts
export async function generateActions(
  ctx: ScanContext,
  findings: Finding[],
  grounding: ActionGrounding = EMPTY_GROUNDING,
): Promise<ActionCard[]> {
  // ... existing fixture + sheet reads ...
  const prompt = buildActionsPrompt({
    storeUrl: ctx.storeUrl,
    reviewThemes: JSON.stringify(reviewThemesBody, null, 2),
    positioning: JSON.stringify(positioningBody, null, 2),
    competitorGap: JSON.stringify(competitorGapBody, null, 2),
    keywordData: JSON.stringify(keywordDataBody, null, 2),
    findings: JSON.stringify(findings, null, 2),
    founderVoice,
    today,
    grounding,
  });
  // ... unchanged ...
}
```

- [ ] **Step 6: Reorder `runFullScan`** in `lib/scan/full-scan.ts` so grounding is gathered before generation and reused by the report (no double reads, no new external calls):

  a. Before the action-generation block (currently ~line 497), compute the grounding inputs. Move the `readCompetitorGap`, `readCreatorDocs`, `readChannelOpportunities` reads (currently at line 544-552) UP to here, into a `const subjectType = factSheetSubjectType(ctx.mode);` + `Promise.all`:

```ts
    const subjectType = factSheetSubjectType(ctx.mode);
    const [competitorGap, creatorsToReach, channelOpportunities] = await Promise.all([
      readCompetitorGap(subjectType, ctx.storeUrl, facts),
      readCreatorDocs(ctx.storeUrl),
      readChannelOpportunities(subjectType, ctx.storeUrl),
    ]);
    const grounding = {
      competitors: competitorGap.map((r) => ({ name: r.competitor, positioning: r.positioning ?? null, themMentions: r.them, youMentions: r.you })),
      communities: channelOpportunities.communitiesByEngagement,
      creators: creatorsToReach,
    };
```

  b. Change the generation call to pass grounding (standard path) — and the cold-start path per Task 7:

```ts
    const actions = facts.coldStart
      ? await generateColdStartActions(ctx, facts, grounding)   // Task 7
      : await generateActions(ctx, findings, grounding);
```

  c. In the later report-assembly section (line 544-552), REMOVE the now-duplicated `readCompetitorGap`/`readCreatorDocs`/`readChannelOpportunities` from the `Promise.all` and reuse the variables already computed above. Keep `readIcpSignals`, `readSurfaces`, `readReviewThemesFull` in a `Promise.all`. Ensure `subjectType` is declared once (it currently is re-declared at line 543 — remove the duplicate).

- [ ] **Step 7: Run tests + typecheck** — `pnpm typecheck && pnpm test lib/llm/actions.test.ts`. Expected: green.

- [ ] **Step 8: Commit** — `git add lib/llm/actions.ts lib/llm/prompts.ts lib/scan/full-scan.ts lib/llm/actions.test.ts && git commit -m "feat(actions): ground generation in named competitors/communities/creators + require targets"`

---

## Task 7: Ground the cold-start generator (nudgi's path)

**Files:**
- Modify: `lib/llm/cold-start-actions.ts` (`deriveSeed` ~line 72-95, `generateColdStartActions` ~line 100-133)
- Modify: `lib/dev/fixtures.ts` (`ColdStartSeed` type + `coldStartActionsFrom` ~line 560-725 — set `target` on outreach/content cards)
- Test: `lib/llm/cold-start-actions.test.ts`, `lib/dev/fixtures` behavior via existing tests

**Interfaces:**
- Consumes: `ActionGrounding` (Task 6). Produces: cold-start `ActionCard[]` whose community/creator cards carry a real `target`, and whose seed uses real community handles instead of the hardcoded `DEFAULT_COMMUNITY_A/B` when grounding is present.

- [ ] **Step 1: Accept grounding** in `generateColdStartActions`:

```ts
export async function generateColdStartActions(
  ctx: ScanContext,
  facts: PreliminaryFacts,
  grounding: ActionGrounding = EMPTY_GROUNDING,
): Promise<ActionCard[]> {
```

Import `ActionGrounding, EMPTY_GROUNDING` from the leaf module chosen in Task 6.

- [ ] **Step 2: Use real communities in the seed.** In `deriveSeed`, accept grounding and prefer real community titles/urls over the hardcoded defaults:

```ts
function deriveSeed(facts: PreliminaryFacts, grounding: ActionGrounding, positioning?: PositioningSheet): ColdStartSeed {
  // ... existing productName/base/topKeyword/etc ...
  const firstCompetitor = grounding.competitors.find((c) => c.name.length > 0)?.name
    ?? facts.competitors.find((c) => cleanStr(c.name).length > 0)?.name;
  const topCompetitor = firstCompetitor ? cleanStr(firstCompetitor) : "the leading alternative";

  const comms = grounding.communities;
  const communityA = comms[0]?.title ?? DEFAULT_COMMUNITY_A;
  const communityAUrl = comms[0]?.url;
  const communityB = comms[1]?.title ?? DEFAULT_COMMUNITY_B;
  const communityBUrl = comms[1]?.url;
  const creator = grounding.creators[0];

  return { productName, icp, topKeyword, secondKeyword, topCompetitor,
    communityA, communityAUrl, communityB, communityBUrl, creator };
}
```

Update `generateColdStartActions` to call `deriveSeed(facts, grounding, positioning)` and pass `grounding` into the fallback seed too (defaults preserved when grounding is empty).

- [ ] **Step 3: Extend `ColdStartSeed` + set targets** in `lib/dev/fixtures.ts`. Add the optional fields to `ColdStartSeed`:

```ts
  communityAUrl?: string;
  communityBUrl?: string;
  creator?: { name: string; url: string; coveredCompetitor: string };
```

In `coldStartActionsFrom`, add `target` to each card:
- The "Share the waitlist in {communityA}" outreach card (card #2): `target: { channel: "community", label: communityA, ...(communityAUrl ? { url: communityAUrl } : {}) }`.
- The "build-in-public post for {communityB}" card (card #2b): `target: { channel: "community", label: communityB, ...(communityBUrl ? { url: communityBUrl } : {}) }`.
- The comparison-page (#3), ad-test (#4), discovery-script (#5), pivot (#6) cards: `target: null` (on-site / self work).
- If `seed.creator` is present, ADD one new outreach card:

```ts
{
  category: "outreach",
  title: `Reach out to ${seed.creator.name}, who has covered ${topCompetitor}`,
  why: `${seed.creator.name} already makes content about ${topCompetitor} — a genuine, specific note (not a mass pitch) puts ${productName} in front of an audience that has shown it cares about this exact category.`,
  evidenceIds: [],
  evidence: [
    evCreator(`${seed.creator.name} covered ${seed.creator.coveredCompetitor || topCompetitor}`),
    evPositioning(`Angle to lead with: how ${productName} differs for ${icp}`),
  ],
  effortMin: 30,
  suggestedDeadline: isoPlusDays(10),
  expectedOutcome: { scoreComponent: "outreach", delta: 3, secondary: "Creator coverage reaches a pre-qualified audience" },
  draft: `Hi ${seed.creator.name} — I saw your work on ${seed.creator.coveredCompetitor || topCompetitor}. I'm building ${productName} for ${icp}; the difference is [one concrete thing]. Not asking for a review — just wondered if it'd be useful to your audience. Happy to give you early access.`,
  draftRequiresEdit: true,
  verification: { method: "self_report", state: "pending" },
  basis: "probability_based",
  confidence: 0.45,
  target: { channel: "creator", label: seed.creator.name, url: seed.creator.url },
},
```

(Add an `evCreator` evidence helper mirroring the existing `evCommunity`/`evSerp` helpers with `sourceType: "youtube"`.)

Every OTHER card in `coldStartActionsFrom` also needs a `target` key (TypeScript will require it once `ActionCard.target` is non-optional) — set `target: null` on all the non-community, non-creator cards.

- [ ] **Step 4: Update tests.** In `lib/llm/cold-start-actions.test.ts`, add a test that when grounding carries a community and a creator, the produced cards include a `target` naming that community and a creator card:

```ts
const cards = coldStartActionsFrom(deriveSeedForTest(facts, {
  competitors: [{ name: "Fathom", positioning: null, themMentions: 5, youMentions: 0 }],
  communities: [{ source: "reddit", title: "r/productivity", url: "https://reddit.com/r/productivity", engagement: 200 }],
  creators: [{ name: "Thomas Frank", url: "https://youtube.com/@thomasfrank", coveredCompetitor: "Fathom", audienceProxy: 0 }],
}));
expect(cards.some((c) => c.target?.label === "r/productivity")).toBe(true);
expect(cards.some((c) => c.target?.channel === "creator" && c.target?.label === "Thomas Frank")).toBe(true);
```

(Export a `deriveSeedForTest` seam from `cold-start-actions.ts` if the test needs seed access, mirroring `coerceCardForTest`.)

- [ ] **Step 5: Run tests + typecheck** — `pnpm typecheck && pnpm test lib/llm/cold-start-actions.test.ts lib/dev`. Expected: green (fixture snapshot tests may need the new `target` keys — update expected fixtures where they assert full card shape).

- [ ] **Step 6: Commit** — `git add lib/llm/cold-start-actions.ts lib/dev/fixtures.ts lib/llm/cold-start-actions.test.ts && git commit -m "feat(cold-start): ground seed in real communities/creators + set action targets"`

---

## Task 8: End-to-end verification + re-scan

**Files:** none (verification task).

- [ ] **Step 1: Full suite** — `pnpm typecheck && pnpm lint && pnpm test`. Expected: 0 type errors, 0 lint errors, all tests green.

- [ ] **Step 2: Verify the routing wiring by inspection** — confirm `components/app/intel/plan-entry-card.tsx:78` `inferExecutionRoute({ channel: entry.channel ?? "", target: entry.target ?? entry.title, targetUrl: entry.targetUrl ?? undefined })` now receives populated `channel`/`target`/`targetUrl` for tracked actions with a target, and that a `community` target with an `r/…` label routes to the reddit share composer (not the email fallback). No code change expected here — Task 4 populated the fields this line already reads.

- [ ] **Step 3: Trigger a fresh scan** of a real cold-start subject (e.g. re-scan `nudgi.ai`) against the local stack with `REACHKIT_USE_FIXTURES=false`, and confirm in the DB that the persisted `actions` rows carry non-null `target` for outreach cards:

```sql
select title, target from actions
where scan_id = '<new-scan-id>' and category = 'outreach';
```
Expected: outreach rows have `target` like `{"channel":"community","label":"r/…","url":"…"}` or `{"channel":"creator",...}`, and the comparison-page card names a real competitor (or the category keyword when none was found) rather than "the leading alternative".

- [ ] **Step 4:** Hand off to `superpowers:finishing-a-development-branch`.
