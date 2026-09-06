// tests/account/lifecycle/confirm-guard.test.ts — REQ-079 c2, c3
//
// c2: "Given the customer starts either action, when they have not
// explicitly confirmed it, then nothing is unpublished, deleted or
// cancelled."
//
// Five refusals, each leaving the account and its pages untouched. The
// assertion that matters in every one of them is the second: the adapter was
// never called, the switch was never written, and no row was stamped.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import type { UnpublishResult } from "@/lib/publish/types";

applyEnvFixture();

const unpublished: string[] = [];
const switched: string[] = [];

vi.mock("@/lib/publish/attempt/unpublish", () => ({
  unpublish: async (a: { draftId: string }): Promise<UnpublishResult> => {
    unpublished.push(a.draftId);
    return { ok: true, outcome: "removed" };
  },
}));

vi.mock("@/lib/publish/switch", () => ({
  setPublishing: async (siteId: string) => {
    switched.push(siteId);
    return { recordedAt: new Date() };
  },
}));

const { confirmDangerAction, setLifecycleStore } = await import("@/lib/account/lifecycle");
const { memoryLifecycleStore, newMemoryLifecycle } = await import("./memory-store");

const NOW = new Date("2026-09-06T12:00:00.000Z");
const LATER = new Date("2026-09-06T12:20:00.000Z");
let state = newMemoryLifecycle();

beforeEach(() => {
  unpublished.length = 0;
  switched.length = 0;
  state = newMemoryLifecycle();
  state.sites.push({ id: "site-1", user_id: "u-1" });
  state.publications.push({ draft_id: "a", destination: "hosted", live_url: null });
  setLifecycleStore(memoryLifecycleStore(state));
});

afterEach(() => {
  setLifecycleStore(null);
});

function ticket(a: {
  action?: string;
  taken?: boolean;
  spent?: boolean;
  expires?: string;
} = {}): string {
  state.tickets.push({
    ticket: "t-1",
    site_id: "site-1",
    action: a.action ?? "unpublish_all",
    taken_at: a.taken === false ? null : NOW.toISOString(),
    spent_at: a.spent === true ? NOW.toISOString() : null,
    expires_at: a.expires ?? "2026-09-06T12:30:00.000Z",
  });
  return "t-1";
}

/** Nothing happened: no adapter call, no switch, no stamp. */
function nothingHappened(): void {
  expect(unpublished).toEqual([]);
  expect(switched).toEqual([]);
  expect(state.writes).toEqual([]);
  expect(state.deleted).toEqual([]);
}

describe("REQ-079 c2 — five refusals, and each changes nothing", () => {
  it("no ticket refuses and changes nothing", async () => {
    expect(await confirmDangerAction({ ticket: "nope", typedConfirmation: "unpublish_all", now: LATER })).toEqual({
      ok: false,
      reason: "no_ticket",
    });
    nothingHappened();
  });

  it("a missing typed confirmation refuses and changes nothing", async () => {
    ticket();
    expect(await confirmDangerAction({ ticket: "t-1", typedConfirmation: "", now: LATER })).toEqual({
      ok: false,
      reason: "not_confirmed",
    });
    nothingHappened();
  });

  it("a typed confirmation for the other action refuses — confirming one is not confirming both", async () => {
    ticket({ action: "delete_account" });
    expect(
      await confirmDangerAction({ ticket: "t-1", typedConfirmation: "unpublish_all", now: LATER })
    ).toEqual({ ok: false, reason: "not_confirmed" });
    nothingHappened();
  });

  it("a ticket without takenAt refuses with export_not_taken and unpublishes nothing", async () => {
    ticket({ taken: false });
    expect(
      await confirmDangerAction({ ticket: "t-1", typedConfirmation: "unpublish_all", now: LATER })
    ).toEqual({ ok: false, reason: "export_not_taken" });
    nothingHappened();
  });

  it("an expired ticket refuses and changes nothing", async () => {
    ticket({ expires: "2026-09-06T12:10:00.000Z" });
    expect(
      await confirmDangerAction({ ticket: "t-1", typedConfirmation: "unpublish_all", now: LATER })
    ).toEqual({ ok: false, reason: "expired" });
    nothingHappened();
  });

  it("a spent ticket refuses and changes nothing — a second confirmation never runs the action twice", async () => {
    ticket({ spent: true });
    expect(
      await confirmDangerAction({ ticket: "t-1", typedConfirmation: "unpublish_all", now: LATER })
    ).toEqual({ ok: false, reason: "spent" });
    nothingHappened();
  });
});

describe("REQ-079 c2 — a ticket that satisfies every clause runs, and is spent before it does", () => {
  it("unpublish_all runs, and the ticket cannot be used again", async () => {
    ticket();
    const run = await confirmDangerAction({
      ticket: "t-1",
      typedConfirmation: "unpublish_all",
      now: LATER,
    });
    expect(run.ok && run.action).toBe("unpublish_all");
    expect(unpublished).toEqual(["a"]);
    expect(state.tickets[0]?.spent_at).toBe(LATER.toISOString());

    const again = await confirmDangerAction({
      ticket: "t-1",
      typedConfirmation: "unpublish_all",
      now: LATER,
    });
    expect(again).toEqual({ ok: false, reason: "spent" });
  });

  it("a ticket naming an action outside the closed offer is no ticket at all", async () => {
    state.tickets.push({
      ticket: "t-9",
      site_id: "site-1",
      action: "delete_everything",
      taken_at: NOW.toISOString(),
      spent_at: null,
      expires_at: "2026-09-06T12:30:00.000Z",
    });
    expect(
      await confirmDangerAction({ ticket: "t-9", typedConfirmation: "delete_everything", now: LATER })
    ).toEqual({ ok: false, reason: "no_ticket" });
    nothingHappened();
  });
});
