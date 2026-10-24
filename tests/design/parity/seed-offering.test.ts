// The parity gate reads the offering page the seed publishes, so its places heading is the writer's, where only (E41).
import "../../generate/env";
import { describe, expect, it } from "vitest";
import { PUBLISHER_OFFERING } from "../../ui/layout/seed";

describe("the seeded offering page's places heading (E41)", () => {
  it("asks where only, and the body draws that heading", () => {
    const where = PUBLISHER_OFFERING.sections.find((s) => s.key === "where_when")!;
    expect(where.heading).not.toMatch(/\bwhen\b/i);
    expect(PUBLISHER_OFFERING.bodyMd.split("\n")).toContain(`## ${where.heading}`);
  });
});
