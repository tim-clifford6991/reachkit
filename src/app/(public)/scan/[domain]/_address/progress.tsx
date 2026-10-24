// BUILD §4.1 — the scanning arm's named stages
//
// REQ-003 c1: named stages that advance as work completes — never an
// unlabelled spinner and never an indeterminate bar alone.
//
// **Each finished stage carries the time it took** (UI-SPEC S3, issue
// #352), measured in the browser from the event that started it to the one
// that finished it, and the running stage carries when it started. Both are
// elapsed times, never a countdown, a percentage or an estimate. A stage
// whose start this page did not see, or that took under a second as a
// replayed log does, carries no figure rather than a 0.
//
// REQ-001 c9: arriving on a shared link starts a scan with no further
// action from the visitor. The post happens **on first frame, in the
// browser** and never during server render — a server render that started
// a scan would start one for every crawler, prefetch and refresh.
//
// REQ-003 c3: the ending event swaps the report in without a reload. This
// component asks the router to re-render the route rather than reloading
// the document: the server resolves the address again, now finds a stored
// report, and the `report` arm replaces this one in place.
//
// daisyUI `steps steps-vertical` in the route (DESIGN rule 1); a finished
// stage's bead carries lucide's check at stroke 1.75.
//
// The stream is `GET /api/scan/{scanId}/progress` (server-sent events),
// which serialises `@/lib/scan/stages`' own `StageEvent` verbatim.
//
// **`StageName` is imported as a type and never as a value.**
// `src/lib/scan/stages.ts` imports `dbAdmin`, and through it
// `src/lib/config/env.ts`, which parses the server's environment at module
// load — a value import of `STAGES` from a `"use client"` module would
// drag the admin database client and the whole server environment into the
// browser bundle. The six handles are the keys of `STAGE_KEY` below, whose
// `satisfies Record<StageName, CopyKey>` is the compile-time guarantee
// that they are exactly the six the engine declares: a seventh stage
// added there fails this file's build until it has a word here.
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { BATTERY } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { StageEvent, StageName, StageSummary } from "@/lib/scan/stages";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { StartScanResponse } from "@/app/api/scan/route";

/** One word per `StageName`; a stage with no key cannot render. */
const STAGE_KEY = {
  reading_your_site: "stage.reading_your_site",
  reading_access_rules: "stage.reading_access_rules",
  reading_your_market: "stage.reading_your_market",
  checking_your_presence: "stage.checking_your_presence",
  asking_the_twelve: "stage.asking_the_twelve",
  scoring: "stage.scoring",
} as const satisfies Record<StageName, CopyKey>;

/** Each stage's sub-line: what it finds out, in the board's words. */
const STAGE_LINE = {
  reading_your_site: "stage.reading_your_site.line",
  reading_access_rules: "stage.reading_access_rules.line",
  reading_your_market: "stage.reading_your_market.line",
  checking_your_presence: "stage.checking_your_presence.line",
  asking_the_twelve: "stage.asking_the_twelve.line",
  scoring: "stage.scoring.line",
} as const satisfies Record<StageName, CopyKey>;

/** The searches a free scan checks, from the battery's own count. */
export const SEARCHES = { searches: String(BATTERY.QUESTIONS) };

/** The six, in the order `STAGE_KEY` declares them — which is
 *  `src/lib/scan/stages.ts`'s own `STAGE_ORDER`, transcribed once and
 *  checked against the union by the `satisfies` above. */
const STAGES = Object.keys(STAGE_KEY) as readonly StageName[];

function isStageEvent(value: unknown): value is StageEvent {
  return typeof value === "object" && value !== null;
}

/** What the stream has said so far: which stages finished, which one is
 *  running, and how long each finished one took.
 *
 *  Lifted out of `ScanProgress` by #935 so the scanning screen can read
 *  the same facts the steps list reads — SPEC §2 (2026-09-20) puts the
 *  report's sections beside the stages, each held by a `skeleton` until
 *  its own stage finishes, and a second subscription to the same stream
 *  would be a second answer to "where is this scan". One stream, one
 *  state, two readers. */
export interface ScanStages {
  readonly done: ReadonlySet<StageName>;
  readonly active: StageName | undefined;
  /** Whole seconds each finished stage took, where this page saw it start. */
  readonly elapsed: Readonly<Record<string, number>>;
  /** Whole seconds from this page's first frame to each stage's start. */
  readonly entered: Readonly<Record<string, number>>;
  /** The page's first frame, in the browser's clock. */
  readonly startedAt: number;
  /** What the finished stages found, the last value of each field kept. */
  readonly found: StageSummary;
}

/** A stage's state on screen: finished, running, or not reached. */
export type StageState = "done" | "active" | "pending";

export function stageState(stages: ScanStages, stage: StageName): StageState {
  return stages.done.has(stage) ? "done" : stage === stages.active ? "active" : "pending";
}

/** Whole seconds as the board writes an offset: 0:12, 1:05. */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function useScanStages(p: {
  domain: CanonicalDomain;
  /** Present when the address already knew which scan is running. Absent
   *  on the `starting` arm, where this hook claims one. */
  scanId?: string;
  /** `false` where the caller already holds a reading from elsewhere.
   *  A hook cannot be called conditionally, so the switch is here: nothing
   *  is claimed and nothing is subscribed to, and the reading returned is
   *  the empty one the caller will discard. */
  enabled?: boolean;
}): ScanStages {
  const enabled = p.enabled !== false;
  const router = useRouter();
  const [scanId, setScanId] = useState<string | undefined>(p.scanId);
  const [done, setDone] = useState<ReadonlySet<StageName>>(new Set());
  const [active, setActive] = useState<StageName | undefined>(undefined);
  /** Whole seconds from this component's first frame to each stage's own
   *  ending event. `useState`'s initialiser runs once, in the browser. */
  const [startedAt] = useState<number>(() => Date.now());
  const [elapsed, setElapsed] = useState<Readonly<Record<string, number>>>({});
  const [entered, setEntered] = useState<Readonly<Record<string, number>>>({});
  const enteredAt = useRef<Record<string, number>>({});
  const [found, setFound] = useState<StageSummary>({});

  // First frame, browser only: claim a scan if the address did not hand
  // one over. `location` is the canonical address and is ignored here —
  // this component is already rendering at it.
  useEffect(() => {
    if (!enabled) return;
    if (scanId !== undefined) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: p.domain }),
      });
      const body = (await response.json()) as StartScanResponse;
      if (cancelled) return;
      if (body.ok && body.scanId !== undefined) {
        setScanId(body.scanId);
        return;
      }
      // Admission refused, or the scan finished before this frame ran:
      // re-resolve the address rather than inventing a state here.
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, p.domain, router, scanId]);

  useEffect(() => {
    if (!enabled) return;
    if (scanId === undefined) return;
    const source = new EventSource(`/api/scan/${scanId}/progress`);
    source.onmessage = (message: MessageEvent<string>) => {
      const parsed: unknown = JSON.parse(message.data);
      if (!isStageEvent(parsed)) return;
      if ("ending" in parsed) {
        source.close();
        router.refresh();
        return;
      }
      if ("stage" in parsed) {
        const event = parsed;
        const now = (Date.now() - startedAt) / 1000;
        if (event.done) {
          setDone((previous) => new Set(previous).add(event.stage));
          const summary = event.summary;
          if (summary !== undefined) setFound((previous) => ({ ...previous, ...summary }));
          const start = enteredAt.current[event.stage];
          const took = start === undefined ? 0 : Math.round(now - start);
          if (took >= 1) setElapsed((previous) => (event.stage in previous ? previous : { ...previous, [event.stage]: took }));
          setActive((current) => (current === event.stage ? undefined : current));
        } else {
          enteredAt.current[event.stage] ??= now;
          setEntered({ ...enteredAt.current });
          setActive(event.stage);
        }
      }
    };
    return () => {
      source.close();
    };
  }, [enabled, router, scanId, startedAt]);

  return { done, active, elapsed, entered, startedAt, found };
}

/** The named stages themselves: daisyUI `steps steps-vertical` in the
 *  route (DESIGN rule 1), each finished one carrying the time it took.
 *
 *  Takes the reading rather than subscribing, where a caller already has
 *  one — the scanning screen reads the stream once and hands the same
 *  reading to this list and to the report's skeletons. Where no reading is
 *  passed it subscribes itself, which is what `correction.tsx` and
 *  `rescan.tsx` do: there the stages are the whole of what is shown. */
export function ScanProgress(p: {
  domain: CanonicalDomain;
  scanId?: string;
  stages?: ScanStages;
}): React.JSX.Element {
  // Hooks are unconditional: the hook runs either way, and its own
  // subscription is skipped where a reading was passed in.
  const own = useScanStages({ domain: p.domain, scanId: p.scanId, enabled: p.stages === undefined });
  const stages = p.stages ?? own;

  return (
    <ol className="steps steps-vertical">
      {STAGES.map((stage) => {
        const seconds = stages.elapsed[stage];
        const from = stages.entered[stage];
        const state = stageState(stages, stage);
        return (
          <li
            key={stage}
            className={state === "done" ? "step step-success" : state === "active" ? "step step-primary" : "step"}
            data-state={state}
            aria-current={state === "active" ? "step" : undefined}
          >
            {state === "done" ? (
              <span className="step-icon" aria-hidden>
                <Check size={16} strokeWidth={1.75} aria-hidden />
              </span>
            ) : null}
            {/* A stage rises into its finished state as it finishes (the calm
                layer's motion, #1059); reduced motion draws it in place. */}
            <span
              className={`flex w-full flex-wrap items-start justify-between gap-x-3 gap-y-1 text-start ${state === "done" ? "motion-safe:animate-rise" : ""}`}
            >
              <span className="flex min-w-0 flex-col">
                <span>{copy(STAGE_KEY[stage], SEARCHES)}</span>
                <span className="text-base-content/70 text-sm">{copy(STAGE_LINE[stage])}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={`badge badge-sm ${state === "done" ? "badge-success badge-soft" : state === "active" ? "badge-primary badge-soft" : "badge-ghost"}`}>
                  {copy(state === "done" ? "stage.status.done" : state === "active" ? "stage.status.working" : "stage.status.next")}
                </span>
                {/* Only a finished stage has a duration and only the running one a start; a stage ahead has neither. */}
                {state === "done" && seconds !== undefined ? (
                  <span className="text-base-content/70 text-xs">{copy("stage.elapsed", { seconds: String(seconds) })}</span>
                ) : null}
                {state === "active" && from !== undefined ? (
                  <span className="text-base-content/70 text-xs">{copy("stage.started", { time: clock(Math.round(from)) })}</span>
                ) : null}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
