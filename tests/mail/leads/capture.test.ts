// BUILD §4.2 — one insert, confirmed only after it commits.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { codeOf } from "./source";
import type { NetworkKey } from "@/lib/scan/admission";

applyEnvFixture();

const { captureLead } = await import("../../../src/lib/mail/leads/capture");
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");

let state: MemoryState;
const network = "a".repeat(64) as NetworkKey;

beforeEach(() => {
  // The shared limiter allows every request here; its limits are `capture-throttle.test.ts`'s.
  vi.stubGlobal("fetch", async () => new Response("true", { headers: { "content-type": "application/json" } }));
  state = newMemoryState();
  state.scans.set("scan-1", "Acme.COM");
  setLeadStore(memoryStore(state));
});

afterEach(() => {
  setLeadStore(null);
  vi.unstubAllGlobals();
});

describe('REQ-003 c10 — "then the submission is refused in writing and no confirmation of delivery is shown"', () => {
  it("a store failure returns { captured: false, reason: 'unavailable' } and writes nothing — the opposite of the scan limiter, which fails open", async () => {
    state.failInsert = true;

    await expect(captureLead({ scanId: "scan-1", email: "anna@example.com", network })).resolves.toEqual({
      captured: false,
      reason: "unavailable",
    });
    expect(state.leads).toEqual([]);
  });

  it("a scan that cannot be read refuses too — nothing is confirmed on a capture that did not commit", async () => {
    state.failScanRead = true;

    await expect(captureLead({ scanId: "scan-1", email: "anna@example.com", network })).resolves.toEqual({
      captured: false,
      reason: "unavailable",
    });
    expect(state.leads).toEqual([]);
  });

  it("the confirmation follows the commit: the row exists whenever captured is true", async () => {
    const result = await captureLead({ scanId: "scan-1", email: "anna@example.com", network });
    if (!result.captured) throw new Error("expected a capture");

    // The mutation this guards: move the return above the insert's await
    // and this row is not there when the id is handed back.
    expect(state.leads.map((lead) => lead.id)).toContain(result.leadId);
  });
});

describe('REQ-010 c1 — "a control that asks for an email address and nothing else: no account, no password, no payment, no further field"', () => {
  it("captureLead's argument admits a scanId, an email and the request's network key and nothing else", () => {
    // Asserted at the type level: none of the four things the criterion
    // forbids is representable in the call. The network key is read from the
    // request's headers, never from the form. The line below does not compile
    // if a further field is ever added to the argument type.
    const call: (a: { scanId: string; email: string; network: NetworkKey }) => unknown = captureLead;
    expect(typeof call).toBe("function");
    expect(captureLead.length).toBe(1);
  });

  it("an address malformed in form is refused with its own reason and writes nothing", async () => {
    for (const email of ["", "anna", "anna@", "@example.com", "anna example.com", "anna@example"]) {
      await expect(captureLead({ scanId: "scan-1", email, network })).resolves.toEqual({
        captured: false,
        reason: "invalid-address",
      });
    }
    expect(state.leads).toEqual([]);
  });

  it("form validation refuses nothing a real founder would type", async () => {
    for (const email of [
      "anna@example.com",
      "anna+report@example.co.uk",
      "a.n.other@sub.example.io",
      "anna_o'brien@example.com",
    ]) {
      const result = await captureLead({ scanId: "scan-1", email, network });
      expect(result.captured).toBe(true);
    }
  });
});

describe("BP-029 decision 1 — the domain is written at capture and lowercased with the address", () => {
  it("the lead carries the scan's domain, so the sequence's natural key can be an index", async () => {
    await captureLead({ scanId: "scan-1", email: "Anna@Example.COM", network });

    expect(state.leads[0]).toMatchObject({
      email: "anna@example.com",
      domain: "acme.com",
      scan_id: "scan-1",
      sequence_state: null,
      first_page_state: "pending",
    });
  });

  it("a second capture for the same address and domain writes a second row with a null sequence_state — criterion 13's own premise", async () => {
    await captureLead({ scanId: "scan-1", email: "anna@example.com", network });
    await captureLead({ scanId: "scan-1", email: "anna@example.com", network });

    expect(state.leads).toHaveLength(2);
    expect(state.leads.every((lead) => lead.sequence_state === null)).toBe(true);
  });
});

describe("ADR-041 — capture does not consult the suppression store", () => {
  it("a suppressed address still gets its lead row: the page it just asked for is not the follow-up", async () => {
    state.suppressions.set("anna@example.com", "opt_out");

    const result = await captureLead({ scanId: "scan-1", email: "anna@example.com", network });
    expect(result.captured).toBe(true);
  });

  it("the module reaches no suppression read and no model at all — capture is one insert", () => {
    const code = codeOf("src/lib/mail/leads/capture.ts");
    // The third of ADR-041's three honest-looking fixes, asserted as a
    // dependency property rather than left to review. Comments are stripped
    // first: this file's own header cites the ADR by name.
    expect(code).not.toMatch(/isSuppressed|suppressionState|email_suppressions/);
    expect(code).not.toMatch(/generateDraft|writeDraft|sendEmail|llm\(/);
  });
});
