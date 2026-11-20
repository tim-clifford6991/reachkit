// tests/account/lifecycle/unpublish-all.test.ts — REQ-079 c4, c5
//
// c4's three moments, and c5's switch. The WordPress write itself is the
// adapter's and is stubbed here: this module takes no branch of its own and
// reports what came back, which is exactly what these cases assert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import type { UnpublishResult } from "@/lib/publish/types";

applyEnvFixture();

/** What the adapter returns, per draft id, in the order the loop asks. */
const outcomes = new Map<string, UnpublishResult>();
const unpublished: string[] = [];
const switched: { siteId: string; on: boolean }[] = [];

vi.mock("@/lib/publish/attempt/unpublish", () => ({
  unpublish: async (a: { draftId: string }): Promise<UnpublishResult> => {
    unpublished.push(a.draftId);
    return outcomes.get(a.draftId) ?? { ok: true, outcome: "removed" };
  },
}));

vi.mock("@/lib/publish/switch", () => ({
  setPublishing: async (siteId: string, on: boolean) => {
    switched.push({ siteId, on });
    return { recordedAt: new Date() };
  },
}));

const { unpublishEverything } = await import("@/lib/account/lifecycle/unpublish-all");
const { setLifecycleStore } = await import("@/lib/account/lifecycle");
const { memoryLifecycleStore, newMemoryLifecycle } = await import("./memory-store");

let state = newMemoryLifecycle();

beforeEach(() => {
  outcomes.clear();
  unpublished.length = 0;
  switched.length = 0;
  state = newMemoryLifecycle();
  setLifecycleStore(memoryLifecycleStore(state));
});

afterEach(() => {
  setLifecycleStore(null);
});

function live(draftId: string, destination: string, liveUrl: string | null = null): void {
  state.publications.push({ draft_id: draftId, destination, live_url: liveUrl });
}

describe("REQ-079 c4 — after the run, nothing ReachKit serves is served", () => {
  it("every live publication is handed to its destination's own adapter, once", async () => {
    live("a", "hosted");
    live("b", "hosted");
    const run = await unpublishEverything({ siteId: "site-1", userId: "u-1" });
    expect(unpublished).toEqual(["a", "b"]);
    expect(run.ok && run.result.takenDown).toBe(2);
    expect(run.ok && run.result.stillLive).toEqual([]);
    expect(run.ok && run.result.lineKey).toBe("danger.all-taken-down");
  });

  it("an unreachable destination's pages appear in stillLive with danger.some-still-live and count toward no takenDown", async () => {
    live("a", "hosted");
    live("b", "wordpress", "https://theirs.example/post");
    outcomes.set("b", { ok: true, outcome: "unreachable", retryOffered: true });
    const run = await unpublishEverything({ siteId: "site-1", userId: "u-1" });
    if (!run.ok) throw new Error("expected a run");
    expect(run.result.takenDown).toBe(1);
    expect(run.result.stillLive).toEqual([
      { destinationId: "wordpress", kind: "wordpress", liveUrls: ["https://theirs.example/post"] },
    ]);
    expect(run.result.lineKey).toBe("danger.some-still-live");
  });

  it("a publication whose unpublish returned ok:false also appears in stillLive", async () => {
    live("a", "wordpress", "https://theirs.example/one");
    outcomes.set("a", { ok: false, reason: "credentials_expired" });
    const run = await unpublishEverything({ siteId: "site-1", userId: "u-1" });
    if (!run.ok) throw new Error("expected a run");
    expect(run.result.takenDown).toBe(0);
    expect(run.result.stillLive[0]?.liveUrls).toEqual(["https://theirs.example/one"]);
  });

  it("a still-live destination is named by its own row id where one exists", async () => {
    state.destinations.push({ id: "dest-9", kind: "wordpress" });
    live("a", "wordpress", "https://theirs.example/one");
    outcomes.set("a", { ok: true, outcome: "unreachable", retryOffered: true });
    const run = await unpublishEverything({ siteId: "site-1", userId: "u-1" });
    expect(run.ok && run.result.stillLive[0]?.destinationId).toBe("dest-9");
  });

  it("a second run converges and takes nothing down twice", async () => {
    live("a", "hosted");
    await unpublishEverything({ siteId: "site-1", userId: "u-1" });
    // The take-down marks the publication; a converged store has no live row
    // left to hand over.
    state.publications = [];
    const again = await unpublishEverything({ siteId: "site-1", userId: "u-1" });
    expect(unpublished).toEqual(["a"]);
    expect(again.ok && again.result.takenDown).toBe(0);
  });
});

describe("REQ-079 c5 — publishing is switched off, and the account survives", () => {
  it("publishing_enabled is written false and publishingSwitchedOff is true", async () => {
    live("a", "hosted");
    const run = await unpublishEverything({ siteId: "site-1", userId: "u-1" });
    expect(switched).toEqual([{ siteId: "site-1", on: false }]);
    expect(run.ok && run.result.publishingSwitchedOff).toBe(true);
  });

  it("the switch is written after the loop, so a failure mid-loop leaves it untouched", async () => {
    state.unreadable = true;
    const run = await unpublishEverything({ siteId: "site-1", userId: "u-1" });
    expect(run).toEqual({ ok: false, reason: "store" });
    expect(switched).toEqual([]);
  });

  it("nothing about the account is touched — it survives this action", async () => {
    live("a", "hosted");
    await unpublishEverything({ siteId: "site-1", userId: "u-1" });
    expect(state.writes).toEqual([]);
    expect(state.deleted).toEqual([]);
  });
});
