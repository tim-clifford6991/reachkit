// tests/site-profile/build.test.ts — issue #577, SPEC.md §2 ("Bounded: 100
// pages, one run per scan") and §12 ruling 8 (2026-09-12).
//
// What the customer is owed from the order of calls: a profile that
// records the pages that were actually read and no others, and a reading
// that failed leaving the inventory — the thing cross-linking needs —
// stored anyway.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

const { crawlMock, voiceMock, writeMock } = vi.hoisted(() => ({
  crawlMock: vi.fn(),
  voiceMock: vi.fn(),
  writeMock: vi.fn(),
}));

vi.mock("../../src/lib/site-profile/crawl", () => ({ crawlSite: crawlMock }));
vi.mock("../../src/lib/site-profile/summary", () => ({ deriveVoice: voiceMock }));
vi.mock("../../src/lib/site-profile/store", () => ({
  writeSiteProfile: writeMock,
  readSiteProfile: vi.fn(),
  adoptVoiceText: vi.fn(),
  saveVoiceText: vi.fn(),
}));

const { buildSiteProfile } = await import("../../src/lib/site-profile");

const AT = new Date("2026-09-12T09:00:00.000Z");
const DOMAIN = "example.com";

const VOICE = {
  text: "Plain and direct, second person.",
  tone: "plain",
  person: "second",
  vocabulary: ["payouts"],
  claimsToKeep: [],
  claimsToAvoid: ["the leading"],
};

function crawled(paths: readonly string[]) {
  return {
    pages: paths.map((path) => ({
      url: `https://${DOMAIN}${path}`,
      title: path,
      h1: path,
      text: "Some words from the page.",
    })),
    discovered: paths.length,
    stoppedBy: "complete" as const,
  };
}

const HOME_HTML =
  '<html><head><meta property="og:site_name" content="Example Payments"><title>Payouts — Example Payments</title></head></html>';

/** The free pass: it crawls, it names the site off the home document, and
 *  it issues no model call at all (issue #577 — the pass's inference
 *  budget is spent on the market profile and the phrasing). */
const FREE = {
  domain: DOMAIN,
  homeUrl: `https://${DOMAIN}/`,
  homeHtml: HOME_HTML,
  sitemaps: [],
  tier: "free" as const,
};

/** A paid pass — the deep pass at setup, and every Monday after it. This
 *  is the one that reads the voice, the products and the claims. */
const PAID = { ...FREE, tier: "deep" as const };

beforeEach(() => {
  crawlMock.mockReset();
  voiceMock.mockReset();
  writeMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("the profile records what was read", () => {
  it("gives every crawled page a purpose and counts only the pages it read", async () => {
    crawlMock.mockResolvedValueOnce(crawled(["/pricing", "/about", "/blog/one"]));
    voiceMock.mockResolvedValueOnce({
      kind: "measured",
      at: AT,
      value: { siteName: "Example Payments", products: ["payments"], claims: [], voice: VOICE },
    });

    const profile = await buildSiteProfile({} as never, PAID);

    expect(profile?.pagesRead).toBe(3);
    expect(profile?.inventory).toHaveLength(3);
    // A site of three pages records three rows — no row is invented to
    // reach the hundred the ruling allows (§2, done-when 8).
    expect(profile?.inventory.every((row) => row.url.startsWith(`https://${DOMAIN}/`))).toBe(true);
    expect(profile?.siteName).toBe("Example Payments");
    expect(profile?.voice).toEqual(VOICE);
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("stores the inventory even when the voice call did not come back", async () => {
    crawlMock.mockResolvedValueOnce(crawled(["/pricing"]));
    voiceMock.mockResolvedValueOnce({ kind: "unmeasured", reason: "undeterminable", at: AT });

    const profile = await buildSiteProfile({} as never, PAID);

    expect(profile?.voice).toBeNull();
    expect(profile?.inventory).toHaveLength(1);
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("writes nothing at all when the crawl read no page — an empty inventory never replaces a real one", async () => {
    crawlMock.mockResolvedValueOnce(crawled([]));

    expect(await buildSiteProfile({} as never, PAID)).toBeNull();
    expect(writeMock).not.toHaveBeenCalled();
    expect(voiceMock).not.toHaveBeenCalled();
  });

  it("crawls once per pass — the ruling's 'one run per scan'", async () => {
    crawlMock.mockResolvedValueOnce(crawled(["/pricing"]));
    voiceMock.mockResolvedValueOnce({ kind: "unmeasured", reason: "undeterminable", at: AT });

    await buildSiteProfile({} as never, PAID);

    expect(crawlMock).toHaveBeenCalledTimes(1);
    expect(voiceMock).toHaveBeenCalledTimes(1);
  });
});

describe("the free pass crawls and names the site, and infers nothing", () => {
  it("stores the inventory and the published site name without a single model call", async () => {
    crawlMock.mockResolvedValueOnce(crawled(["/pricing", "/about"]));

    const profile = await buildSiteProfile({} as never, FREE);

    // The whole point: a free scan spends no inference on the profile, so
    // the pass's two nano calls stay its two (`FREE_PASS_INFERENCE_CALLS`).
    expect(voiceMock).not.toHaveBeenCalled();
    expect(profile?.pagesRead).toBe(2);
    expect(profile?.inventory).toHaveLength(2);
    // Read off the home document, not asked of a model.
    expect(profile?.siteName).toBe("Example Payments");
    // And the three inferred facts are simply absent, never invented.
    expect(profile?.voice).toBeNull();
    expect(profile?.products).toEqual([]);
    expect(profile?.claims).toEqual([]);
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the home page's own title where the caller holds no document", async () => {
    crawlMock.mockResolvedValueOnce({
      pages: [
        { url: `https://${DOMAIN}/`, title: "Payouts — Example Payments", h1: "", text: "" },
      ],
      discovered: 1,
      stoppedBy: "complete" as const,
    });

    const profile = await buildSiteProfile({} as never, { ...FREE, homeHtml: null });

    expect(profile?.siteName).toBe("Example Payments");
    expect(voiceMock).not.toHaveBeenCalled();
  });

  it("stores no name at all where the site publishes none — never a guess", async () => {
    crawlMock.mockResolvedValueOnce({
      pages: [{ url: `https://${DOMAIN}/`, title: "", h1: "", text: "" }],
      discovered: 1,
      stoppedBy: "complete" as const,
    });

    const profile = await buildSiteProfile({} as never, { ...FREE, homeHtml: "<html></html>" });

    expect(profile?.siteName).toBeNull();
  });
});
