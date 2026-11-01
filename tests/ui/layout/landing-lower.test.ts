// The landing from Why to the footer as boards PubLanding and PubLandingPhone draw it:
// the two Why drawings share a row once the cards sit side by side, each FAQ summary is a
// 64px target, and every text and footer link a 44px one.
import { describe, expect, it } from "vitest";
import { getBaseURL, withPage } from "./browser";
import { NO_OVERFLOW_THEMES, settleForMeasurement, STILL } from "./no-overflow";

interface Measured {
  theme: string;
  titles: number[];
  demos: { top: number; height: number }[];
  summaries: number[];
  links: { text: string; height: number }[];
}

async function measure(width: number): Promise<Measured[]> {
  const baseURL = getBaseURL();
  if (!baseURL) throw new Error("tests/ui/layout/landing-lower.test.ts: no app server is running");
  return withPage(width, async (page) => {
    const out: Measured[] = [];
    for (const theme of NO_OVERFLOW_THEMES) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(`${baseURL}/`);
      await page.addStyleTag({ content: STILL });
      await settleForMeasurement(page);
      const got = await page.evaluate(() => {
        const r = (el: Element) => el.getBoundingClientRect();
        const links = [...document.querySelectorAll('#why a, #faq a, [data-testid="public-footer"] nav a, [data-testid="public-footer"] > p a, section[aria-labelledby="latest-articles"] h2 + a')];
        return {
          titles: [...document.querySelectorAll("#why li.card h3")].map((h) => r(h).top),
          demos: [...document.querySelectorAll("#why [data-demo]")].map((d) => ({ top: r(d).top, height: r(d).height })),
          summaries: [...document.querySelectorAll("#faq summary")].map((s) => r(s).height),
          links: links.map((a) => ({ text: (a.textContent ?? "").trim(), height: r(a).height })),
        };
      });
      out.push({ theme, ...got });
    }
    return out;
  });
}

describe("the landing's lower half, light and dark", () => {
  it.each([390, 1280])("at %ipx: two Why drawings, 64px questions, 44px links", async (width) => {
    for (const { theme, titles, demos, summaries, links } of await measure(width)) {
      expect(demos, theme).toHaveLength(2);
      if (width === 1280) {
        expect(Math.abs(titles[0]! - titles[1]!), `${theme} titles`).toBeLessThanOrEqual(0.5);
        expect(Math.abs(demos[0]!.top - demos[1]!.top), `${theme} drawing tops`).toBeLessThanOrEqual(0.5);
        expect(Math.abs(demos[0]!.height - demos[1]!.height), `${theme} drawing heights`).toBeLessThanOrEqual(0.5);
      }
      expect(summaries, theme).toHaveLength(8);
      for (const h of summaries) expect(h, `${theme} summary`).toBeGreaterThanOrEqual(64);
      expect(links.length, theme).toBeGreaterThan(0);
      for (const l of links) expect(l.height, `${theme} ${l.text}`).toBeGreaterThanOrEqual(44);
    }
  }, 180_000);
});
