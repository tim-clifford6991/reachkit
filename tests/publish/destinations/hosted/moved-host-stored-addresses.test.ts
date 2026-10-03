// tests/publish/destinations/hosted/moved-host-stored-addresses.test.ts — issue 1182.
//
// SPEC §7 (2026-09-18, issue 888): "a hosted page follows its site's host …
// never the one stored when it was published."
//
// `moved-host-readers.test.ts` reads that law back at the calendar, the
// verdicts and the cross-links. The dogfood audit of 2026-10-02 found the
// readers it did not reach: a refresh whose target was copied off a page
// before the host moved could never be delivered — the destination refuses
// an address that is not on its host — and the pages a new page links to,
// the pages a tracked question is asked about, the export and the pages
// named as still live were all still named at the dead host.
//
// As there, the move is the test: every row is seeded at the old host, one
// column changes, and the same reads are taken again.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { opportunityStore } = await import("@/lib/opportunities/store");
const { canUpdateFrom } = await import("@/lib/opportunities/readiness");
const { hostedOwnPagesOfSite } = await import("@/lib/publish/destinations/hosted/store");
const { readOurPages } = await import("@/lib/known-content/store");
const { pageQuestionCandidates } = await import("@/lib/scan/page-questions");
const { supabaseExportStore } = await import("@/lib/account/export/store");
const { supabaseLifecycleStore } = await import("@/lib/account/lifecycle/store");

const SITE = "s1";
const OLD_HOST = "reachkit-hosted-test.example.net";
const NEW_HOST = "content.example.com";
const SLUG = "how-long-does-a-roof-last";
const OLD_ADDRESS = `https://${OLD_HOST}/${SLUG}`;
const NEW_ADDRESS = `https://${NEW_HOST}/${SLUG}`;
/** The customer's own pages. Never recomposed. */
const WORDPRESS_ADDRESS = "https://example.com/blog/what-a-new-roof-costs";
const THEIR_PAGE = "https://example.com/pricing";

const PUBLISHED_AT = new Date(Date.UTC(2026, 8, 15, 9, 0, 0)).toISOString();

function opportunity(a: { id: string; family: string; type: string; targetRef: string }): Row {
  return {
    id: a.id,
    site_id: SITE,
    scan_id: "sc1",
    type: a.type,
    family: a.family,
    target_query: "how long does a roof last",
    target_ref: a.targetRef,
    proposed_slug: null,
    title: null,
    volume: 40,
    evidence: {
      family: a.family,
      query: "how long does a roof last",
      pageUrl: a.targetRef,
      shortfall: { kind: "covered", page: { url: a.targetRef, title: "A page", source: "reachkit" } },
    },
    acceptance: { form: "top20", query: "how long does a roof last" },
    fit_band: null,
    effort: 1,
    status: "queued",
    cluster_key: null,
    absorbed_queries: [],
    ready: true,
    unready_reason: null,
    rest_until: null,
    created_at: PUBLISHED_AT,
  };
}

function publication(a: { id: string; draftId: string; destination: string; liveUrl: string }): Row {
  return {
    id: a.id,
    draft_id: a.draftId,
    site_id: SITE,
    destination: a.destination,
    mode: "autopilot",
    live_url: a.liveUrl,
    published_at: PUBLISHED_AT,
    unpublished_at: null,
  };
}

beforeEach(() => {
  db.reset();
  db.seed("sites", [{ id: SITE, domain: "example.com" }]);
  db.seed("destinations", [
    { id: "dest1", site_id: SITE, kind: "hosted", hostname: OLD_HOST, deleted_at: null },
  ]);
  db.seed("opportunities", [
    { id: "o1", target_query: "how long does a roof last", acceptance: null },
    { id: "o2", target_query: "what a new roof costs", acceptance: null },
    opportunity({ id: "refresh", family: "improve", type: "refresh_page", targetRef: OLD_ADDRESS }),
    opportunity({ id: "theirs", family: "improve", type: "refresh_page", targetRef: THEIR_PAGE }),
  ]);
  db.seed("drafts", [
    { id: "d1", site_id: SITE, state: "published", opportunity_id: "o1", title: "How long does a roof last?", body_md: "x", meta: {} },
    { id: "d2", site_id: SITE, state: "published", opportunity_id: "o2", title: "What a new roof costs", body_md: "x", meta: {} },
  ]);
  db.seed("publications", [
    publication({ id: "p1", draftId: "d1", destination: "hosted", liveUrl: OLD_ADDRESS }),
    publication({ id: "p2", draftId: "d2", destination: "wordpress", liveUrl: WORDPRESS_ADDRESS }),
  ]);
});

function moveTheHost(): void {
  (db.rows("destinations")[0] as Row).hostname = NEW_HOST;
}

/** Whether the site's destination can deliver the refresh as it is read. */
async function refreshIsDeliverable(): Promise<boolean> {
  const row = await opportunityStore().byId("refresh");
  const canUpdate = canUpdateFrom(await hostedOwnPagesOfSite(SITE));
  return row !== null && canUpdate(row.target_ref);
}

describe("a refresh derived before its page's host moved", () => {
  it("is deliverable before the move", async () => {
    expect(await refreshIsDeliverable()).toBe(true);
  });

  it("is still deliverable after it, at the page's new address", async () => {
    moveTheHost();

    expect(await refreshIsDeliverable()).toBe(true);
    const row = await opportunityStore().byId("refresh");
    expect(row?.target_ref).toBe(NEW_ADDRESS);
    expect(JSON.stringify(row?.evidence)).not.toContain(OLD_HOST);
  });

  it("an update of the customer's own page keeps the address it was given", async () => {
    moveTheHost();

    expect((await opportunityStore().byId("theirs"))?.target_ref).toBe(THEIR_PAGE);
  });
});

describe("every other reader of a stored address", () => {
  it("names the page at the new host, and a WordPress page where it was stored", async () => {
    moveTheHost();

    const known = (await readOurPages(SITE)).map((page) => page.url);
    const tracked = (await pageQuestionCandidates({ siteId: SITE, ownRankedRows: [] })).map(
      (candidate) => candidate.liveUrl
    );
    const exported = await supabaseExportStore().publications(SITE);
    const stillLive = await supabaseLifecycleStore().livePublications(SITE);

    const expected = [NEW_ADDRESS, WORDPRESS_ADDRESS].sort();
    expect(known.sort()).toEqual(expected);
    expect(tracked.sort()).toEqual(expected);
    expect(exported.ok && exported.publications.map((row) => row.live_url).sort()).toEqual(expected);
    expect(stillLive.ok && stillLive.publications.map((row) => row.live_url).sort()).toEqual(expected);
  });
});
