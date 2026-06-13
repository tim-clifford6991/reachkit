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
test("a charge that crosses the tool-call cap leaves state unchanged", () => {
  const b = new ScanBudget({ maxToolCalls: 3, budgetCents: 1000 });
  b.charge({ toolCalls: 2, cents: 10 });
  expect(() => b.charge({ toolCalls: 2, cents: 10 })).toThrow(BudgetExceededError);
  // The rejected charge must not be partially applied.
  expect(b.callsMade).toBe(2);
  expect(b.spentCents).toBe(10);
  // Budget is still usable for a charge that fits exactly at the cap.
  b.charge({ toolCalls: 1, cents: 10 });
  expect(b.callsMade).toBe(3);
  expect(b.spentCents).toBe(20);
});
test("a charge that crosses the cents cap leaves state unchanged", () => {
  const b = new ScanBudget({ maxToolCalls: 100, budgetCents: 50 });
  b.charge({ toolCalls: 1, cents: 40 });
  expect(() => b.charge({ toolCalls: 1, cents: 20 })).toThrow(BudgetExceededError);
  expect(b.callsMade).toBe(1);
  expect(b.spentCents).toBe(40);
});
test("a charge landing exactly on each cap succeeds (boundary is inclusive)", () => {
  const b = new ScanBudget({ maxToolCalls: 5, budgetCents: 50 });
  b.charge({ toolCalls: 5, cents: 50 });
  expect(b.callsMade).toBe(5);
  expect(b.spentCents).toBe(50);
  // Any further non-zero charge now throws.
  expect(() => b.charge({ toolCalls: 1, cents: 0 })).toThrow(BudgetExceededError);
  expect(() => b.charge({ toolCalls: 0, cents: 1 })).toThrow(BudgetExceededError);
});
