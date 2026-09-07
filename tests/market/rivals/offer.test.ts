// tests/market/rivals/offer.test.ts — BUILD §6.6
//
// The control's state and its destination, and the four ways the module is
// stopped from being able to change the rival set at all.
import { describe, expect, it } from "vitest";
import { swapOffer, type SwapOffer } from "../../../src/lib/market/rivals/offer.ts";
import type { RivalSizeBand } from "../../../src/lib/market/rivals/band.ts";
import type { RivalSize } from "../../../src/lib/market/rivals/size.ts";
import { codeOf, importsOf, sourceOf } from "./source.ts";

const AT = new Date("2026-09-06T00:00:00.000Z");

function sized(band: RivalSizeBand, a: { current?: boolean } = {}): RivalSize {
  return {
    domain: "rival.com",
    state: "sized",
    rankedCount: 900,
    band,
    at: AT,
    current: a.current ?? true,
  };
}

describe('REQ-096 c6 — "the same place offers them a single control that takes them to where they can replace that rival"', () => {
  it("offer/far-offers-the-swap", () => {
    expect(swapOffer(sized("far"))).toEqual({
      offered: true,
      rival: "rival.com",
      destination: "settings.competitors",
    });
  });

  it("offer/near-and-middle-offer-nothing", () => {
    expect(swapOffer(sized("near"))).toEqual({ offered: false });
    expect(swapOffer(sized("middle"))).toEqual({ offered: false });
  });

  it("offer/unsized-offers-nothing — neither reason implies a band, so neither offers a swap", () => {
    for (const because of ["awaiting_deep_pass", "added_since_last_sizing"] as const) {
      expect(swapOffer({ domain: "rival.com", state: "unsized", because })).toEqual({ offered: false });
    }
  });

  it("offer/stale-far-still-offers — a stale far band is still a far band, and its date travels on the entry", () => {
    expect(swapOffer(sized("far", { current: false }))).toEqual({
      offered: true,
      rival: "rival.com",
      destination: "settings.competitors",
    });
  });

  it("offer/one-control-only — the offered arm carries exactly three fields, so no second control can be rendered from it", () => {
    const offer = swapOffer(sized("far"));
    expect(Object.keys(offer).sort()).toEqual(["destination", "offered", "rival"]);

    // A type-level assertion of the same closure: adding `replaceWith` to
    // the arm would make this assignment compile, and it must not.
    const arm: SwapOffer = { offered: true, rival: "rival.com", destination: "settings.competitors" };
    // @ts-expect-error — the offer names a destination; it never names a replacement.
    const widened: SwapOffer = { ...arm, replaceWith: "other.com" };
    expect(widened).toBeDefined();
  });
});

describe('REQ-096 c7 — "no band ever removes a rival, hides it, drops it from a comparison"', () => {
  it("offer/exports-no-mutation — one function and one type, no array, no writer imported", () => {
    const code = codeOf("offer.ts");
    expect([...code.matchAll(/export (?:function|type|const) (\w+)/g)].map((m) => m[1]).sort()).toEqual([
      "SwapOffer",
      "swapOffer",
    ]);
    // `./rival-size` and not `./size` since issue #223: the shape moved to
    // a leaf of its own so Overview can name it without pulling the
    // DataForSEO client that `size.ts` imports (that screen asserts its own
    // module graph reaches no vendor at all). What this row is actually
    // about is unchanged and is the point of asserting the whole list —
    // this module imports one type and nothing that can write.
    expect(importsOf("offer.ts")).toEqual(["./rival-size"]);
    expect(code).not.toContain("addRival");
    expect(code).not.toContain("removeRival");
    expect(code).not.toMatch(/RivalSize\[\]/);
  });

  it("offer/is-pure — the same entry in gives the same value out, and the argument is untouched", () => {
    const entry = sized("far");
    const before = JSON.stringify(entry);
    expect(swapOffer(entry)).toEqual(swapOffer(entry));
    expect(JSON.stringify(entry)).toBe(before);
  });
});

describe("ADR-001 — the written line is the owner's, and none is written here", () => {
  it("offer/writes-no-string — no ruled band word, no copy key, nothing from the copy layer", () => {
    const source = sourceOf("offer.ts");
    for (const term of ["Similar size", "Larger", "Much larger"]) {
      expect(source).not.toContain(term);
    }
    expect(codeOf("offer.ts")).not.toContain("band.rivalSize.");
    expect(importsOf("offer.ts").filter((i) => i.includes("presentation"))).toEqual([]);
  });
});
