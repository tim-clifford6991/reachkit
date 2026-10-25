// A chip's lucide icon is a flex item, so a chip whose text wraps can squeeze
// it below the 14px the board draws. Each case first proves its long chips
// really wrap, then measures every icon's drawn box, at 390px light and dark.
import { expect, it } from "vitest";
import type { Page } from "playwright";
import { getBaseURL, withPage } from "./browser";
import { LONG_READ_AS } from "./seed-rows";
import { copy } from "@/lib/presentation/copy";
import { NO_OVERFLOW_THEMES, NO_OVERFLOW_WIDTHS, settleForMeasurement, STILL } from "./no-overflow";

const PLACE = "Kingston upon Hull and the villages of the East Riding coast";
const CATEGORY = "Emergency plumbing, boiler servicing and central heating repair";

interface Chip {
  text: string;
  lines: number;
  icons: string[];
}

// Lines are the distinct bottoms of the chip's own text, so a centred icon is never counted as one.
function measureChips(selector: string): Chip[] {
  return [...document.querySelectorAll(selector)].map((li) => {
    const bottoms = [...li.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .flatMap((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return [...range.getClientRects()].map((rect) => Math.round(rect.bottom));
      });
    const icons = [...li.querySelectorAll("svg")].map((svg) => {
      const box = svg.getBoundingClientRect();
      return `${box.width}x${box.height}`;
    });
    return { text: li.textContent ?? "", lines: new Set(bottoms).size, icons };
  });
}

async function chipsInBothThemes(page: Page, path: string, selector: string, ready: string): Promise<Chip[][]> {
  const themes: Chip[][] = [];
  for (const theme of NO_OVERFLOW_THEMES) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto(`${getBaseURL()}${path}`);
    await page.addStyleTag({ content: STILL });
    await settleForMeasurement(page);
    await page.getByText(ready).first().waitFor();
    themes.push(await page.evaluate(measureChips, selector));
  }
  return themes;
}

function expectWrappedAt14(themes: Chip[][], long: readonly string[], iconCount: number): void {
  for (const chips of themes) {
    const wrapped = long.map((text) => chips.find((chip) => chip.text.includes(text))?.lines ?? 0);
    expect(wrapped.every((lines) => lines >= 2), `each long chip wraps: ${JSON.stringify(chips)}`).toBe(true);
    const icons = chips.flatMap((chip) => chip.icons);
    expect(icons).toEqual(Array.from({ length: iconCount }, () => "14x14"));
  }
}

it("the report's read-as icons draw 14 x 14 when a long category and town wrap at 390px, light and dark", async () => {
  expect(LONG_READ_AS.town).toHaveLength(60);
  const themes = await withPage(NO_OVERFLOW_WIDTHS[0], (page) =>
    chipsInBothThemes(page, `/scan/${LONG_READ_AS.domain}`, '[data-testid="report-read-as"] li', LONG_READ_AS.town)
  );
  // Tag, MapPin and Languages; the buyer chip draws none.
  expectWrappedAt14(themes, [LONG_READ_AS.category, LONG_READ_AS.town], 3);
}, 180_000);

it("the scan's What we read icons draw 14 x 14 when a long category and town wrap at 390px, light and dark", async () => {
  expect(PLACE).toHaveLength(60);
  const events = [
    { stage: "reading_your_site", done: true },
    { stage: "reading_your_market", done: true, summary: { pagesRead: 38, category: CATEGORY, place: PLACE } },
  ];
  const themes = await withPage(NO_OVERFLOW_WIDTHS[0], async (page) => {
    await page.route("**/api/scan/*/progress", (route) =>
      route.fulfill({ status: 200, contentType: "text/event-stream", body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") })
    );
    return chipsInBothThemes(page, "/scan/scanning.example.com", "li.badge", copy("report.read.where.local", { place: PLACE }));
  });
  expectWrappedAt14(themes, [CATEGORY, PLACE], 2);
}, 180_000);
