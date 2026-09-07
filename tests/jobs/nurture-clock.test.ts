// tests/jobs/nurture-clock.test.ts — BUILD §11 · §12, issue #182
//
// The clock, end to end: the `lead/nurture` job, the real engine seam and
// the real sweep, over the lead store in memory. `tests/jobs/definitions.test.ts`
// asserts the wiring against a recorded double — that the tick hands its own
// clock to `advanceDueSequences` and maps what it answers. This file asserts
// the thing that made the ruling: that running that tick on the hour puts the
// touches at `NURTURE_H`'s offsets, and that running it again puts out
// nothing.
//
// **Nothing here is mocked above the send seam.** The job, `engine.ts`,
// `advanceSequences`, `advanceLead` and the store are all the real ones, so
// a wiring that reached the sweep with the wrong clock — or reached
// `advanceOneTouch` instead, whose due-ness is the event's rather than the
// row's — fails here rather than passing against a double that agrees with
// it.
//
// The offsets are read from `NURTURE_H` and never written down: a test that
// hard-coded 24/72/168 would keep passing on the day the pin changed and the
// product stopped matching it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubEnv } from "./env-fixture";
import { blankLead, memoryStore, newMemoryState, type MemoryState } from "../mail/leads/memory-store";
import { sendCalls, sendMock, sendOutcome } from "../mail/leads/send-mock";

stubEnv(false);

vi.mock("@/lib/mail/send", () => sendMock());

const { jobs } = await import("@/jobs");
type JobDefinition = (typeof jobs)[number];
const { setLeadStore } = await import("@/lib/mail/leads/store");
const { NURTURE_H, NURTURE_MAX_TOUCHES } = await import("@/lib/config/constants");

const MS_PER_HOUR = 3_600_000;
const STARTED = new Date("2026-09-07T09:00:00.000Z");

function definition(): JobDefinition {
  const found = jobs.find((job) => job.id === "lead/nurture");
  if (found === undefined) throw new Error("no lead/nurture definition");
  return found;
}

let state: MemoryState;

/** The instant `hours` after the sequence began, on the hour — which is
 *  when this job's own trigger fires. */
function at(hours: number): Date {
  return new Date(STARTED.getTime() + hours * MS_PER_HOUR);
}

/** One tick. The platform hands `now`; the job reads no clock of its own. */
async function tick(now: Date): Promise<{ outcome: string }> {
  return (await definition().run({ data: {}, now })) as { outcome: string };
}

/** A sequence already released and waiting on its first touch — the state
 *  `release()` leaves behind, written directly so this file's subject is the
 *  touches and not the release. */
function running(over: Record<string, unknown> = {}): void {
  state.leads = [
    blankLead({
      id: "lead-1",
      email: "anna@example.com",
      domain: "acme.com",
      sequence_state: "running",
      sequence_started_at: STARTED.toISOString(),
      page_delivered_at: STARTED.toISOString(),
      touch_count: 0,
      next_touch_at: at(NURTURE_H[0]!).toISOString(),
      ...over,
    }),
  ];
}

function lead(): Record<string, unknown> {
  const row = state.leads[0];
  if (row === undefined) throw new Error("no lead row");
  return row as unknown as Record<string, unknown>;
}

beforeEach(() => {
  state = newMemoryState();
  setLeadStore(memoryStore(state));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  setLeadStore(null);
  vi.restoreAllMocks();
});

describe("REQ-010 c9 — the touches land at NURTURE_H's hours, and the clock is what puts them there", () => {
  it("an hour before the first offset sends nothing, and the tick says so", async () => {
    running();
    const outcome = await tick(at(NURTURE_H[0]! - 1));
    expect(sendCalls).toHaveLength(0);
    expect(outcome.outcome).toBe("skipped");
    expect(lead().touch_count).toBe(0);
  });

  it("at the first offset the first touch goes, and the next is scheduled at the second", async () => {
    running();
    const outcome = await tick(at(NURTURE_H[0]!));

    expect(outcome.outcome).toBe("ran");
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]?.to).toBe("anna@example.com");
    expect(lead().touch_count).toBe(1);
    // Measured from when the sequence began, not from the previous touch:
    // REQ-010 c9 fixes the offsets "after that domain's sequence begins".
    expect(lead().next_touch_at).toBe(at(NURTURE_H[1]!).toISOString());
  });

  it("every offset in NURTURE_H gets its touch, in order, and the sequence then finishes", async () => {
    running();
    for (const [index, offset] of NURTURE_H.entries()) {
      // An hour early: nothing. On the hour: the touch. That pair is what
      // proves the schedule rather than the loop.
      await tick(at(offset - 1));
      expect(sendCalls, `touch ${index + 1} went early`).toHaveLength(index);
      await tick(at(offset));
      expect(sendCalls, `touch ${index + 1} did not go on the hour`).toHaveLength(index + 1);
    }

    expect(sendCalls).toHaveLength(NURTURE_MAX_TOUCHES);
    expect(lead().touch_count).toBe(NURTURE_MAX_TOUCHES);
    // There is no fourth: the schedule is spent and the row says so.
    expect(lead().next_touch_at).toBeNull();
  });

  it("a tick long after the last offset sends no fourth touch", async () => {
    running();
    for (const offset of NURTURE_H) await tick(at(offset));
    sendCalls.length = 0;

    await tick(at(NURTURE_H[NURTURE_H.length - 1]! + 24));
    expect(sendCalls).toHaveLength(0);
    expect(lead().touch_count).toBe(NURTURE_MAX_TOUCHES);
  });
});

describe("a re-run sends nothing — the property that made the clock the safer shape", () => {
  it("the same tick run twice in the same hour sends one touch, not two", async () => {
    running();
    const first = await tick(at(NURTURE_H[0]!));
    const second = await tick(at(NURTURE_H[0]!));

    expect(sendCalls).toHaveLength(1);
    expect(first.outcome).toBe("ran");
    // The second found nothing due — `next_touch_at` had already moved on.
    // The position check is what makes it exact, and it reads the row.
    expect(second.outcome).toBe("skipped");
    expect(lead().touch_count).toBe(1);
  });

  it("ticking every hour for a week sends exactly three touches", async () => {
    running();
    const lastOffset = NURTURE_H[NURTURE_H.length - 1]!;
    for (let hour = 0; hour <= lastOffset + 24; hour += 1) await tick(at(hour));

    // The strongest statement this file makes: the platform delivering the
    // tick every hour, as it will, produces the schedule and no more of it.
    expect(sendCalls).toHaveLength(NURTURE_MAX_TOUCHES);
    expect(lead().touch_count).toBe(NURTURE_MAX_TOUCHES);
  });

  it("a missed tick does not lose a touch — the next one still finds it due", async () => {
    // The reason the ruling took the clock over chained events: a declined
    // event is never re-delivered, and a touch lost that way is lost
    // forever. Here the row is still due an hour later, and three hours
    // later, and the touch goes.
    running();
    await tick(at(NURTURE_H[0]! + 3));

    expect(sendCalls).toHaveLength(1);
    expect(lead().touch_count).toBe(1);
    // The schedule does not slip: the next offset is still measured from
    // when the sequence began, so a late tick catches up rather than
    // pushing every later touch out by the same delay.
    expect(lead().next_touch_at).toBe(at(NURTURE_H[1]!).toISOString());
  });

  it("a send the seam refused leaves the touch owed, and the next tick tries it again", async () => {
    running();
    sendOutcome.next = { sent: false, reason: "vendor" };
    await tick(at(NURTURE_H[0]!));
    expect(lead().touch_count).toBe(0);

    sendOutcome.next = { sent: true, id: "vendor-1" };
    const retry = await tick(at(NURTURE_H[0]! + 1));
    expect(retry.outcome).toBe("ran");
    expect(lead().touch_count).toBe(1);
  });
});
