/** @vitest-environment jsdom */
// A list of hosted pages is read without their bodies: the index, the sitemap, the feed and ReachKit's own footer list
// only titles, dates and addresses, so only one article, or a search, reads a body. The selects are the ones the real
// store sends, recorded by the publish harness at the route boundary.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";
import { fakeDb } from "../../publish/harness";

applyEnvFixture();

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/account/billing", () => ({ hostedServingState: async () => ({ serve: true }) }));

const host = { name: "content.example.com" };
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: host.name }) }));

const cachedUnder: string[] = [];
const cleared: string[] = [];
vi.mock("next/cache", () => ({
  unstable_cache:
    <T>(read: () => Promise<T>, _keys: string[], options: { tags?: string[] }) =>
    () => {
      cachedUnder.push(...(options.tags ?? []));
      return read();
    },
  revalidateTag: (tag: string) => {
    cleared.push(tag);
  },
}));

const { livePagesForSite, hostedOwnPagesOfSite, invalidateHosted, tags } = await import("@/lib/publish/destinations/hosted");
const IndexRoute = (await import("@/app/(hosted)/hosted-page/[[...slug]]/page")).default;
const article = await import("@/app/(hosted)/hosted-article/[slug]/route");
const sitemap = await import("@/app/(hosted)/sitemap.xml/route");
const rss = await import("@/app/(hosted)/hosted-page/rss.xml/route");
const { readOwnArticles } = await import("@/app/(public)/_chrome/own-articles");

/** A select that would download a page's text: its body, its grounded fact, or its whole meta. */
const carriesText = (columns: string): boolean => /body_md|grounded_fact|\bmeta\b(?!->)/.test(columns);

function selects(): { table: string; columns: string; filters: { op: string; column: string; value: unknown }[] }[] {
  return db.queries
    .filter((query) => query.verb === "select")
    .map((query) => ({ table: query.table, columns: query.columns ?? "", filters: query.filters }));
}

const textSelects = () => selects().filter((query) => carriesText(query.columns));

function seed(domain: string): void {
  db.seed("sites", [{ id: "site-1", domain }]);
  db.seed("destinations", [{ id: "dest-1", site_id: "site-1", kind: "hosted", hostname: null, deleted_at: null }]);
  db.seed("scans", [{ id: "scan-1", created_at: "2026-08-28T00:00:00.000Z" }]);
  db.seed("opportunities", [
    { id: "opp-1", scan_id: "scan-1", target_query: "best onboarding tools" },
    { id: "opp-2", scan_id: "scan-1", target_query: "onboarding pricing" },
  ]);
  const draft = (id: string, opportunity: string, title: string, body: string) => ({
    id,
    site_id: "site-1",
    opportunity_id: opportunity,
    title,
    body_md: body,
    attribution: null,
    meta: { description: `${title}, in one line.`, heading: title, faq: [{ question: "Q?", answer: "A." }] },
    grounded_fact: null,
  });
  db.seed("drafts", [
    draft("draft-1", "opp-1", "The best onboarding tools", "Time to the first flow."),
    draft("draft-2", "opp-2", "How onboarding is priced", "Seats and tiers decide it."),
  ]);
  const publication = (id: string, draftId: string, slug: string, at: string) => ({
    id,
    draft_id: draftId,
    site_id: "site-1",
    destination: "hosted",
    live_url: `https://content.${domain}/${slug}`,
    published_at: at,
    unpublished_at: null,
    mode: "autopilot",
  });
  db.seed("publications", [
    publication("pub-1", "draft-1", "onboarding-tools", "2026-09-02T09:00:00.000Z"),
    publication("pub-2", "draft-2", "pricing-guide", "2026-09-01T09:00:00.000Z"),
  ]);
}

async function index(q?: string): Promise<string> {
  const tree = await IndexRoute({ params: Promise.resolve({}), searchParams: Promise.resolve(q === undefined ? {} : { q }) });
  return renderToStaticMarkup(tree);
}

beforeEach(() => {
  db.reset();
  seed("example.com");
  host.name = "content.example.com";
  cachedUnder.length = 0;
  cleared.length = 0;
});

describe("the list read carries no body", () => {
  it("the store's list and the own pages a refresh may update select no body, grounded fact or whole meta", async () => {
    const pages = await livePagesForSite("site-1", "content.example.com");
    expect(pages.map((page) => [page.slug, page.description])).toEqual([
      ["onboarding-tools", "The best onboarding tools, in one line."],
      ["pricing-guide", "How onboarding is priced, in one line."],
    ]);
    expect(pages.every((page) => !("bodyMd" in page))).toBe(true);
    expect(await hostedOwnPagesOfSite("site-1")).toEqual({ host: "content.example.com", slugs: ["onboarding-tools", "pricing-guide"] });
    expect(selects().some((query) => query.table === "publications")).toBe(true);
    expect(textSelects()).toEqual([]);
  });

  it("the index without a search, the sitemap and the feed list every page and read no body", async () => {
    const html = await index();
    expect(html).toContain("The best onboarding tools");
    expect(html).toContain("How onboarding is priced");
    const request = new Request("https://content.example.com/", { headers: { host: "content.example.com" } });
    expect(await (await sitemap.GET(request)).text()).toContain("https://content.example.com/pricing-guide");
    expect(await (await rss.GET(request)).text()).toContain("How onboarding is priced");
    expect(textSelects()).toEqual([]);
  });

  it("ReachKit's own articles, for the footer and landing, are read with no body", async () => {
    db.reset();
    seed("reachkit.app");
    const own = await readOwnArticles();
    expect(own?.latest.map((entry) => entry.title)).toEqual(["The best onboarding tools", "How onboarding is priced"]);
    expect(textSelects()).toEqual([]);
  });
});

describe("one article reads one body", () => {
  it("the article sends exactly one select with a body, filtered to its own publication", async () => {
    const response = await article.GET(new Request("https://content.example.com/pricing-guide", { headers: { host: "content.example.com" } }), {
      params: Promise.resolve({ slug: "pricing-guide" }),
    });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Seats and tiers decide it.");
    const bodies = textSelects();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.table).toBe("publications");
    expect(bodies[0]?.filters).toEqual([{ op: "eq", column: "id", value: "pub-2" }]);
  });
});

describe("the hosted index reads bodies only for a search", () => {
  it("a search reads the bodies it matches on; no search reads none", async () => {
    await index();
    expect(textSelects()).toEqual([]);
    const html = await index("tiers");
    expect(html).toContain("How onboarding is priced");
    expect(html).not.toContain('href="/onboarding-tools"');
    expect(textSelects().map((query) => query.table)).toEqual(["publications"]);
  });
});

describe("the footer read is cached and cleared on publish", () => {
  it("is cached under the own-articles tag, which every publish and takedown clears, and keeps its dates", async () => {
    db.reset();
    seed("reachkit.app");
    const own = await readOwnArticles();
    expect(cachedUnder).toContain(tags.ownArticles);
    expect(own?.latest[0]?.published).toBeInstanceOf(Date);
    invalidateHosted({ siteId: "site-9" });
    invalidateHosted({ siteId: "site-9", publicationId: "pub-9" });
    expect(cleared.filter((tag) => tag === tags.ownArticles)).toHaveLength(2);
  });
});
