// The landing's story card as board PubLanding draws it: each node beside its
// title, the picture card beside the title once the card is wide and under it
// on a phone, and the card centred under the centred hero text below desktop.
import { describe, expect, it } from "vitest";
import { checkContainment, checkNoClippingOrTruncation, checkNoHorizontalScroll, MONO_FONT_FAMILY } from "./checks";
import { getBaseURL, withPage } from "./browser";
import { NO_OVERFLOW_CLAMPED_TEXT, NO_OVERFLOW_SCROLL_CONTAINERS, NO_OVERFLOW_THEMES, settleForMeasurement, STILL } from "./no-overflow";

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Geometry {
  card: Box;
  heroText: Box;
  frames: { li: Box; node: Box; title: Box; mini: Box }[];
}

async function measure(width: number): Promise<{ theme: string; geometry: Geometry; offenders: string[] }[]> {
  const baseURL = getBaseURL();
  if (!baseURL) throw new Error("tests/ui/layout/landing-story.test.ts: no app server is running");
  return withPage(width, async (page) => {
    const out: { theme: string; geometry: Geometry; offenders: string[] }[] = [];
    for (const theme of NO_OVERFLOW_THEMES) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(`${baseURL}/`);
      await page.addStyleTag({ content: STILL });
      await settleForMeasurement(page);
      const geometry = await page.evaluate(() => {
        const box = (el: Element | null): Box => {
          const r = el!.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        };
        const card = document.querySelector('[data-testid="landing-story"]');
        return {
          card: box(card),
          heroText: box(document.querySelector("h1")!.parentElement),
          frames: [...card!.querySelectorAll("ol > li")].map((li) => ({
            li: box(li),
            node: box(li.querySelector(".timeline-middle")),
            title: box(li.querySelector(".timeline-end > p")),
            mini: box(li.querySelector(".timeline-end > :last-child")),
          })),
        };
      });
      const offenders = [
        await page.evaluate(checkNoHorizontalScroll),
        await page.evaluate(checkContainment, { scrollContainerAllowlist: NO_OVERFLOW_SCROLL_CONTAINERS }),
        await page.evaluate(checkNoClippingOrTruncation, {
          scrollContainerAllowlist: NO_OVERFLOW_SCROLL_CONTAINERS,
          truncationAllowlist: NO_OVERFLOW_CLAMPED_TEXT,
          monoFontFamily: MONO_FONT_FAMILY,
        }),
      ]
        .flat()
        .map((o) => `${o.check} — ${o.element}`);
      out.push({ theme, geometry, offenders });
    }
    return out;
  });
}

const centre = (b: Box): number => (b.left + b.right) / 2;

describe("the landing's story card frames, light and dark", () => {
  it.each([390, 768, 1023, 1280])("at %ipx nothing overflows and each node sits beside its title, with no empty start column", async (width) => {
    for (const { theme, geometry, offenders } of await measure(width)) {
      expect(offenders, theme).toEqual([]);
      expect(geometry.frames, theme).toHaveLength(4);
      for (const [i, f] of geometry.frames.entries()) {
        const at = `${theme} frame ${i + 1}`;
        expect(Math.abs(f.node.top - f.title.top), at).toBeLessThanOrEqual(8);
        expect(f.node.left - f.li.left, at).toBeLessThanOrEqual(1);
        expect(f.mini.right, at).toBeLessThanOrEqual(f.li.right + 0.5);
        if (width === 390) expect(f.mini.top, at).toBeGreaterThanOrEqual(f.title.bottom);
        if (width === 1280) expect(f.mini.left, at).toBeGreaterThan(f.title.right);
      }
      if (width === 768 || width === 1023) expect(Math.abs(centre(geometry.card) - centre(geometry.heroText)), theme).toBeLessThanOrEqual(4);
      if (width === 1280) expect(geometry.card.right - geometry.card.left, theme).toBeCloseTo(geometry.heroText.right - geometry.heroText.left, 0);
    }
  }, 180_000);
});
