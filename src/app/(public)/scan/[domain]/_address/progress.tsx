// BUILD §4.1 — the scanning arm's named stages
//
// REQ-003 c1: named stages that advance as work completes — never an
// unlabelled spinner and never an indeterminate bar alone.
//
// **Each finished stage carries the time it took** (UI-SPEC S3, issue
// #352). It is measured in the browser, from the frame this component
// mounted on to the event that finished the stage, so it is an elapsed
// time and never a countdown, a percentage or an estimate: nothing here
// predicts when the scan ends, and the running stage carries no figure at
// all — a number beside it would be a promise the scan has not made.
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

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Steps } from "@/ui/components";
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

function isStageEvent(value: unknown): value is StageEvent {
  return typeof value === "object" && value !== null;
}

export function ScanProgress(p: {
  domain: CanonicalDomain;
  /** Present when the address already knew which scan is running. Absent
   *  on the `starting` arm, where this component claims one. */
  scanId?: string;
}): React.JSX.Element {
  const router = useRouter();
  const [scanId, setScanId] = useState<string | undefined>(p.scanId);
  const [done, setDone] = useState<ReadonlySet<StageName>>(new Set());
  const [active, setActive] = useState<StageName | undefined>(undefined);
  /** Whole seconds from this component's first frame to each stage's own
   *  ending event. `useState`'s initialiser runs once, in the browser. */
  const [startedAt] = useState<number>(() => Date.now());
  const [elapsed, setElapsed] = useState<Readonly<Record<string, number>>>({});

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
      if ("ending" in parsed) {
        source.close();
        router.refresh();
        return;
      }
      if ("stage" in parsed) {
        const event = parsed;
        if (event.done) {
          setDone((previous) => new Set(previous).add(event.stage));
          setElapsed((previous) =>
            event.stage in previous
              ? previous
              : { ...previous, [event.stage]: Math.max(0, Math.round((Date.now() - startedAt) / 1000)) }
          );
          setActive((current) => (current === event.stage ? undefined : current));
        } else {
          setActive(event.stage);
        }
      }
    };
    return () => {
      source.close();
    };
  }, [router, scanId, startedAt]);

  return (
    <Steps
      direction="vertical"
      steps={STAGES.map((stage) => {
        const seconds = elapsed[stage];
        return {
          id: stage,
          label: copy(STAGE_KEY[stage]),
          state: done.has(stage) ? "done" : stage === active ? "active" : "pending",
          // Only a stage that finished has a time; the one running and the
          // ones ahead of it carry none.
          note: seconds === undefined ? undefined : copy("stage.elapsed", { seconds: String(seconds) }),
        };
      })}
    />
  );
}
