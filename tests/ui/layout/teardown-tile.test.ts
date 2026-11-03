// A teardown's letter tile sits above its title, so at 390 the title keeps
// the column's full width. The sweep measures overflow, never order or width.
import { expect, it } from "vitest";
import { getBaseURL, withPage } from "./browser";

/** Read in the page. Closure-free: `page.evaluate` serialises its text. */
function measure() {
  const main = document.querySelector('[data-testid="teardown"] article')?.getBoundingClientRect();
  const h1 = document.querySelector('[data-testid="teardown"] h1')?.getBoundingClientRect();
  const tile = document.querySelector('[data-testid="teardown"] h1')?.previousElementSibling?.getBoundingClientRect();
  return { column: main?.width ?? null, title: h1?.width ?? null, h1Top: h1?.top ?? null, tileBottom: tile?.bottom ?? null, tile: tile?.width ?? null };
}

it("/teardowns/plausible at 390: the 56px tile stacks above the h1, which keeps the column's width", async () => {
  const at = await withPage(390, async (page) => {
    await page.goto(`${getBaseURL()}/teardowns/plausible`);
    return page.evaluate(measure);
  });
  expect(at.title, "no h1 on the teardown").not.toBeNull();
  expect(at.tile).toBe(56);
  expect(at.tileBottom!).toBeLessThanOrEqual(at.h1Top!);
  expect(at.title).toBe(at.column);
}, 60_000);
