// tests/hosted/indexing/search-engines.test.ts — issue 1553, the SEO
// metrics review's R2.
//
// The weekly step for one site, through the real Search Console client with
// every vendor answered by fixtures: the host is verified by the meta method
// and its sitemap submitted, each page's reading is stored, and the ladder
// reads it. Without credentials nothing is asked and the ladder still shows
// what ReachKit's own rows prove. A page the hub never accepted is announced
// once, and never twice. No suite calls Google.
import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../../publish/harness";
import type { FetchOutcome, SafeFetchOpts } from "@/lib/egress";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { readSearchEngines } from "@/lib/publish/destinations/hosted/search-engines";
import { WEBSUB_HUB } from "@/lib/publish/destinations/hosted/announce";
import { searchVerificationOfSite } from "@/lib/publish/destinations/hosted/store";
import { ladderOf } from "@/lib/measure/ladder";
import { readingOf } from "@/lib/measure/page-reading";
import { verdictStore } from "@/lib/opportunities/verdicts/store";
import { stored as asStored, weekWith } from "../../measure/reading-fixture";

const NOW = new Date(Date.UTC(2026, 9, 19, 6, 0, 0));
const HOST = "content.example.com";
const SITE_URL = `https://${HOST}/`;
const OLD = `${SITE_URL}how-to-rank`;
const NEW = `${SITE_URL}onboarding-checklist`;
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ACCOUNT = { client_email: "pool-1@reachkit.example", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };

function ok(body: unknown, status = 200): FetchOutcome {
  return { ok: true, status, url: "", html: body === null ? "" : JSON.stringify(body), bytes: 0, readAt: NOW, headers: {} };
}

let sent: { url: string; opts: SafeFetchOpts }[] = [];

/** Google, as its documentation answers. */
async function google(url: string, opts: SafeFetchOpts): Promise<FetchOutcome> {
  sent.push({ url, opts });
  if (url === "https://oauth2.googleapis.com/token") return ok({ access_token: "fixture-access", expires_in: 3600 });
  if (url.endsWith("/siteVerification/v1/token")) return ok({ method: "META", token: '<meta name="google-site-verification" content="g-fixture-token" />' });
  if (url.includes("/siteVerification/v1/webResource")) return ok({ id: SITE_URL, owners: [ACCOUNT.client_email] });
  if (url.endsWith("/searchAnalytics/query")) {
    // By page alone Google keeps the anonymised queries the page × query rows leave out.
    if (opts.body?.includes('["page"]')) return ok({ rows: [{ keys: [OLD], clicks: 2, impressions: 40, position: 40 }] });
    return ok({
      rows: [
        { keys: [OLD, "How to  rank"], clicks: 1, impressions: 30, ctr: 0.03, position: 34.2 },
        { keys: [OLD, "ai overview ranking"], clicks: 0, impressions: 7, ctr: 0, position: 61 },
      ],
    });
  }
  if (url.endsWith("urlInspection/index:inspect")) {
    const inspected = JSON.parse(opts.body ?? "{}") as { inspectionUrl: string };
    return ok({
      inspectionResult: {
        indexStatusResult:
          inspected.inspectionUrl === OLD
            ? { verdict: "PASS", coverageState: "Submitted and indexed", lastCrawlTime: "2026-10-12T03:00:00Z" }
            : { verdict: "NEUTRAL", coverageState: "URL is unknown to Google" },
      },
    });
  }
  if (opts.method === "PUT") return ok(null, 204);
  return ok({}, 404);
}

function seed(): void {
  sent = [];
  db.reset();
  db.seed("destinations", [{ id: "dest-1", site_id: "s1", kind: "hosted", hostname: HOST, hostname_state: "live", deleted_at: null, search_verification: null }]);
  db.seed("publications", [
    // Published 2026-10-03, before issue 1511: never announced.
    { id: "pub-old", draft_id: "d-old", site_id: "s1", destination: "hosted", live_url: OLD, published_at: "2026-10-03T07:00:00.000Z", unpublished_at: null, announced_at: null, search_reading: null, acceptance: { form: "top20", query: "how to rank" } },
    { id: "pub-new", draft_id: "d-new", site_id: "s1", destination: "hosted", live_url: NEW, published_at: "2026-10-18T07:00:00.000Z", unpublished_at: null, announced_at: "2026-10-18T07:00:05.000Z", search_reading: null },
  ]);
  db.seed("scans", [
    {
      id: "scan-1",
      site_id: "s1",
      created_at: "2026-10-19T05:00:00.000Z",
      // pub-new's own question was answered with a link to it; pub-old's
      // own Google result does not hold it this week.
      report: asStored(
        weekWith({
          domain: HOST,
          asked: [
            { publicationId: "pub-new", liveUrl: NEW, search: "onboarding checklist", place: null, linked: true },
            { publicationId: "pub-old", liveUrl: OLD, search: "how to rank", place: null },
          ],
        })
      ),
    },
  ]);
  db.seed("publication_reads", [{ site_id: "s1", publication_id: "pub-new", day: "2026-10-18", engine: "google", kind: "crawl", hits: 2 }]);
}

const stored = (id: string) => readingOf(db.rows("publications").find((row) => row.id === id)?.search_reading);
const hub = () => sent.filter((request) => request.url === WEBSUB_HUB);

describe("issue 1553 — a live hosted host is verified, and each page's way to being found is stored", () => {
  beforeEach(seed);

  it("fixture answers verify the host by the meta method, submit its sitemap, and produce each page's ladder", async () => {
    await readSearchEngines({
      siteId: "s1",
      now: NOW,
      deps: { accounts: [ACCOUNT], gscSend: google, announce: async () => ok({}) },
    });

    // The tokens the hosted index prints, and when each engine accepted it.
    expect(await searchVerificationOfSite("s1")).toBe("g-fixture-token");
    const verification = db.rows("destinations")[0]?.search_verification as Record<string, Record<string, string>>;
    expect(verification.google).toMatchObject({ account: ACCOUNT.client_email, verifiedAt: NOW.toISOString(), sitemapAt: NOW.toISOString() });
    expect(sent.some((r) => r.opts.method === "PUT" && r.url.endsWith(`/sitemaps/${encodeURIComponent(`${SITE_URL}sitemap.xml`)}`))).toBe(true);
    // The property added this pass is not measured yet: URL Inspection's facts are kept, and no figure is stored.
    expect(stored("pub-old")?.google).toEqual({ unread: "property_new", indexed: true, lastCrawl: "2026-10-12T03:00:00Z", coverageState: "Submitted and indexed" });

    await readSearchEngines({ siteId: "s1", now: new Date(NOW.getTime() + 5 * 86_400_000), deps: { accounts: [ACCOUNT], gscSend: google, announce: async () => ok({}) } });

    // The older page: indexed, shown 40 times by page alone, absent from its own result,
    // so Search Console's place 34 — and its own question's answer linked nobody.
    expect(ladderOf(stored("pub-old"), 0)).toEqual({ crawled: true, indexed: true, impressions: 40, showing: true, bestPlace: 34, placeSource: "gsc", cited: false });
    expect(stored("pub-old")?.google).toMatchObject({ indexed: true, bestPlace: 34.2, bestQuery: "How to  rank" });
    // The newer page: Googlebot counted, unknown to Google, cited by AI.
    expect(ladderOf(stored("pub-new"), 2)).toEqual({ crawled: true, indexed: false, impressions: 0, showing: false, bestPlace: null, placeSource: null, cited: true });
  });

  it("without credentials it asks no engine, and the ladder shows only what ReachKit's rows prove", async () => {
    db.rows("scans")[0]!.report = asStored(
      weekWith({
        domain: HOST,
        asked: [
          { publicationId: "pub-new", liveUrl: NEW, search: "onboarding checklist", place: null, linked: true },
          { publicationId: "pub-old", liveUrl: OLD, search: "how to rank", place: 7 },
        ],
      })
    );
    await readSearchEngines({ siteId: "s1", now: NOW, deps: { accounts: [], announce: async () => ok({}) } });

    expect(sent).toEqual([]);
    expect(db.rows("destinations")[0]?.search_verification).toBeNull();
    // Seen at 7 on its own result is indexed and placed; impressions are not drawn.
    expect(ladderOf(stored("pub-old"), 0)).toEqual({ crawled: false, indexed: true, impressions: null, showing: true, bestPlace: 7, placeSource: "serp", cited: false });
    expect(ladderOf(stored("pub-new"), 2)).toEqual({ crawled: true, indexed: null, impressions: null, showing: null, bestPlace: null, placeSource: null, cited: true });
  });

  it("a host whose verification Google refuses stores the reason on each hosted page, and no impressions", async () => {
    const refusing = async (url: string, opts: SafeFetchOpts) => (url.includes("/webResource") ? ok({}, 403) : google(url, opts));
    await readSearchEngines({ siteId: "s1", now: NOW, deps: { accounts: [ACCOUNT], gscSend: refusing, announce: async () => ok({}) } });
    expect(db.rows("publications").find((row) => row.id === "pub-old")?.search_reading).toMatchObject({ google: { unread: "verify_refused" } });
    expect(ladderOf(stored("pub-old"), 0).impressions).toBeNull();
  });

  it("a page the hub never accepted is announced once, and never twice", async () => {
    const send = async (url: string, opts: SafeFetchOpts): Promise<FetchOutcome> => {
      sent.push({ url, opts });
      return ok({}, 204);
    };
    const deps = { accounts: [], announce: send };

    await readSearchEngines({ siteId: "s1", now: NOW, deps });
    expect(sent.map((request) => request.url)).toEqual([WEBSUB_HUB]);
    expect(db.rows("publications").find((row) => row.id === "pub-old")?.announced_at).toBe(NOW.toISOString());

    await readSearchEngines({ siteId: "s1", now: new Date(NOW.getTime() + 7 * 86_400_000), deps });
    expect(hub()).toHaveLength(1);
  });

  it("a duplicate run writes each closed week once, and the trim drops only weeks older than 57", async () => {
    db.rows("publication_reads").push({ site_id: "s1", publication_id: "pub-old", day: "2026-10-05", engine: "google", kind: "referral", hits: 3 });
    const aged = (week_start: string) => ({ publication_id: "pub-old", site_id: "s1", week_start, counts: {}, reading: null });
    db.seed("publication_weeks", [aged("2025-09-15"), aged("2025-09-08")]);
    const run = () => readSearchEngines({ siteId: "s1", now: NOW, deps: { accounts: [], announce: async () => ok({}) } });
    await run();
    const first = structuredClone(db.rows("publication_weeks"));
    await run();
    expect(db.rows("publication_weeks")).toEqual(first);
    expect(first.map((row) => `${row.publication_id} ${row.week_start}`).sort()).toEqual(["pub-new 2026-10-12", "pub-old 2025-09-15", "pub-old 2026-09-28", "pub-old 2026-10-05", "pub-old 2026-10-12"]);
    expect(first.find((row) => row.week_start === "2026-10-05")?.counts).toEqual({ "referral:google": 3 });
    expect(first.find((row) => row.publication_id === "pub-new")).toMatchObject({ counts: { "crawl:google": 2 }, reading: { indexed: null, linkedBy: ["ai_overview"] } });
  });

  it("a re-run writes the newest week's reading again and keeps an older week's stored reading", async () => {
    db.seed("publication_weeks", [{ publication_id: "pub-old", site_id: "s1", week_start: "2026-10-05", counts: {}, reading: { indexed: true, impressions: 9, clicks: 1, place: null, linkedBy: [] } }]);
    await readSearchEngines({ siteId: "s1", now: NOW, again: true, deps: { accounts: [], announce: async () => ok({}) } });
    const week = (start: string) => db.rows("publication_weeks").find((row) => row.publication_id === "pub-old" && row.week_start === start);
    expect(week("2026-10-05")?.reading).toEqual({ indexed: true, impressions: 9, clicks: 1, place: null, linkedBy: [] });
    expect(week("2026-10-12")?.reading).not.toBeNull();
  });

  it("an older version live at the newest's address keeps only its weeks from before the newest went live", async () => {
    db.seed("publications", db.rows("publications").map((row) => ({ ...row, live_url: OLD })));
    db.seed("publication_weeks", ["2026-09-28", "2026-10-05", "2026-10-12"].map((week_start) => ({ publication_id: "pub-old", site_id: "s1", week_start, counts: {}, reading: null })));
    await readSearchEngines({ siteId: "s1", now: NOW, deps: { accounts: [], announce: async () => ok({}) } });
    expect(db.rows("publication_weeks").map((row) => `${row.publication_id} ${row.week_start}`).sort()).toEqual(["pub-new 2026-10-12", "pub-old 2026-09-28", "pub-old 2026-10-05"]);
  });

  it("issue 1538's seen state reads URL Inspection: a page Google calls indexed is seen", async () => {
    await readSearchEngines({ siteId: "s1", now: NOW, deps: { accounts: [ACCOUNT], gscSend: google, announce: async () => ok({}) } });
    const seen = await verdictStore().seenUrls?.("s1");
    expect(seen).toContain(OLD);
    expect(seen).not.toContain(NEW);
  });
});
