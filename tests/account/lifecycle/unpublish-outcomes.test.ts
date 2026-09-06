// tests/account/lifecycle/unpublish-outcomes.test.ts — REQ-079 c4
//
// **The empty arm, pinned so its removal fails rather than passes quietly.**
// Since 2026-09-01 every page is created live at every destination, so
// `returned_to_draft` is every WordPress unpublish that reaches the site and
// `named_for_removal` is the arm with no members — nothing ReachKit creates
// there is left un-live. It is not dead code: it is the outcome §9 promises
// for a page ReachKit created but did not make live, held open against
// exactly that case, and its copy key is minted and unreached beside it.
//
// Two halves:
//  (a) **Type-level** — this file re-declares the same total match over
//      `UnpublishResult` that `unpublish-all.ts` performs, ending in
//      `const _never: never = outcome`. Deleting an arm from the union, or
//      dropping its case from the loop, is a type error rather than a green
//      suite.
//  (b) **Behavioural, from a fixture** — each arm counted where it belongs.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import type { UnpublishOutcome, UnpublishResult } from "@/lib/publish/types";

applyEnvFixture();

const outcomes = new Map<string, UnpublishResult>();
const writes: string[] = [];

vi.mock("@/lib/publish/attempt/unpublish", () => ({
  unpublish: async (a: { draftId: string }): Promise<UnpublishResult> =>
    outcomes.get(a.draftId) ?? { ok: true, outcome: "removed" },
}));

vi.mock("@/lib/publish/switch", () => ({
  setPublishing: async () => {
    writes.push("setPublishing");
    return { recordedAt: new Date() };
  },
}));

const { unpublishEverything } = await import("@/lib/account/lifecycle/unpublish-all");
const { setLifecycleStore } = await import("@/lib/account/lifecycle");
const { memoryLifecycleStore, newMemoryLifecycle } = await import("./memory-store");

let state = newMemoryLifecycle();

beforeEach(() => {
  outcomes.clear();
  writes.length = 0;
  state = newMemoryLifecycle();
  setLifecycleStore(memoryLifecycleStore(state));
});

afterEach(() => {
  setLifecycleStore(null);
});

// (a) The pin. Removing an arm from `UnpublishResult`, or a case from here,
// stops this file compiling. `ADR-084 Decision 4` — and `named_for_removal`
// is unreachable, not dead.
function restatedMatch(result: UnpublishResult): "taken_down" | "still_live" {
  if (!result.ok) return "still_live";
  const outcome: UnpublishOutcome = result.outcome;
  switch (outcome) {
    case "removed":
      return "taken_down";
    case "returned_to_draft":
      return "taken_down";
    case "named_for_removal":
      return "taken_down";
    case "already_gone":
      return "taken_down";
    case "unreachable":
      return "still_live";
    default: {
      const _never: never = outcome;
      return _never;
    }
  }
}

async function runWith(result: UnpublishResult): Promise<{ takenDown: number; stillLive: number }> {
  state.publications.push({ draft_id: "a", destination: "wordpress", live_url: "https://x.example/p" });
  outcomes.set("a", result);
  const run = await unpublishEverything({ siteId: "site-1", userId: "u-1" });
  if (!run.ok) throw new Error("expected a run");
  return { takenDown: run.result.takenDown, stillLive: run.result.stillLive.length };
}

describe("(a) the outcome match is total over UnpublishResult", () => {
  it("every arm is routed, and removing one would not compile", () => {
    expect(restatedMatch({ ok: true, outcome: "removed" })).toBe("taken_down");
    expect(restatedMatch({ ok: true, outcome: "returned_to_draft" })).toBe("taken_down");
    expect(restatedMatch({ ok: true, outcome: "named_for_removal" })).toBe("taken_down");
    expect(restatedMatch({ ok: true, outcome: "already_gone" })).toBe("taken_down");
    expect(restatedMatch({ ok: true, outcome: "unreachable", retryOffered: true })).toBe("still_live");
    expect(restatedMatch({ ok: false, reason: "network" })).toBe("still_live");
  });
});

describe("(b) each arm, from a fixture rather than from production data", () => {
  it("a returned_to_draft outcome counts as taken down and never as still live", async () => {
    expect(await runWith({ ok: true, outcome: "returned_to_draft" })).toEqual({
      takenDown: 1,
      stillLive: 0,
    });
  });

  it("a named_for_removal outcome counts as taken down and this module writes nothing of its own", async () => {
    expect(await runWith({ ok: true, outcome: "named_for_removal" })).toEqual({
      takenDown: 1,
      stillLive: 0,
    });
    // The switch, and nothing else. No row of the customer's is written by
    // this module on any arm.
    expect(writes).toEqual(["setPublishing"]);
    expect(state.writes).toEqual([]);
  });

  it("an already_gone outcome counts as taken down", async () => {
    expect(await runWith({ ok: true, outcome: "already_gone" })).toEqual({
      takenDown: 1,
      stillLive: 0,
    });
  });

  it("an unreachable outcome is ok:true and is nevertheless not counted as taken down", async () => {
    const result: UnpublishResult = { ok: true, outcome: "unreachable", retryOffered: true };
    expect(result.ok).toBe(true);
    expect(await runWith(result)).toEqual({ takenDown: 0, stillLive: 1 });
  });
});
