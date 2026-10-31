// Golden rivals: who each customer-panel site's stored searches name as its
// rivals, and which domain holds each search a Write page is proposed for. A
// change to how rivals or holders are chosen shows here as a diff of
// `<site>.md`; `vitest -u` writes the new list once the diff is the one
// intended. 0¢: stored evidence only, and no vendor client is built.
import "../../opportunities/env";
import { describe, expect, it } from "vitest";
import { isListingHost, isPlatformDomain, registrableDomain } from "@/lib/market/rivals/domains";
import { writeCandidates } from "@/lib/opportunities/derive/write";
import { panelDomains } from "../plan/panel";
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
