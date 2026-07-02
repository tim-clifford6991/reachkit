/**
 * Pure-helper unit tests for the dashboard pillar rollup. No DB — exercises the
 * assessed/not-measured semantics, weakest-lever selection, and the gain estimate.
 */

import { describe, expect, test } from "vitest";
import { pillarRollup } from "./pillar-scores";

describe("pillarRollup", () => {
  test("orders pillars Content, Outreach, SEO", () => {
    const { pillars } = pillarRollup({ content: 40, outreach: 30, seo: 60 });
    expect(pillars.map((p) => p.pillar)).toEqual(["content", "outreach", "seo"]);
    expect(pillars.map((p) => p.label)).toEqual(["Content", "Outreach", "SEO"]);
  });

  test("first scan: content/outreach are not-measured (0), SEO always assessed", () => {
    // verifiedScore semantics — total === seo, content/outreach un-assessed.
    const { pillars, weakest } = pillarRollup({ content: 0, outreach: 0, seo: 47 });
    const byPillar = Object.fromEntries(pillars.map((p) => [p.pillar, p]));
    expect(byPillar.content!.assessed).toBe(false);
    expect(byPillar.outreach!.assessed).toBe(false);
    expect(byPillar.seo!.assessed).toBe(true);
    // The only assessed pillar is the weakest by definition.
    expect(weakest?.pillar).toBe("seo");
  });

  test("weakest is the lowest-scoring assessed pillar", () => {
    const { weakest } = pillarRollup({ content: 55, outreach: 20, seo: 70 });
    expect(weakest?.pillar).toBe("outreach");
    expect(weakest?.value).toBe(20);
  });

  test("a real zero (un-assessed) never wins weakest over an assessed low pillar", () => {
    // outreach un-measured (0) must not be picked as the lever ahead of content=15.
    const { weakest } = pillarRollup({ content: 15, outreach: 0, seo: 80 });
    expect(weakest?.pillar).toBe("content");
  });

  test("estGain = weight × gap to strongest assessed pillar", () => {
    // weakest outreach=20, strongest seo=70, gap=50, outreach weight 0.25 → 13.
    const { estGain } = pillarRollup({ content: 55, outreach: 20, seo: 70 });
    expect(estGain).toBe(Math.round(0.25 * (70 - 20)));
  });

  test("no headroom → estGain 0", () => {
    const { estGain } = pillarRollup({ content: 60, outreach: 60, seo: 60 });
    expect(estGain).toBe(0);
  });

  test("null/undefined breakdown degrades to zeros without throwing", () => {
    const { pillars, weakest } = pillarRollup(null);
    expect(pillars).toHaveLength(3);
    // Only SEO is assessed at 0; it is the weakest.
    expect(weakest?.pillar).toBe("seo");
    expect(weakest?.value).toBe(0);
  });
});
