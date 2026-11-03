// The reserved fixture account's published pages: seventeen, the newest ten
// on the days Plan's fixture month shows live and the rest over July and
// August, so the Content tile has a total, a last-four-weeks count below it
// and a newest, and every label a live page can wear is drawn.
import type { Ladder } from "@/lib/measure/ladder";
import type { PageReading } from "@/lib/measure/page-reading";
import type { PublishedPage } from "@/lib/measure/published";

/** Plan's fixture today (`calendar/fixture.ts` reads it from here), so both
 *  screens judge the same pages on the same day. */
export const CONTENT_FIXTURE_NOW = new Date(Date.UTC(2026, 8, 15, 14, 0, 0));

/** Each page, newest first: the day it went live, its title, and the one
 *  of `search-fixture.ts`'s live searches it is read on. Written out: that
 *  fixture's module graph reaches the market's, and Overview's does not. */
const PAGES: readonly (readonly [day: string, title: string, search: string])[] = [
  ["2026-09-14", "How to choose a CRM for a small team", "best crm for small teams"],
  ["2026-09-11", "Cleaning a contact list before you switch", "crm contact deduplication"],
  ["2026-09-09", "A first CRM for a two-person business", "crm for a two person business"],
  ["2026-09-07", "What a CRM really costs per user", "how much does a crm cost per user"],
  ["2026-09-06", "Unlimited contacts on a free CRM: the catch", "free crm with unlimited contacts"],
  ["2026-09-05", "Working from Gmail with a CRM beside it", "crm that works with gmail"],
  ["2026-09-04", "Setting up a sales pipeline in an afternoon", "what is a sales pipeline"],
  ["2026-09-03", "How to import contacts without duplicates", "crm data import mistakes"],
  ["2026-09-02", "Signs you have outgrown your spreadsheet", "crm vs spreadsheet"],
  ["2026-09-01", "What to put in a CRM onboarding checklist", "crm onboarding checklist"],
  ["2026-08-26", "A CRM for consultants who bill by the hour", "best crm for consultants"],
  ["2026-08-19", "Moving customers off a spreadsheet in a weekend", "how to move customers off a spreadsheet"],
  ["2026-08-12", "A simple CRM for plumbers and electricians", "simple crm for tradespeople"],
  ["2026-08-05", "What a CRM does for a five-person team", "do i really need a crm"],
  ["2026-07-29", "Spreadsheet to CRM: a migration plan", "spreadsheet to crm migration"],
  ["2026-07-15", "Client records for a small accountancy practice", "crm for a small accountancy practice"],
  ["2026-07-08", "What small teams pay for a CRM", "crm pricing comparison"],
];

const DAY_MS = 86_400_000;

/** The weekly pass every reading below is from: the Monday before today. */
const READ_AT = "2026-09-14T06:00:00.000Z";

/** The page whose best place is from a pass eight weeks back, so it is not moving. */
const STALLED = 15;
const STALLED_BEST_AT = "2026-07-20T06:00:00.000Z";

/** The older a page, the further it has got. The newest is not read yet;
 *  Search Console has shown the oldest ones. */
function ladderAt(index: number): Ladder {
  const shown = index >= 6;
  return {
    crawled: index >= 1,
    indexed: index >= 4,
    impressions: shown ? (index - 5) * 9 : 0,
    showing: shown,
    bestPlace: shown ? 52 - index * 2 : null,
    placeSource: shown ? "serp" : null,
    cited: index === 12,
  };
}

/** The pages whose own question the weekly pass asked; `answers-fixture.ts`
 *  holds those questions, by these pages' addresses. */
export const ASKED: ReadonlySet<number> = new Set([2, 10, 11, 12]);

/** The weekly reading behind that ladder; the newest page went live after the pass. */
function readingAt(index: number, publishedAt: Date, search: string): PageReading | null {
  if (index < 1) return null;
  const shown = index >= 6;
  const place = shown ? 52 - index * 2 : null;
  const at = (days: number): string => new Date(publishedAt.getTime() + days * DAY_MS).toISOString();
  const bestAt = index === STALLED ? STALLED_BEST_AT : READ_AT;
  return {
    at: READ_AT,
    crawled: true,
    place: place === null ? null : { value: place, source: "serp", query: search },
    // Two pages rose fourteen places since first seen, so they are climbing.
    first: place === null ? null : { at: index === STALLED ? bestAt : at(9), place: place + (index === 8 || index === 9 ? 14 : 0) },
    best: place === null ? null : { at: bestAt, place },
    // One page moved up this week: the best mover.
    prev: place === null ? null : place + (index === 8 ? 9 : 0),
    linkedBy: index === 12 ? ["chatgpt"] : ASKED.has(index) ? [] : null,
    aiReads: index >= 3 ? index : 0,
    variants: [],
    reached: {
      found: at(2),
      ...(shown ? { showing: at(9) } : {}),
      ...(index >= 3 ? { readByAi: at(4) } : {}),
      ...(index === 12 ? { linkedByAi: at(12) } : {}),
      ...(index === 11 ? { aiVisit: at(11) } : {}),
    },
    google: shown ? { indexed: true, lastCrawl: at(3), impressions: (index - 5) * 9, clicks: index === 16 ? 3 : 0, bestPlace: place, bestQuery: null } : null,
    bing: null,
  };
}

export const FIXTURE_PUBLISHED: readonly PublishedPage[] = Object.freeze(
  PAGES.map(([day, title, search], index) => {
    // 13:00 UTC, the hour Plan's fixture pages go live.
    const publishedAt = new Date(`${day}T13:00:00.000Z`);
    return {
      id: `fixture-published-${index + 1}`,
      title,
      // The address Plan's fixture gives the page live on that day.
      url: `https://content.example.com/${day}`,
      publishedAt,
      ladder: ladderAt(index),
      reading: readingAt(index, publishedAt, search),
      // The draft fixture's published page, so each title opens a page screen as a real row's does.
      draftId: "draft-2026-09-14",
      wordpress: false,
    };
  })
);
