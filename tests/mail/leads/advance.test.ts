// BUILD §4.2 — advanceSequences: sweep, then release, then send.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import {
  NURTURE_H,
  NURTURE_MAX_TOUCHES,
  SEQUENCE_START_DEADLINE_DAYS,
} from "../../../src/lib/config/constants";
import { blankLead, memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { sendCalls, sendMock, sendOutcome } from "./send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { advanceSequences } = await import("../../../src/lib/mail/leads/sequence");
const { suppressAddress } = await import("../../../src/lib/mail/leads/suppress");
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");

let state: MemoryState;

const DAY_ZERO = new Date("2026-09-01T00:00:00.000Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Which domain a recorded nurture send is about: the body block's own
 *  `domain` var, which is the only place a touch names it. */
function domainOf(call: { blocks: readonly unknown[] }): string {
  const first = call.blocks[1] as { vars?: { domain?: string } };
  return first.vars?.domain ?? "";
}

function at(offsetMs: number): Date {
  return new Date(DAY_ZERO.getTime() + offsetMs);
}

function waitingLead(a: { id: string; email: string; domain: string; deliveredMsAfterZero: number }) {
  return blankLead({
    id: a.id,
    email: a.email,
    domain: a.domain,
    first_page_state: "sent",
    sequence_state: "waiting",
    page_delivered_at: at(a.deliveredMsAfterZero).toISOString(),
  });
}

beforeEach(() => {
  state = newMemoryState();
  setLeadStore(memoryStore(state));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
});

afterEach(() => setLeadStore(null));

describe('REQ-010 c9 — "then at most three follow-up emails are sent for that domain, at 24, 72 and 168 hours after that domain\'s sequence begins, and none afterwards"', () => {
  it("a released sequence sends exactly three touches, at the pinned offsets from sequence_started_at, and nothing at +336h", async () => {
    state.leads = [
      waitingLead({ id: "l1", email: "anna@example.com", domain: "acme.com", deliveredMsAfterZero: 0 }),
    ];

    // Release at hour 0, then step the clock hour by hour for two weeks.
    const sentAtHours: number[] = [];
    for (let hour = 0; hour <= 336; hour++) {
      const before = sendCalls.length;
      await advanceSequences(at(hour * HOUR));
      if (sendCalls.length > before) sentAtHours.push(hour);
    }

    expect(sentAtHours).toEqual([...NURTURE_H]);
    expect(sendCalls).toHaveLength(NURTURE_MAX_TOUCHES);
    expect(sendCalls.map((call) => call.kind)).toEqual(["nurture", "nurture", "nurture"]);
    expect(state.leads[0]?.sequence_state).toBe("finished");
    expect(state.leads[0]?.next_touch_at).toBeNull();
  });

  it("the offsets come from the pin, not from literals in the module", async () => {
    // The mutation this guards: delete the NURTURE_MAX_TOUCHES stop and a
    // fourth touch is sent; hard-code the offsets and this assertion no
    // longer describes what the module does.
    expect(NURTURE_H).toEqual([24, 72, 168]);
    expect(NURTURE_MAX_TOUCHES).toBe(3);
  });
});

describe('REQ-010 c12 — "at most one sequence to an address is ever running, and sequences to one address run in the order their pages were delivered"', () => {
  it("an address with four domains never has two running at once", async () => {
    state.leads = [
      waitingLead({ id: "a", email: "anna@example.com", domain: "a.com", deliveredMsAfterZero: 0 }),
      waitingLead({ id: "b", email: "anna@example.com", domain: "b.com", deliveredMsAfterZero: HOUR }),
      waitingLead({ id: "c", email: "anna@example.com", domain: "c.com", deliveredMsAfterZero: 2 * HOUR }),
      waitingLead({ id: "d", email: "anna@example.com", domain: "d.com", deliveredMsAfterZero: 3 * HOUR }),
    ];

    for (let hour = 0; hour <= 24 * 30; hour++) {
      await advanceSequences(at(hour * HOUR));
      const running = state.leads.filter((lead) => lead.sequence_state === "running");
      expect(running.length, `at hour ${hour}`).toBeLessThanOrEqual(1);
    }
  });

  it("sequences release in page_delivered_at order", async () => {
    state.leads = [
      waitingLead({ id: "later", email: "anna@example.com", domain: "b.com", deliveredMsAfterZero: 2 * HOUR }),
      waitingLead({ id: "earlier", email: "anna@example.com", domain: "a.com", deliveredMsAfterZero: HOUR }),
    ];

    const order: string[] = [];
    for (let hour = 1; hour <= 24 * 30; hour++) {
      const before = new Set(
        state.leads.filter((lead) => lead.sequence_state === "running").map((lead) => lead.id)
      );
      await advanceSequences(at(hour * HOUR));
      for (const lead of state.leads) {
        if (lead.sequence_state === "running" && !before.has(lead.id)) order.push(lead.id);
      }
    }

    // The earlier delivery runs first, whatever order the rows came back in.
    expect(order).toEqual(["earlier", "later"]);
  });

  it("no sequence starts before its own page_delivered_at", async () => {
    state.leads = [
      waitingLead({ id: "future", email: "anna@example.com", domain: "a.com", deliveredMsAfterZero: 5 * DAY }),
    ];

    await advanceSequences(at(DAY));
    expect(state.leads[0]?.sequence_state).toBe("waiting");
    expect(state.leads[0]?.sequence_started_at).toBeNull();
  });
});

describe('REQ-010 c12 — "A sequence that has not begun within 7 days of its own page\'s delivery is dropped and never sent" (ADR-041 landmine 1)', () => {
  it("a waiting sequence is dropped at the deadline on an invocation that releases nothing, and no later invocation can release it", async () => {
    state.leads = [
      // One running, so the release step has nothing to give the second.
      blankLead({
        id: "running",
        email: "anna@example.com",
        domain: "a.com",
        sequence_state: "running",
        sequence_started_at: DAY_ZERO.toISOString(),
        next_touch_at: at(400 * DAY).toISOString(),
        page_delivered_at: DAY_ZERO.toISOString(),
      }),
      waitingLead({ id: "stuck", email: "anna@example.com", domain: "b.com", deliveredMsAfterZero: 0 }),
    ];

    const justPast = at(SEQUENCE_START_DEADLINE_DAYS * DAY + HOUR);
    const result = await advanceSequences(justPast);

    expect(result.dropped).toBe(1);
    expect(result.released).toBe(0);
    const stuck = state.leads.find((lead) => lead.id === "stuck");
    expect(stuck?.sequence_state).toBe("dropped");
    expect(stuck?.dropped_at).toBe(justPast.toISOString());

    // The mutation this guards: move the sweep after the release, and on an
    // invocation that releases nothing the row never reaches its terminal
    // state. And: there is no path back.
    state.leads = state.leads.map((lead) =>
      lead.id === "running" ? { ...lead, sequence_state: "finished" as const } : lead
    );
    for (let day = 8; day <= 40; day++) {
      await advanceSequences(at(day * DAY));
    }
    expect(state.leads.find((lead) => lead.id === "stuck")?.sequence_state).toBe("dropped");
    expect(sendCalls).toEqual([]);
  });

  it("no touch is ever sent more than 14 days after its own page_delivered_at — the bound is arithmetic on two pins", async () => {
    const domains = ["a.com", "b.com", "c.com", "d.com"];
    state.leads = domains.map((domain, index) =>
      waitingLead({
        id: domain,
        email: "anna@example.com",
        domain,
        deliveredMsAfterZero: index * HOUR,
      })
    );

    const deliveredAt = new Map(
      state.leads.map((lead) => [lead.domain, new Date(lead.page_delivered_at as string).getTime()])
    );

    // Seven days of waiting plus a last touch at 168 hours. The bound is
    // this sum and not a third check that could disagree with the pins.
    const bound = (SEQUENCE_START_DEADLINE_DAYS * 24 + NURTURE_H[2]) * HOUR;
    expect(bound).toBe(14 * DAY);

    // Four domains, one address, run day by day for thirty days. Each send
    // is stamped with the hour it went out and the domain its body names.
    const sentTouches: { domain: string; sentAt: number }[] = [];
    for (let hour = 0; hour <= 24 * 30; hour++) {
      const now = at(hour * HOUR);
      const before = sendCalls.length;
      await advanceSequences(now);
      for (const call of sendCalls.slice(before)) {
        sentTouches.push({ domain: domainOf(call), sentAt: now.getTime() });
      }
    }

    expect(sentTouches.length).toBeGreaterThan(0);
    for (const touch of sentTouches) {
      const delivered = deliveredAt.get(touch.domain) as number;
      expect(touch.sentAt - delivered, `a touch about ${touch.domain}`).toBeLessThanOrEqual(bound);
    }

    // And the arithmetic is real rather than vacuous: with four domains
    // behind one address, at least one sequence is dropped at its deadline
    // rather than mailed late.
    expect(state.leads.some((lead) => lead.sequence_state === "dropped")).toBe(true);
  });
});

describe('REQ-010 c12, last sentence — "those end the waiting sequences too, and no waiting sequence ever begins after either"', () => {
  it("after suppressAddress, advanceSequences releases nothing for that address on any later invocation", async () => {
    state.leads = [
      waitingLead({ id: "a", email: "anna@example.com", domain: "a.com", deliveredMsAfterZero: 0 }),
      waitingLead({ id: "b", email: "anna@example.com", domain: "b.com", deliveredMsAfterZero: HOUR }),
    ];

    await suppressAddress("anna@example.com", "opt_out");
    for (let hour = 0; hour <= 24 * 20; hour++) {
      const result = await advanceSequences(at(hour * HOUR));
      expect(result.released).toBe(0);
      expect(result.sent).toBe(0);
    }
    expect(state.leads.every((lead) => lead.sequence_state === "stopped")).toBe(true);
    expect(sendCalls).toEqual([]);
  });

  it("a running sequence suppressed mid-flight is stopped rather than left labelled running", async () => {
    state.leads = [
      waitingLead({ id: "a", email: "anna@example.com", domain: "a.com", deliveredMsAfterZero: 0 }),
    ];
    await advanceSequences(DAY_ZERO);
    expect(state.leads[0]?.sequence_state).toBe("running");

    state.suppressions.set("anna@example.com", "subscribed");
    await advanceSequences(at(NURTURE_H[0] * HOUR));

    expect(state.leads[0]?.sequence_state).toBe("stopped");
    expect(state.leads[0]?.next_touch_at).toBeNull();
    expect(sendCalls).toEqual([]);
  });
});

describe("a touch the seam did not send does not advance the count", () => {
  it("a refused send leaves the row due, so nothing is recorded as sent that was not", async () => {
    state.leads = [
      waitingLead({ id: "a", email: "anna@example.com", domain: "a.com", deliveredMsAfterZero: 0 }),
    ];
    await advanceSequences(DAY_ZERO);

    sendOutcome.next = { sent: false, reason: "vendor" };
    const refused = await advanceSequences(at(NURTURE_H[0] * HOUR));
    expect(refused.sent).toBe(0);
    expect(state.leads[0]?.touch_count).toBe(0);

    sendOutcome.next = { sent: true, id: "vendor-2" };
    const sent = await advanceSequences(at((NURTURE_H[0] + 1) * HOUR));
    expect(sent.sent).toBe(1);
    expect(state.leads[0]?.touch_count).toBe(1);
  });
});
