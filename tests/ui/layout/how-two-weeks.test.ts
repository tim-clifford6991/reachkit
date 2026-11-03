// How it works' head card, "Two weeks, side by side", as board PubHowItWorks draws it: each
// week's rows start under its heading, and ReachKit's page titles keep a readable width.
import { describe, expect, it } from "vitest";
import { getBaseURL, withPage } from "./browser";
import { settleForMeasurement, STILL } from "./no-overflow";

interface Head {
  weeks: Week[];
  /** Each step chip: how many lines its words take, and whether they overflow it. */
  chips: { lines: number; overflows: boolean }[];
}

interface Week {
  /** Gap from the heading's name line to the first row. */
  gap: number;
  titleWidths: number[];
}

async function measure(width: number): Promise<Head> {
  const baseURL = getBaseURL();
  if (!baseURL) throw new Error("tests/ui/layout/how-two-weeks.test.ts: no app server is running");
  return withPage(width, async (page) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${baseURL}/how-it-works`);
    await page.addStyleTag({ content: STILL });
    await settleForMeasurement(page);
    return page.evaluate(() => ({
      weeks: [...document.querySelectorAll("#top figure ol")].map((ol) => {
        const name = ol.previousElementSibling!.firstElementChild!.getBoundingClientRect();
        // A row is day, icon tile, then its text.
        const titles = [...ol.querySelectorAll(":scope > li > span:nth-child(3)")];
        return {
          gap: ol.querySelector("li")!.getBoundingClientRect().top - name.bottom,
          titleWidths: titles.map((t) => t.getBoundingClientRect().width),
        };
      }),
      chips: [...document.querySelectorAll("#top ol a .badge")].map((chip) => {
        const range = document.createRange();
        range.selectNodeContents(chip);
        return {
          lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size,
          overflows: chip.scrollWidth > chip.clientWidth + 1,
        };
      }),
    }));
  });
}

describe("how it works: the two weeks side by side", () => {
  it.each([768, 1024, 1280, 1440])("at %ipx both weeks' first rows sit within 24px of their heading", async (width) => {
    const { weeks } = await measure(width);
    expect(weeks).toHaveLength(2);
    for (const [i, week] of weeks.entries()) expect(week.gap, `week ${i + 1}`).toBeLessThanOrEqual(24);
  }, 120_000);

  it.each([1280, 1440])("at %ipx no ReachKit page title is narrower than 160px", async (width) => {
    const [, ours] = (await measure(width)).weeks;
    expect(ours!.titleWidths.length).toBeGreaterThan(1);
    for (const w of ours!.titleWidths) expect(w).toBeGreaterThanOrEqual(160);
  }, 120_000);

  it("at 1280px every step chip holds its words on one line", async () => {
    const { chips } = await measure(1280);
    expect(chips).toHaveLength(4);
    for (const [i, chip] of chips.entries()) expect(chip, `step ${i + 1}`).toEqual({ lines: 1, overflows: false });
  }, 120_000);
});
