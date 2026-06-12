import { expect, test } from "vitest";
import { ScanBudget, BudgetExceededError } from "./registry";

test("budget allows calls under the cap then throws", () => {
  const b = new ScanBudget({ maxToolCalls: 2, budgetCents: 100 });
  b.charge({ toolCalls: 1, cents: 10 });
  b.charge({ toolCalls: 1, cents: 10 });
  expect(() => b.charge({ toolCalls: 1, cents: 10 })).toThrow(BudgetExceededError);
});
test("budget throws when cents cap exceeded", () => {
  const b = new ScanBudget({ maxToolCalls: 100, budgetCents: 15 });
  expect(() => b.charge({ toolCalls: 1, cents: 20 })).toThrow(BudgetExceededError);
});
test("budget tracks spend and calls on the happy path", () => {
  const b = new ScanBudget({ maxToolCalls: 10, budgetCents: 100 });
  b.charge({ toolCalls: 2, cents: 30 });
  expect(b.callsMade).toBe(2);
  expect(b.spentCents).toBe(30);
});
