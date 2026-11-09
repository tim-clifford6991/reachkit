// BUILD §4.2 — the address-wide store: what an opt-out and a subscribe stop.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { blankLead, memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { codeOf } from "./source";

applyEnvFixture();

const { suppressAddress, suppressionState, normaliseAddress } = await import(
  "../../../src/lib/mail/leads/suppress"
);
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");

let state: MemoryState;

beforeEach(() => {
  state = newMemoryState();
  setLeadStore(memoryStore(state));
});

afterEach(() => setLeadStore(null));

describe('REQ-010 c11 — "using it stops all future follow-up email to that address — every remaining touch of the running sequence, every sequence for every other domain, and any sequence a future delivery would otherwise start"', () => {
  it("it stops the running sequence, every waiting sequence for every other domain, and answers suppressed for a domain never scanned", async () => {
    state.leads = [
      blankLead({
        id: "running",
        email: "anna@example.com",
        domain: "acme.com",
        sequence_state: "running",
        next_touch_at: "2026-09-06T00:00:00.000Z",
      }),
      blankLead({
        id: "waiting-1",
        email: "anna@example.com",
        domain: "beta.com",
        sequence_state: "waiting",
      }),
      blankLead({
        id: "waiting-2",
        email: "anna@example.com",
        domain: "gamma.com",
        sequence_state: "waiting",
      }),
      blankLead({
        id: "someone-else",
        email: "bob@example.com",
        domain: "acme.com",
        sequence_state: "running",
      }),
    ];

    await expect(suppressAddress("Anna@Example.com", "opt_out")).resolves.toEqual({
      suppressed: true,
      stopped: 3,
    });

    const byId = new Map(state.leads.map((lead) => [lead.id, lead]));
    expect(byId.get("running")?.sequence_state).toBe("stopped");
    expect(byId.get("waiting-1")?.sequence_state).toBe("stopped");
    expect(byId.get("waiting-2")?.sequence_state).toBe("stopped");
    // Another person's sequence is untouched: this is address-wide, not
    // global.
    expect(byId.get("someone-else")?.sequence_state).toBe("running");

    // The third limb: an address the store now holds is suppressed for a
    // domain it has never scanned, which is what a future delivery reads.
    await expect(suppressionState("anna@example.com")).resolves.toBe("suppressed");
  });

  it("the running sequence's next touch is cleared, so nothing is left labelled due", async () => {
    state.leads = [
      blankLead({
        id: "running",
        email: "anna@example.com",
        domain: "acme.com",
        sequence_state: "running",
        next_touch_at: "2026-09-06T00:00:00.000Z",
      }),
    ];

    await suppressAddress("anna@example.com", "opt_out");
    expect(state.leads[0]?.next_touch_at).toBeNull();
  });
});

describe('REQ-010 c12, last sentence — "A sequence ended by a subscribe or an opt-out releases nothing"', () => {
  it("suppression sets waiting sequences to stopped and releases none", async () => {
    state.leads = [
      blankLead({
        id: "waiting",
        email: "anna@example.com",
        domain: "beta.com",
        sequence_state: "waiting",
        page_delivered_at: "2026-09-01T00:00:00.000Z",
      }),
    ];

    await suppressAddress("anna@example.com", "opt_out");
    expect(state.leads[0]?.sequence_state).toBe("stopped");
    // Not `running`: the waiting one behind a stopped sequence is ended, not
    // let through.
    expect(state.leads[0]?.sequence_started_at).toBeNull();
  });

  it("a terminal sequence keeps the state that records why it ended", async () => {
    state.leads = [
      blankLead({
        id: "dropped",
        email: "anna@example.com",
        domain: "beta.com",
        sequence_state: "dropped",
        dropped_at: "2026-09-08T00:00:00.000Z",
      }),
      blankLead({
        id: "finished",
        email: "anna@example.com",
        domain: "gamma.com",
        sequence_state: "finished",
      }),
    ];

    await suppressAddress("anna@example.com", "opt_out");
    expect(state.leads.map((lead) => lead.sequence_state)).toEqual(["dropped", "finished"]);
  });
});

describe('REQ-010 c10 — "when they subscribe, then no further follow-up is sent to that address for any domain, and no later delivery starts one"', () => {
  it("suppressAddress(email, 'subscribed') stops every sequence for the address and blocks a later one", async () => {
    state.leads = [
      blankLead({
        id: "running",
        email: "anna@example.com",
        domain: "acme.com",
        sequence_state: "running",
      }),
    ];

    await expect(suppressAddress("anna@example.com", "subscribed")).resolves.toEqual({
      suppressed: true,
      stopped: 1,
    });
    expect(state.suppressions.get("anna@example.com")).toBe("subscribed");
    await expect(suppressionState("anna@example.com")).resolves.toBe("suppressed");
  });
});

describe("the store is idempotent, and a read that fails says so", () => {
  it("a second opt-out click writes nothing and still succeeds", async () => {
    await suppressAddress("anna@example.com", "opt_out");
    await expect(suppressAddress("anna@example.com", "subscribed")).resolves.toMatchObject({
      suppressed: true,
    });
    // The first cause stands: the row was already there and was not
    // rewritten.
    expect(state.suppressions.get("anna@example.com")).toBe("opt_out");
  });

  it("an unreadable store answers 'unreadable', never 'send'", async () => {
    state.failSuppressionRead = true;
    // The mutation this guards: collapse the third answer into a boolean
    // and an unreadable store reads as "not suppressed", which mails a
    // person who opted out.
    await expect(suppressionState("anna@example.com")).resolves.toBe("unreadable");
  });

  it("a write that fails reports the suppression as not made", async () => {
    state.failSuppressionWrite = true;
    await expect(suppressAddress("anna@example.com", "opt_out")).resolves.toEqual({
      suppressed: false,
    });
  });

  it("one address is one identity, whatever case it arrives in", () => {
    expect(normaliseAddress("  Anna@Example.COM ")).toBe("anna@example.com");
  });
});

describe("ADR-042 — this store and the notification toggles never become one", () => {
  it("suppress.ts writes no user preference and imports nothing from the toggles", () => {
    const code = codeOf("src/lib/mail/leads/suppress.ts");
    expect(code).not.toMatch(/notifications|users\.notify|setNotifyPref|readNotifyPrefs/);
  });

  it("nothing in this feature imports the notification module at all", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = "src/lib/mail/leads";
    for (const file of readdirSync(dir)) {
      const source = readFileSync(`${dir}/${file}`, "utf8");
      // A dependency assertion, not a naming one: an import is what would
      // let one mechanism reach the other's store.
      expect(source).not.toMatch(/from "\.\.\/notifications/);
    }
  });
});
