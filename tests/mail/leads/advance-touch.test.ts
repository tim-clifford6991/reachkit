// BUILD §11 · §12 — `advanceOneTouch`: one lead, one touch, the body the
// `lead/nurture` job runs (issue #176).
//
// The sweep (`advanceSequences`) and the job reach the same function, so
// the two cannot come to disagree about what one touch does — these
// assertions are about the job's half of it: the position check that makes
// `(leadId, touchIndex)` per-touch dedupe, the three states that stop a
// sequence rather than skip it, and the next touch scheduled from
// `NURTURE_H` and never from a literal.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { blankLead, memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { sendCalls, sendMock, sendOutcome } from "./send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { advanceOneTouch, advanceSequences } = await import("../../../src/lib/mail/leads/sequence");
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");
const { NURTURE_H, NURTURE_MAX_TOUCHES } = await import("../../../src/lib/config/constants");

let state: MemoryState;

const STARTED = new Date("2026-09-05T12:00:00.000Z");
/** Any instant after the sequence began. Due-ness on this path is the
 *  event's arrival, not the stored clock — see the function's own header. */
const NOW = new Date("2026-09-06T12:00:00.000Z");

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
      next_touch_at: new Date(STARTED.getTime() + NURTURE_H[0] * 3600_000).toISOString(),
      ...over,
    }),
  ];
}

beforeEach(() => {
  state = newMemoryState();
  setLeadStore(memoryStore(state));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
});

afterEach(() => setLeadStore(null));

describe("the touch is composed through the real shell and handed to the send seam", () => {
  it("touch 0 sends the first nurture mail to the lead's own address", async () => {
    running();
    const outcome = await advanceOneTouch({ leadId: "lead-1", touchIndex: 0, now: NOW });

    expect(outcome).toEqual({
      advanced: true,
      touch: 1,
      nextTouchAt: new Date(STARTED.getTime() + NURTURE_H[1] * 3600_000),
    });
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]).toMatchObject({
      kind: "nurture",
      to: "anna@example.com",
      subject: "mail.nurture.subject.1",
    });
    // The body carries the domain in its slot — composed by
    // `buildNurture`, not by this function.
    expect(sendCalls[0]?.blocks).toEqual([
      { block: "paragraph", text: "mail.nurture.body.1", vars: { domain: "acme.com" } },
    ]);
  });

  it("the touch is recorded and the next one scheduled from `NURTURE_H`, measured from the start", async () => {
    running();
    await advanceOneTouch({ leadId: "lead-1", touchIndex: 0, now: NOW });
    expect(state.leads[0]).toMatchObject({
      touch_count: 1,
      sequence_state: "running",
      next_touch_at: new Date(STARTED.getTime() + NURTURE_H[1] * 3600_000).toISOString(),
    });
  });

  it("the last touch finishes the sequence and schedules nothing — there is no fourth", async () => {
    running({ touch_count: NURTURE_MAX_TOUCHES - 1 });
    const outcome = await advanceOneTouch({
      leadId: "lead-1",
      touchIndex: NURTURE_MAX_TOUCHES - 1,
      now: NOW,
    });
    expect(outcome).toEqual({ advanced: true, touch: NURTURE_MAX_TOUCHES, nextTouchAt: null });
    expect(state.leads[0]).toMatchObject({ sequence_state: "finished", next_touch_at: null });

    // And a fourth event for the same lead sends nothing at all.
    sendCalls.length = 0;
    const fourth = await advanceOneTouch({ leadId: "lead-1", touchIndex: NURTURE_MAX_TOUCHES, now: NOW });
    expect(fourth).toEqual({ advanced: false, reason: "not-running" });
    expect(sendCalls).toHaveLength(0);
  });
});

describe("`(leadId, touchIndex)` is per-touch dedupe — a re-run sends nothing", () => {
  it("the same event delivered twice sends one mail and records one touch", async () => {
    running();
    await advanceOneTouch({ leadId: "lead-1", touchIndex: 0, now: NOW });
    const again = await advanceOneTouch({ leadId: "lead-1", touchIndex: 0, now: NOW });

    expect(again).toEqual({ advanced: false, reason: "already-recorded" });
    expect(sendCalls).toHaveLength(1);
    expect(state.leads[0]?.touch_count).toBe(1);
  });

  it("an event for a touch the sequence has not reached sends nothing and moves nothing", async () => {
    running();
    const ahead = await advanceOneTouch({ leadId: "lead-1", touchIndex: 2, now: NOW });
    expect(ahead).toEqual({ advanced: false, reason: "already-recorded" });
    expect(sendCalls).toHaveLength(0);
    expect(state.leads[0]).toMatchObject({ touch_count: 0, sequence_state: "running" });
  });

  it("a lead that does not exist sends nothing and raises nothing", async () => {
    const outcome = await advanceOneTouch({ leadId: "no-such-lead", touchIndex: 0, now: NOW });
    expect(outcome).toEqual({ advanced: false, reason: "no-lead" });
    expect(sendCalls).toHaveLength(0);
  });

  it("a refused send records nothing — the touch is still owed", async () => {
    running();
    sendOutcome.next = { sent: false, reason: "not-composable" };
    const outcome = await advanceOneTouch({ leadId: "lead-1", touchIndex: 0, now: NOW });

    expect(outcome).toEqual({ advanced: false, reason: "not-sent" });
    expect(state.leads[0]).toMatchObject({ touch_count: 0, sequence_state: "running" });

    // The same event, once the line is written, still sends its touch.
    sendOutcome.next = { sent: true, id: "vendor-1" };
    expect(await advanceOneTouch({ leadId: "lead-1", touchIndex: 0, now: NOW })).toMatchObject({
      advanced: true,
      touch: 1,
    });
  });
});

describe("REQ-010 c10/c11 — converted, suppressed or opted-out advances nothing and stops the sequence", () => {
  it("a converted lead is stopped with its cause and sends nothing", async () => {
    running({ converted_at: "2026-09-06T09:00:00.000Z" });
    const outcome = await advanceOneTouch({ leadId: "lead-1", touchIndex: 0, now: NOW });

    expect(outcome).toEqual({ advanced: false, reason: "converted" });
    expect(sendCalls).toHaveLength(0);
    // Stopped, not skipped: a row left labelled `running` is a lie about
    // what is still due, and every later run would re-read it.
    expect(state.leads[0]).toMatchObject({ sequence_state: "stopped", next_touch_at: null });
  });

  it.each(["opt_out", "subscribed"] as const)("a %s address is stopped and sends nothing", async (cause) => {
    running();
    state.suppressions.set("anna@example.com", cause);
    const outcome = await advanceOneTouch({ leadId: "lead-1", touchIndex: 0, now: NOW });

    expect(outcome).toEqual({ advanced: false, reason: "suppressed" });
    expect(sendCalls).toHaveLength(0);
    expect(state.leads[0]).toMatchObject({ sequence_state: "stopped", next_touch_at: null });
  });

  it("conversion outranks the position check — a converted lead is stopped even on a stale event", async () => {
    running({ converted_at: "2026-09-06T09:00:00.000Z", touch_count: 1 });
    const outcome = await advanceOneTouch({ leadId: "lead-1", touchIndex: 0, now: NOW });
    expect(outcome).toEqual({ advanced: false, reason: "converted" });
    expect(state.leads[0]?.sequence_state).toBe("stopped");
  });

  it("a sequence that never started, was dropped or already stopped advances nothing", async () => {
    for (const sequence_state of [null, "waiting", "dropped", "stopped", "finished"] as const) {
      state = newMemoryState();
      setLeadStore(memoryStore(state));
      sendCalls.length = 0;
      running({ sequence_state });
      expect(
        await advanceOneTouch({ leadId: "lead-1", touchIndex: 0, now: NOW }),
        String(sequence_state)
      ).toEqual({ advanced: false, reason: "not-running" });
      expect(sendCalls).toHaveLength(0);
    }
  });
});

describe("the sweep and the job run the same body", () => {
  it("a converted lead the sweep reaches is stopped there too", async () => {
    running({ converted_at: "2026-09-06T09:00:00.000Z" });
    const swept = await advanceSequences(NOW);
    expect(swept.sent).toBe(0);
    expect(state.leads[0]?.sequence_state).toBe("stopped");
  });

  it("the sweep sends a due touch and records it exactly as the job does", async () => {
    running();
    const swept = await advanceSequences(NOW);
    expect(swept.sent).toBe(1);
    expect(sendCalls).toHaveLength(1);
    expect(state.leads[0]).toMatchObject({
      touch_count: 1,
      next_touch_at: new Date(STARTED.getTime() + NURTURE_H[1] * 3600_000).toISOString(),
    });
  });

  it("the sweep leaves a touch that has not come round alone; the job's event does not wait for the stored clock", async () => {
    running({ next_touch_at: "2026-09-30T00:00:00.000Z" });
    expect((await advanceSequences(NOW)).sent).toBe(0);
    expect(sendCalls).toHaveLength(0);

    // The platform's own delay is what scheduled the event, so its arrival
    // is the due-ness. Re-checking the stored clock here would lose the
    // touch forever — there is no re-delivery for one this path declines.
    expect(await advanceOneTouch({ leadId: "lead-1", touchIndex: 0, now: NOW })).toMatchObject({
      advanced: true,
      touch: 1,
    });
  });
});
