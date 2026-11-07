// How it works' four step cards, as board PubHowItWorks draws them: one head each, one line
// per chip, two to a row on a phone, and each question's chip on its first line.
import { describe, expect, it } from "vitest";
import { getBaseURL, withPage } from "./browser";
import { settleForMeasurement, STILL } from "./no-overflow";

interface Head {
  /** Each step chip: how many lines its words take, and whether they overflow it. */
  chips: { lines: number; overflows: boolean }[];
  /** Each step card's title top: its head is number, icon tile, then chip. */
  stepTitleTops: number[];
  /** Each step card's left edge. */
  stepLefts: number[];
  /** Each question row: how far its Picked or Skipped chip sits below the question's top. */
  chipDrops: number[];
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
      chips: [...document.querySelectorAll("#top ol a .badge")].map((chip) => {
        const range = document.createRange();
        range.selectNodeContents(chip);
        return {
          lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size,
          overflows: chip.scrollWidth > chip.clientWidth + 1,
        };
      }),
      stepTitleTops: [...document.querySelectorAll("#top ol a .card-body > :nth-child(2)")].map((t) => t.getBoundingClientRect().top),
      stepLefts: [...document.querySelectorAll("#top ol a.card")].map((a) => Math.round(a.getBoundingClientRect().left)),
      chipDrops: [...document.querySelectorAll("#questions figure ul > li")].map((li) => {
        const [question, chip] = [li.firstElementChild!, li.lastElementChild!];
        return Math.round(chip.getBoundingClientRect().top - question.getBoundingClientRect().top);
      }),
    }));
  });
}

describe("how it works: the four steps", () => {
  it("at 390px the steps sit two to a row", async () => {
    const { stepLefts } = await measure(390);
    expect(stepLefts).toHaveLength(4);
    expect(new Set(stepLefts).size).toBe(2);
  }, 120_000);

  it("at 390px every question's chip stays on the question's first line", async () => {
    const { chipDrops } = await measure(390);
    expect(chipDrops.length).toBeGreaterThan(0);
    for (const [i, drop] of chipDrops.entries()) expect(drop, `question ${i + 1}`).toBeLessThanOrEqual(8);
  }, 120_000);

  it("at 1280px every step chip holds its words on one line", async () => {
    const { chips } = await measure(1280);
    expect(chips).toHaveLength(4);
    for (const [i, chip] of chips.entries()) expect(chip, `step ${i + 1}`).toEqual({ lines: 1, overflows: false });
  }, 120_000);

  it.each([1024, 1280])("at %ipx the four step titles share a top", async (width) => {
    const { stepTitleTops: tops } = await measure(width);
    expect(tops).toHaveLength(4);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  }, 120_000);
});
