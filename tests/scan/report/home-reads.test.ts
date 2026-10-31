// The re-score asks the database for the home reads it scores with, not a
// domain's whole history, and scores every stored scan as the history would.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderedDocumentOf } from "../../../src/lib/measure/own-fetch";
import { homeReadsFor, type HomeReadRow, type StoredRead } from "../../../src/lib/scan/home-reads";
import { rescoreStored, type RescoreStore } from "../../../src/lib/scan/rescore-run";

interface FixtureScan {
  id: string;
  createdAt: string;
  status: "done";
  score: number | null;
  drivers: unknown;
  report: Record<string, unknown> & { domain: string };
  home: { created_at: string; payload: Record<string, unknown> };
}

const gusto = (JSON.parse(readFileSync(new URL("./fixtures/rescore/gusto.com.json", import.meta.url), "utf8")) as { scans: FixtureScan[] }).scans[0]!;

const plain = (created_at: string, readAt: string): StoredRead => ({
  source: "egress.safeFetch",
  created_at,
  payload: { ...gusto.home.payload, readAt },
});
const drawn = [{ url: "https://gusto.com/", status: 200, bytes: 120, readAt: "2026-10-08T13:53:00Z", html: "<html><head><title>Gusto</title></head><body><h1>Payroll, benefits and HR for small businesses</h1></body></html>" }];
const rendered = (created_at: string, payload: unknown): StoredRead => ({ source: "on_page/instant_pages", created_at, payload });

/** gusto.com's whole home history: its stored read, an older and a later one,
 *  a failed render before and after it, the render that drew the site, and
 *  one after that. */
const history = {
  older: plain("2026-10-01T09:00:00Z", "2026-10-01T09:00:00Z"),
  home: { source: "egress.safeFetch", ...gusto.home },
  later: plain("2026-10-20T09:00:00Z", "2026-10-20T09:00:00Z"),
  failedBefore: rendered("2026-10-07T09:00:00Z", []),
  failedAfter: rendered("2026-10-08T13:52:30Z", []),
  drew: rendered("2026-10-08T13:53:00Z", drawn),
  afterDrew: rendered("2026-10-09T09:00:00Z", drawn),
} satisfies Record<string, StoredRead>;

const rowsOf = (reads: Record<string, StoredRead>): HomeReadRow[] =>
  Object.entries(reads).map(([id, r]) => ({ id, source: r.source, created_at: r.created_at, read_at: (r.payload as { readAt?: unknown }).readAt }));

function loader(reads: Record<string, StoredRead>) {
  const asked: string[] = [];
  const load = async (ids: readonly string[]) => {
    asked.push(...ids);
    return ids.map((id) => reads[id]!);
  };
  return { asked, load };
}

const onPageAt = Date.parse((gusto.report.onPage as { at: string }).at);

describe("the home reads the re-score asks for", () => {
  it("is the report's home read, then the renders after it up to the first that drew the site", async () => {
    expect(renderedDocumentOf(drawn)).not.toBeNull();
    const { asked, load } = loader(history);
    const reads = await homeReadsFor(rowsOf(history), [onPageAt, onPageAt], load);
    expect(asked).toEqual(["home", "failedAfter", "drew"]);
    expect(reads).toEqual([history.home, history.failedAfter, history.drew]);
  });

  it("is one render where none follows the home read, and nothing where no home read precedes the report", async () => {
    const { older, home, later, failedBefore } = history;
    const before = { older, home, later, failedBefore };
    const one = loader(before);
    await homeReadsFor(rowsOf(before), [onPageAt], one.load);
    expect(one.asked).toEqual(["home", "failedBefore"]);
    const none = loader(before);
    await expect(homeReadsFor(rowsOf(before), [Date.parse("2026-09-01T00:00:00Z")], none.load)).resolves.toEqual([]);
    expect(none.asked).toEqual([]);
  });

  it("scores every stored scan as the whole history does, where a render drew the site and where none did", async () => {
    const scored: unknown[] = [];
    const histories: Record<string, StoredRead>[] = [history, { home: history.home, failedBefore: history.failedBefore, later: history.later }];
    for (const reads of histories) {
      const storeOf = (homeReads: RescoreStore["homeReads"]): RescoreStore => ({
        scans: async () => [{ ...gusto, domain: gusto.report.domain, md5: "m", report: structuredClone(gusto.report), siteId: null, isCurrent: false }],
        homeReads,
        ownReads: async () => ({ own: [], ours: [], oursReads: [] }),
        sites: async () => [],
        profiles: async () => [],
        answers: async () => [],
        writeScan: async () => true,
        writeSite: async () => undefined,
        writeProfileName: async () => true,
      });
      const o = { apply: false, version: "abc1234", at: new Date("2026-10-26T12:00:00Z") };
      const whole = await rescoreStored(storeOf(async () => Object.values(reads)), o);
      const asked = await rescoreStored(storeOf(async (_, at) => homeReadsFor(rowsOf(reads), at!, loader(reads).load)), o);
      expect(asked).toEqual(whole);
      scored.push(whole.scoreMoves);
    }
    expect(scored[0]).not.toEqual(scored[1]);
  });
});
