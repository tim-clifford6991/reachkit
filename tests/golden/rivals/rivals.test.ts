// Golden rivals: who each customer-panel site's stored searches name as its
// rivals, and which domain holds each search a Write page is proposed for. A
// change to how rivals or holders are chosen shows here as a diff of
// `<site>.md`; `vitest -u` writes the new list once the diff is the one
// intended. 0¢: stored evidence only, and no vendor client is built.
import "../../opportunities/env";
import { describe, expect, it } from "vitest";
import { isOthersPage, isOwnDomain, isPublicHost, isSourceRow, registrableDomain } from "@/lib/market/rivals/domains";
import { sourceReadingOf, writeCandidates } from "@/lib/opportunities/derive/write";
import { beatsOf, freePageOf } from "@/lib/opportunities/free-page";
import { missingPagesOf } from "@/app/(public)/scan/[domain]/_problems/model";
import { businessOf, panelDomains, storedPayloads } from "../plan/panel";
import { panelReport } from "./panel";

function holders(domain: string) {
  const { report, rivals } = panelReport(domain);
  const { candidates } = writeCandidates({ siteId: "", scanId: report.scanId, report, ownRanked: 0, rankedCounts: new Map() });
  const byQuery = new Map(candidates.map((candidate) => [candidate.targetQuery, candidate]));
  const questions = report.questions.kind === "unmeasured" ? [] : report.questions.value;
  const searches = questions.map(({ search }) => {
    const candidate = byQuery.get(search.keyword);
    const evidence = candidate?.evidence;
    return { search: search.keyword, type: candidate?.type ?? null, holder: evidence?.family === "write" ? (evidence.rival?.domain ?? null) : null };
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

describe("each search's holder is the first business in Google's order, never a source", () => {
  it.each(panelDomains())("%s", (domain) => {
    const { report, rivals } = panelReport(domain);
    const reading = sourceReadingOf(report, rivals.map((rival) => rival.domain));
    const { searches } = holders(domain);
    searches.forEach(({ search, type, holder }, index) => {
      const serp = report.serps[index];
      if (type === null || serp === undefined || serp.kind === "unmeasured") return;
      const organic = serp.value.organic;
      const at = holder === null ? organic.length : organic.findIndex((row) => registrableDomain(row.domain) === holder);
      const row = organic[at];
      if (holder !== null) {
        expect(row === undefined || isSourceRow(row, reading), `${search}: ${holder}`).toBe(false);
        expect(isOthersPage(row!, reading.local) && !reading.rivals!.includes(holder), `${search}: ${holder} is a page about others`).toBe(false);
      }
      const before = organic.slice(0, at).filter((each) => !isOwnDomain(each.domain, domain) && !isSourceRow(each, reading));
      expect(before.map((each) => each.domain), `${search}: a business ranks above ${holder ?? "no holder"}`).toEqual([]);
    });
  });
});

describe("the free page and the missing pages name one holder for one search, as stored and as read back", () => {
  it.each(panelDomains())("%s", (domain) => {
    const { report } = panelReport(domain);
    const freePage = freePageOf(report);
    if (freePage === null) return;
    const missing = missingPagesOf({ ...report, freePage });
    expect(missing?.find((page) => page.search === freePage.target.keyword)?.holder ?? null).toBe(freePage.beats);
    expect(beatsOf({ ...report, freePage })).toBe(freePage.beats);
  });
});

describe("a rival offers its own business somewhere: not every page it holds is about others", () => {
  it.each(panelDomains())("%s", (domain) => {
    const { report, rivals } = panelReport(domain);
    const local = sourceReadingOf(report).local;
    const serps = [...storedPayloads(domain).values()].map(({ serp }) => serp);
    const offers = (rival: string) =>
      serps.some(
        (serp) =>
          serp.organic.some((row) => registrableDomain(row.domain) === rival && !isOthersPage(row, local)) ||
          (serp.localPack ?? []).some((row) => registrableDomain(row.domain) === rival) ||
          (serp.aiOverview.referenceUrls ?? []).some((url) => registrableDomain(url) === rival && !isOthersPage({ domain: url, url }, local))
      );
    expect(rivals.map((rival) => rival.domain).filter((rival) => !offers(rival))).toEqual([]);
  });
});

describe("no public host is a rival or a holder", () => {
  for (const domain of panelDomains()) {
    it(`${domain}: rivals`, () => {
      expect(holders(domain).rivals.map((rival) => rival.domain).filter((rival) => isPublicHost(rival))).toEqual([]);
    });
    it(`${domain}: holders`, () => {
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
