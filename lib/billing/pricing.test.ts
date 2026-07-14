import { describe, expect, test } from "vitest";
import { CURRENCY, TIERS, fmtPrice, annualPerMonth, tierByPlan } from "./pricing";

describe("pricing (WS5 — EUR single source)", () => {
  test("currency is EUR", () => {
    expect(CURRENCY.code).toBe("EUR");
    expect(CURRENCY.symbol).toBe("€");
  });

  test("tiers are the locked EUR amounts (annual = 10× monthly)", () => {
    expect(tierByPlan("solo")).toMatchObject({ monthly: 59, annual: 590 });
    expect(tierByPlan("growth")).toMatchObject({ monthly: 129, annual: 1290 });
    for (const t of TIERS) expect(t.annual).toBe(t.monthly * 10); // two months free
  });

  test("fmtPrice adds the € symbol + thousands comma", () => {
    expect(fmtPrice(59)).toBe("€59");
    expect(fmtPrice(129)).toBe("€129");
    expect(fmtPrice(590)).toBe("€590");
    expect(fmtPrice(1290)).toBe("€1,290");
  });

  test("annualPerMonth rounds annual/12", () => {
    expect(annualPerMonth(590)).toBe(49);
    expect(annualPerMonth(1290)).toBe(108);
  });

  test("tierByPlan throws on an unknown plan", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => tierByPlan("enterprise")).toThrow();
  });
});
