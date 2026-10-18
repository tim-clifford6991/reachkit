// tests/costs/vendor-days.test.ts — issue 1478: a day's DataForSEO bill is
// the balance's fall between two openings, deposits added back, and it is
// never a guess where either opening is missing.
import "../generate/env";
import { describe, expect, it } from "vitest";
import { billedBetween, previousMonth } from "../../src/lib/costs/vendor-days";
import { accountReadingOf } from "../../src/lib/vendors/dataforseo/account";
import { costReportDays } from "../../src/lib/vendors/anthropic/cost-report";

describe("a day's DataForSEO bill", () => {
  it("is the opening balance less the next opening, with a deposit added back", () => {
    expect(billedBetween({ balance_cents: "3113.1168", deposited_cents: "10100" }, { balanceCents: 3014.0, depositedCents: 10100 })).toBe(99.1168);
    expect(billedBetween({ balance_cents: 100, deposited_cents: 10100 }, { balanceCents: 5090, depositedCents: 15100 })).toBe(10);
  });

  it("is not read where an opening is missing", () => {
    expect(billedBetween({ balance_cents: null, deposited_cents: 10100 }, { balanceCents: 1, depositedCents: 10100 })).toBeNull();
  });

  it("reads the vendor's dollars as cents", () => {
    expect(accountReadingOf({ tasks: [{ result: [{ money: { balance: 31.131168, total: 101 } }] }] })).toEqual({ balanceCents: 3113.1168, depositedCents: 10100 });
    expect(accountReadingOf({ tasks: [] })).toBeNull();
  });
});

describe("Anthropic's cost report", () => {
  it("is cents a UTC day, US dollar items only", () => {
    expect(
      costReportDays([
        { starting_at: "2026-10-15T00:00:00Z", results: [{ amount: "96.2", currency: "USD" }, { amount: "4", currency: "EUR" }] },
        { starting_at: "not a date", results: [{ amount: "1", currency: "USD" }] },
      ])
    ).toEqual({ "2026-10-15": 96.2 });
  });
});

describe("the fixed costs' month", () => {
  it("is the month before, across a year", () => {
    expect(previousMonth(new Date("2026-10-17T00:05:00Z"))).toBe("2026-09-01");
    expect(previousMonth(new Date("2027-01-01T00:05:00Z"))).toBe("2026-12-01");
  });
});
