// A gallery card whose stored logo fails to load draws its letter tile, before
// and without any script, and a logo that loads draws itself: read off the
// pixels the browser painted, never off markup.
import { expect, it } from "vitest";
import { PNG } from "pngjs";
import type { Page } from "playwright";
import { getBaseURL, withPage } from "./browser";

/** A black square, so a drawn logo is unmistakable at the mark's centre. */
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#000"/></svg>';

/** The centre pixel and the brightest pixel of each card mark with a logo, as painted. */
async function painted(page: Page, logo: "fails" | "loads"): Promise<{ centre: number[]; tinted: number }[]> {
  await page.route("**/scans/logo/**", (route) =>
    logo === "fails" ? route.fulfill({ status: 404, body: "" }) : route.fulfill({ status: 200, headers: { "content-type": "image/svg+xml" }, body: LOGO })
  );
  await page.goto(`${getBaseURL()}/scans`, { waitUntil: "networkidle" });
  const out = [];
  for (const mark of await page.locator('[data-testid="gallery-cards"] span:has(> img[data-letter])').all()) {
    const png = PNG.sync.read(await mark.screenshot());
    const at = (x: number, y: number) => {
      const i = (png.width * y + x) * 4;
      return [png.data[i]!, png.data[i + 1]!, png.data[i + 2]!];
    };
    const pixels = Array.from({ length: png.width * png.height }, (_, n) => at(n % png.width, Math.floor(n / png.width)));
    // The letter tile is a light tint across the whole mark; a white frame, a broken-image glyph or a black logo is not.
    const tinted = pixels.filter(([r, g, b]) => Math.max(r!, g!, b!) > 200 && Math.max(r!, g!, b!) - Math.min(r!, g!, b!) >= 6).length / pixels.length;
    out.push({ centre: at(Math.floor(png.width / 2), Math.floor(png.height / 2)), tinted });
  }
  return out;
}

it("a logo that fails to load paints the site's letter on its tint, with no script running", async () => {
  const marks = await withPage(390, (page) => painted(page, "fails"), { firstPaint: true });
  expect(marks.length).toBeGreaterThan(0);
  for (const mark of marks) expect(mark.tinted).toBeGreaterThan(0.5);
}, 60_000);

it("a logo that loads paints the logo, and no letter", async () => {
  const marks = await withPage(390, (page) => painted(page, "loads"));
  expect(marks.length).toBeGreaterThan(0);
  for (const mark of marks) {
    expect(mark.centre.every((c) => c < 40)).toBe(true);
    expect(mark.tinted).toBeLessThan(0.2);
  }
}, 60_000);
