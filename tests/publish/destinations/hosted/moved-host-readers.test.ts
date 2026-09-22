// tests/publish/destinations/hosted/moved-host-readers.test.ts — issue 896.
//
// SPEC §7 (2026-09-18, issue 888): "a hosted page follows its site's
// host … A WordPress page is on a host this product does not own: its
// stored address is the only one there is and is never recomposed."
//
// Issue 888 made that true of the five addresses it owned — the canonical,
// the sitemap entry, §9's recorded address, the `published` mail's link and
// the address the 24-hour check fetches — and named two readers outside its
// files that still handed `publications.live_url` on: the calendar and the
// weekly verdicts. This file is the law read back at **those** two surfaces,
// and at the cross-links a new page is written with.
//
// **The move is the test, not the fixture.** Every row here is seeded once,
// at the old host, and read at both surfaces; then one column changes — the
// site's destination hostname — and the same two reads are taken again.
// A reader that hands the stored column on passes every static fixture and
// fails the second reading, which is exactly the shape of the defect: the
// founder's calendar offers **View live page** on an address that 404s, and
// the Monday verdict names a page at an address this product no longer
// serves.
//
// **The join is asserted, not assumed.** `calendar/store.ts`'s
// `readStandings` joins the month's pages to the week's verdicts *by the
// live address*. Both sides read the same column today, so they agree while
// both are wrong; a fix to one side alone would empty the join instead of
// mending it, and every live card would quietly lose its place. So the last
// row does the join the way that reader does it.
//
// Nothing is fetched: the destination is a `destinations` row and the
// composition is a string.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { pageRecordFor, scheduledPagesFor } = await import("@/lib/publish/record");
const { weeklyDigest } = await import("@/lib/opportunities");
const { generateStore } = await import("@/lib/generate/store");

const SITE = "s1";
const WEEK = "2026-09-14";
const MONTH = { from: "2026-09-01", to: "2026-09-30" };
const CLUSTER = "roof-lifetime";

const OLD_HOST = "blog.example.com";
const NEW_HOST = "pages.example.com";
const SLUG = "how-long-does-a-roof-last";

const OLD_ADDRESS = `https://${OLD_HOST}/${SLUG}`;
const NEW_ADDRESS = `https://${NEW_HOST}/${SLUG}`;
/** On the customer's own WordPress. This product owns no part of that
 *  host and never recomposes this string. */
const WORDPRESS_ADDRESS = "https://example.com/blog/what-a-new-roof-costs";

const PUBLISHED_AT = new Date(Date.UTC(2026, 8, 15, 9, 0, 0)).toISOString();
const NOW = new Date(Date.UTC(2026, 8, 18, 9, 0, 0));

const FOUND: Row = {
  outcome: "found",
  checkedAt: new Date(Date.UTC(2026, 8, 16, 9, 0, 0)).toISOString(),
  siteCondition: null,
  checks: Object.fromEntries(
    ["reachable", "indexable", "sitemap", "aiReadable"].map((id) => [
      id,
      { kind: "measured", value: true, at: PUBLISHED_AT },
    ])
  ),
};

function publication(a: { id: string; draftId: string; destination: string; liveUrl: string }): Row {
  return {
    id: a.id,
    draft_id: a.draftId,
    site_id: SITE,
    destination: a.destination,
    mode: "autopilot",
    made_live_by_us: true,
    unpublish_outcome: null,
    seo_written: null,
    acceptance: null,
    live_url: a.liveUrl,
    published_at: PUBLISHED_AT,
    unpublished_at: null,
    verify_due_at: null,
    verify: FOUND,
  };
}

function seed(): void {
  db.reset();
  db.seed("sites", [{ id: SITE, domain: "example.com" }]);
  db.seed("destinations", [
    { id: "dest1", site_id: SITE, kind: "hosted", hostname: OLD_HOST, deleted_at: null },
  ]);
  db.seed("scans", [{ id: "sc1", created_at: PUBLISHED_AT }]);
  db.seed("opportunities", [
    {
      id: "o1",
      scan_id: "sc1",
      target_query: "how long does a roof last",
      cluster_key: CLUSTER,
      acceptance: { form: "top20", query: "how long does a roof last" },
    },
    {
      id: "o2",
      scan_id: "sc1",
      target_query: "what a new roof costs",
      cluster_key: CLUSTER,
      acceptance: { form: "top20", query: "what a new roof costs" },
    },
  ]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: SITE,
      state: "published",
      opportunity_id: "o1",
      scheduled_for: "2026-09-15",
      title: "How long does a roof last?",
      veto_deadline: null,
      approved_at: null,
      transitions: [{ from: "in_review", to: "approved" }],
    },
    {
      id: "d2",
      site_id: SITE,
      state: "published",
      opportunity_id: "o2",
      scheduled_for: "2026-09-16",
      title: "What a new roof costs",
      veto_deadline: null,
      approved_at: null,
      transitions: [{ from: "in_review", to: "approved" }],
    },
  ]);
  db.seed("publications", [
    publication({ id: "p1", draftId: "d1", destination: "hosted", liveUrl: OLD_ADDRESS }),
    publication({ id: "p2", draftId: "d2", destination: "wordpress", liveUrl: WORDPRESS_ADDRESS }),
  ]);
}

/** The one column the move changes. The founder repointed their record, or
 *  the owner's test destination moved on a deploy; the pages themselves are
 *  untouched, which is the whole point. */
function moveTheHost(): void {
  const row = db.rows("destinations")[0] as Row;
  row.hostname = NEW_HOST;
}

/** What the calendar draws `View live page` on, by draft. */
async function calendarAddresses(): Promise<Map<string, string | null>> {
  const pages = await scheduledPagesFor({ siteId: SITE, ...MONTH, now: NOW });
  return new Map(pages.map((page) => [page.draftId, page.liveUrl]));
}

/** What the Monday verdicts name each page at, by publication. */
async function verdictAddresses(): Promise<Map<string, string | null>> {
  const { standings } = await weeklyDigest({ siteId: SITE, week: WEEK });
  return new Map(standings.map((standing) => [standing.publicationId, standing.liveUrl]));
}

beforeEach(seed);

describe("a hosted page's host moves under it", () => {
  it("the calendar and the weekly verdicts both show the old address before the move", async () => {
    expect((await calendarAddresses()).get("d1")).toBe(OLD_ADDRESS);
    expect((await verdictAddresses()).get("p1")).toBe(OLD_ADDRESS);
  });

  it("both show the new address after it, and the old one is offered nowhere", async () => {
    moveTheHost();

    expect((await calendarAddresses()).get("d1")).toBe(NEW_ADDRESS);
    expect((await verdictAddresses()).get("p1")).toBe(NEW_ADDRESS);

    const offered = [
      ...(await calendarAddresses()).values(),
      ...(await verdictAddresses()).values(),
    ];
    expect(offered).not.toContain(OLD_ADDRESS);
  });

  it("the page's own record says it is publicly readable at the new address", async () => {
    moveTheHost();

    const record = await pageRecordFor("d1", NOW);
    expect(record?.address).toEqual({
      offered: true,
      label: "record.address.publiclyReadableAt",
      url: NEW_ADDRESS,
    });
  });

  it("a page written afterwards cross-links to the new address", async () => {
    moveTheHost();

    const pages = await generateStore().clusterPages(SITE, CLUSTER);
    expect(pages.map((page) => page.liveUrl).sort()).toEqual(
      [NEW_ADDRESS, WORDPRESS_ADDRESS].sort()
    );
  });

  it("the join the calendar makes between the two still lands on the page", async () => {
    moveTheHost();

    // `calendar/store.ts`'s `readStandings`, in its own two steps: the
    // month's live addresses are the set, and the week's pages are looked
    // up in it.
    const wanted = new Set(
      [...(await calendarAddresses()).values()].filter((url): url is string => url !== null)
    );
    const found = [...(await verdictAddresses()).entries()].filter(
      ([, url]) => url !== null && wanted.has(url)
    );
    expect(found.map(([publicationId]) => publicationId).sort()).toEqual(["p1", "p2"]);
  });
});

describe("a WordPress page is on a host this product does not own", () => {
  it("the same move leaves its address exactly as it was stored", async () => {
    const before = [(await calendarAddresses()).get("d2"), (await verdictAddresses()).get("p2")];
    moveTheHost();
    const after = [(await calendarAddresses()).get("d2"), (await verdictAddresses()).get("p2")];

    expect(before).toEqual([WORDPRESS_ADDRESS, WORDPRESS_ADDRESS]);
    expect(after).toEqual([WORDPRESS_ADDRESS, WORDPRESS_ADDRESS]);
  });
});

describe("the host is read the two ways issue 888 composes a delivery address", () => {
  it("a site with no destination row falls to the default label over its own domain", async () => {
    db.seed("destinations", []);
    const composed = `https://content.example.com/${SLUG}`;

    expect((await calendarAddresses()).get("d1")).toBe(composed);
    expect((await verdictAddresses()).get("p1")).toBe(composed);
  });

  it("a host that cannot be read at all keeps the stored address, never a blank one", async () => {
    db.seed("destinations", []);
    db.seed("sites", [{ id: SITE, domain: "" }]);

    expect((await calendarAddresses()).get("d1")).toBe(OLD_ADDRESS);
    expect((await verdictAddresses()).get("p1")).toBe(OLD_ADDRESS);
  });
});
