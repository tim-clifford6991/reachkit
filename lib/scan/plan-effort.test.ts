/**
 * plan-effort.test.ts — guard test pinning recalibrated, realistic effort estimates.
 *
 * Ensures the plan's daily ritual, content, and outreach times are human-honest
 * and matched across the plan-schedule and action-formatting layers.
 */
import { describe, it, expect } from "vitest";
import { EFFORT_MIN, CONTENT_EFFORT_MIN } from "./plan-schedule";
import { ACTION_EFFORT_MAX } from "@/lib/llm/actions";

describe("recalibrated effort (human-honest times)", () => {
  it("pins the new, realistic effort minutes", () => {
    expect(EFFORT_MIN).toEqual({ low: 8, medium: 20, high: 45 });
    expect(CONTENT_EFFORT_MIN).toBe(45);
    expect(ACTION_EFFORT_MAX).toBe(60);
  });
});
