// Issue 1538, condition 1 — a page any stored SERP or ranked row held is
// `seen`; otherwise it is `not_verified`, never "not indexed".
import "../env";
import { afterEach, describe, expect, it } from "vitest";
import { weeklyDigest } from "../../../src/lib/opportunities/verdicts/read";
import { urlsIn } from "../../../src/lib/opportunities/verdicts/seen";
import { PAGE_URL, SITE_ID, WEEK, fakeStore, pageOf, releaseStore, reportWithOwnPlace } from "./harness";

afterEach(releaseStore);

/** A week the site stored: one SERP for another search, and its ranked rows. */
const STORED = {
  serps: [
    { kind: "measured", value: { organic: [{ url: "https://appcues.com/a", position: 1 }] } },
    { kind: "unmeasured", reason: "not_attempted" },
  ],
  ranked: [{ keyword: "onboarding checklist", url: "http://www.content.example.com/onboarding-checklist/", position: 34 }],
};

async function digestOf(seenUrls: readonly string[] | null) {
  const store = fakeStore({
    pages: [pageOf(), pageOf({ publicationId: "pub-2", liveUrl: "https://content.example.com/onboarding-checklist" })],
    // This week's SERP holds neither page.
    report: reportWithOwnPlace(null),
  });
  if (seenUrls !== null) store.seenUrls = async () => seenUrls;
  return (await weeklyDigest({ siteId: SITE_ID, week: WEEK })).standings;
}

describe("a page's index state is what the stored rows held, for any search and any week", () => {
  it("a page in an earlier week's ranked row is seen; a page in none is not verified", async () => {
    const standings = await digestOf(urlsIn(STORED));
    expect(standings.map((page) => [page.liveUrl, page.indexState])).toEqual([
      [PAGE_URL, "not_verified"],
      ["https://content.example.com/onboarding-checklist", "seen"],
    ]);
    // Rows that could not be read state nothing — never not verified.
    expect((await digestOf(null)).every((page) => !("indexState" in page))).toBe(true);
  });

  it("a page at an address it answered at before is seen", async () => {
    const store = fakeStore({ pages: [pageOf({ earlierUrls: ["https://old.example.com/onboarding"] })], report: reportWithOwnPlace(null) });
    store.seenUrls = async () => ["https://old.example.com/onboarding?utm_source=x"];
    const [page] = (await weeklyDigest({ siteId: SITE_ID, week: WEEK })).standings;
    expect(page?.indexState).toBe("seen");
  });
});
