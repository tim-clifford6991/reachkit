// BUILD §4.2 — scheduleSequence: a re-delivery starts nothing, and a
// suppressed address starts nothing at all.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { blankLead, memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { sendCalls, sendMock } from "./send-mock";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { scheduleSequence } = await import("../../../src/lib/mail/leads/sequence");
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");

let state: MemoryState;

const DELIVERED = new Date("2026-09-05T12:00:00.000Z");

beforeEach(async () => {
  const [{ setAccountStore }, { memoryAccountStore, newMemoryAccounts }] = await Promise.all([import("@/lib/account/store"), import("../../account/memory-store")]);
  setAccountStore(memoryAccountStore(newMemoryAccounts()));
  state = newMemoryState();
  setLeadStore(memoryStore(state));
  sendCalls.length = 0;
});

afterEach(() => setLeadStore(null));

describe("a sequence begins on the row whose page was delivered, and never before that delivery", () => {
  it("a delivered page puts its own lead row into waiting, anchored to the delivery", async () => {
    state.leads = [
      blankLead({
        id: "lead-1",
        email: "anna@example.com",
        domain: "acme.com",
        first_page_state: "sent",
        page_delivered_at: DELIVERED.toISOString(),
      }),
    ];

    await scheduleSequence({ email: "anna@example.com", domain: "acme.com", deliveredAt: DELIVERED });

    expect(state.leads[0]).toMatchObject({
      sequence_state: "waiting",
      page_delivered_at: DELIVERED.toISOString(),
      touch_count: 0,
    });
  });

  it("a lead whose page was never delivered starts nothing", async () => {
    state.leads = [blankLead({ id: "lead-1", email: "anna@example.com", domain: "acme.com" })];

    await scheduleSequence({ email: "anna@example.com", domain: "acme.com", deliveredAt: DELIVERED });
    expect(state.leads[0]?.sequence_state).toBeNull();
  });
});

describe('REQ-010 c13 — "when that domain\'s page is delivered to that address again, for any reason, then no second sequence for that domain is started"', () => {
  it("scheduleSequence for a (email, domain) that already has any sequence_state is a no-op and raises nothing", async () => {
    for (const existing of ["running", "waiting", "finished", "stopped", "dropped"] as const) {
      state = newMemoryState();
      setLeadStore(memoryStore(state));
      state.leads = [
        blankLead({
          id: "first",
          email: "anna@example.com",
          domain: "acme.com",
          sequence_state: existing,
          page_delivered_at: "2026-09-01T00:00:00.000Z",
        }),
        // The second `leads` row a re-scan produces. Its `sequence_state`
        // stays null forever; that reads as a lost enqueue and is not one.
        blankLead({
          id: "second",
          email: "anna@example.com",
          domain: "acme.com",
          scan_id: "scan-2",
          first_page_state: "sent",
          page_delivered_at: DELIVERED.toISOString(),
        }),
      ];

      await expect(
        scheduleSequence({ email: "anna@example.com", domain: "acme.com", deliveredAt: DELIVERED })
      ).resolves.toBeUndefined();

      const second = state.leads.find((lead) => lead.id === "second");
      expect(second?.sequence_state, `existing state: ${existing}`).toBeNull();
      const first = state.leads.find((lead) => lead.id === "first");
      expect(first?.sequence_state).toBe(existing);
    }
  });

  it("the refusal is the index's, not a branch's: the caller swallows a conflict as success-with-no-effect", async () => {
    state.leads = [
      blankLead({
        id: "first",
        email: "anna@example.com",
        domain: "acme.com",
        sequence_state: "finished",
      }),
      blankLead({
        id: "second",
        email: "anna@example.com",
        domain: "acme.com",
        first_page_state: "sent",
        page_delivered_at: DELIVERED.toISOString(),
      }),
    ];

    // No throw, no retry, and nothing sent.
    await scheduleSequence({ email: "anna@example.com", domain: "acme.com", deliveredAt: DELIVERED });
    expect(sendCalls).toEqual([]);
  });

  it("a different domain for the same address is a different key and does start", async () => {
    state.leads = [
      blankLead({
        id: "acme",
        email: "anna@example.com",
        domain: "acme.com",
        sequence_state: "running",
      }),
      blankLead({
        id: "beta",
        email: "anna@example.com",
        domain: "beta.com",
        first_page_state: "sent",
        page_delivered_at: DELIVERED.toISOString(),
      }),
    ];

    await scheduleSequence({ email: "anna@example.com", domain: "beta.com", deliveredAt: DELIVERED });
    expect(state.leads.find((lead) => lead.id === "beta")?.sequence_state).toBe("waiting");
  });
});

describe('REQ-010 c11, last limb — "any sequence a future delivery would otherwise start"', () => {
  it("scheduleSequence starts nothing for a suppressed address", async () => {
    state.suppressions.set("anna@example.com", "opt_out");
    state.leads = [
      blankLead({
        id: "lead-1",
        email: "anna@example.com",
        domain: "acme.com",
        first_page_state: "sent",
        page_delivered_at: DELIVERED.toISOString(),
      }),
    ];

    await scheduleSequence({ email: "anna@example.com", domain: "acme.com", deliveredAt: DELIVERED });
    expect(state.leads[0]?.sequence_state).toBeNull();
  });

  it("an unreadable suppression store starts nothing either — the fail-closed direction", async () => {
    state.failSuppressionRead = true;
    state.leads = [
      blankLead({
        id: "lead-1",
        email: "anna@example.com",
        domain: "acme.com",
        first_page_state: "sent",
        page_delivered_at: DELIVERED.toISOString(),
      }),
    ];

    await scheduleSequence({ email: "anna@example.com", domain: "acme.com", deliveredAt: DELIVERED });
    expect(state.leads[0]?.sequence_state).toBeNull();
  });
});
