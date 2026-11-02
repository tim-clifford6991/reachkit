// tests/ui/layout/footer.test.ts — board PubLanding v36: at 390 the footer's four columns are two across, brand above them.
import { describe, expect, it } from "vitest";
import { COPY } from "@/lib/presentation/copy";
import { getBaseURL, withPage } from "./browser";

const COLUMNS = ["chrome.footer.product", "chrome.footer.learn", "chrome.footer.legal", "chrome.footer.contact"] as const;

describe("board PubLanding v36 — the footer at 390", () => {
  it("Product | Learn, then Legal | Contact, under the brand", async () => {
    const baseURL = getBaseURL();
    if (!baseURL) throw new Error("tests/ui/layout/footer.test.ts: no app server is running.");
    const [brand, product, learn, legal, contact] = await withPage(390, async (page) => {
      await page.goto(baseURL + "/pricing", { waitUntil: "load" });
      return page.evaluate((labels) => {
        const footer = document.querySelector('[data-testid="public-footer"]')!;
        const parts = [footer.querySelector("aside")!, ...labels.map((l) => footer.querySelector(`nav[aria-label="${l}"]`)!)];
        return parts.map((el) => el.getBoundingClientRect().toJSON() as { top: number; bottom: number; left: number });
      }, COLUMNS.map((key) => COPY[key]));
    });
    expect([product!.top, legal!.top]).toEqual([learn!.top, contact!.top]);
    expect([product!.left, legal!.left]).toEqual([legal!.left, product!.left]);
    expect(product!.left).toBeLessThan(learn!.left);
    expect(legal!.left).toBeLessThan(contact!.left);
    expect(legal!.top).toBeGreaterThan(product!.bottom);
    expect(product!.top).toBeGreaterThan(brand!.bottom);
  }, 60_000);
});
