// The landing's three steps as boards PubLanding and PubLandingPhone draw them: the three
// pictures share one height at a given width, beside the text once the card is wide and
// under it on a phone, and nothing in them overflows.
import { describe, expect, it } from "vitest";
import { checkContainment, checkNoClippingOrTruncation, MONO_FONT_FAMILY } from "./checks";
import { getBaseURL, withPage } from "./browser";
import { NO_OVERFLOW_CLAMPED_TEXT, NO_OVERFLOW_SCROLL_CONTAINERS, NO_OVERFLOW_THEMES, settleForMeasurement, STILL } from "./no-overflow";

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

async function measure(width: number): Promise<{ theme: string; steps: { text: Box; figure: Box; fits: boolean }[]; offenders: string[] }[]> {
  const baseURL = getBaseURL();
  if (!baseURL) throw new Error("tests/ui/layout/landing-steps.test.ts: no app server is running");
  return withPage(width, async (page) => {
    const out: { theme: string; steps: { text: Box; figure: Box; fits: boolean }[]; offenders: string[] }[] = [];
    for (const theme of NO_OVERFLOW_THEMES) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(`${baseURL}/`);
      await page.addStyleTag({ content: STILL });
      await settleForMeasurement(page);
      const steps = await page.evaluate(() => {
        const box = (el: Element): Box => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        };
        // Each step carries `data-step`; step 2's day rows are list items too, inside their own picture.
        return [...document.querySelectorAll("#how li[data-step]")].map((li) => {
          const figure = li.querySelector("figure")!;
          const body = figure.querySelector(".card-body")!;
          return { text: box(li.querySelector("h3")!.parentElement!), figure: box(figure), fits: body.scrollHeight <= body.clientHeight + 1 };
        });
      });
      const offenders = [
        await page.evaluate(checkContainment, { scrollContainerAllowlist: NO_OVERFLOW_SCROLL_CONTAINERS }),
        await page.evaluate(checkNoClippingOrTruncation, {
          scrollContainerAllowlist: NO_OVERFLOW_SCROLL_CONTAINERS,
          truncationAllowlist: NO_OVERFLOW_CLAMPED_TEXT,
          monoFontFamily: MONO_FONT_FAMILY,
        }),
      ]
        .flat()
        .map((o) => `${o.check} — ${o.element}`);
      out.push({ theme, steps, offenders });
    }
    return out;
  });
}

const height = (b: Box): number => b.bottom - b.top;

describe("the landing's three step pictures, light and dark", () => {
  it.each([390, 1280])("at %ipx the three pictures are one height, each holds its content, and the text sits where the board puts it", async (width) => {
    for (const { theme, steps, offenders } of await measure(width)) {
      expect(offenders, theme).toEqual([]);
      expect(steps, theme).toHaveLength(3);
      const [first] = steps;
      for (const [i, s] of steps.entries()) {
        const at = `${theme} step ${i + 1}`;
        expect(Math.abs(height(s.figure) - height(first!.figure)), at).toBeLessThanOrEqual(0.5);
        expect(s.fits, at).toBe(true);
        if (width === 390) expect(s.figure.top, at).toBeGreaterThanOrEqual(s.text.bottom);
        if (width === 1280) {
          expect(s.figure.left, at).toBeGreaterThan(s.text.right);
          expect(s.text.top, at).toBeLessThan(s.figure.top + 16);
        }
      }
    }
  }, 180_000);
});
