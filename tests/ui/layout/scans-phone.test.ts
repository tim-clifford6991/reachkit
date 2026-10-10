// tests/ui/layout/scans-phone.test.ts — SPEC §2 2026-10-10 (owner, issue 1377)
//
// **On a phone, `/scans` shows scan cards — on load and while scrolling.**
//
// The toolbar is sticky and its category chips wrapped, so with production's
// fifty categories it stood 1,550px tall on a 390×844 phone and no card was
// ever on screen. Every check the sweep ran passed on it: nothing was wider
// than its box and nothing was cut. So this file makes the claim the visitor
// cares about, against a listing seeded as production fills it (`seed.ts`:
// ten shared categories, a tail of singles, two placeholders).
import { describe, expect, it } from "vitest";
import { CHIPS_MAX } from "@/lib/scan/gallery";
import { getBaseURL, withPage } from "./browser";

/** The phone in the owner's report. */
const PHONE = { width: 390, height: 844 } as const;
/** Far enough that the heading has left and the toolbar is stuck. */
const SCROLL_PX = 900;

interface Seen {
  /** The toolbar's box, top and bottom, in the viewport. */
  readonly toolbar: { top: number; bottom: number } | null;
  /** How much of a card's height shows below the toolbar, the most of any. */
  readonly cardShowing: number;
  /** The first card's box. */
  readonly firstCard: { top: number; bottom: number } | null;
  /** The chips' words, *All* among them. */
  readonly chips: readonly string[];
  /** The words of every category link, chip or under *More*. */
  readonly categories: readonly string[];
}

/** Read in the page. Closure-free: `page.evaluate` serialises its text. */
function measure(): Seen {
  const bar = document.querySelector('[data-testid="gallery-toolbar"]');
  const cards = Array.from(document.querySelectorAll('[data-testid="gallery-cards"] > li'));
  const barBox = bar?.getBoundingClientRect() ?? null;
  const from = barBox?.bottom ?? 0;
  const showing = cards.map((card) => {
    const box = card.getBoundingClientRect();
    return Math.min(box.bottom, window.innerHeight) - Math.max(box.top, from);
  });
  const first = cards[0]?.getBoundingClientRect() ?? null;
  const words = (selector: string): string[] =>
    Array.from(bar?.querySelectorAll(selector) ?? []).map((el) => (el.firstChild?.textContent ?? "").trim());
  return {
    toolbar: barBox === null ? null : { top: barBox.top, bottom: barBox.bottom },
    cardShowing: Math.max(0, ...showing),
    firstCard: first === null ? null : { top: first.top, bottom: first.bottom },
    chips: words("nav > ul a"),
    categories: [...words("nav > ul a"), ...words("nav details a span:first-child")],
  };
}

async function seen(scrollTo: number): Promise<Seen> {
  const baseURL = getBaseURL();
  if (!baseURL) throw new Error("tests/ui/layout/scans-phone.test.ts: no app server is running.");
  return withPage(PHONE.width, async (page) => {
    await page.setViewportSize(PHONE);
    await page.goto(`${baseURL}/scans`);
    await page.evaluate((y) => window.scrollTo(0, y), scrollTo);
    return page.evaluate(measure);
  });
}

describe("issue 1377 — /scans on a 390×844 phone", () => {
  it("opens with the first scan card on screen, below the toolbar", async () => {
    const s = await seen(0);
    expect(s.toolbar, "the toolbar was not drawn").not.toBeNull();
    expect(s.firstCard, "no card was drawn").not.toBeNull();
    expect(s.firstCard!.top, "the first card starts under the toolbar").toBeGreaterThanOrEqual(s.toolbar!.bottom);
    expect(s.firstCard!.bottom, "the first card ends below the screen").toBeLessThanOrEqual(PHONE.height);
  }, 60_000);

  it("keeps a whole card's height on screen under the stuck toolbar while scrolling", async () => {
    const s = await seen(SCROLL_PX);
    // Stuck under the 64px header, and two rows tall however many categories.
    expect(s.toolbar!.top, "the toolbar is not stuck").toBeLessThan(80);
    expect(s.toolbar!.bottom - s.toolbar!.top, "the toolbar grew past two rows").toBeLessThanOrEqual(120);
    expect(s.cardShowing, "no card shows in full under the toolbar").toBeGreaterThanOrEqual(80);
  }, 60_000);

  it("holds a bounded set of chips, keeps every category reachable, and lists no placeholder", async () => {
    const s = await seen(0);
    expect(s.chips.length, `chips: ${s.chips.join(" · ")}`).toBe(CHIPS_MAX + 1);
    // *All*, ten shared categories, and twenty-seven with one scan (`seed.ts`).
    expect(new Set(s.categories).size).toBe(1 + 10 + 3 + 24);
    expect(s.categories.filter((c) => /unknown|[<>]/i.test(c))).toEqual([]);
  }, 60_000);
});
