import { describe, it, expect } from "vitest";
import { parseOnboardingForm } from "./parse";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("parseOnboardingForm", () => {
  it("trims the display name and caps it at 120 chars", () => {
    const long = "a".repeat(200);
    const out = parseOnboardingForm(fd({ display_name: `  ${long}  ` }));
    expect(out.displayName).toBe("a".repeat(120));
  });

  it("trims the goal and caps it at 200 chars", () => {
    const long = "g".repeat(300);
    const out = parseOnboardingForm(fd({ distribution_goal: `  ${long}  ` }));
    expect(out.goal).toBe("g".repeat(200));
  });

  it("splits ICP by newline, trims, drops blank lines, caps at 12", () => {
    const icpRaw = ["  solo founders ", "", "  indie devs", "   ", "pm"].join("\n");
    const out = parseOnboardingForm(fd({ icp_confirmed: icpRaw }));
    expect(out.icp).toEqual(["solo founders", "indie devs", "pm"]);
  });

  it("caps ICP at 12 entries", () => {
    const icpRaw = Array.from({ length: 20 }, (_, i) => `trait ${i}`).join("\n");
    const out = parseOnboardingForm(fd({ icp_confirmed: icpRaw }));
    expect(out.icp).toHaveLength(12);
    expect(out.icp[0]).toBe("trait 0");
  });

  it("returns empty defaults when fields are missing", () => {
    const out = parseOnboardingForm(new FormData());
    expect(out).toEqual({ displayName: "", goal: "", icp: [] });
  });

  it("treats a whitespace-only ICP as empty", () => {
    const out = parseOnboardingForm(fd({ icp_confirmed: "   \n  \n " }));
    expect(out.icp).toEqual([]);
  });
});
