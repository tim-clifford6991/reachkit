// The panel runs the pass's own steps but the first draft: the first week is still committed, so readiness is
// written as in production, and no page is written.
import { describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();
const { panelStep } = await import("../../scripts/panel/run");

describe("panelStep", () => {
  it("commits the site's first week on the first-draft step and never runs the draft", async () => {
    const plan = vi.fn(async () => []);
    const draft = vi.fn(async () => "released");
    const step = panelStep("site-1", plan);

    await step("first-draft", draft);

    expect(plan).toHaveBeenCalledWith("site-1", expect.any(Date));
    expect(draft).not.toHaveBeenCalled();
  });

  it("runs every other step as the pass does, and commits nothing there", async () => {
    const plan = vi.fn(async () => []);
    const step = panelStep("site-1", plan);

    for (const name of ["deep-pass", "knowledge-base", "opportunities"]) expect(await step(name, async () => name)).toBe(name);
    expect(plan).not.toHaveBeenCalled();
  });
});
