// Golden rivals: who each customer-panel site's stored searches name as its
// rivals, and which domain holds each search a Write page is proposed for. A
// change to how rivals or holders are chosen shows here as a diff of
// `<site>.md`; `vitest -u` writes the new list once the diff is the one
// intended. 0¢: stored evidence only, and no vendor client is built.
import "../../opportunities/env";
import { describe, expect, it } from "vitest";
import { isListingHost, isPlatformDomain, isPublicHost, isSourceRow, registrableDomain } from "@/lib/market/rivals/domains";
import { writeCandidates } from "@/lib/opportunities/derive/write";
import { businessOf, panelDomains, storedPayloads } from "../plan/panel";
import { panelReport } from "./panel";

/** The sites whose stored searches name a holder that is no rival today: the
 *  holder is the first top-ten row not the site's own (wrong-rival F1, #2193).
 *  Each case is expected red until that fix lands. */
const HOLDER_NOT_A_RIVAL: ReadonlySet<string> = new Set([
  "alexander.co.uk",
  "austinplumbery.com",
  "baeckerei-hinkel.de",
  "clearleft.com",
  "fletcherelectric.co.uk",
  "pdxsmiledesign.com",
  "savvycal.com",
  "streaksapp.com",
  "wesbos.com",
  "zunicafe.com",
]);

/** The sites whose stored searches hold a public body as their first row
 *  not the site's own, today's holder; the shared holder rule flips them. */
const PUBLIC_HOLDER: ReadonlySet<string> = new Set(["clearleft.com"]);

function holders(domain: string) {
  const { report, rivals } = panelReport(domain);
  const { candidates } = writeCandidates({ siteId: "", scanId: report.scanId, report, ownRanked: 0, rankedCounts: new Map() });
  const byQuery = new Map(candidates.map((candidate) => [candidate.targetQuery, candidate]));
  const questions = report.questions.kind === "unmeasured" ? [] : report.questions.value;
  const searches = questions.map(({ search }) => {
    const candidate = byQuery.get(search.keyword);
    const evidence = candidate?.evidence;
    return { search: search.keyword, type: candidate?.type ?? null, holder: evidence?.family === "write" ? evidence.rival.domain : null };
  });
  return { rivals, searches };
}

function render(domain: string): string {
  const { rivals, searches } = holders(domain);
  return [
    `# ${domain}`,
    "",
    `From \`scripts/panel/evidence/${domain}.json\`: ${searches.length} stored searches, ${rivals.length} rivals.`,
    "",
    "| Rival | Top ten | AI citations | Score |",
    "|---|---|---|---|",
    ...rivals.map((rival) => `| ${rival.domain} | ${rival.top10Appearances} | ${rival.aiCitations} | ${rival.score} |`),
    "",
    "| Search | Type | Holder |",
    "|---|---|---|",
    ...searches.map((row) => `| ${row.search} | ${row.type ?? "—"} | ${row.holder ?? "—"} |`),
    "",
  ].join("\n");
}

describe("the golden rivals and holders of each panel site", () => {
  it.each(panelDomains())("%s", async (domain) => {
    await expect(render(domain)).toMatchFileSnapshot(`./${domain}.md`);
  });
});

describe("every holder is a rival, never a listing or a platform", () => {
  for (const domain of panelDomains()) {
    (HOLDER_NOT_A_RIVAL.has(domain) ? it.fails : it)(domain, () => {
      const { rivals, searches } = holders(domain);
      const rivalSet = new Set(rivals.map((rival) => rival.domain));
      for (const { search, holder } of searches) {
        if (holder === null) continue;
        expect(isListingHost(holder) || isPlatformDomain(holder), `${search}: ${holder}`).toBe(false);
        expect(rivalSet.has(registrableDomain(holder) ?? holder), `${search}: ${holder}`).toBe(true);
      }
    });
  }
});

describe("no public host is a rival or a holder", () => {
  for (const domain of panelDomains()) {
    it(`${domain}: rivals`, () => {
      expect(holders(domain).rivals.map((rival) => rival.domain).filter((rival) => isPublicHost(rival))).toEqual([]);
    });
    (PUBLIC_HOLDER.has(domain) ? it.fails : it)(`${domain}: holders`, () => {
      expect(holders(domain).searches.flatMap(({ holder }) => (holder !== null && isPublicHost(holder) ? [holder] : []))).toEqual([]);
    });
  }
});

describe("the panel's top tens: a source row is set aside and a business's row is not", () => {
  // Every row these hold on any panel site is a source.
  const SOURCES = ["yelp.com", "pinterest.com", "tripadvisor.com", "practo.com", "mybuilder.com", "reddit.com", "ubereats.com", "google.com"];
  // Each holds a search on some panel site as a business.
  const BUSINESSES = ["jpelectricalleeds.co.uk", "portlandfamilydentistry.com", "calendly.com", "inkbox.com"];
  const rows = panelDomains().flatMap((site) => {
    const { report, rivals } = panelReport(site);
    const reading = { local: businessOf(site).serves !== null, sources: report.sources, rivals: rivals.map((rival) => rival.domain) };
    return [...storedPayloads(site).values()].flatMap(({ serp }) =>
      serp.organic.map((row) => ({ site, row, domain: registrableDomain(row.domain), source: isSourceRow(row, reading), rival: reading.rivals.includes(registrableDomain(row.domain) ?? "") }))
    );
  });

  it.each(SOURCES)("%s is a source on every row", (name) => {
    const held = rows.filter(({ domain }) => domain === name);
    expect(held.length).toBeGreaterThan(0);
    expect(held.filter(({ source }) => !source).map(({ site, row }) => `${site}: ${row.title}`)).toEqual([]);
  });

  it("a public body is a source on every row", () => {
    const held = rows.filter(({ row }) => isPublicHost(row.domain));
    expect(held.length).toBeGreaterThan(0);
    expect(held.every(({ source }) => source)).toBe(true);
  });

  it.each(BUSINESSES)("%s holds a row as a business", (name) => {
    expect(rows.some(({ domain, source }) => domain === name && !source)).toBe(true);
  });

  it("a report rival's row is never a source", () => {
    expect(rows.filter(({ rival, source }) => rival && source)).toEqual([]);
  });
});
