// BUILD §4.2 — deliverFirstPage: one page, once, or a written message.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../env-fixture";
import { blankLead, memoryStore, newMemoryState, type MemoryState } from "./memory-store";
import { sendCalls, sendMock, sendOutcome } from "./send-mock";
import { codeOf } from "./source";

applyEnvFixture();

vi.mock("@/lib/mail/send", () => sendMock());

const { deliverFirstPage, FIRST_PAGE_UNAVAILABLE_COPY } = await import(
  "../../../src/lib/mail/leads/giveaway"
);
const { registerDraftWriter, registerOfferReader } = await import(
  "../../../src/lib/mail/leads/ports"
);
const { setLeadStore } = await import("../../../src/lib/mail/leads/store");
const { COPY, OWNER_OWED, TODO_COPY_MARKER } = await import(
  "../../../src/lib/presentation/copy/registry"
);
const { buildFirstPageUnavailable } = await import(
  "../../../src/lib/mail/templates/first-page-unavailable"
);
const { composeMail } = await import("../../../src/lib/mail/shell/compose");
const { escapeHtml } = await import("../../../src/lib/mail/blocks/html");

let state: MemoryState;
let draftCalls: number;

const NOW = new Date("2026-09-05T12:00:00.000Z");

function offerReader() {
  return async () => ({
    read: true as const,
    page: {
      title: "How Acme compares to Rival",
      pagesFound: 6,
      targetQuery: "acme vs rival",
      volume: { kind: "measured" as const, value: 1900, at: NOW },
      rival: { kind: "measured" as const, value: "rival.com", at: NOW },
      format: "comparison_page",
    },
  });
}

function pendingLead(over: Record<string, unknown> = {}) {
  return blankLead({
    id: "lead-1",
    email: "anna@example.com",
    domain: "acme.com",
    scan_id: "scan-1",
    ...over,
  });
}

beforeEach(() => {
  state = newMemoryState();
  setLeadStore(memoryStore(state));
  sendCalls.length = 0;
  sendOutcome.next = { sent: true, id: "vendor-1" };
  draftCalls = 0;
  registerOfferReader(offerReader());
  registerDraftWriter(async () => {
    draftCalls += 1;
    return { written: true, title: "How Acme compares to Rival", markdown: "# The page\n\nBody." };
  });
});

afterEach(() => {
  setLeadStore(null);
  registerOfferReader(null);
  registerDraftWriter(null);
});

describe('REQ-010 c2 — "Given no email address has been submitted for a report, when the report is viewed for any length of time, then no full page is written for it"', () => {
  it("the draft port is reachable only from deliverFirstPage, which requires a committed leads row", async () => {
    // No lead row: nothing to deliver, and nothing written.
    await expect(deliverFirstPage("lead-never-captured", NOW)).resolves.toEqual({
      delivered: "none",
      cause: "no-page-to-write",
    });
    expect(draftCalls).toBe(0);

    // And the call graph: the port is reached from exactly one place in
    // this module, and no other module in the feature reaches it.
    const giveaway = codeOf("src/lib/mail/leads/giveaway.ts");
    expect(giveaway.match(/writeDraft\(/g)).toHaveLength(1);
    for (const file of ["capture.ts", "offer.ts", "sequence.ts", "suppress.ts", "optout.ts"]) {
      expect(codeOf(`src/lib/mail/leads/${file}`)).not.toMatch(/writeDraft/);
    }
  });

  it("reading the offer repeatedly, with no lead row, never writes a page", async () => {
    const { firstPageOffer } = await import("../../../src/lib/mail/leads/offer");
    for (let i = 0; i < 5; i++) await firstPageOffer("scan-1");
    expect(draftCalls).toBe(0);
    expect(sendCalls).toEqual([]);
  });
});

describe('REQ-010 c3 — "the full page is written and delivered to that address, and the page is delivered to no other address … sent once, in answer to their own submission"', () => {
  it("the page is sent to exactly the address on the lead row and to no second recipient", async () => {
    state.leads = [pendingLead()];

    await expect(deliverFirstPage("lead-1", NOW)).resolves.toEqual({ delivered: "page" });

    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]).toMatchObject({ kind: "first-page", to: "anna@example.com" });
    // One vendor request, one `to`. There is no list and no batch.
    expect(Object.keys(sendCalls[0] as object)).not.toContain("bcc");
  });

  it("a second call for a lead already in first_page_state 'sent' sends nothing", async () => {
    state.leads = [pendingLead()];
    await deliverFirstPage("lead-1", NOW);
    expect(state.leads[0]?.first_page_state).toBe("sent");

    await expect(deliverFirstPage("lead-1", NOW)).resolves.toEqual({ delivered: "page" });
    expect(sendCalls).toHaveLength(1);
    expect(draftCalls).toBe(1);
  });

  it("a lead whose address is in email_suppressions still receives its page (ADR-041 landmine 3)", async () => {
    // This is the case a later reader will try to delete. It is REQ-010 c3
    // against c11: the page has been asked for, and the opt-out in it stops
    // the follow-up, not the page.
    state.suppressions.set("anna@example.com", "opt_out");
    state.leads = [pendingLead()];

    await expect(deliverFirstPage("lead-1", NOW)).resolves.toEqual({ delivered: "page" });
    expect(sendCalls[0]).toMatchObject({ kind: "first-page", to: "anna@example.com" });

    // …and the follow-up it would otherwise have started does not start.
    expect(state.leads[0]?.sequence_state).toBeNull();
  });

  it("this module adds no suppression check of its own before the send", () => {
    const code = codeOf("src/lib/mail/leads/giveaway.ts");
    expect(code).not.toMatch(/isSuppressed|suppressionState/);
  });

  it("a delivered page starts the domain's sequence, anchored to the delivery", async () => {
    state.leads = [pendingLead()];
    await deliverFirstPage("lead-1", NOW);

    expect(state.leads[0]).toMatchObject({
      sequence_state: "waiting",
      page_delivered_at: NOW.toISOString(),
    });
  });
});

describe('REQ-010 c7 — "the founder is told the page is not coming and why, in a written statement naming the cause"', () => {
  it("every FirstPageFailure member has a distinct CopyKey in FIRST_PAGE_UNAVAILABLE_COPY", () => {
    const keys = Object.values(FIRST_PAGE_UNAVAILABLE_COPY);
    expect(keys).toHaveLength(4);
    // A map pointing two causes at one key would satisfy the compiler and
    // not the criterion.
    expect(new Set(keys).size).toBe(4);
    expect(Object.keys(FIRST_PAGE_UNAVAILABLE_COPY).sort()).toEqual([
      "delivery-failed",
      "no-page-to-write",
      "writing-failed",
      "writing-refused",
    ]);
  });

  it("all four cause lines are the owner's written sentences (issue #458), and each mail composes with its own", () => {
    // Owner-owed until issue #458 filled them on the owner's 2026-09-10
    // approval, when the real seam refused this mail as `not-composable`.
    // Each cause's mail is composed here and must carry its own line — and
    // only its own, so a template that spoke one cause for all four fails.
    const causes = Object.entries(FIRST_PAGE_UNAVAILABLE_COPY);
    for (const [cause, key] of causes) {
      expect(COPY[key].trim(), key).not.toBe("");
      expect(COPY[key], key).not.toBe(TODO_COPY_MARKER);
      expect(OWNER_OWED).not.toContain(key);

      const mail = buildFirstPageUnavailable({ email: "anna@example.com", causeLine: key });
      const composed = composeMail({
        kind: "first-page-unavailable",
        subject: mail.subject,
        blocks: mail.blocks,
        optOut: mail.optOut,
      });
      expect(composed.subject, cause).toBe(COPY[mail.subject]);
      expect(composed.text, cause).toContain(COPY[key]);
      expect(composed.html, cause).toContain(escapeHtml(COPY[key]));
      for (const [other, otherKey] of causes) {
        if (other !== cause) expect(composed.text, cause).not.toContain(COPY[otherKey]);
      }
    }
  });

  it("a writing failure sends exactly one first-page-unavailable mail carrying that cause's key, and records nothing as delivered", async () => {
    registerDraftWriter(async () => {
      draftCalls += 1;
      return { written: false, refused: false };
    });
    state.leads = [pendingLead()];

    await expect(deliverFirstPage("lead-1", NOW)).resolves.toEqual({
      delivered: "unavailable-notice",
      cause: "writing-failed",
    });

    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0]).toMatchObject({ kind: "first-page-unavailable" });
    expect(sendCalls[0]?.blocks).toEqual([
      { block: "notice", text: FIRST_PAGE_UNAVAILABLE_COPY["writing-failed"] },
    ]);
    expect(state.leads[0]).toMatchObject({
      first_page_state: "notice_sent",
      first_page_failure: "writing-failed",
      page_delivered_at: null,
      sequence_state: null,
    });
  });

  it("a refusal by the hard rules is its own cause, distinct from the pipeline failing", async () => {
    registerDraftWriter(async () => ({ written: false, refused: true }));
    state.leads = [pendingLead()];

    await expect(deliverFirstPage("lead-1", NOW)).resolves.toEqual({
      delivered: "unavailable-notice",
      cause: "writing-refused",
    });
  });

  it("a report that no longer offers a page is 'no-page-to-write', and no page is written for it", async () => {
    registerOfferReader(async () => ({ read: true, page: null }));
    state.leads = [pendingLead()];

    await expect(deliverFirstPage("lead-1", NOW)).resolves.toEqual({
      delivered: "unavailable-notice",
      cause: "no-page-to-write",
    });
    expect(draftCalls).toBe(0);
  });

  it("an offer that could not be read is not told to the founder as 'your scan found nothing'", async () => {
    registerOfferReader(async () => ({ read: false }));
    state.leads = [pendingLead()];

    // Nothing is sent and nothing is recorded: the attempt is deferred to
    // the next one inside the window.
    await expect(deliverFirstPage("lead-1", NOW)).resolves.toEqual({
      delivered: "none",
      cause: "delivery-failed",
    });
    expect(sendCalls).toEqual([]);
    expect(state.leads[0]?.first_page_state).toBe("pending");
  });
});

describe("BP-029 NFR budget — one generateDraft() call per lead, ever", () => {
  it("a lead already in 'written' re-sends what was written and never re-writes it", async () => {
    state.leads = [
      pendingLead({
        first_page_state: "written",
        first_page_title: "Already written",
        first_page_markdown: "# Already\n",
      }),
    ];

    await expect(deliverFirstPage("lead-1", NOW)).resolves.toEqual({ delivered: "page" });
    expect(draftCalls).toBe(0);
    // Index 2 since issue #376: S20 heads the mail on the page's title and
    // puts the first-of-N line under it, so the page itself is third.
    expect(sendCalls[0]?.blocks[2]).toMatchObject({
      block: "pageBody",
      pageTitle: "Already written",
      written: true,
      markdown: "# Already\n",
    });
  });

  it("the written page is stored against the lead the moment it is written", async () => {
    sendOutcome.next = { sent: false, reason: "vendor", retryUntil: new Date(NOW.getTime() + 60_000) };
    state.leads = [pendingLead()];

    await deliverFirstPage("lead-1", NOW);
    expect(state.leads[0]).toMatchObject({
      first_page_state: "written",
      first_page_title: "How Acme compares to Rival",
    });
    expect(draftCalls).toBe(1);
  });
});
