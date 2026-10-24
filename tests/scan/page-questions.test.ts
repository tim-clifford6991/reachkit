// tests/scan/page-questions.test.ts — SPEC §6 (2026-09-20, #908 · #919),
// the two reads behind the page questions.
//
// The arithmetic they answer is pure and tested with no database
// (`tests/market/questions/tracked.test.ts`); this suite is about the reads
// themselves: which live pages are candidates, what question each carries,
// how the misses are counted out of the stored weeks, and what happens when
// the database will not answer.
//
// The mutations it exists to kill:
//
//  - composing a question instead of reading the opportunity's own;
//  - counting a page that was taken down, or one on another site;
//  - counting a week that did not ask a page as a week it went unmentioned
//    — which would retire a question for the pass's own failure;
//  - a failed read retiring anything, which is permanent.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PAGE_QUESTION_RETIRE_WEEKS } from "../../src/lib/config/constants";
import "../generate/env";

interface Query {
  table: string;
  filters: [string, unknown][];
}

/** What the next read of each table answers with, and every query it was
 *  asked. A PostgREST-shaped double, thenable, that never reaches a
 *  network. */
const db = {
  queries: [] as Query[],
  answer: null as ((query: Query) => { data: unknown[] | null; error: { message: string } | null }) | null,
  client: {
    from(table: string) {
      const query: Query = { table, filters: [] };
      db.queries.push(query);
      const self = {
        select: () => self,
        eq: (column: string, value: unknown) => (query.filters.push([column, value]), self),
        not: (column: string, _operator: string, value: unknown) => (query.filters.push([column, value]), self),
        order: () => self,
        limit: () => self,
        then: (resolve: (value: { data: unknown[] | null; error: unknown }) => unknown) =>
          Promise.resolve(db.answer?.(query) ?? { data: [], error: null }).then(resolve),
      };
      return self;
    },
  },
};

vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { pageQuestionCandidates, pageQuestionMisses } = await import("../../src/lib/scan/page-questions");

const SITE_ID = "55555555-5555-4555-8555-555555555555";
const DOMAIN = "example.com";
/** A rival's domain that carries none of the site's own brand token.
 *  `classifyReferences` reads a *mention* as the brand token — the first
 *  label of the site's domain, "example" — appearing whole in a reference,
 *  so "rival.example.net" is a mention of this site and would make every
 *  week below a week the site was named. */
const RIVAL = "othersite.net";

function publication(a: {
  n: number;
  search?: string | null;
  acceptance?: unknown;
  unpublishedAt?: string | null;
  liveUrl?: string | null;
}): Record<string, unknown> {
  return {
    id: `pub-${a.n}`,
    live_url: a.liveUrl === undefined ? `https://content.example.com/page-${a.n}` : a.liveUrl,
    unpublished_at: a.unpublishedAt ?? null,
    drafts: {
      opportunities:
        a.search === null
          ? null
          : { target_query: a.search ?? `search ${a.n}`, acceptance: a.acceptance ?? null },
    },
  };
}

beforeEach(() => {
  db.queries.length = 0;
  db.answer = null;
});

describe("the candidates — §9's live pages, each with its own question", () => {
  it("reads the opportunity's asked-as question where its acceptance test names one", async () => {
    db.answer = () => ({
      data: [publication({ n: 1, acceptance: { form: "named_on", question: "Which CRM keeps contact history?" } })],
      error: null,
    });
    const [candidate] = await pageQuestionCandidates({ siteId: SITE_ID, ownRankedRows: [] });
    expect(candidate?.question).toBe("Which CRM keeps contact history?");
    expect(candidate?.publicationId).toBe("pub-1");
    expect(candidate?.liveUrl).toBe("https://content.example.com/page-1");
  });

  it("falls back to the search's own template question, never to one composed here", async () => {
    db.answer = () => ({
      data: [publication({ n: 2, search: "best crm for small teams", acceptance: { form: "top20", query: "x" } })],
      error: null,
    });
    const [candidate] = await pageQuestionCandidates({ siteId: SITE_ID, ownRankedRows: [] });
    // `templateQuestion`'s own deterministic shape — code, not a sentence
    // this file speaks, and the same form the calendar states for the page.
    expect(candidate?.question).toContain("best crm for small teams");
    expect(candidate?.question.endsWith("?")).toBe(true);
  });

  it("carries the place each target search holds, from the rows the pass already bought", async () => {
    db.answer = () => ({
      data: [publication({ n: 1 }), publication({ n: 2 }), publication({ n: 3 })],
      error: null,
    });
    const candidates = await pageQuestionCandidates({
      siteId: SITE_ID,
      ownRankedRows: [
        { keyword: "search 1", position: 31, searchVolume: 10, url: "u" },
        { keyword: "SEARCH 3", position: 4, searchVolume: 10, url: "u" },
        // The same search twice: the best place is the one that orders it.
        { keyword: "search 3", position: 9, searchVolume: 10, url: "u" },
      ],
    });
    // The place, not the order: which pages are asked, and in what order,
    // is `trackedQuestions`' one rule and is tested with no database.
    const places = new Map(candidates.map((c) => [c.publicationId, c.position]));
    // The same search twice keeps the better place.
    expect(places.get("pub-3")).toBe(4);
    expect(places.get("pub-1")).toBe(31);
    // A page whose search the rows do not hold ranks nowhere we can see —
    // `null`, never a zero and never a position invented for it.
    expect(places.get("pub-2")).toBeNull();
  });

  it("reads where the page was last seen and whether AI linked it from its stored reading, and when it went live", async () => {
    const reading = { at: "2026-10-12T04:00:00.000Z", place: { value: 17, source: "serp", query: "search 1" }, first: { at: "2026-10-05T04:00:00.000Z", place: 40 }, linkedBy: ["chatgpt"] };
    db.answer = () => ({
      data: [
        { ...publication({ n: 1 }), published_at: "2026-09-28T09:00:00.000Z", search_reading: reading },
        { ...publication({ n: 2 }), published_at: "2026-10-14T09:00:00.000Z", search_reading: null },
      ],
      error: null,
    });
    const candidates = await pageQuestionCandidates({
      siteId: SITE_ID,
      // The stored reading wins over the keyword database's older place.
      ownRankedRows: [{ keyword: "search 1", position: 31, searchVolume: 10, url: "u" }],
    });
    const byId = new Map(candidates.map((c) => [c.publicationId, c]));
    expect(byId.get("pub-1")).toMatchObject({ position: 17, linked: true, publishedAt: "2026-09-28T09:00:00.000Z" });
    expect(byId.get("pub-2")).toMatchObject({ position: null, linked: false, publishedAt: "2026-10-14T09:00:00.000Z" });
  });

  it("leaves out a page that was taken down, one with no address, and one with no target", async () => {
    db.answer = () => ({
      data: [
        publication({ n: 1, unpublishedAt: "2026-09-01T00:00:00.000Z" }),
        publication({ n: 2, liveUrl: null }),
        publication({ n: 3, search: null }),
        publication({ n: 4, search: "   " }),
        publication({ n: 5 }),
      ],
      error: null,
    });
    const candidates = await pageQuestionCandidates({ siteId: SITE_ID, ownRankedRows: [] });
    expect(candidates.map((c) => c.publicationId)).toEqual(["pub-5"]);
  });

  it("asks once per search, however many pages the site has on it", async () => {
    db.answer = () => ({
      data: [publication({ n: 1, search: "one search" }), publication({ n: 2, search: "One Search " })],
      error: null,
    });
    const candidates = await pageQuestionCandidates({ siteId: SITE_ID, ownRankedRows: [] });
    expect(candidates).toHaveLength(1);
  });

  it("asks only about this site, and only about pages that went live", async () => {
    db.answer = () => ({ data: [], error: null });
    await pageQuestionCandidates({ siteId: SITE_ID, ownRankedRows: [] });
    const query = db.queries.at(-1);
    expect(query?.table).toBe("publications");
    expect(query?.filters).toContainEqual(["site_id", SITE_ID]);
    expect(query?.filters).toContainEqual(["published_at", null]);
  });

  it("answers nothing where the read failed — a measurement is never taken down by it", async () => {
    db.answer = () => ({ data: null, error: { message: "connection refused" } });
    await expect(pageQuestionCandidates({ siteId: SITE_ID, ownRankedRows: [] })).resolves.toEqual([]);
  });
});

/** One stored week, as the history read hands it back. */
function week(a: { asked: readonly string[]; named: readonly string[]; unread?: readonly string[] }) {
  return {
    week_start: "2026-08-31",
    report: {
      version: 11,
      pageQuestions: {
        measuredAt: "2026-08-31T06:00:00.000Z",
        ownDomain: DOMAIN,
        tracked: 12 + a.asked.length,
        cap: 24,
        retired: [],
        rows: [...a.asked, ...(a.unread ?? [])].map((id) => ({
          publicationId: id,
          liveUrl: `https://content.example.com/${id}`,
          question: { n: 13, wording: { source: "model", text: "Is it?" }, search: `search ${id}` },
          cell: { kind: "no_answer" },
          engines: [
            {
              engine: "ai_overview",
              cell: (a.unread ?? []).includes(id)
                ? { kind: "unmeasured", reason: "not_attempted" }
                : a.named.includes(id)
                  ? { kind: "answered", citedDomains: [DOMAIN], namesCustomer: true }
                  : { kind: "answered", citedDomains: [RIVAL], namesCustomer: false },
            },
          ],
        })),
      },
    },
  };
}

describe("the misses — the run of weeks that asked and heard nothing", () => {
  it("counts a run, and a mention resets it", async () => {
    db.answer = () => ({
      data: [
        week({ asked: ["pub-1", "pub-2"], named: [] }),
        week({ asked: ["pub-1", "pub-2"], named: [] }),
        week({ asked: ["pub-1", "pub-2"], named: ["pub-1"] }),
        week({ asked: ["pub-1", "pub-2"], named: [] }),
      ],
      error: null,
    });
    const misses = await pageQuestionMisses(SITE_ID);
    expect(misses.get("pub-1")).toBe(2);
    expect(misses.get("pub-2")).toBe(4);
  });

  it("does not count a week that could not read a page's answer at all", async () => {
    db.answer = () => ({
      data: [week({ asked: ["pub-1"], named: [], unread: ["pub-2"] }), week({ asked: ["pub-1"], named: [], unread: ["pub-2"] })],
      error: null,
    });
    const misses = await pageQuestionMisses(SITE_ID);
    expect(misses.get("pub-1")).toBe(2);
    expect(misses.get("pub-2")).toBeUndefined();
  });

  it("reads the window the rule is stated over — this site's weekly reports", async () => {
    db.answer = () => ({ data: [], error: null });
    await pageQuestionMisses(SITE_ID);
    const query = db.queries.at(-1);
    expect(query?.table).toBe("scans");
    expect(query?.filters).toContainEqual(["site_id", SITE_ID]);
    expect(query?.filters).toContainEqual(["tier", "weekly"]);
    expect(PAGE_QUESTION_RETIRE_WEEKS).toBe(8);
  });

  it("counts nothing from a week that stored no page questions, or a blob it cannot read", async () => {
    db.answer = () => ({
      data: [
        { week_start: "2026-08-24", report: { version: 11, pageQuestions: null } },
        { week_start: "2026-08-17", report: { version: 2 } },
        { week_start: "2026-08-10", report: null },
        week({ asked: ["pub-1"], named: [] }),
      ],
      error: null,
    });
    const misses = await pageQuestionMisses(SITE_ID);
    expect(misses.get("pub-1")).toBe(1);
  });

  it("counts nothing where the read failed — a lost slot is permanent, a kept one costs 0.24¢", async () => {
    db.answer = () => ({ data: null, error: { message: "connection refused" } });
    expect((await pageQuestionMisses(SITE_ID)).size).toBe(0);
  });
});
