// tests/scan/retry-offer.test.ts — SPEC §2, issue 715.
//
// The decision behind "Retry this part", on its own: which parts a report
// may re-run, and why it may not. It is pure, so this suite doubles
// nothing — the route and the screen make the same call from the same
// facts, and a rule that lived in either of them would be two rules.
import { describe, expect, it } from "vitest";
import { setEnvFixture } from "./run/harness";

setEnvFixture();

const { RETRY_PARTS, RETRY_STAGE, budgetLeftCents, isRetryPart, partIsAbsent, retryOffer } = await import(
  "../../src/lib/scan/retry"
);
const { assembleReport } = await import("../../src/lib/scan/store");
const { CAPS } = await import("../../src/lib/config/constants");
const { fullSections } = await import("./report/fixtures");
import type { RetryFacts, RetryPart } from "../../src/lib/scan/retry";
import type { StoredReport } from "../../src/lib/scan/report";

/** A report a ceiling stopped, with the named parts missing from it. */
function cutOff(missing: Partial<Record<"aiAnswers" | "presence" | "freePage", true>>): StoredReport {
  return assembleReport(
    fullSections({
      stoppedReason: "time_ceiling",
      ...(missing.aiAnswers === true ? { aiAnswers: null } : {}),
      ...(missing.presence === true ? { presence: null } : {}),
      freePage: null,
    })
  );
}

function facts(report: StoredReport, spentCents: number, domainRemoved = false): RetryFacts {
  return { scanId: "11111111-1111-4111-8111-111111111111", report, spentCents, domainRemoved };
}

describe("which part a card names", () => {
  it("the three cards that can draw the control, and no fourth", () => {
    expect([...RETRY_PARTS]).toEqual(["ai_answers", "presence", "free_page"]);
    for (const part of RETRY_PARTS) expect(isRetryPart(part)).toBe(true);
    for (const junk of ["", "everything", "AI_ANSWERS", 1, null]) expect(isRetryPart(junk)).toBe(false);
  });

  it("the two cards counted over the twelve name the stage that buys them; the first page names scoring", () => {
    // Not a shortcut: both cards are counted over the same purchase, so the
    // part either of them is missing is that one stage's.
    expect(RETRY_STAGE.ai_answers).toBe("asking_the_twelve");
    expect(RETRY_STAGE.presence).toBe("asking_the_twelve");
    expect(RETRY_STAGE.free_page).toBe("scoring");
  });

  it("a part is absent when its own section is, and not otherwise", () => {
    const report = cutOff({ aiAnswers: true });
    expect(partIsAbsent(report, "ai_answers")).toBe(true);
    expect(partIsAbsent(report, "presence")).toBe(false);
    expect(partIsAbsent(report, "free_page")).toBe(true);
  });
});

describe("what the 12¢ still holds", () => {
  it("is the cap less what the row spent, and never below nothing", () => {
    expect(budgetLeftCents(0)).toBe(CAPS.FREE_C);
    expect(budgetLeftCents(4.73)).toBeCloseTo(CAPS.FREE_C - 4.73, 6);
    expect(budgetLeftCents(CAPS.FREE_C)).toBe(0);
    expect(budgetLeftCents(CAPS.FREE_C + 5)).toBe(0);
  });
});

describe("retryOffer — a control that cannot act is never drawn", () => {
  const part: RetryPart = "ai_answers";

  it("offers a part a ceiling cut off while the report's own budget still holds it", () => {
    expect(retryOffer({ facts: facts(cutOff({ aiAnswers: true }), 4.73), part })).toEqual({ offered: true });
  });

  it("refuses where there is no current report to retry a part of", () => {
    expect(retryOffer({ facts: null, part })).toEqual({ offered: false, because: "no_current_report" });
  });

  it("refuses a report no ceiling stopped — a card absent for its own reason is not one a ceiling cut off", () => {
    const complete = assembleReport(fullSections({ aiAnswers: null }));
    expect(retryOffer({ facts: facts(complete, 0), part })).toEqual({ offered: false, because: "not_cut_off" });
  });

  it("refuses a part that is already on the report", () => {
    expect(retryOffer({ facts: facts(cutOff({ presence: true }), 0), part })).toEqual({
      offered: false,
      because: "part_present",
    });
  });

  it("refuses a buying part once the pass has spent the whole cap — there is nothing left to buy it with", () => {
    expect(retryOffer({ facts: facts(cutOff({ aiAnswers: true }), CAPS.FREE_C), part })).toEqual({
      offered: false,
      because: "no_budget_left",
    });
  });

  it("still offers the first page at the cap: it buys nothing, so refusing it would refuse free work", () => {
    expect(retryOffer({ facts: facts(cutOff({}), CAPS.FREE_C), part: "free_page" })).toEqual({ offered: true });
  });

  it("refuses a removed domain before anything else about the report is read", () => {
    expect(retryOffer({ facts: facts(cutOff({ aiAnswers: true }), 0, true), part })).toEqual({
      offered: false,
      because: "domain_removed",
    });
  });
});
