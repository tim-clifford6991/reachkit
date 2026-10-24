// A stored weekly report as the Monday pass writes it, with each page's own
// question asked and its Google rows kept, for the page-reading suites.
// Built through the pass's own section builders, so the rows are the shape
// production stores.
import { measured } from "../../src/lib/measure/measured";
import { pageQuestionsSectionOf } from "../../src/lib/scan/sections";
import type { StoredReport } from "../../src/lib/scan/report";
import type { CanonicalDomain } from "../../src/lib/scan/domain";
import type { RankedRow } from "../../src/lib/vendors/dataforseo/types";
import { AT, reportOf, serp } from "../opportunities/fixtures";

export { AT };

export interface AskedPage {
  publicationId: string;
  liveUrl: string;
  search: string;
  /** The page's own place in its question's Google result; `null` absent. */
  place: number | null;
  /** Whether the AI Overview on that result links the page. */
  linked?: boolean;
  /** How deep that result was bought, where not as the pass reads it today. */
  depth?: number;
}

/** A SaaS site and a local plumber from the customer panel. */
export const SAAS = { domain: "content.example.com", page: "https://content.example.com/user-onboarding-checklist", search: "user onboarding checklist" };
export const LOCAL = { domain: "harborplumbing.example.com", page: "https://harborplumbing.example.com/water-heater-repair-austin", search: "water heater repair austin" };

export function weekWith(a: { domain: string; asked: readonly AskedPage[]; ranked?: readonly RankedRow[] }): StoredReport {
  const rival = { position: 1, domain: "rotorooter.com", url: "https://rotorooter.com/a", title: "Rival" };
  const pageQuestions = pageQuestionsSectionOf({
    asked: a.asked.map((page) => ({
      publicationId: page.publicationId,
      liveUrl: page.liveUrl,
      question: `What should I know about ${page.search}?`,
      search: page.search,
      position: null,
      publishedAt: null,
      linked: false,
    })),
    serps: a.asked.map((page) =>
      measured(
        serp({
          organic: page.place === null ? [rival] : [rival, { position: page.place, domain: a.domain, url: page.liveUrl, title: "Ours" }],
          aiOverview: {
            present: true,
            asynchronousAiOverview: true,
            referenceDomains: page.linked === true ? [a.domain] : ["rotorooter.com"],
            referenceUrls: page.linked === true ? [page.liveUrl] : ["https://rotorooter.com/a"],
          },
        }),
        AT
      )
    ),
    battery: [],
    retired: [],
    selected: 0,
    ownDomain: a.domain,
    measuredAt: AT,
  });
  const rows = pageQuestions?.rows.map((row, i) => (a.asked[i]?.depth === undefined ? row : { ...row, depth: a.asked[i]?.depth }));
  const ranked = a.ranked ?? [];
  return reportOf({ questions: [], serps: [] }, { domain: a.domain as CanonicalDomain, pageQuestions: pageQuestions && rows ? { ...pageQuestions, rows } : pageQuestions, ownRanked: measured(Math.max(ranked.length, 1), AT), ownRankedRows: ranked });
}

/** The report as `scans.report` holds it: JSON, dates as strings. */
export function stored(report: StoredReport): unknown {
  return JSON.parse(JSON.stringify(report));
}
