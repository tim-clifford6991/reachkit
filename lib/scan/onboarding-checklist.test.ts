import { describe, it, expect } from "vitest";
import { checklistSteps, checklistComplete, type ChecklistFacts } from "./onboarding-checklist";

const NONE: ChecklistFacts = {
  hasScan: false,
  hasStartedAction: false,
  hasVerifiedAction: false,
  scoreMoved: false,
};

describe("checklistSteps", () => {
  it("returns the four activation steps", () => {
    const steps = checklistSteps(NONE);
    expect(steps.map((s) => s.key)).toEqual(["scan", "start", "verify", "move"]);
    expect(steps.every((s) => !s.done)).toBe(true);
  });

  it("maps each fact to its step's done flag", () => {
    const steps = checklistSteps({ hasScan: true, hasStartedAction: true, hasVerifiedAction: false, scoreMoved: false });
    const done = Object.fromEntries(steps.map((s) => [s.key, s.done]));
    expect(done).toEqual({ scan: true, start: true, verify: false, move: false });
  });
});

describe("checklistComplete", () => {
  it("is false until every step is done", () => {
    expect(checklistComplete(checklistSteps(NONE))).toBe(false);
    expect(checklistComplete(checklistSteps({ hasScan: true, hasStartedAction: true, hasVerifiedAction: true, scoreMoved: false }))).toBe(false);
  });

  it("is true when all four are done", () => {
    expect(checklistComplete(checklistSteps({ hasScan: true, hasStartedAction: true, hasVerifiedAction: true, scoreMoved: true }))).toBe(true);
  });
});
