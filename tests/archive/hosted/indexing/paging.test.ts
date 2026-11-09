// tests/hosted/indexing/paging.test.ts — issue 2292
//
// Each later page of a hosted index is its own canonical (issue 1514), so it
// names itself in the head too: its title, share titles and description add
// the pager's own sentence. Page 1, a search and the feed's name stay the
// index's. The businesses are customer-panel sites as their stored runs read
// them, SaaS and local, in both languages.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { HostedBusiness } from "@/app/(hosted)/hosted-page/[[...slug]]/chrome";
import { indexMetadata, indexTitle } from "@/app/(hosted)/hosted-page/[[...slug]]/seo";
import { copyInto, readIn, readingIn } from "@/lib/presentation/copy/reader";

/** A panel business: its site name and its market's job, which is the hosted line. */
function panelBusiness(run: string, domain: string): HostedBusiness {
  const stored: { sites: { site: { domain: string }; siteName: string; market: { job: string } }[] } = JSON.parse(
    readFileSync(`docs/walk/panel/${run}.json`, "utf8")
  );
  const site = stored.sites.find((entry) => entry.site.domain === domain)!;
  return { domain, name: site.siteName, logoType: null, line: site.market.job };
}

const BUSINESSES = [
  ["software", panelBusiness("2026-10-14-1423", "savvycal.com")],
  ["local plumber", panelBusiness("2026-10-09", "austinplumbery.com")],
  ["local accountant", panelBusiness("2026-10-09", "alexander.co.uk")],
] as const;

function headIn(language: "en" | "de", business: HostedBusiness, at: { page: number; query?: string }) {
  return readingIn(() => {
    readIn(language);
    const metadata = indexMetadata({ canonical: `https://content.${business.domain}/`, business, pageCount: 3, ...at });
    return {
      metadata,
      title: String(metadata.title),
      description: String(metadata.description),
      today: indexTitle(business, language),
      pageOf: copyInto(language, "hosted.index.pageOf", { page: "2", pages: "3" }),
    };
  });
}

describe("each later page of the index names itself in the head", () => {
  for (const language of ["en", "de"] as const) {
    for (const [kind, business] of BUSINESSES) {
      it(`${kind}, ${language}: page 2 has its own title, share titles and description; page 1 is unchanged`, () => {
        const first = headIn(language, business, { page: 1 });
        const second = headIn(language, business, { page: 2 });

        expect(first.title).toBe(first.today);
        expect(second.title).not.toBe(first.title);
        expect(second.title).toContain(second.pageOf);
        expect(second.title).toContain(business.name);
        expect(second.metadata.openGraph).toMatchObject({ title: second.title });
        expect(second.metadata.twitter).toMatchObject({ title: second.title });

        expect(second.description).not.toBe(first.description);
        expect(second.description).toContain(second.pageOf);
        expect(second.description.length).toBeLessThanOrEqual(155);
        expect(first.description.length).toBeLessThanOrEqual(155);
        if (first.description.length >= 120) expect(second.description.length).toBeGreaterThanOrEqual(120);
      });
    }
  }

  it("a line long enough to fill a result still leaves room for the page's sentence", () => {
    const business = { ...BUSINESSES[0][1], line: `${"Onboarding checklists that customers finish, ".repeat(5)}every time` };
    const second = headIn("en", business, { page: 2 });
    expect(second.description.length).toBeLessThanOrEqual(155);
    expect(second.description.endsWith(`… ${second.pageOf}.`)).toBe(true);
  });

  it("a search's second page keeps page 1's title, description and canonical", () => {
    for (const language of ["en", "de"] as const) {
      const [, business] = BUSINESSES[0];
      const first = headIn(language, business, { page: 1 });
      const search = headIn(language, business, { page: 2, query: "x" });
      expect(search.title).toBe(first.title);
      expect(search.description).toBe(first.description);
      expect(search.metadata.alternates?.canonical).toBe(first.metadata.alternates?.canonical);
    }
  });
});
