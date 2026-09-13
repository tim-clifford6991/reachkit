// BUILD §4.1 / SPEC §2 — the scanning arm, as `Canvas: ScanProgress` draws
// it: one row per named stage with its own elapsed time, and a determinate
// bar under them. No spinner, no percentage, no countdown.
//
// **`StageName` is imported as a type and never as a value.**
// `src/lib/scan/stages.ts` reaches `dbAdmin` and the parsed server
// environment, which a `"use client"` module must not pull into the bundle;
// `satisfies Record<StageName, CopyKey>` below is what still fails the build
// when the engine declares a seventh stage with no word here.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Circle, CircleCheck, CircleDot } from "lucide-react";
import { Progress } from "@/ui/components";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { StageEvent, StageName } from "@/lib/scan/stages";
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

/** The six, in the order `STAGE_KEY` declares them — which is
 *  `src/lib/scan/stages.ts`'s own `STAGE_ORDER`, transcribed once and
 *  checked against the union by the `satisfies` above. */
const STAGES = Object.keys(STAGE_KEY) as readonly StageName[];

type StageState = "done" | "active" | "pending";

/** The artboard's glyph and ink per state: the finished stage checked in
 *  `--ok`, the running one in the accent, the ones ahead of it quiet. */
const GLYPH: Record<StageState, typeof Circle> = {
  done: CircleCheck,
  active: CircleDot,
  pending: Circle,
};
const ICON_CLASS: Record<StageState, string> = {
  done: "text-success",
  active: "text-primary",
  pending: "text-(color:--ink-3)",
};
const LABEL_CLASS: Record<StageState, string> = {
  done: "",
  active: "font-semibold text-primary",
  pending: "text-(color:--ink-3)",
};
const TIME_CLASS: Record<StageState, string> = {
  done: "text-(color:--ink-2)",
  active: "text-primary",
  pending: "text-(color:--ink-3)",
};

/** The set's icon: 20px at stroke 1.75 (`docs/DESIGN.md`, "Icons"). */
const ICON_SIZE = 20;
const ICON_STROKE = 1.75;

/** Two units of the bar per finished stage and one for the stage under way,
 *  which is the fill the artboard draws with three done and a fourth
 *  running. The bar counts stages; it predicts nothing. */
const PER_STAGE = 2;

/** The clock the running stage's figure is read off, ticked once a second
 *  so an elapsed time stays elapsed rather than freezing at its start. */
const TICK_MS = 1000;

function isStageEvent(value: unknown): value is StageEvent {
  return typeof value === "object" && value !== null;
}

/** Whole seconds between two marks, or 0 where the first never arrived. */
function secondsBetween(from: number | undefined, to: number): number {
  return from === undefined ? 0 : Math.max(0, Math.round((to - from) / TICK_MS));
}

export function ScanProgress(p: {
  domain: CanonicalDomain;
  /** Present when the address already knew which scan is running. Absent
   *  on the `starting` arm, where this component claims one. */
  scanId?: string;
}): React.JSX.Element {
  const router = useRouter();
  const [scanId, setScanId] = useState<string | undefined>(p.scanId);
  /** When each stage started and when it finished, both measured in the
   *  browser. A stage's figure is the distance between its own two marks —
   *  its duration, as the artboard draws it, never a total or an estimate. */
  const [began, setBegan] = useState<Readonly<Record<string, number>>>({});
  const [ended, setEnded] = useState<Readonly<Record<string, number>>>({});
  const [now, setNow] = useState<number>(() => Date.now());

  // First frame, browser only: claim a scan if the address did not hand
  // one over. `location` is the canonical address and is ignored here —
  // this component is already rendering at it.
  useEffect(() => {
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
  }, [p.domain, router, scanId]);

  useEffect(() => {
    if (scanId === undefined) return;
    const source = new EventSource(`/api/scan/${scanId}/progress`);
    source.onmessage = (message: MessageEvent<string>) => {
      const parsed: unknown = JSON.parse(message.data);
      if (!isStageEvent(parsed)) return;
      // REQ-003 c3: the ending event swaps the report in with no reload —
      // the server resolves the address again and the `report` arm replaces
      // this one in place.
      if ("ending" in parsed) {
        source.close();
        router.refresh();
        return;
      }
      if ("stage" in parsed) {
        const event = parsed;
        const at = Date.now();
        const mark = (previous: Readonly<Record<string, number>>) =>
          event.stage in previous ? previous : { ...previous, [event.stage]: at };
        if (event.done) setEnded(mark);
        else setBegan(mark);
      }
    };
    return () => {
      source.close();
    };
  }, [router, scanId]);

  const stateOf = (stage: StageName): StageState =>
    ended[stage] !== undefined ? "done" : began[stage] !== undefined ? "active" : "pending";
  const secondsOf = (stage: StageName): number =>
    secondsBetween(began[stage], ended[stage] ?? now);

  const running = STAGES.some((stage) => stateOf(stage) === "active");
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      clearInterval(tick);
    };
  }, [running]);

  const filled = STAGES.reduce((total, stage) => {
    const state = stateOf(stage);
    return total + (state === "done" ? PER_STAGE : state === "active" ? 1 : 0);
  }, 0);

  return (
    <div className="flex flex-col gap-(--s-4)">
      <ol className="flex flex-col divide-y divide-base-300 border-y border-base-300">
        {STAGES.map((stage) => {
          const state = stateOf(stage);
          const Glyph = GLYPH[state];
          return (
            <li key={stage} className="flex items-center gap-(--s-3) py-(--s-2)">
              <Glyph
                size={ICON_SIZE}
                strokeWidth={ICON_STROKE}
                className={`shrink-0 ${ICON_CLASS[state]}`}
                aria-hidden
              />
              <span className={`min-w-0 flex-1 ${LABEL_CLASS[state]}`}>{copy(STAGE_KEY[stage])}</span>
              <span className={`num t-sm ${TIME_CLASS[state]}`}>
                {copy("stage.elapsed", { seconds: String(secondsOf(stage)) })}
              </span>
            </li>
          );
        })}
      </ol>
      {/* Determinate by construction (`Progress` takes no indeterminate
          arm): it counts the stages behind it and promises no finish time. */}
      <Progress value={filled} max={STAGES.length * PER_STAGE} />
    </div>
  );
}
