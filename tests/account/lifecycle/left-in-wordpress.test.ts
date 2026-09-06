// tests/account/lifecycle/left-in-wordpress.test.ts — REQ-079 c6
//
// "that mail gives each of [§9's] four outcomes one sentence of its own,
// carrying that outcome's own count and, where there is anywhere to look,
// its own place — and no sentence carries two outcomes or one count for
// both. … An outcome holding no posts is not named at all rather than named
// with a count of none."
//
// One fixture per rule, and the discriminating case is `already_gone`'s
// place: `null` **even when that destination's stamp capability answers** —
// the case a capability-driven implementation gets wrong.
import { afterEach, describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import type { UnpublishOutcome } from "@/lib/publish/types";

applyEnvFixture();

const { leftInWordPress } = await import("@/lib/account/lifecycle/left-in-wordpress");
const { setStampCapability } = await import("@/lib/account/lifecycle");

const PLACE = { siteBaseUrl: "https://theirs.example/", stampSlug: "tag/reachkit" };

afterEach(() => {
  setStampCapability(null);
});

function run(counts: Partial<Record<UnpublishOutcome, number>>) {
  const outcomes: { destination: string; outcome: UnpublishOutcome }[] = [];
  for (const [outcome, count] of Object.entries(counts)) {
    for (let i = 0; i < (count ?? 0); i += 1) {
      outcomes.push({ destination: "wordpress", outcome: outcome as UnpublishOutcome });
    }
  }
  return leftInWordPress({ outcomes, destinationId: "dest-1" });
}

describe("REQ-079 c6 — four sentences, four counts, no merge", () => {
  it("a run producing all four outcomes yields four entries, each with its own count", async () => {
    // Mutually distinct primes: any pairwise merge is arithmetically
    // visible, so a count that is the sum of two arms cannot pass.
    const map = await run({
      returned_to_draft: 2,
      named_for_removal: 3,
      already_gone: 5,
      unreachable: 7,
    });
    expect(map.returned_to_draft?.count).toBe(2);
    expect(map.named_for_removal?.count).toBe(3);
    expect(map.already_gone?.count).toBe(5);
    expect(map.unreachable?.count).toBe(7);
    expect(Object.keys(map)).toHaveLength(4);
  });

  it("an outcome with no rows is absent from the map, never present with a count of none", async () => {
    const map = await run({ returned_to_draft: 1 });
    expect(Object.hasOwn(map, "already_gone")).toBe(false);
    expect(Object.hasOwn(map, "named_for_removal")).toBe(false);
    expect(Object.hasOwn(map, "unreachable")).toBe(false);
    for (const entry of Object.values(map)) expect(entry.count).toBeGreaterThan(0);
  });

  it("a run leaving nothing in WordPress yields an empty map", async () => {
    expect(await run({})).toEqual({});
    // The hosted arm is not one of the four and never lands here.
    expect(
      await leftInWordPress({
        outcomes: [{ destination: "hosted", outcome: "removed" }],
        destinationId: null,
      })
    ).toEqual({});
  });
});

describe("REQ-079 c6 — where a place exists, and where one cannot", () => {
  it("the discriminating case: already_gone's place is null even when the capability answers", async () => {
    setStampCapability({ async place() { return PLACE; } });
    const map = await run({ already_gone: 1, returned_to_draft: 1 });
    expect(map.already_gone?.place).toBeNull();
    expect(map.returned_to_draft?.place).toEqual(PLACE);
  });

  it("a stamp-incapable destination gives place null on the other three, and their counts stand", async () => {
    setStampCapability({ async place() { return null; } });
    const map = await run({ returned_to_draft: 2, named_for_removal: 3, unreachable: 7 });
    expect(map.returned_to_draft).toEqual({ count: 2, place: null });
    expect(map.named_for_removal).toEqual({ count: 3, place: null });
    expect(map.unreachable).toEqual({ count: 7, place: null });
  });

  it("this build answers no place at all, and every sentence still carries its count", async () => {
    const map = await run({ returned_to_draft: 4 });
    expect(map.returned_to_draft).toEqual({ count: 4, place: null });
  });

  it("a destination that is no longer there is not asked for a place", async () => {
    let asked = 0;
    setStampCapability({ async place() { asked += 1; return PLACE; } });
    const map = await leftInWordPress({
      outcomes: [{ destination: "wordpress", outcome: "returned_to_draft" }],
      destinationId: null,
    });
    expect(asked).toBe(0);
    expect(map.returned_to_draft).toEqual({ count: 1, place: null });
  });
});
