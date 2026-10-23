// The reserved fixture account's published pages (issue 1457): seventeen,
// one every other day up to the Overview fixture's own last page, so the
// Content tile has a total, a last-four-weeks count below it and a newest.
import type { Ladder } from "@/lib/measure/ladder";
import type { PageReading } from "@/lib/measure/page-reading";
import type { PublishedPage } from "./content";

/** The Overview fixture's own today (`fixture.ts`). */
export const CONTENT_FIXTURE_NOW = new Date(Date.UTC(2026, 8, 4, 14, 30, 0));

const TITLES = [
  "What an onboarding checklist should hold",
  "How to send a first invoice",
  "Late payment reminders that work",
  "Invoice terms for freelancers",
  "When to charge a deposit",
  "Recurring invoices, step by step",
  "What to put on a quote",
  "Paying contractors abroad",
  "How to price a small project",
  "Chasing an unpaid invoice",
  "Invoice numbering rules",
  "VAT on a freelance invoice",
  "Choosing payment terms",
  "Billing by the hour or the project",
  "A simple refund policy",
  "Keeping client records tidy",
  "Year-end paperwork for small teams",
] as const;

const LAST = Date.UTC(2026, 8, 4, 13, 0, 0);

/** Issue 1553: the older a page, the further it has got. The newest two
 *  are not crawled yet; Search Console has shown the oldest ones. */
function ladderAt(index: number): Ladder {
  const shown = index >= 6;
  return {
    crawled: index >= 2,
    indexed: index >= 4,
    impressions: shown ? (index - 5) * 9 : 0,
    showing: shown,
    bestPlace: shown ? 52 - index * 2 : null,
    placeSource: shown ? "serp" : null,
    cited: index === 12,
  };
}

const READ_AT = "2026-08-31T06:00:00.000Z";

/** The weekly reading behind that ladder; the newest two were never read. */
function readingAt(index: number): PageReading | null {
  if (index < 2) return null;
  const shown = index >= 6;
  const place = shown ? 52 - index * 2 : null;
  const at = (days: number): string => new Date(LAST - (index * 2 - days) * 86_400_000).toISOString();
  return {
    at: READ_AT,
    crawled: true,
    place: place === null ? null : { value: place, source: "serp", query: `fixture search ${index + 1}` },
    first: place === null ? null : { at: at(9), place: place + (index === 8 || index === 9 ? 14 : 0) },
    best: place === null ? null : { at: READ_AT, place },
    prev: place,
    linkedBy: index === 12 ? ["chatgpt"] : [],
    aiReads: index >= 3 ? index : 0,
    variants: [],
    reached: {
      found: at(3),
      ...(shown ? { showing: at(9) } : {}),
      ...(index >= 3 ? { readByAi: at(4) } : {}),
      ...(index === 12 ? { linkedByAi: at(12) } : {}),
    },
    google: shown ? { indexed: true, lastCrawl: at(3), impressions: (index - 5) * 9, clicks: index === 16 ? 3 : 0, bestPlace: place, bestQuery: null } : null,
    bing: null,
  };
}

export const FIXTURE_PUBLISHED: readonly PublishedPage[] = Object.freeze(
  TITLES.map((title, index) => ({
    id: `fixture-published-${index + 1}`,
    title,
    url: `https://content.example.com/p/${index + 1}`,
    publishedAt: new Date(LAST - index * 2 * 86_400_000),
    ladder: ladderAt(index),
    reading: readingAt(index),
    wordpress: false,
  }))
);
