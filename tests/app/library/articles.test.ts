// Issue 1458 — the rules every article page keeps, held over the data
// rather than transcribed: SPEC §0's titles and vocabulary (2026-10-15),
// and one source and date on every page that states facts about another
// company.
import "../../generate/env";
import { describe, expect, it } from "vitest";
import { ANSWERS, COMPARISONS, TEARDOWNS } from "@/app/(public)/_library";

const PAGES = [
  ...COMPARISONS.map((c) => ({ kind: "compare", ...c, headings: [c.theirs.heading, ...(c.heading === undefined ? [] : [c.heading])] })),
  ...TEARDOWNS.map((t) => ({ kind: "teardowns", ...t, headings: t.sections.map((s) => s.heading) })),
  ...ANSWERS.map((a) => ({ kind: "answers", ...a, headings: [a.tiers.title, ...a.sections.map((s) => s.heading), a.fits.title] })),
];

/** Words the product no longer says (SPEC §0, 2026-10-15; §7, 2026-09-20). */
const RETIRED = /\b(discoverability|rivals?|veto(ed)?|calendars?|top ten|top 10|top 20|launch price|list price|locked for life|re-?measure)\b/i;
const DASH = /[–—]/;

const words = (s: string): number => s.trim().split(/\s+/).length;

describe("every article keeps the rules of a title (SPEC §0, 2026-10-15)", () => {
  it("the library holds the pages Google still ranks", () => {
    expect(COMPARISONS).toHaveLength(24);
    expect(TEARDOWNS).toHaveLength(9);
    expect(ANSWERS).toHaveLength(1);
  });

  for (const page of PAGES) {
    it(`/${page.kind}/${page.slug}: titles at most six words, no dash; description fits a result`, () => {
      for (const title of [page.title, ...page.headings]) {
        expect(words(title), title).toBeLessThanOrEqual(6);
        expect(DASH.test(title), title).toBe(false);
      }
      expect(page.description.length, page.description).toBeLessThanOrEqual(160);
      expect(new Set(PAGES.filter((p) => p.kind === page.kind).map((p) => p.slug)).size).toBe(
        PAGES.filter((p) => p.kind === page.kind).length
      );
    });

    it(`/${page.kind}/${page.slug}: says no retired word and no dash`, () => {
      const text = JSON.stringify(page);
      expect(text.match(RETIRED)?.[0]).toBeUndefined();
      expect(DASH.test(text)).toBe(false);
    });

    it(`/${page.kind}/${page.slug}: dated, with the pages its facts came from`, () => {
      const date = "checked" in page ? page.checked : page.revised;
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(page.sources.length).toBeGreaterThan(0);
    });
  }
});
