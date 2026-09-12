// tests/scan/free/stages.test.ts
//
// WO-281 `## Test plan` (criteria quoted verbatim from `requirements/
// REQ-003.md`, carried from WO-060) — the ordering, heartbeat, cut-off and
// single-ending suites for `progress`, `STAGES` and `StageName` — and
// issue #540's own: the stream crosses the process boundary.
//
// **The database is doubled as a store, not as a script.** Since #540 the
// transport *is* the `scans` row's own `stage_events` log, so a mock that
// answered reads with canned rows would test nothing: it would pass with
// the in-process bus this issue removed. The double below holds rows,
// applies `append_scan_stage_event` the way the migration does (append in
// call order, nothing after the first ending) and answers the reader with
// a copy of what the row holds at the moment it is read — which is what
// makes the cross-instance suite able to fail.
//
// Every event this suite observes is driven through this module's own
// producers (`enterStage`, `exitStage`, `emitEnding`), the seam
// `src/lib/scan/run.ts` calls.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => {
  interface Row {
    status: string;
    stopped_reason: string | null;
    stage_events: unknown[];
  }
  const rows = new Map<string, Row>();
  const faults = { readError: false, rpcError: false };
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const isEnding = (event: unknown): boolean => typeof event === "object" && event !== null && "ending" in event;
  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, id: unknown) => ({
          limit: () => {
            if (faults.readError) return Promise.resolve({ data: null, error: { message: "boom" } });
            const row = table === "scans" ? rows.get(String(id)) : undefined;
            return Promise.resolve({ data: row === undefined ? [] : [copy(row)], error: null });
          },
        }),
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args: copy(args) });
      if (faults.rpcError) return Promise.resolve({ error: { message: "PostgREST unreachable" } });
      if (fn === "append_scan_stage_event") {
        const row = rows.get(String(args.p_scan_id));
        if (row !== undefined && !row.stage_events.some(isEnding)) row.stage_events.push(copy(args.p_event));
      }
      return Promise.resolve({ error: null });
    },
  };
  return { rows, faults, rpcCalls, client };
});

vi.mock("@/lib/db", () => ({ dbAdmin: () => store.client }));

import { STAGES, enterStage, exitStage, emitEnding, progress, type StageEvent, type StageName } from "@/lib/scan/stages";
import type { Ending } from "@/lib/scan/ceilings";

const ROOT = path.resolve(import.meta.dirname, "../../..");

let scanCounter = 0;
/** A scan admission has claimed: a `scans` row, still running, that has
 *  recorded nothing yet. */
function freshScanId(row: { status?: string; stopped_reason?: string | null; stage_events?: unknown[] } = {}): string {
  scanCounter += 1;
  const scanId = `stages-scan-${scanCounter}`;
  store.rows.set(scanId, {
    status: row.status ?? "running",
    stopped_reason: row.stopped_reason ?? null,
    stage_events: row.stage_events ?? [],
  });
  return scanId;
}

afterEach(() => {
  store.rows.clear();
  store.rpcCalls.length = 0;
  store.faults.readError = false;
  store.faults.rpcError = false;
  vi.useRealTimers();
});

async function collectUntilEnding(iterable: AsyncIterable<StageEvent>, max = 200): Promise<StageEvent[]> {
  const collected: StageEvent[] = [];
  for await (const event of iterable) {
    collected.push(event);
    if ("ending" in event) break;
    if (collected.length >= max) break;
  }
  return collected;
}

/** Everything but the heartbeats: what the stream *says*, as against the
 *  frames that only keep it open. */
function said(events: StageEvent[]): StageEvent[] {
  return events.filter((event) => !("heartbeat" in event));
}

function withTimeout<T>(promise: Promise<T>, ms: number, because: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out: ${because}`)), ms)),
  ]);
}

// ── REQ-003 c1 — six named stages, in order ────────────────────────────

describe(
  'REQ-003 c1 — "Given a scan is running … when the visitor watches the page, then it shows named stages that advance as work completes, never an unlabelled spinner or an indeterminate bar alone."',
  () => {
    it("stages/order · STAGES is exactly the six dataset-boundary handles, in order", () => {
      expect(STAGES).toEqual([
        "reading_your_site",
        "reading_access_rules",
        "reading_your_market",
        "checking_your_presence",
        "asking_the_twelve",
        "scoring",
      ]);
    });

    it("stages/order · a scan driven through the pipeline emits entry then exit for each stage, in order, none repeated or skipped", async () => {
      const scanId = freshScanId();
      const collected = collectUntilEnding(progress(scanId));

      for (const stage of STAGES) {
        await enterStage(scanId, stage);
        await exitStage(scanId, stage);
      }
      const ending: Ending = { kind: "report", complete: true, stoppedReason: "complete" };
      await emitEnding(scanId, ending);

      const events = await collected;
      const stagesOnly = events.filter((e): e is { stage: StageName; done: boolean } => "stage" in e);
      expect(stagesOnly.map((e) => `${e.stage}:${e.done}`)).toEqual(
        STAGES.flatMap((stage) => [`${stage}:false`, `${stage}:true`])
      );
      expect(events.at(-1)).toEqual({ ending });
    });

    it("stages/advance · a stage advances on completed work, not on a clock", async () => {
      vi.useFakeTimers();
      const scanId = freshScanId();
      const iterator = progress(scanId)[Symbol.asyncIterator]();

      // The opening frame: nothing recorded yet, so the stream opens on a
      // heartbeat rather than holding the response (issue #540).
      const opening = await iterator.next();
      expect(opening.value).toEqual({ heartbeat: true });

      // Advance the clock arbitrarily with no work completing: well inside
      // the heartbeat interval, so nothing at all may arrive — no stage,
      // because none was reported.
      let settled = false;
      const pending = iterator.next().then((result) => {
        settled = true;
        return result;
      });
      await vi.advanceTimersByTimeAsync(20_000);
      expect(settled).toBe(false);

      await enterStage(scanId, "reading_your_site");
      await exitStage(scanId, "reading_your_site");
      await vi.advanceTimersByTimeAsync(0);
      const first = await pending;
      expect(first.value).toEqual({ stage: "reading_your_site", done: false });
      await iterator.return?.();
    });
  }
);

// ── REQ-003 c1 — heartbeat ──────────────────────────────────────────────

describe('REQ-003 c1, "never an unlabelled spinner or an indeterminate bar alone"', () => {
  it("stages/heartbeat · a slow third party never reads as stuck, and never as progress", async () => {
    vi.useFakeTimers();
    const scanId = freshScanId();
    const iterator = progress(scanId)[Symbol.asyncIterator]();

    const heartbeats: StageEvent[] = [];
    const pump = (async () => {
      for (let i = 0; i < 3; i++) {
        const { value } = await iterator.next();
        heartbeats.push(value);
      }
    })();

    await vi.advanceTimersByTimeAsync(95_000); // stalled 95 s, no stage reported

    await pump;
    expect(heartbeats).toHaveLength(3);
    for (const event of heartbeats) {
      expect(event).toEqual({ heartbeat: true });
      expect(event).not.toHaveProperty("stage");
    }
    await iterator.return?.();
  });

  it("stages/heartbeat · the first frame is never waited for: a scan with nothing recorded opens on a heartbeat at once (issue #540)", async () => {
    vi.useFakeTimers();
    const scanId = freshScanId();
    const iterator = progress(scanId)[Symbol.asyncIterator]();
    // No timer is advanced: the opening frame costs one read and no wait.
    const first = await iterator.next();
    expect(first).toEqual({ done: false, value: { heartbeat: true } });
    await iterator.return?.();
  });
});

// ── REQ-003 c5 / c11 — cut-off stages ────────────────────────────────────

describe(
  'REQ-003 c5 — "… when it reaches 90 seconds, then measuring stops and the visitor is shown the report of everything measured by that point, with the rest reported as unmeasured …"',
  () => {
    it("stages/cutoff · a cut-off stage emits no completion", async () => {
      const scanId = freshScanId();
      const collected = collectUntilEnding(progress(scanId));

      await enterStage(scanId, "reading_your_site");
      await exitStage(scanId, "reading_your_site");
      await enterStage(scanId, "reading_access_rules");
      await exitStage(scanId, "reading_access_rules");
      await enterStage(scanId, "asking_the_twelve"); // cut off mid-stage — no exitStage
      const ending: Ending = { kind: "report", complete: false, stoppedReason: "time_ceiling" };
      await emitEnding(scanId, ending);

      const events = await collected;
      expect(said(events)).toEqual([
        { stage: "reading_your_site", done: false },
        { stage: "reading_your_site", done: true },
        { stage: "reading_access_rules", done: false },
        { stage: "reading_access_rules", done: true },
        { stage: "asking_the_twelve", done: false },
        { ending },
      ]);
      expect(events.filter((e) => "stage" in e && e.stage === "asking_the_twelve" && e.done)).toHaveLength(0);
    });
  }
);

describe(
  'REQ-003 c11 — "… all remaining work is skipped, and the visitor is shown the report of everything measured up to that point …"',
  () => {
    it("stages/cutoff · the spend ceiling ends the stream the same way, and nothing after it is emitted", async () => {
      const scanId = freshScanId();
      const collected = collectUntilEnding(progress(scanId));

      await enterStage(scanId, "reading_your_site");
      await exitStage(scanId, "reading_your_site");
      await enterStage(scanId, "asking_the_twelve");
      const ending: Ending = { kind: "report", complete: false, stoppedReason: "spend_ceiling" };
      await emitEnding(scanId, ending);
      // Attempts after the ending are dropped, not delivered (WO-060 step 11).
      await exitStage(scanId, "asking_the_twelve");
      await enterStage(scanId, "scoring");

      const events = await collected;
      expect(events.at(-1)).toEqual({ ending });
      expect(events.filter((e) => "stage" in e && e.stage === "scoring")).toHaveLength(0);
      expect(events.filter((e) => "stage" in e && e.stage === "asking_the_twelve" && e.done)).toHaveLength(0);
      // …and dropped where it matters since #540: the recorded log itself
      // ends on the ending, so no later subscriber can be shown them either.
      expect(store.rows.get(scanId)?.stage_events.at(-1)).toEqual({ ending });
    });
  }
);

// ── REQ-003 c4 — exactly one ending ──────────────────────────────────────

describe(
  'REQ-003 c4 — "Given a scan that cannot complete at all, when it ends, then the visitor is told in one written line that the measurement failed and is offered a manual retry (the retry window is REQ-001\'s)."',
  () => {
    it.each<Ending>([
      { kind: "report", complete: true, stoppedReason: "complete" },
      { kind: "report", complete: false, stoppedReason: "time_ceiling" },
      { kind: "report", complete: false, stoppedReason: "spend_ceiling" },
      { kind: "report", complete: false, stoppedReason: "site_unreadable", refusal: "too_large" },
      { kind: "no_report", stoppedReason: "failed" },
    ])("stages/ending · exactly one ending, then the stream closes — %j", async (ending) => {
      const scanId = freshScanId();
      const iterator = progress(scanId)[Symbol.asyncIterator]();
      const events: StageEvent[] = [];
      const pump = (async () => {
        while (true) {
          const next = await iterator.next();
          if (next.done) return;
          events.push(next.value);
        }
      })();
      await emitEnding(scanId, ending);
      await withTimeout(pump, 3000, "the stream did not close after its ending");
      expect(said(events)).toEqual([{ ending }]);

      // A second ending is never delivered even if the driver mistakenly
      // reports one.
      await emitEnding(scanId, { kind: "report", complete: true, stoppedReason: "complete" });
      const lateSubscriber = await collectUntilEnding(progress(scanId));
      expect(lateSubscriber).toEqual([{ ending }]);
    });

    // TST-036 (WO-281 validation report): the live path a subscriber
    // watching a real, still-running scan actually takes — idle, waiting
    // on its next read — must halt on an ending published while it waits,
    // not only on one it finds already recorded. This case forces the
    // generator genuinely idle first (the opening heartbeat taken, real
    // macrotask ticks, nothing recorded) before publishing.
    it("stages/ending · a live-published ending reaches a genuinely idle subscriber, and closes the stream (TST-036)", async () => {
      const scanId = freshScanId();
      const iterator = progress(scanId)[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toEqual({ heartbeat: true });

      let settled = false;
      const pending = iterator.next().then((result) => {
        settled = true;
        return result;
      });
      for (let i = 0; i < 5; i++) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      expect(settled).toBe(false); // still idle — nothing recorded yet

      const ending: Ending = { kind: "report", complete: true, stoppedReason: "complete" };
      await emitEnding(scanId, ending);

      const first = await withTimeout(pending, 2000, "the live halt-on-ending did not fire (TST-036)");
      expect(first).toEqual({ done: false, value: { ending } });
      const second = await withTimeout(iterator.next(), 3000, "the stream did not close after the live ending (TST-036)");
      expect(second.done).toBe(true);
    });
  }
);

// ── Issue #540 — the stream crosses the process boundary ─────────────────

describe("issue #540 — `progress(scanId)` carries stage transitions across process boundaries", () => {
  /** A second copy of the module, with its own module-scoped state: what a
   *  second serverless instance is. `vi.resetModules()` empties the module
   *  registry, so the next import evaluates `stages.ts` afresh; the
   *  database double is the only thing the two copies share, as Postgres
   *  is the only thing two instances share. */
  async function anotherInstance(): Promise<typeof import("@/lib/scan/stages")> {
    vi.resetModules();
    return import("@/lib/scan/stages");
  }

  it("stages/cross-instance · a transition recorded by a subscriber-less producer is delivered to a subscriber that attached afterwards, in another instance", async () => {
    const scanId = freshScanId();

    // The invocation that runs the pass: nobody is listening, anywhere.
    for (const stage of STAGES) {
      await enterStage(scanId, stage);
      await exitStage(scanId, stage);
    }
    const ending: Ending = { kind: "report", complete: true, stoppedReason: "complete" };
    await emitEnding(scanId, ending);

    // The invocation that serves the stream: a different module instance,
    // attaching after every transition already happened.
    const other = await anotherInstance();
    expect(other.progress).not.toBe(progress);
    const events = await withTimeout(
      collectUntilEnding(other.progress(scanId)),
      3000,
      "the other instance never received the recorded transitions"
    );

    expect(events).toEqual([
      ...STAGES.flatMap((stage) => [
        { stage, done: false },
        { stage, done: true },
      ]),
      { ending },
    ]);
  });

  it("stages/cross-instance · a subscriber attached in another instance sees each live transition on its next read, with no shared memory to be woken by", async () => {
    vi.useFakeTimers();
    const scanId = freshScanId();
    const other = await anotherInstance();
    const iterator = other.progress(scanId)[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toEqual({ heartbeat: true });

    let received: IteratorResult<StageEvent> | null = null;
    const pending = iterator.next().then((result) => {
      received = result;
      return result;
    });

    // Recorded by *this* instance. Its nudge reaches no subscriber — the
    // subscriber is in the other one — so with no time passing, nothing
    // has arrived: delivery cannot be riding on shared module state.
    await enterStage(scanId, "reading_your_site");
    await vi.advanceTimersByTimeAsync(0);
    expect(received).toBeNull();

    // One poll later, the other instance has read it off the row.
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual({ done: false, value: { stage: "reading_your_site", done: false } });

    const ending: Ending = { kind: "report", complete: false, stoppedReason: "time_ceiling" };
    await emitEnding(scanId, ending);
    const last = iterator.next();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await last).toEqual({ done: false, value: { ending } });
    expect((await iterator.next()).done).toBe(true);
  });

  it.each<[string, string, Ending]>([
    ["done", "complete", { kind: "report", complete: true, stoppedReason: "complete" }],
    ["degraded", "time_ceiling", { kind: "report", complete: false, stoppedReason: "time_ceiling" }],
    ["degraded", "spend_ceiling", { kind: "report", complete: false, stoppedReason: "spend_ceiling" }],
    ["degraded", "site_unreadable", { kind: "report", complete: false, stoppedReason: "site_unreadable", refusal: null }],
    ["failed", "failed", { kind: "no_report", stoppedReason: "failed" }],
  ])(
    "stages/row-ended · a row that ended (%s, %s) without recording its ending still ends the stream — REQ-003 c3",
    async (status, stoppedReason, ending) => {
      // The pass the platform froze and the sweep called a ghost; a pass
      // from before the log existed; §6.4's served re-scan. The row's own
      // end state is the last word, after whatever the log does hold.
      const scanId = freshScanId({
        status,
        stopped_reason: stoppedReason,
        stage_events: [{ stage: "reading_your_site", done: false }],
      });
      const events = await withTimeout(collectUntilEnding(progress(scanId)), 3000, "a row that ended held its stream open");
      expect(events).toEqual([{ stage: "reading_your_site", done: false }, { ending }]);
    }
  );

  it("stages/row-ended · a running row the sweep later fails ends a stream that is already open", async () => {
    vi.useFakeTimers();
    const scanId = freshScanId();
    const iterator = progress(scanId)[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toEqual({ heartbeat: true });
    const pending = iterator.next();

    // `src/lib/scan/stuck.ts`'s write, from yet another process.
    Object.assign(store.rows.get(scanId)!, { status: "failed", stopped_reason: "failed" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual({ done: false, value: { ending: { kind: "no_report", stoppedReason: "failed" } } });
    expect((await iterator.next()).done).toBe(true);
  });

  it("stages/record · each producer appends the event verbatim through `append_scan_stage_event`, and the migration on disk defines it", async () => {
    const scanId = freshScanId();
    const ending: Ending = { kind: "report", complete: true, stoppedReason: "complete" };
    await enterStage(scanId, "scoring");
    await exitStage(scanId, "scoring");
    await emitEnding(scanId, ending);

    expect(store.rpcCalls).toEqual([
      { fn: "append_scan_stage_event", args: { p_scan_id: scanId, p_event: { stage: "scoring", done: false } } },
      { fn: "append_scan_stage_event", args: { p_scan_id: scanId, p_event: { stage: "scoring", done: true } } },
      { fn: "append_scan_stage_event", args: { p_scan_id: scanId, p_event: { ending } } },
    ]);

    // The name and the parameters above are the ones Postgres will be
    // asked for; a rename on either side fails here rather than in prod.
    const migrations = readdirSync(path.join(ROOT, "supabase/migrations"))
      .filter((name) => name.endsWith(".sql"))
      .map((name) => readFileSync(path.join(ROOT, "supabase/migrations", name), "utf8"))
      .join("\n");
    expect(migrations).toMatch(/add column stage_events jsonb not null default '\[\]'::jsonb/);
    expect(migrations).toMatch(/create or replace function append_scan_stage_event\(p_scan_id uuid, p_event jsonb\)/);
    // The ending closes the log in the database, not only in this double.
    expect(migrations).toMatch(/jsonb_exists\(recorded, 'ending'\)/);
    // A visitor cannot write into anyone's stream.
    expect(migrations).toMatch(/revoke all on function append_scan_stage_event\(uuid, jsonb\) from anon;/);
    expect(migrations).toMatch(/grant execute on function append_scan_stage_event\(uuid, jsonb\) to service_role;/);
  });

  it("stages/record · a recording that fails never takes the pass down with it", async () => {
    const scanId = freshScanId();
    store.faults.rpcError = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(enterStage(scanId, "reading_your_site")).resolves.toBeUndefined();
    await expect(exitStage(scanId, "reading_your_site")).resolves.toBeUndefined();
    await expect(emitEnding(scanId, { kind: "no_report", stoppedReason: "failed" })).resolves.toBeUndefined();
    expect(warn.mock.calls.map(([line]) => (JSON.parse(String(line)) as { event: string }).event)).toEqual([
      "stage_event_not_recorded",
      "stage_event_not_recorded",
      "stage_event_not_recorded",
    ]);
    warn.mockRestore();
  });
});

// ── REQ-003's non-goals — shape ──────────────────────────────────────────

describe('REQ-003\'s non-goal — "No queue position, percentage estimate, or countdown timer."', () => {
  it("stages/shape · the stream carries no estimate, and the type has exactly three arms", async () => {
    function classify(event: StageEvent): "stage" | "heartbeat" | "ending" {
      if ("stage" in event) return "stage";
      if ("heartbeat" in event) return "heartbeat";
      if ("ending" in event) return "ending";
      // Exhaustiveness — a fourth arm added to `StageEvent` without a
      // branch here fails `npm run typecheck`, not just at runtime.
      return ((x: never) => {
        throw new Error(`unreachable: ${JSON.stringify(x)}`);
      })(event);
    }

    const scanId = freshScanId();
    const collected = collectUntilEnding(progress(scanId));
    await enterStage(scanId, "reading_your_site");
    await exitStage(scanId, "reading_your_site");
    const ending: Ending = { kind: "report", complete: true, stoppedReason: "complete" };
    await emitEnding(scanId, ending);
    const events = await collected;

    for (const event of events) {
      expect(["stage", "heartbeat", "ending"]).toContain(classify(event));
      const keys = Object.keys(event).join(",");
      expect(keys.toLowerCase()).not.toMatch(/percent|eta|remaining|position|queue|countdown/);
    }
  });

  it("stages/shape · an element the log holds that is not a `StageEvent` this engine names is dropped, never put on the wire", async () => {
    const scanId = freshScanId({
      status: "done",
      stopped_reason: "complete",
      stage_events: [
        { stage: "reading_your_site", done: false },
        { stage: "a_stage_from_an_older_shape", done: false },
        { percent: 40 },
        { stage: "reading_your_site", done: true, eta: 12 },
        { ending: { kind: "report", complete: true, stoppedReason: "complete" } },
      ],
    });
    const events = await collectUntilEnding(progress(scanId));
    expect(events).toEqual([
      { stage: "reading_your_site", done: false },
      { stage: "reading_your_site", done: true },
      { ending: { kind: "report", complete: true, stoppedReason: "complete" } },
    ]);
  });
});

describe('REQ-003\'s non-goal — "No spend, cost or cap figure shown to a visitor."', () => {
  it("stages/shape · no cost figure on the stream, including the ending arm", async () => {
    const scanId = freshScanId();
    const collected = collectUntilEnding(progress(scanId));
    await enterStage(scanId, "scoring");
    await exitStage(scanId, "scoring");
    await emitEnding(scanId, { kind: "report", complete: false, stoppedReason: "spend_ceiling" });
    const events = await collected;

    // A key check, not a substring check on the whole payload: `Ending`
    // legitimately carries the *label* `stoppedReason: 'spend_ceiling'`
    // (REQ-003's own vocabulary, not a figure) — what must never appear is
    // a *field* naming a cost, a cap or a cent amount.
    function keysOf(event: StageEvent): string[] {
      if ("ending" in event) return Object.keys(event.ending);
      return Object.keys(event);
    }
    for (const event of events) {
      for (const key of keysOf(event)) {
        expect(key.toLowerCase()).not.toMatch(/cent|cost|cap|spend/);
      }
    }
  });
});

// ── Unknown scanId ────────────────────────────────────────────────────

describe("stages/unknown · a scanId with no scans row yields an immediately exhausted iterable", () => {
  it("produces no event at all", async () => {
    const events: StageEvent[] = [];
    for await (const event of progress("no-such-scan")) {
      events.push(event);
    }
    expect(events).toEqual([]);
  });

  it("a dbAdmin read error is treated the same as unknown, not as 'stream forever'", async () => {
    const scanId = freshScanId();
    store.faults.readError = true;
    const events: StageEvent[] = [];
    for await (const event of progress(scanId)) {
      events.push(event);
    }
    expect(events).toEqual([]);
  });
});

// ── Module-load assertion (WO-281 `## Steps` step 8) ─────────────────────

describe("WO-281 `## Steps` step 8 — STAGES is exactly six, none duplicated", () => {
  it("STAGES.length === 6 and every entry is unique", () => {
    expect(STAGES.length).toBe(6);
    expect(new Set(STAGES).size).toBe(6);
  });
});
