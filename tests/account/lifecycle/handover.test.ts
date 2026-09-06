// tests/account/lifecycle/handover.test.ts — REQ-079 c2, c3
//
// c3: "an export of their pages is produced and downloaded by them before
// anything is unpublished or deleted; if it cannot be produced, or they do
// not take it, the action does not proceed and says why."
//
// The discriminating case is the last one: after a begin whose archive was
// never taken, nothing in the account has changed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { beginDangerAction, markExportTaken, setLifecycleStore } = await import(
  "@/lib/account/lifecycle"
);
const { setExportStore } = await import("@/lib/account/export");
const { memoryLifecycleStore, newMemoryLifecycle } = await import("./memory-store");
const { memoryExportStore, newMemoryExport, page } = await import("../export/memory-store");

const NOW = new Date("2026-09-06T12:00:00.000Z");
let state = newMemoryLifecycle();
let pages = newMemoryExport();

beforeEach(() => {
  state = newMemoryLifecycle();
  pages = newMemoryExport();
  pages.pages.push(page({ id: "a", title: "Mine" }));
  setLifecycleStore(memoryLifecycleStore(state));
  setExportStore(memoryExportStore(pages));
});

afterEach(() => {
  setLifecycleStore(null);
  setExportStore(null);
  vi.useRealTimers();
});

describe("REQ-079 c3 — the archive is produced first, and the ticket second", () => {
  it("a successful begin returns a ticket and an archive", async () => {
    const begun = await beginDangerAction({ siteId: "site-1", action: "delete_account", now: NOW });
    expect(begun.ok).toBe(true);
    if (!begun.ok) return;
    expect(begun.ticket).toMatch(/[0-9a-f-]{36}/);
    expect(begun.pages).toBe(1);
    expect(begun.archive).toBeInstanceOf(ReadableStream);
  });

  it("a begin writes only the ticket row and changes nothing else", async () => {
    await beginDangerAction({ siteId: "site-1", action: "unpublish_all", now: NOW });
    expect(state.writes).toEqual(["insertTicket"]);
    expect(state.deleted).toEqual([]);
  });

  it("the ticket expires DANGER_TICKET_TTL_MINUTES after it is written", async () => {
    await beginDangerAction({ siteId: "site-1", action: "unpublish_all", now: NOW });
    expect(state.tickets[0]?.expires_at).toBe("2026-09-06T12:30:00.000Z");
  });

  it("a failed export returns danger.export-failed, issues no ticket, for both actions", async () => {
    pages.unreadable = true;
    for (const action of ["unpublish_all", "delete_account"] as const) {
      const begun = await beginDangerAction({ siteId: "site-1", action, now: NOW });
      expect(begun).toEqual({
        ok: false,
        reason: "record_unreadable",
        lineKey: "danger.export-failed",
      });
    }
    expect(state.tickets).toEqual([]);
    expect(state.writes).toEqual([]);
  });

  it("the discriminating case: after a begin whose archive was never taken, nothing has changed", async () => {
    const begun = await beginDangerAction({ siteId: "site-1", action: "delete_account", now: NOW });
    expect(begun.ok).toBe(true);
    expect(state.tickets[0]?.taken_at).toBeNull();
    expect(state.tickets[0]?.spent_at).toBeNull();
    expect(state.accounts).toEqual([]);
    expect(state.deleted).toEqual([]);
  });
});

describe("REQ-079 c3 — markExportTaken stamps only after a complete response", () => {
  it("stamps taken_at once and is idempotent", async () => {
    const begun = await beginDangerAction({ siteId: "site-1", action: "unpublish_all", now: NOW });
    if (!begun.ok) throw new Error("expected a ticket");
    await markExportTaken(begun.ticket, NOW);
    const first = state.tickets[0]?.taken_at;
    await markExportTaken(begun.ticket, new Date("2026-09-06T13:00:00.000Z"));
    expect(state.tickets[0]?.taken_at).toBe(first);
    expect(first).toBe(NOW.toISOString());
  });
});
