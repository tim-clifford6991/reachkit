// SPEC §4 (2026-09-20, #908), #916 — the three decisions the Search tab's
// read makes over a stored row, held where they can be read.
//
// Each one is a place where a screen could quietly lie about a customer's
// own pages, so each is decided by a pure function and tested here rather
// than inferred from a render: which of SPEC §4's four words a row wears,
// which rows are drawn at all, and which way a page moved this week.
// `search-store.ts` resolves `@/lib/db`, which parses the deployment's own
// bindings at module load. The fixture is a side-effect import and must run
// before that one: calling it from `beforeAll` is already too late.
import "../../generate/env";
import { describe, expect, it } from "vitest";
import { changeOf, drawn, statusOf } from "@/app/(account)/app/_overview/search-store";

describe("SPEC §4's four status words, from the stored row", () => {
  it("a row with a page is live when that page is live, and the customer's to read when it is not", () => {
    expect(statusOf("queued", false, null, true)).toBe("live");
    expect(statusOf("queued", false, null, false)).toBe("your_review");
  });

  it("acceptance having passed does not make a page live — the publication does", () => {
    // `done` means the acceptance test passed, which is later and rarer
    // than the page going up. Read off the publication, so a customer whose
    // page is up never reads "up next".
    expect(statusOf("done", false, null, true)).toBe("live");
    expect(statusOf("done", false, null, false)).toBe("your_review");
  });

  it("an open, ready row is up next", () => {
    expect(statusOf("open", true, null, false)).toBe("up_next");
  });

  it("an open row held back by the right-sizing law is too big for now", () => {
    expect(statusOf("open", false, "outsized", false)).toBe("too_big");
  });
});

describe("which rows the table draws at all", () => {
  it("draws every row with a page, every ready row, and every outsized one", () => {
    expect(drawn("queued", false, null)).toBe(true);
    expect(drawn("done", false, null)).toBe(true);
    expect(drawn("open", true, null)).toBe(true);
    expect(drawn("open", false, "outsized")).toBe(true);
  });

  it("draws no row held back by ReachKit's own plumbing", () => {
    // These are on file and are not being gone after this week. There is no
    // honest word for them among SPEC §4's four, and "up next" would be a
    // promise — so the table says nothing rather than something wrong.
    for (const reason of [
      "not_assessed",
      "cluster_suppressed",
      "url_retired",
      "keyword_gate",
      "format_not_allowed",
      "no_grounding_fact",
      "destination_cannot_address",
    ]) {
      expect(drawn("open", false, reason), reason).toBe(false);
    }
  });
});

describe("the week's move, from the verdict's own two figures", () => {
  const at = new Date("2026-08-31T06:00:00.000Z");
  const m = (value: number) => ({ kind: "measured", value, at });

  it("a smaller place is better, and the move is how many places", () => {
    expect(changeOf({ from: m(17), to: m(11) })).toEqual({ kind: "moved", places: 6, better: true });
  });

  it("a larger place is worse, and the decline is carried rather than smoothed", () => {
    expect(changeOf({ from: m(11), to: m(19) })).toEqual({ kind: "moved", places: 8, better: false });
  });

  it("no movement recorded at all is the page's first judged week, not a change of zero", () => {
    expect(changeOf(null)).toEqual({ kind: "first" });
  });

  it("a movement whose figures were not both measured states no change", () => {
    expect(changeOf({ from: { kind: "unmeasured", reason: "not_attempted", at }, to: m(11) })).toEqual({
      kind: "first",
    });
  });

  it("the same place two weeks running is no change — and is not drawn as one", () => {
    expect(changeOf({ from: m(11), to: m(11) })).toEqual({ kind: "none" });
  });
});
