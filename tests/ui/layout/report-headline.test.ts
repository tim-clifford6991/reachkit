// tests/ui/layout/report-headline.test.ts — owner R12 (2026-10-31)
//
// The free report leads with who gets your buyers: on a phone and on a
// laptop, the headline is whole on the first screen, and on a phone it comes
// before the score ring. The sweep measures overflow, never order or height.
import { expect, it } from "vitest";
import { getBaseURL, withPage } from "./browser";

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;

/** Read in the page. Closure-free: `page.evaluate` serialises its text. */
function measure() {
  const title = document.querySelector('[data-testid="report-top"] h2')?.getBoundingClientRect();
  const ring = document.querySelector('[data-testid="report-score"] .radial-progress')?.getBoundingClientRect();
  return { top: title?.top ?? null, bottom: title?.bottom ?? null, ring: ring?.top ?? null, height: window.innerHeight };
}

for (const viewport of VIEWPORTS) {
  it(`/scan/example.com at ${viewport.width}×${viewport.height}: the headline is whole on the first screen`, async () => {
    const at = await withPage(viewport.width, async (page) => {
      await page.setViewportSize(viewport);
      await page.goto(`${getBaseURL()}/scan/example.com`);
      return page.evaluate(measure);
    });
    expect(at.top, "no headline title on the report").not.toBeNull();
    expect(at.bottom!, "the headline ends below the first screen").toBeLessThanOrEqual(at.height);
    if (viewport.width < 768) expect(at.top!, "the headline comes after the score ring").toBeLessThan(at.ring!);
  }, 60_000);
}
