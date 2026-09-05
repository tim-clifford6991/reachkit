// BUILD §4.1 — fixture data for the report screen, until the pipeline lands
//
// **This file is temporary and says so.** Issue #25 builds `runScan`,
// `assembleReport`, `storeCurrentReport` and `readCurrentReport`, and
// rewires `page.tsx` to resolve a visit from the database. Until then the
// screen has to render *something*, and this is that something: one
// hand-written `StoredReport` and a small map from fixture domains to the
// other six arms of `AddressState`, so every arm is reachable in a preview
// deployment and reviewable by the owner in both themes.
//
// Every figure below is invented for the fixture and is labelled as such
// by the domains it hangs on — all of them under `example.com`,
// `example.net` and `example.org`, the IANA reserved names. No real
// customer, rival or search appears here.
//
// It contains no sentence a person reads: every string is a domain, a
// search phrase, a slug or a format handle. The screen's own sentences are
// the copy registry's.
import { AI_READER_AGENTS } from "@/lib/config/constants";
import { measured, measuredZero } from "@/lib/measure/measured";
import { fromStored } from "@/lib/presentation/generated";
import type { CanonicalDomain } from "@/lib/scan/domain";
import type { AnswerCell, StoredQuestion, StoredReport } from "@/lib/scan/report";
import type { AddressState } from "../_address/state";

const MEASURED_AT = new Date("2026-09-05T09:00:00.000Z");

const OWN_DOMAIN = "example.com";
const RIVALS = ["rival-one.example.net", "rival-two.example.net", "rival-three.example.org"] as const;

const SEARCHES = [
  "product analytics tools",
  "best product analytics tool",
  "analytics without a data warehouse",
  "amplitude alternative",
  "mixpanel vs amplitude",
  "self hosted analytics",
  "product analytics for startups",
  "track activation without code",
  "session replay tools",
  "funnel analysis software",
  "cohort analysis tool",
  "product analytics pricing",
] as const;

const QUESTION_WORDING = [
  "What is the best product analytics tool for a small SaaS team?",
  "Which product analytics tool should a startup pick first?",
  "Which analytics tools work without a data warehouse?",
  "Is there a cheaper alternative to Amplitude?",
  "How does Mixpanel compare with Amplitude for a seed-stage team?",
  "Can I self-host product analytics?",
  "What do early-stage teams use to measure product usage?",
  "How do I track activation without an engineer?",
  "Which tools record and replay user sessions?",
  "What software shows where users drop out of a funnel?",
  "How do I group users into cohorts and compare them?",
  "What does product analytics usually cost per month?",
] as const;

/** Three of the twelve returned no AI answer at all; the other nine did,
 *  and none of the nine named the customer — the shape §4.1's own example
 *  describes ("rivals' cited rows filled grey, customer's row empty"). */
function cellFor(index: number): AnswerCell {
  if (index >= 9) return { kind: "no_answer" };
  return {
    kind: "answered",
    citedDomains: index % 2 === 0 ? [RIVALS[0], RIVALS[1]] : [RIVALS[0], RIVALS[2]],
    namesCustomer: false,
  };
}

function rivalCells(offset: number): readonly AnswerCell[] {
  return SEARCHES.map((_, index): AnswerCell => {
    if (index >= 9) return { kind: "no_answer" };
    return {
      kind: "answered",
      citedDomains: (index + offset) % 3 === 0 ? [] : [RIVALS[offset % RIVALS.length]!],
      namesCustomer: false,
    };
  });
}

const QUESTIONS: readonly StoredQuestion[] = QUESTION_WORDING.map((wording, index) => ({
  n: index + 1,
  wording: fromStored("questions.wording", wording),
  search: SEARCHES[index]!,
  namedBrands: index >= 9 ? [] : [RIVALS[0], RIVALS[1]],
}));

/** What the *pipeline* recorded, beside what the screen renders (issue
 *  #25's half of `StoredReport`). The screen reads none of it — the
 *  correction, the paid pass's reuse of a fresh free scan and anyone asked
 *  to reproduce a report do — so it is spread into both fixture reports
 *  rather than written out twice. Invented, like every figure in this
 *  file, and it goes when the fixture does. */
const FIXTURE_RECORD = {
  version: 1,
  scanId: "fixture-scan-1",
  domain: OWN_DOMAIN as CanonicalDomain,
  tier: "free",
  complete: true,
  stoppedReason: "complete",
  fromIncompleteRescan: false,
  market: { kind: "unmeasured", reason: "not_attempted", at: MEASURED_AT },
  questions: { kind: "unmeasured", reason: "not_attempted", at: MEASURED_AT },
  serps: [],
  rivals: { kind: "unmeasured", reason: "not_attempted", at: MEASURED_AT },
  sources: [],
  onPage: { kind: "unmeasured", reason: "not_attempted", at: MEASURED_AT },
  robots: { kind: "unmeasured", reason: "not_attempted", at: MEASURED_AT },
  coherence: { verdict: "unjudgeable", measuredCount: 0 },
  correctionState: "none",
} as const satisfies Pick<
  StoredReport,
  | "version"
  | "scanId"
  | "domain"
  | "tier"
  | "complete"
  | "stoppedReason"
  | "fromIncompleteRescan"
  | "market"
  | "questions"
  | "serps"
  | "rivals"
  | "sources"
  | "onPage"
  | "robots"
  | "coherence"
  | "correctionState"
>;

/** The report the screen renders for every domain with no other fixture
 *  arm. Complete: every section present, every count measured. */
export const FIXTURE_REPORT: StoredReport = {
  // The record half of the blob (issue #25). Invented for the fixture like
  // everything else here: this file is still the stand-in, and the screen
  // reads none of these members.
  ...FIXTURE_RECORD,
  verdict: {
    domain: OWN_DOMAIN as CanonicalDomain,
    measuredAt: MEASURED_AT,
    scoreAndBand: measured({ score: 62, band: "findable" }, MEASURED_AT),
    limiting: { kind: "factor", factor: "presence" },
    missing: [],
    unmeasuredElsewhere: [],
    blockedReaders: measured(4, MEASURED_AT),
  },
  blockedAgents: AI_READER_AGENTS.slice(0, 4),
  category: "product analytics",
  aiAnswers: {
    measuredSearches: 12,
    answeredSearches: 9,
    customerCitations: 0,
    measuredAt: MEASURED_AT,
    ownDomain: OWN_DOMAIN,
    rivals: RIVALS.map((domain, offset) => ({ domain, cells: rivalCells(offset) })),
    rows: QUESTIONS.map((question, index) => ({ question, cell: cellFor(index) })),
    coverage: "async_included",
  },
  presence: {
    measuredSearches: 12,
    you: { domain: OWN_DOMAIN, top10Count: 1 },
    rivals: [
      { domain: RIVALS[0], top10Count: 10 },
      { domain: RIVALS[1], top10Count: 8 },
      { domain: RIVALS[2], top10Count: 5 },
    ],
    absentFrom: [
      { keyword: SEARCHES[0], volume: 8100, topHolder: RIVALS[0] },
      { keyword: SEARCHES[1], volume: 4400, topHolder: RIVALS[1] },
      { keyword: SEARCHES[3], volume: 2900, topHolder: RIVALS[2] },
      { keyword: SEARCHES[4], volume: 1900, topHolder: RIVALS[0] },
      { keyword: SEARCHES[5], volume: 1600, topHolder: null },
    ],
    framing: "shown",
  },
  supply: {
    missingPages: measured(7, MEASURED_AT),
    unquotablePages: measured(3, MEASURED_AT),
  },
  freePage: {
    opportunityId: "fixture-opportunity-1",
    title: fromStored(
      "opportunities.proposed_title",
      "Six product analytics tools that work without a data warehouse"
    ),
    slug: fromStored("opportunities.proposed_slug", "analytics-without-a-data-warehouse"),
    target: { keyword: SEARCHES[3], volume: 2900 },
    beats: RIVALS[2],
    format: "comparison_page",
    totalPages: 7,
  },
};

/** The same report with the score nulled and two sections absent — the
 *  degraded arm §4.1 names: "missing driver → section absent + one written
 *  line, score `null` renders as '—'". The two counts that *were* measured
 *  stay measured; a measured zero stays a zero. */
export const FIXTURE_DEGRADED_REPORT: StoredReport = {
  ...FIXTURE_REPORT,
  verdict: {
    ...FIXTURE_REPORT.verdict,
    scoreAndBand: { kind: "unmeasured", reason: "undeterminable", at: MEASURED_AT },
    limiting: { kind: "none", because: "score_unmeasured" },
    missing: [
      { factor: "foundations", reason: "undeterminable" },
      { factor: "presence", reason: "not_attempted" },
    ],
    blockedReaders: { kind: "unmeasured", reason: "undeterminable", at: MEASURED_AT },
  },
  blockedAgents: [],
  aiAnswers: null,
  presence: null,
  supply: {
    missingPages: measuredZero(0, MEASURED_AT),
    unquotablePages: { kind: "unmeasured", reason: "not_attempted", at: MEASURED_AT },
  },
  freePage: null,
};

/** REQ-091/092's shape, at this screen: a domain that ranks for nothing
 *  and has no derived rivals. Every section is *present* and every count
 *  is measured — that is what makes it different from the degraded
 *  fixture above, where sections are absent because the measurement did
 *  not happen. Here the measurement happened and the answer is zero, and
 *  a measured zero is a zero (REQ-004 c7): no dash anywhere.
 *
 *  It is the case that catches an empty-state written as a blank: the
 *  presence card's `suppressed_no_rivals` framing, its empty absent-from
 *  table, an AI matrix nobody was cited in, and no first page to offer. */
export const FIXTURE_COLD_START_REPORT: StoredReport = {
  ...FIXTURE_REPORT,
  verdict: {
    ...FIXTURE_REPORT.verdict,
    scoreAndBand: measured({ score: 8, band: "invisible" }, MEASURED_AT),
    limiting: { kind: "factor", factor: "presence" },
    blockedReaders: measuredZero(0, MEASURED_AT),
  },
  blockedAgents: [],
  aiAnswers: {
    measuredSearches: 12,
    answeredSearches: 9,
    customerCitations: 0,
    measuredAt: MEASURED_AT,
    ownDomain: OWN_DOMAIN,
    rivals: [],
    rows: QUESTIONS.map((question, index) => ({ question, cell: cellFor(index) })),
    coverage: "async_included",
  },
  presence: {
    measuredSearches: 12,
    you: { domain: OWN_DOMAIN, top10Count: 0 },
    rivals: [],
    absentFrom: [],
    framing: "suppressed_no_rivals",
  },
  supply: {
    missingPages: measuredZero(0, MEASURED_AT),
    unquotablePages: measuredZero(0, MEASURED_AT),
  },
  freePage: null,
};

/** The fixture domains, one per arm the report route can resolve to. Any
 *  other domain resolves to the complete report above, so the screen the
 *  owner reviews first is the one a stranger actually lands on. */
const FIXTURE_ARMS: Readonly<Record<string, (domain: CanonicalDomain) => AddressState>> =
  Object.freeze<Record<string, (domain: CanonicalDomain) => AddressState>>({
    "degraded.example.com": () => ({
      kind: "report",
      report: FIXTURE_DEGRADED_REPORT,
      notice: { kind: "incomplete", unmeasured: ["foundations", "presence"] },
      control: { kind: "rescan", because: "incomplete" },
    }),
    "cold-start.example.com": () => ({
      kind: "report",
      report: FIXTURE_COLD_START_REPORT,
      notice: null,
      control: { kind: "none" },
    }),
    "starting.example.com": (domain) => ({ kind: "starting", domain }),
    "scanning.example.com": (domain) => ({
      kind: "scanning",
      domain,
      scanId: "fixture-scan-id",
    }),
    "refused.example.com": (domain) => ({
      kind: "refused",
      domain,
      refusal: { reason: "network-limit", retryAfterSeconds: 2220 },
    }),
    "cooldown.example.com": (domain) => ({ kind: "cooldown", domain }),
    "removed.example.com": (domain) => ({ kind: "removed", domain }),
  });

/** Fixture stand-in for issue #25's `readCurrentReport()` plus #28's
 *  removal check. Reads nothing, writes nothing, starts no scan. */
export function fixtureStateFor(domain: CanonicalDomain): AddressState {
  const arm = FIXTURE_ARMS[domain];
  if (arm !== undefined) return arm(domain);
  return {
    kind: "report",
    report: { ...FIXTURE_REPORT, verdict: { ...FIXTURE_REPORT.verdict, domain } },
    notice: null,
    control: { kind: "none" },
  };
}
