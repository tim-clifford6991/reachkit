// The scan in progress, its What we read card filled with the longest values
// a market stage may record: a 200-character buyer and a 60-character town.
// The stream is the screen's own, answered here with the events a pass writes.
import { expect, it } from "vitest";
import { checkContainment, checkNoClippingOrTruncation, checkNoHorizontalScroll, MONO_FONT_FAMILY } from "./checks";
import { getBaseURL, withPage } from "./browser";
import { copy } from "@/lib/presentation/copy";
import { NO_OVERFLOW_CLAMPED_TEXT, NO_OVERFLOW_SCROLL_CONTAINERS, NO_OVERFLOW_THEMES, NO_OVERFLOW_WIDTHS, settleForMeasurement, STILL } from "./no-overflow";

const BUYER =
  "B2B SaaS and software companies seeking to be discovered by buyers researching solutions, and the agencies, consultants and freelancers who run search for them across several markets in Europe, today.";
const PLACE = "Kingston upon Hull and the villages of the East Riding coast";

const EVENTS = [
  { stage: "reading_your_site", done: false },
  { stage: "reading_your_site", done: true },
  { stage: "reading_your_market", done: false },
  { stage: "reading_your_market", done: true, summary: { pagesRead: 38, category: "Plumber", buyer: BUYER, place: PLACE } },
];

it("a 200-character buyer and a 60-character town wrap inside What we read at 390px, light and dark", async () => {
  expect(BUYER).toHaveLength(200);
  expect(PLACE).toHaveLength(60);
  const failing = await withPage(NO_OVERFLOW_WIDTHS[0], async (page) => {
    await page.route("**/api/scan/*/progress", (route) =>
      route.fulfill({ status: 200, contentType: "text/event-stream", body: EVENTS.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") })
    );
    const lines: string[] = [];
    for (const theme of NO_OVERFLOW_THEMES) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(`${getBaseURL()}/scan/scanning.example.com`);
      await page.addStyleTag({ content: STILL });
      await settleForMeasurement(page);
      await page.getByText(copy("scan.filling.buyer", { buyer: BUYER })).waitFor();
      const offenders = [
        await page.evaluate(checkNoHorizontalScroll),
        await page.evaluate(checkContainment, { scrollContainerAllowlist: NO_OVERFLOW_SCROLL_CONTAINERS }),
        await page.evaluate(checkNoClippingOrTruncation, {
          scrollContainerAllowlist: NO_OVERFLOW_SCROLL_CONTAINERS,
          truncationAllowlist: NO_OVERFLOW_CLAMPED_TEXT,
          monoFontFamily: MONO_FONT_FAMILY,
        }),
      ].flat();
      lines.push(...offenders.map((o) => `${theme}: ${o.check} — ${o.element}`));
    }
    return lines;
  });
  expect(failing).toEqual([]);
}, 180_000);
