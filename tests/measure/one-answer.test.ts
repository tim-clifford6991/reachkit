// One answer everywhere: a page at #7 on its own Google result and absent
// from the keyword database is on the first page in the Overview's Google
// tile, on the page's ladder and in its verdict, which the Monday mail's
// top-twenty number counts. A SaaS page and a local plumber's, each through
// the weekly step, the stored reading and the verdict over the same rows.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../publish/harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { readSearchEngines } from "@/lib/publish/destinations/hosted/search-engines";
import { readLadders } from "@/lib/publish/reads/store";
import { readingOf } from "@/lib/measure/page-reading";
import { judgeWeek } from "@/lib/opportunities/verdicts/judge";
import { livePlaces, type LivePageRow } from "@/app/(account)/app/_overview/search-store";
import { assembleSearch } from "@/app/(account)/app/_overview/search-model";
import { googlePagesOf } from "@/app/(account)/app/_overview/google-pages";
import { measured, unmeasured } from "@/lib/measure/measured";
import { LOCAL, SAAS, stored, weekWith } from "./reading-fixture";

const WEEK = "2026-10-19";
const NOW = new Date(Date.UTC(2026, 9, 19, 6, 0, 0));

function seed(site: { domain: string; page: string; search: string }): void {
  db.reset();
  db.seed("sites", [{ id: "s1", domain: site.domain }]);
  db.seed("destinations", [{ id: "dest-1", site_id: "s1", kind: "hosted", hostname: site.domain, hostname_state: "live", deleted_at: null, search_verification: null }]);
  db.seed("opportunities", [{ id: "opp-1", site_id: "s1", target_query: site.search, acceptance: { form: "top20", query: site.search }, volume: 90, family: "write", target_ref: "page" }]);
  db.seed("drafts", [{ id: "d-1", site_id: "s1", opportunity_id: "opp-1", meta: {} }]);
  db.seed("publications", [
    { id: "pub-1", draft_id: "d-1", site_id: "s1", destination: "hosted", live_url: site.page, published_at: "2026-09-01T07:00:00.000Z", unpublished_at: null, announced_at: "2026-09-01T07:00:05.000Z", acceptance: { form: "top20", query: site.search }, verify: null, search_reading: null },
  ]);
  const report = weekWith({
    domain: site.domain,
    asked: [{ publicationId: "pub-1", liveUrl: site.page, search: site.search, place: 7 }],
    // The keyword database holds nothing for the page.
    ranked: [],
  });
  db.seed("scans", [{ id: "scan-1", site_id: "s1", tier: "weekly", week_start: WEEK, created_at: NOW.toISOString(), report: stored(report) }]);
}

describe.each([
  ["a SaaS page", SAAS],
  ["a local plumber's page", LOCAL],
])("%s at #7 on its own result, absent from the keyword database", (_, site) => {
  beforeEach(() => seed(site));

  it("is on the first page in the tile, the ladder and the verdict", async () => {
    await readSearchEngines({ siteId: "s1", now: NOW, deps: { accounts: [], bing: null, announce: async () => ({ ok: true, status: 202, url: "", html: "", bytes: 0, readAt: NOW, headers: {} }) } });
    const reading = readingOf(db.rows("publications")[0]?.search_reading);
    expect(reading?.place).toEqual({ value: 7, source: "serp", query: site.search });

    // The ladder.
    const [ladder] = (await readLadders("s1")) ?? [];
    expect(ladder?.ladder).toMatchObject({ bestPlace: 7, placeSource: "serp", showing: true });

    // The Overview's Google tile: the keyword database has no place for the
    // page, and the tile counts it on the first page from its reading.
    const rows: LivePageRow[] = db.rows("publications").map((row) => ({
      live_url: row.live_url as string,
      unpublished_at: null,
      search_reading: row.search_reading,
      drafts: { opportunity_id: "opp-1" },
    }));
    const places = livePlaces(rows);
    const unknown = unmeasured<number>("not_attempted", NOW);
    const search = assembleSearch(
      {
        targets: [
          {
            id: "opp-1",
            target: { search: site.search, volume: measured(90, NOW), difficulty: unknown, ceiling: unknown, winnability: unknown } as never,
            status: "live",
            rival: null,
            change: { kind: "none" },
            ...(places.has("opp-1") ? { position: places.get("opp-1") } : {}),
          },
        ],
        // What the keyword database's rows give the search: nothing.
        positions: new Map(),
        market: null,
        measuredAt: NOW,
      },
      NOW
    );
    expect(search.rows[0]?.position).toMatchObject({ kind: "measured", value: 7 });
    const pages = googlePagesOf([{ id: "pub-1", title: "t", url: null, publishedAt: new Date(0), reading }], NOW);
    expect(pages).toMatchObject({ live: 1, read: 1, showing: 1, firstPage: 1 });

    // The verdict, through the real verdict store over the same rows: the
    // place it stores is the one the mail's top-twenty number counts.
    await judgeWeek({ siteId: "s1", week: WEEK });
    const [verdict] = db.rows("page_verdicts");
    expect(verdict).toMatchObject({ publication_id: "pub-1", verdict: "working", measured: { kind: "measured", value: 7 } });
  });
});
