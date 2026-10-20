// tests/hosted/indexing/search-engines.test.ts — issue 1553, the SEO
// metrics review's R2.
//
// The weekly step for one site, through the real Search Console and Bing
// clients with every vendor answered by fixtures: the host is verified by
// the meta method and its sitemap submitted, each page's reading is
// stored, and the ladder reads it. Without credentials nothing is asked and
// the ladder still shows what ReachKit's own rows prove. The pages that
// predate IndexNow are announced once, and never twice. No suite calls
// Google, Bing or IndexNow.
import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "../../publish/harness";
import type { FetchOutcome, SafeFetchOpts } from "@/lib/egress";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { readSearchEngines } from "@/lib/publish/destinations/hosted/search-engines";
import { INDEXNOW_ENDPOINT } from "@/lib/publish/destinations/hosted/announce";
import { searchVerificationOfSite } from "@/lib/publish/destinations/hosted/store";
import { bingClient } from "@/lib/vendors/bing-wmt";
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
const ACCOUNT = { client_email: "pool-1@reachkit.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };

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
    return ok({
      rows: [
        { keys: [OLD, "rank in ai overview"], clicks: 1, impressions: 30, ctr: 0.03, position: 34.2 },
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

/** Bing, as its JSON API answers (`{ d: … }`). */
async function bing(url: string, opts: SafeFetchOpts): Promise<FetchOutcome> {
  sent.push({ url, opts });
  const method = new URL(url).pathname.split("/").pop();
  if (method === "GetUserSites") return ok({ d: [{ Url: SITE_URL, IsVerified: false, AuthenticationCode: "B1FIXTURE" }] });
  if (method === "VerifySite") return ok({ d: true });
  if (method === "GetPageStats") {
    return ok({ d: [{ Query: OLD, Date: `/Date(${Date.UTC(2026, 9, 15)})/`, Impressions: 5, Clicks: 0, AvgImpressionPosition: 28 }] });
  }
  if (method === "GetUrlInfo") return ok({ d: { LastCrawledDate: new URL(url).searchParams.get("url") === OLD ? `/Date(${Date.UTC(2026, 9, 11)})/` : "/Date(0)/" } });
  return ok({ d: null });
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
const indexNow = () => sent.filter((request) => request.url === INDEXNOW_ENDPOINT);

describe("issue 1553 — a live hosted host is verified, and each page's way to being found is stored", () => {
  beforeEach(seed);

  it("fixture answers verify the host by the meta method, submit its sitemap, and produce each page's ladder", async () => {
    await readSearchEngines({
      siteId: "s1",
      now: NOW,
      deps: { accounts: [ACCOUNT], gscSend: google, bing: bingClient("bing-key-fixture", bing), announce: async () => ok({}) },
    });

    // The tokens the hosted index prints, and when each engine accepted it.
    expect(await searchVerificationOfSite("s1")).toEqual({ google: "g-fixture-token", bing: "B1FIXTURE" });
    const verification = db.rows("destinations")[0]?.search_verification as Record<string, Record<string, string>>;
    expect(verification.google).toMatchObject({ account: ACCOUNT.client_email, verifiedAt: NOW.toISOString(), sitemapAt: NOW.toISOString() });
    expect(verification.bing).toMatchObject({ verifiedAt: NOW.toISOString(), sitemapAt: NOW.toISOString() });
    expect(sent.some((r) => r.opts.method === "PUT" && r.url.endsWith(`/sitemaps/${encodeURIComponent(`${SITE_URL}sitemap.xml`)}`))).toBe(true);
    expect(sent.some((r) => r.url.includes("/SubmitFeed") && (r.opts.body ?? "").includes(`${SITE_URL}sitemap.xml`))).toBe(true);

    // The older page: indexed, shown 42 times, absent from its own result,
    // so Search Console's place 34 — and its own question's answer linked nobody.
    expect(ladderOf(stored("pub-old"), 0)).toEqual({ crawled: true, indexed: true, impressions: 42, showing: true, bestPlace: 34, placeSource: "gsc", cited: false });
    expect(stored("pub-old")?.google).toMatchObject({ indexed: true, bestPlace: 34.2, bestQuery: "rank in ai overview" });
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
    await readSearchEngines({ siteId: "s1", now: NOW, deps: { accounts: [], bing: null, announce: async () => ok({}) } });

    expect(sent).toEqual([]);
    expect(db.rows("destinations")[0]?.search_verification).toBeNull();
    // Seen at 7 on its own result is indexed and placed; impressions are not drawn.
    expect(ladderOf(stored("pub-old"), 0)).toEqual({ crawled: false, indexed: true, impressions: null, showing: true, bestPlace: 7, placeSource: "serp", cited: false });
    expect(ladderOf(stored("pub-new"), 2)).toEqual({ crawled: true, indexed: null, impressions: null, showing: null, bestPlace: null, placeSource: null, cited: true });
  });

  it("a page that predates IndexNow is announced once, and never twice", async () => {
    const send = async (url: string, opts: SafeFetchOpts): Promise<FetchOutcome> => {
      sent.push({ url, opts });
      return ok({}, url === INDEXNOW_ENDPOINT ? 202 : 204);
    };
    const deps = { accounts: [], bing: null, announce: send };

    await readSearchEngines({ siteId: "s1", now: NOW, deps });
    expect(indexNow()).toHaveLength(1);
    expect((JSON.parse(indexNow()[0]?.opts.body ?? "{}") as { urlList: string[] }).urlList).toEqual([OLD, SITE_URL]);
    expect(db.rows("publications").find((row) => row.id === "pub-old")?.announced_at).toBe(NOW.toISOString());

    await readSearchEngines({ siteId: "s1", now: new Date(NOW.getTime() + 7 * 86_400_000), deps });
    expect(indexNow()).toHaveLength(1);
  });

  it("issue 1538's seen state reads URL Inspection: a page Google calls indexed is seen", async () => {
    await readSearchEngines({ siteId: "s1", now: NOW, deps: { accounts: [ACCOUNT], gscSend: google, bing: null, announce: async () => ok({}) } });
    const seen = await verdictStore().seenUrls?.("s1");
    expect(seen).toContain(OLD);
    expect(seen).not.toContain(NEW);
  });
});
