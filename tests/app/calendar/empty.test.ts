// tests/app/calendar/empty.test.ts — BUILD §4.6, REQ-043 criteria 3, 4, 5
//
// WO-165 `## Test plan`, all three rows, and ADR-061's own discriminating
// test. This is the file that stops the product telling a customer their
// market is empty on a day it merely broke.
import { describe, expect, it } from "vitest";
import { EMPTY_COPY_KEY, EMPTY_PRECEDENCE, accountFor, type EmptyFacts, LAW_CAUSES, isLawCause } from "@/app/(account)/app/calendar/empty";
import { COPY } from "@/lib/presentation/copy";

/** No cause established. Every field stated, none absent. */
const NOTHING: EmptyFacts = {
  instruction: null,
  reachkitStopped: false,
  pageCannotGoLive: null,
  pageHeld: false,
  customerChangeHoldsPages: null,
  changeHoldsGeneration: null,
  unusedSupply: null,
};

describe("ADR-061 — the precedence is data, and it is the one ADR-061 states", () => {
  it("is instruction → reachkit_stopped → page_cannot_go_live → customer_change_holds_pages → change_holds_generation → page_held → supply_exhausted → unattributed", () => {
    expect([...EMPTY_PRECEDENCE]).toEqual([
      "instruction",
      "reachkit_stopped",
      "page_cannot_go_live",
      "customer_change_holds_pages",
      // #204: below the switch the customer can undo with a click, because
      // this one resolves on a date they have already been given; above
      // `page_held`, because it says why no page exists for the date at all
      // where that one says only that a page which does exist did not go out
      // (REQ-071 c11).
      "change_holds_generation",
      // #116: below every cause that says *why*, above the arm REQ-043 c3
      // reserves. A date a page was planned for did not run out of supply.
      "page_held",
      "supply_exhausted",
      "unattributed",
    ]);
  });

  it("unattributed is last, and supply_exhausted is not", () => {
    expect(EMPTY_PRECEDENCE[EMPTY_PRECEDENCE.length - 1]).toBe("unattributed");
    expect(EMPTY_PRECEDENCE.indexOf("supply_exhausted")).toBeLessThan(
      EMPTY_PRECEDENCE.indexOf("unattributed")
    );
  });
});

describe("REQ-043 c3 — the exhausted-supply line is a proven arm, never the fallback", () => {
  it("with unused supply read and zero, the account is supply_exhausted", () => {
    expect(accountFor({ ...NOTHING, unusedSupply: 0 })).toEqual({ cause: "supply_exhausted" });
  });

  it("with supply depth unreadable and no other cause matching, the account is unattributed, never supply_exhausted", () => {
    // ADR-061 step 7's mutation check, in full. Replacing `=== 0` with a
    // falsiness test, or letting the arm be reached by elimination, turns
    // this into `supply_exhausted` and the product starts telling
    // customers their market is empty on days it merely broke.
    expect(accountFor({ ...NOTHING, unusedSupply: null })).toEqual({ cause: "unattributed" });
  });

  it("unused supply that is read and non-zero does not fire the arm either", () => {
    expect(accountFor({ ...NOTHING, unusedSupply: 7 })).toEqual({ cause: "unattributed" });
  });

  it("no other cause ever returns the exhausted-supply key", () => {
    const others: EmptyFacts[] = [
      { ...NOTHING, instruction: { opportunityId: "o1" }, unusedSupply: 0 },
      { ...NOTHING, reachkitStopped: true, unusedSupply: 0 },
      { ...NOTHING, pageCannotGoLive: "skipped", unusedSupply: 0 },
      { ...NOTHING, customerChangeHoldsPages: "publishing_off", unusedSupply: 0 },
    ];
    // Each of these has zero unused supply **as well**, so the arm would
    // fire on any reading that is not first-match over the precedence.
    for (const facts of others) {
      expect(accountFor(facts).cause).not.toBe("supply_exhausted");
    }
  });
});

describe("REQ-043 c4 — each other cause resolves to itself, and to exactly one line", () => {
  it("each of skipped/unpublished, ReachKit's stop, publishing off and destination disconnected has its own cause", () => {
    expect(accountFor({ ...NOTHING, pageCannotGoLive: "skipped" })).toEqual({
      cause: "page_cannot_go_live",
      state: "skipped",
    });
    expect(accountFor({ ...NOTHING, pageCannotGoLive: "unpublished" })).toEqual({
      cause: "page_cannot_go_live",
      state: "unpublished",
    });
    expect(accountFor({ ...NOTHING, reachkitStopped: true })).toEqual({ cause: "reachkit_stopped" });
    expect(accountFor({ ...NOTHING, customerChangeHoldsPages: "publishing_off" })).toEqual({
      cause: "customer_change_holds_pages",
      setting: "publishing_off",
    });
    expect(accountFor({ ...NOTHING, customerChangeHoldsPages: "destination_disconnected" })).toEqual({
      cause: "customer_change_holds_pages",
      setting: "destination_disconnected",
    });
  });

  it("an unenumerated cause resolves to unattributed, and this file names no line for it", () => {
    // ADR-061 point 2: a date the product cannot explain is a date on which
    // something of the product's failed, so `unattributed` is ReachKit's own
    // stop — and REQ-092's lines are `stoppedWorkStatement`'s, not this
    // record's (issue #113). The record cannot name them: both causes are
    // excluded from its key type.
    expect(accountFor(NOTHING).cause).toBe("unattributed");
    expect(LAW_CAUSES).toEqual(["reachkit_stopped", "unattributed"]);
    for (const cause of LAW_CAUSES) {
      expect(isLawCause(cause)).toBe(true);
      expect(Object.keys(EMPTY_COPY_KEY)).not.toContain(cause);
    }
  });

  it("the exhausted-supply line is the calendar's own, and is not a law's key", () => {
    expect(EMPTY_COPY_KEY.supply_exhausted).toBe("cause.supply-exhausted");
    expect(Object.values(EMPTY_COPY_KEY)).not.toContain("stopped.work.line");
    // The stopped-work line is still a written one, so a law-caused day is
    // never a blank cell — it is just no longer read from here.
    expect(COPY["stopped.work.line"]).not.toBe("");
  });
});

describe("REQ-092 c5 — a date whose page was held is never told the market was empty", () => {
  it("a held page gives the date its own account, not the exhausted-supply line", () => {
    // The date a page was planned for is the one date whose supply
    // manifestly was *not* exhausted. REQ-043 c3 reserves that sentence to
    // proven exhaustion, and this is the arm that keeps it off this date.
    expect(accountFor({ ...NOTHING, pageHeld: true, unusedSupply: 0 })).toEqual({
      cause: "page_held",
    });
  });

  it("it is not the page-cannot-go-live line — a held page still publishes", () => {
    expect(EMPTY_COPY_KEY.page_held).not.toBe(EMPTY_COPY_KEY.page_cannot_go_live);
    expect(EMPTY_COPY_KEY.page_held).toBe("calendar.empty.page-held");
  });

  it("ReachKit's own stop outranks it, and so does a page that can no longer go live (ADR-061)", () => {
    expect(accountFor({ ...NOTHING, pageHeld: true, reachkitStopped: true }).cause).toBe(
      "reachkit_stopped"
    );
    expect(accountFor({ ...NOTHING, pageHeld: true, pageCannotGoLive: "skipped" }).cause).toBe(
      "page_cannot_go_live"
    );
    expect(
      accountFor({ ...NOTHING, pageHeld: true, customerChangeHoldsPages: "publishing_off" }).cause
    ).toBe("customer_change_holds_pages");
  });

  it("and it outranks both of the last two arms", () => {
    expect(EMPTY_PRECEDENCE.indexOf("page_held")).toBeLessThan(
      EMPTY_PRECEDENCE.indexOf("supply_exhausted")
    );
    expect(EMPTY_PRECEDENCE.indexOf("page_held")).toBeLessThan(
      EMPTY_PRECEDENCE.indexOf("unattributed")
    );
    expect(accountFor({ ...NOTHING, pageHeld: true, unusedSupply: null }).cause).toBe("page_held");
  });
});

describe("REQ-043 c5 — one account per date, and the instruction outranks everything", () => {
  it("an outstanding instruction outranks every other cause, including ReachKit's stop", () => {
    expect(
      accountFor({
        instruction: { opportunityId: "o9" },
        reachkitStopped: true,
        pageCannotGoLive: "skipped",
        customerChangeHoldsPages: "publishing_off",
        changeHoldsGeneration: { because: "domain", resumesOn: new Date("2026-09-21T00:00:00.000Z") },
        pageHeld: true,
        unusedSupply: 0,
      })
    ).toEqual({ cause: "instruction", opportunityId: "o9" });
  });

  it("once the instruction is carried out the date falls through to the account c3 or c4 gives it", () => {
    const withInstruction: EmptyFacts = { ...NOTHING, reachkitStopped: true, instruction: { opportunityId: "o9" } };
    expect(accountFor(withInstruction).cause).toBe("instruction");
    expect(accountFor({ ...withInstruction, instruction: null }).cause).toBe("reachkit_stopped");
  });

  it("ReachKit's own stop outranks the customer's own causes (REQ-092 c7, ADR-061 point 4)", () => {
    expect(
      accountFor({ ...NOTHING, reachkitStopped: true, customerChangeHoldsPages: "publishing_off" }).cause
    ).toBe("reachkit_stopped");
  });

  it("the resolver returns exactly one account, and it is total over every combination", () => {
    // 2 × 2 × 3 × 3 × 2 × 3 = 216 fact sets, every one resolved, every one
    // to a cause the precedence names and to nothing else.
    const values = {
      instruction: [null, { opportunityId: "o" }],
      reachkitStopped: [false, true],
      pageCannotGoLive: [null, "skipped", "unpublished"],
      customerChangeHoldsPages: [null, "publishing_off", "destination_disconnected"],
      changeHoldsGeneration: [
        null,
        { because: "domain", resumesOn: new Date("2026-09-21T00:00:00.000Z") },
        { because: "category", resumesOn: new Date("2026-09-21T00:00:00.000Z") },
      ],
      pageHeld: [false, true],
      unusedSupply: [null, 0, 3],
    } as const;
    let seen = 0;
    for (const instruction of values.instruction)
      for (const reachkitStopped of values.reachkitStopped)
        for (const pageCannotGoLive of values.pageCannotGoLive)
          for (const customerChangeHoldsPages of values.customerChangeHoldsPages)
            for (const changeHoldsGeneration of values.changeHoldsGeneration)
              for (const pageHeld of values.pageHeld)
              for (const unusedSupply of values.unusedSupply) {
                const account = accountFor({
                  instruction,
                  reachkitStopped,
                  pageCannotGoLive,
                  customerChangeHoldsPages,
                  changeHoldsGeneration,
                  pageHeld,
                  unusedSupply,
                });
                expect(EMPTY_PRECEDENCE).toContain(account.cause);
                seen += 1;
              }
    // 3 × 2 × 3 × 3 × 3 × 2 × 3 — the new axis is swept like every other.
    expect(seen).toBe(648);
  });
});
