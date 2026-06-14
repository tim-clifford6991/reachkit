# Live Scan Narrative UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the static-feeling scan progress with a continuously-alive "thinking" experience — an accumulating ✓ checklist with one active spinner + a page-scan animation on the side — that always keeps moving and narrates what the system is doing, grounded in real scan data.

**Architecture:** A frontend **curated narrative synced to real milestones** (the decision Tim picked). A fixed `STEP_SCRIPT` of granular steps drives the checklist; real `scan_events` confirm/advance it; "optimistic" fast sub-steps auto-tick on a timer so it never sits static during the opaque ~20–30s LLM blocks. A CSS/Motion scan-line animation sits beside it. Backend stays almost unchanged — the existing milestone events are the sync points; we add dynamic counts (already in payloads) and 1 optional cheap signal (CTA count).

**Voice:** confident with a light wink (the picked blend) — e.g. "Counting your CTAs — found 1", "Finding your competitors", "Comparing how you stack up".

**Tech Stack:** Next.js 16 / React 19, Motion (already used via `@/components/motion/*`), Tailwind v4 tokens, the existing SSE stream (`/api/scan/[id]/stream`) + `scan_events`.

---

## ⚠️ One flow decision for Tim (pick before build)

Today the scan page swaps from `ScanTheater` (pre-`facts`) to `FactsView` (post-`facts`, ~15s in) which reveals the **competitor card "wow" for free**, then `FindingsReveal` (email gate) at `findings`. The reference design is a *pure* checklist→result.

**Option A (recommended): Checklist + animation run the WHOLE scan (collect → findings), then reveal.**
The competitor "wow" still happens — the checklist shows "Found 5 competitors" live, and the scan card peeks the detected product name + an "N competitors" pill as `facts` lands — but the full competitor-names card moves into the post-scan reveal. Cleanest, closest to the reference, one continuous live experience.

**Option B: Keep the mid-scan facts reveal; just restyle the progress.**
Checklist + animation show during collect; once `facts` lands the current `FactsView` (product header, competitor card, themes) still appears, with the checklist continuing as the "working" indicator for the remaining steps. Preserves the early (~15s) free competitor card exactly as-is; less like the reference (mixes cards + checklist).

This plan implements **Option A** (with the early peek so the funnel hook isn't lost). If Tim prefers B, only Task 5 (wiring/transition) changes — Tasks 1–4 are identical.

---

## File Structure

- Create: `app/(funnel)/scan/[id]/scan-narrative.ts` — the `STEP_SCRIPT` + `useScanNarrative` hook (pure logic + timer; unit-tested).
- Create: `app/(funnel)/scan/[id]/scan-narrative.test.ts` — hook/state-machine + step-label tests.
- Create: `components/scan/scan-checklist.tsx` — the ✓ / ◐ / ○ checklist presentation.
- Create: `components/scan/scan-animation.tsx` — the page-skeleton + sweeping scan-line card.
- Create: `components/scan/scan-animation.css` (or inline Tailwind keyframes) — the scan-line keyframes (respect `prefers-reduced-motion`).
- Modify: `app/(funnel)/scan/[id]/scan-stream.tsx` — replace `ScanTheater` (and, Option A, the post-`facts` working feed) with `<ScanProgress>` (checklist + animation); keep `FactsView`/`FindingsReveal` for the reveal.
- Modify (optional, Task 6): `lib/scan/collect.ts` + `lib/llm/extract.ts` — emit a CTA-count artifact so "Counting your CTAs — found N" is real.
- Reference (unchanged): `lib/scan/progress.ts` (`emitScanEvent`), the SSE route, `scan-stream.tsx`'s existing event handling (`artifact`/`facts`/`findings`/`done`/`error`).

---

## The step script (the real milestones it syncs to)

`scan_events` artifact labels currently emitted (the sync points):
`Read your product page` · `Analysed N reviews`/`Checked for public reviews` · `Found N competitors`/`Mapping your competitive landscape` · `Reading your reviews & positioning` · `Comparing you to your competitors` · `Scoring your discoverability` · `Drafting your action plan` · `Pressure-testing each recommendation` · `Finalising your report` — plus `facts`, `findings`, `done`, `error` event types.

`STEP_SCRIPT` (each step: `id`, `label(ctx)`, `confirmBy` = the real label/event that completes it, `optimistic` = auto-tick on timer if its group hasn't confirmed yet):

| # | Label (blend voice) | confirmBy | optimistic |
|---|---|---|---|
| 1 | Loading your homepage | `Read your product page` | yes |
| 2 | Reading your hero & value prop | `Read your product page` | yes |
| 3 | Counting your CTAs{` — found ${n}` when known} | `Read your product page` (or CTA event, Task 6) | yes |
| 4 | {`Reading ${n} reviews` \| `Checking for public reviews`} | `Analysed`/`Checked` reviews | no |
| 5 | {`Sizing up ${n} rivals` \| `Finding your competitors`} | `Found`/`Mapping` competitors | no |
| 6 | Reading your reviews & positioning | `Reading your reviews & positioning` | no |
| 7 | Comparing how you stack up | `Comparing you to your competitors` | no |
| 8 | Scoring your visibility | `Scoring your discoverability` | no |
| 9 | Drafting your action plan | `Drafting your action plan` | no |
| 10 | Pressure-testing each move | `Pressure-testing each recommendation` | no |
| 11 | Finalizing your report | `Finalising your report` / `findings` | no |

`ctx` = `{ reviewCount?, competitorCount?, ctaCount? }` extracted from event payloads (`payload.count`) + `facts`.

---

## Task 1: The narrative state machine (`useScanNarrative`)

**Files:** Create `app/(funnel)/scan/[id]/scan-narrative.ts`, `app/(funnel)/scan/[id]/scan-narrative.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/(funnel)/scan/[id]/scan-narrative.test.ts
import { describe, it, expect } from "vitest";
import { STEP_SCRIPT, computeStepStates, labelFor } from "./scan-narrative";

describe("scan narrative", () => {
  it("step 1 is active at start, rest pending; nothing done", () => {
    const s = computeStepStates({ confirmedLabels: new Set(), tick: 0, ctx: {} });
    expect(s[0].state).toBe("active");
    expect(s.slice(1).every((x) => x.state === "pending")).toBe(true);
  });

  it("optimistic steps auto-complete as the tick advances (never static)", () => {
    const s = computeStepStates({ confirmedLabels: new Set(), tick: 2, ctx: {} });
    // first two optimistic steps ticked to done, the 3rd is active
    expect(s[0].state).toBe("done");
    expect(s[1].state).toBe("done");
    expect(s[2].state).toBe("active");
  });

  it("a non-optimistic step never completes until its milestone confirms", () => {
    // big tick, but no review/competitor/LLM milestones confirmed yet
    const s = computeStepStates({ confirmedLabels: new Set(["Read your product page"]), tick: 99, ctx: {} });
    const reviews = s.find((x) => x.id === "reviews")!;
    expect(reviews.state).not.toBe("done"); // waits for the real event
  });

  it("confirming 'Found 5 competitors' marks the competitor step done with the live count", () => {
    const s = computeStepStates({
      confirmedLabels: new Set(["Read your product page", "Analysed 6 reviews", "Found 5 competitors"]),
      tick: 99,
      ctx: { competitorCount: 5, reviewCount: 6 },
    });
    const comp = s.find((x) => x.id === "competitors")!;
    expect(comp.state).toBe("done");
    expect(comp.label).toMatch(/5 rivals/);
  });

  it("labelFor injects dynamic counts and falls back cleanly when unknown", () => {
    expect(labelFor("reviews", { reviewCount: 6 })).toMatch(/6 reviews/);
    expect(labelFor("reviews", {})).toMatch(/public reviews/i);
  });

  it("STEP_SCRIPT covers every emitted milestone label", () => {
    const confirmable = STEP_SCRIPT.flatMap((s) => s.confirmBy);
    for (const lbl of ["Reading your reviews & positioning", "Comparing you to your competitors", "Scoring your discoverability", "Drafting your action plan", "Pressure-testing each recommendation", "Finalising your report"]) {
      expect(confirmable).toContain(lbl);
    }
  });
});
```

- [ ] **Step 2: Run → fail** — `pnpm vitest run "app/(funnel)/scan/[id]/scan-narrative.test.ts"` → module missing.

- [ ] **Step 3: Implement `scan-narrative.ts`**

```ts
import { useEffect, useRef, useState } from "react";

export type StepId =
  | "homepage" | "hero" | "ctas" | "reviews" | "competitors"
  | "positioning" | "compare" | "score" | "draft" | "critique" | "finalize";

export type StepState = "pending" | "active" | "done";

export interface NarrativeCtx { reviewCount?: number; competitorCount?: number; ctaCount?: number }

export interface Step {
  id: StepId;
  /** Real artifact labels / event types that confirm this step is done. */
  confirmBy: string[];
  /** Fast, definitely-happening sub-actions auto-tick on a timer before their event lands. */
  optimistic: boolean;
  label: (c: NarrativeCtx) => string;
}

export const STEP_SCRIPT: Step[] = [
  { id: "homepage",    optimistic: true,  confirmBy: ["Read your product page"], label: () => "Loading your homepage" },
  { id: "hero",        optimistic: true,  confirmBy: ["Read your product page"], label: () => "Reading your hero & value prop" },
  { id: "ctas",        optimistic: true,  confirmBy: ["Read your product page"], label: (c) => c.ctaCount != null ? `Counting your CTAs — found ${c.ctaCount}` : "Counting your CTAs" },
  { id: "reviews",     optimistic: false, confirmBy: ["Analysed", "Checked for public reviews"], label: (c) => c.reviewCount && c.reviewCount > 0 ? `Reading ${c.reviewCount} reviews` : "Checking for public reviews" },
  { id: "competitors", optimistic: false, confirmBy: ["Found", "Mapping your competitive landscape"], label: (c) => c.competitorCount && c.competitorCount > 0 ? `Sizing up ${c.competitorCount} rivals` : "Finding your competitors" },
  { id: "positioning", optimistic: false, confirmBy: ["Reading your reviews & positioning"], label: () => "Reading your reviews & positioning" },
  { id: "compare",     optimistic: false, confirmBy: ["Comparing you to your competitors"], label: () => "Comparing how you stack up" },
  { id: "score",       optimistic: false, confirmBy: ["Scoring your discoverability"], label: () => "Scoring your visibility" },
  { id: "draft",       optimistic: false, confirmBy: ["Drafting your action plan"], label: () => "Drafting your action plan" },
  { id: "critique",    optimistic: false, confirmBy: ["Pressure-testing each recommendation"], label: () => "Pressure-testing each move" },
  { id: "finalize",    optimistic: false, confirmBy: ["Finalising your report", "__findings__"], label: () => "Finalizing your report" },
];

export function labelFor(id: StepId, ctx: NarrativeCtx): string {
  const step = STEP_SCRIPT.find((s) => s.id === id);
  return step ? step.label(ctx) : id;
}

/** A confirmed-label set matches a step if any confirmBy token is a prefix of a seen label. */
function isConfirmed(step: Step, confirmed: Set<string>): boolean {
  for (const seen of confirmed) for (const tok of step.confirmBy) if (seen.startsWith(tok)) return true;
  return false;
}

export interface ComputedStep { id: StepId; label: string; state: StepState }

export function computeStepStates(input: {
  confirmedLabels: Set<string>;
  tick: number; // increments on a timer to advance optimistic steps
  ctx: NarrativeCtx;
}): ComputedStep[] {
  const { confirmedLabels, tick, ctx } = input;
  // The furthest "real" progress: index of the last step whose milestone confirmed.
  let confirmedThrough = -1;
  STEP_SCRIPT.forEach((s, i) => { if (isConfirmed(s, confirmedLabels)) confirmedThrough = Math.max(confirmedThrough, i); });
  // Optimistic steps may tick ahead of confirmation, but never past the first
  // non-optimistic unconfirmed step (we won't fake an LLM result).
  let optimisticCeiling = 0;
  for (let i = 0; i < STEP_SCRIPT.length; i++) {
    if (STEP_SCRIPT[i].optimistic) optimisticCeiling = i; else break;
  }
  const optimisticDone = Math.min(optimisticCeiling, tick - 1); // tick advances 1 step at a time
  const doneThrough = Math.max(confirmedThrough, optimisticDone);
  const activeIndex = doneThrough + 1;

  return STEP_SCRIPT.map((s, i) => ({
    id: s.id,
    label: s.label(ctx),
    state: i <= doneThrough ? "done" : i === activeIndex ? "active" : "pending",
  }));
}

/** React hook: drives a ~1.4s tick so optimistic steps advance; recomputes on confirmations. */
export function useScanNarrative(confirmedLabels: Set<string>, ctx: NarrativeCtx, running: boolean) {
  const [tick, setTick] = useState(1);
  const tickRef = useRef(1);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => { tickRef.current += 1; setTick(tickRef.current); }, 1400);
    return () => clearInterval(t);
  }, [running]);
  return computeStepStates({ confirmedLabels, tick, ctx });
}
```

- [ ] **Step 4: Run → pass.** `pnpm vitest run "app/(funnel)/scan/[id]/scan-narrative.test.ts"`

- [ ] **Step 5: Commit** — `feat(scan-ui): scan narrative step script + state machine`

## Task 2: The checklist presentation

**Files:** Create `components/scan/scan-checklist.tsx`

- [ ] **Step 1: Implement** (presentation only; states come from Task 1)

```tsx
import type { ComputedStep } from "@/app/(funnel)/scan/[id]/scan-narrative";

function Mark({ state }: { state: ComputedStep["state"] }) {
  if (state === "done") return (
    <span className="grid size-5 shrink-0 place-items-center rounded-full" style={{ background: "var(--color-accent)", color: "var(--color-accent-fg)" }} aria-hidden>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </span>
  );
  if (state === "active") return (
    <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: "var(--color-accent)" }} />
    </span>
  );
  return <span className="size-5 shrink-0 rounded-full border-2" style={{ borderColor: "var(--hairline-strong)" }} aria-hidden />;
}

export function ScanChecklist({ steps }: { steps: ComputedStep[] }) {
  return (
    <ol className="space-y-4" role="log" aria-live="polite" aria-label="Scan progress">
      {steps.map((s) => (
        <li key={s.id} className="flex items-center gap-3 transition-opacity"
            style={{ opacity: s.state === "pending" ? 0.45 : 1 }}>
          <Mark state={s.state} />
          <span className="font-mono text-base leading-snug"
                style={{ color: s.state === "active" ? "var(--color-fg)" : "var(--color-muted)", fontWeight: s.state === "active" ? 600 : 400 }}>
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 2: Typecheck** — `pnpm typecheck`
- [ ] **Step 3: Commit** — `feat(scan-ui): accumulating ✓/active/pending checklist`

## Task 3: The page-scan animation

**Files:** Create `components/scan/scan-animation.tsx`

- [ ] **Step 1: Implement** — a skeleton "page" card with a scan line sweeping top→bottom; honors `prefers-reduced-motion`. Optionally shows the detected product name once `facts` lands.

```tsx
export function ScanAnimation({ productName }: { productName?: string | null }) {
  const bars = [62, 92, 78, 40, 88, 54];
  return (
    <div className="relative overflow-hidden rounded-2xl border p-6"
         style={{ borderColor: "var(--hairline)", background: "var(--color-surface)", minHeight: 280 }}
         aria-hidden="true">
      <div className="mb-5 h-1.5 w-full rounded-full" style={{ background: "var(--color-accent)" }} />
      {productName ? (
        <p className="mb-4 truncate font-mono text-sm" style={{ color: "var(--color-muted)" }}>{productName}</p>
      ) : <div className="mb-4 h-4 w-1/3 rounded" style={{ background: "var(--fill-subtle)" }} />}
      <div className="space-y-3">
        {bars.map((w, i) => (
          <div key={i} className="h-3.5 rounded-lg" style={{ width: `${w}%`, background: "var(--fill-subtle)" }} />
        ))}
      </div>
      {/* Sweeping scan line */}
      <div className="scan-sweep pointer-events-none absolute inset-x-0 top-0 h-16"
           style={{ background: "linear-gradient(180deg, transparent, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent)" }} />
      <style>{`
        @keyframes scanSweep { 0% { transform: translateY(-64px) } 100% { transform: translateY(280px) } }
        .scan-sweep { animation: scanSweep 2.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .scan-sweep { animation: none; opacity: 0 } }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck; Step 3: Commit** — `feat(scan-ui): page-scan sweep animation`

## Task 4: Compose `<ScanProgress>` (checklist + animation, two-column)

**Files:** Modify `app/(funnel)/scan/[id]/scan-stream.tsx`

- [ ] **Step 1: Build `ScanProgress`** — derive `confirmedLabels` from `artifacts` (the labels already accumulated) + a synthetic `__findings__` when `findingsData`; derive `ctx` counts from `facts`/artifact text; render two columns.

```tsx
function ScanProgress({ artifacts, facts, findingsData }: {
  artifacts: string[]; facts: PreliminaryFacts | null; findingsData: FindingsPayload | null;
}) {
  const confirmed = new Set<string>(artifacts);
  if (findingsData) confirmed.add("__findings__");
  const ctx = {
    reviewCount: facts?.reviewVolume,
    competitorCount: facts?.competitors.length,
  };
  const running = !findingsData;
  const steps = useScanNarrative(confirmed, ctx, running);
  return (
    <div className="mx-auto grid max-w-4xl gap-8 p-8 md:grid-cols-2 md:items-start">
      <ScanAnimation productName={facts?.listing.name} />
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <PulseDot />
          <p className="font-mono text-sm tracking-wide" style={{ color: "var(--color-muted)" }}>Scanning your product…</p>
        </div>
        <ScanChecklist steps={steps} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck; Step 3: Commit** — `feat(scan-ui): two-column scan progress (animation + narrative)`

## Task 5: Wire it into the scan flow (Option A)

**Files:** Modify `app/(funnel)/scan/[id]/scan-stream.tsx` (the `ScanStream` render branch + `FactsView`)

- [ ] **Step 1:** Replace the terminal render logic:
  - `!facts` → `<ScanProgress artifacts={artifacts} facts={null} findingsData={null} />` (was `<ScanTheater>`).
  - `facts && !findingsData` → `<ScanProgress artifacts={artifacts} facts={facts} findingsData={null} />` (Option A: keep the live narrative running; the animation now peeks the product name + the checklist shows "Sizing up N rivals"). Remove the mid-scan `FactsView` cards from this state.
  - `findingsData` → `<FindingsReveal …>` (unchanged reveal + email gate). Move the free competitor-names card (currently in `FactsView`) into `FindingsReveal`'s pre-gate section so the free "competitor intelligence" wow is preserved (per the value ladder).
  - Keep `ScanError` / `ScanNotFound` branches.
- [ ] **Step 2:** Delete the now-unused `ScanTheater` + the post-facts working-feed block (and `ArtifactLine`/`Stagger` if no longer used).
- [ ] **Step 3:** Manual check against the running dev server: trigger a scan, confirm the checklist advances continuously (optimistic ticks during collect, real milestones snapping each ✓), the animation sweeps, and at findings the reveal + gate appears. Confirm refresh-safety (seed rebuilds `confirmedLabels` from persisted `scan_events`).
- [ ] **Step 4: Commit** — `feat(scan-ui): live narrative replaces static theater (Option A)`

## Task 6 (optional polish): real CTA count

**Files:** Modify `lib/llm/extract.ts` (positioning extract already parses the homepage HTML) or `lib/scan/collect.ts`

- [ ] Emit one extra artifact `Counting your CTAs — found N` where N = count of `<a class="btn"|role=button|<button>` / primary-CTA heuristics already available from the fetched HTML (the listing fetch). Wire `ctx.ctaCount` in `ScanProgress`. Keep it cheap (regex on the HTML already in hand; no new fetch). If skipped, step 3 shows "Counting your CTAs" without a number.

---

## Self-Review

- **Spec coverage:** continuous live updates (Task 1 timer + optimistic ticks — never static) ✓; accumulating ✓ / active spinner / pending ○ checklist (Task 2) ✓; scan animation on the side (Task 3) ✓; grounded in real data (counts from payloads; real milestones gate the heavy steps) ✓; voice = blend ✓.
- **Honesty:** non-optimistic (LLM) steps never show ✓ until their real `scan_event` lands — the narrative can't claim work that didn't happen (brand/honesty bar). Optimistic steps are limited to fast, definitely-happening collect sub-actions.
- **No regression:** refresh-safety preserved (confirmed set rebuilds from persisted events via the existing seed); error/not-found branches untouched; value-ladder free competitor card preserved (moved into the reveal in Task 5).
- **Open decision:** Option A vs B (top of doc) — only Task 5 differs.
