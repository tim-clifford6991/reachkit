// tests/app/overview/supply.test.ts — BUILD §4.5, DECISIONS 2026-08-28.
//
// "Supply is the cap: never invent an opportunity to fill a day." Overview
// may say that once. The discriminating case is all three conditions true at
// the same time.
import { describe, expect, it } from "vitest";
import {
  readSupplyStatement,
  SUPPLY_PRECEDENCE,
  type SupplyFacts,
} from "@/app/(account)/app/_overview/supply";

const facts = (over: Partial<SupplyFacts> = {}): SupplyFacts => ({
  exhausted: false,
  short: false,
  firstArrivalShortfall: false,
  ...over,
});

describe("one statement, never two", () => {
  it("with exhausted, short and first-arrival all true, exactly one key comes back", () => {
    const statement = readSupplyStatement(
      facts({ exhausted: true, short: true, firstArrivalShortfall: true })
    );
    expect(statement).toEqual({ key: "overview.supply.exhausted", vars: {} });
  });

  it("short outranks a first-arrival shortfall", () => {
    const statement = readSupplyStatement(facts({ short: true, firstArrivalShortfall: true }));
    expect(statement?.key).toBe("overview.supply.short");
  });

  it("a first-arrival shortfall alone is its own line", () => {
    expect(readSupplyStatement(facts({ firstArrivalShortfall: true }))?.key).toBe(
      "overview.supply.first-arrival"
    );
  });

  it("with nothing true the screen says nothing about supply", () => {
    expect(readSupplyStatement(facts())).toBeUndefined();
  });
});

describe("the order is data, not the shape of an if-chain", () => {
  it("the precedence names each condition once, strongest claim first", () => {
    expect(SUPPLY_PRECEDENCE.map((row) => row.when)).toEqual([
      "exhausted",
      "short",
      "firstArrivalShortfall",
    ]);
  });

  it("the three keys are distinct — three conditions are never one sentence", () => {
    const keys = SUPPLY_PRECEDENCE.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every row's condition resolves to its own key when it is the only one true", () => {
    for (const row of SUPPLY_PRECEDENCE) {
      expect(readSupplyStatement(facts({ [row.when]: true }))?.key).toBe(row.key);
    }
  });
});
