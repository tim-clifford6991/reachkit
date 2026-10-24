// SPEC §6 2026-10-24 — where each engine stood on a target's question, as the
// derivation copies it onto the candidate.
import { describe, expect, it } from "vitest";
import { targetFactsOf } from "@/lib/opportunities/derive/target";
import type { AnswerCell } from "@/lib/scan/report";

const AT = new Date("2026-10-24T06:00:00.000Z");

function standingOf(cell: AnswerCell): string | undefined {
  const answerRow = { question: {}, cell, engines: [{ engine: "ai_overview", cell }] } as unknown as Parameters<
    typeof targetFactsOf
  >[0]["answerRow"];
  return targetFactsOf({ difficulty: 10, ownRanked: 0, answerRow, at: AT }).engines[0]?.standing;
}

describe("an engine's standing on a target's question", () => {
  it("an answer that cites no address and does not name the site names no one", () => {
    expect(standingOf({ kind: "answered", citedDomains: [], namesCustomer: false })).toBe("names_no_one");
  });

  it("an answer that names the site names it, cited addresses or not", () => {
    expect(standingOf({ kind: "answered", citedDomains: [], namesCustomer: true })).toBe("names_you");
  });

  it("an answer that cites another site names others", () => {
    expect(standingOf({ kind: "answered", citedDomains: ["rival.com"], namesCustomer: false })).toBe("names_others");
  });
});
