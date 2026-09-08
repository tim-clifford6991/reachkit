// BUILD §4.1 — fixture arms for dev previews, on reserved names only
//
// **Every arm of the report address, reachable on a preview deployment
// without a database behind it.** The screen resolves from the store
// (#104's `resolveAddress`); this file is what a handful of *reserved*
// domains resolve to instead, so the owner can review every state —
// degraded, cold start, starting, scanning, refused, cooldown, removed —
// in both themes on `dev.reachkit.app` without arranging seven real scans.
//
// **The gate is the point.** `fixtureStateFor` answers for a domain under
// `example.com` and for nothing else, and returns `null` for every other
// domain — so a real customer's address can never be served invented
// figures, whatever this file grows to hold. `example.com` is IANA
// reserved (RFC 2606) and cannot be registered, which is what makes the
// gate safe to state as a suffix rather than as a list to keep in step.
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
import type { AnswerCell, EngineCell, StoredQuestion, StoredReport } from "@/lib/scan/report";
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

/** §6.2's three answer columns for a **free** report: Google's AI answer,
 *  and the two engines the free path never asks (§6.2 — "The free path
 *  makes **zero** AI Optimization API calls"), which read `not_attempted`
 *  and never as a miss.
 *
 *  Written as literals rather than through `matrix.ts`'s `engineColumns`,
 *  and that is not taste: this file is reachable from `src/middleware.ts`,
 *  a **runtime** import of the market leaf pulls `rivals/domains` →
 *  `scan/domain` → `node:net` into the Edge bundle, and the build fails
 *  with "A Node.js module is loaded which is not supported in the Edge
 *  Runtime". A fixture describes a fixed shape; the order it describes is
 *  asserted against `BATTERY_ENGINES` in `tests/market/questions/
 *  matrix.test.ts`. */
const NOT_ASKED = { kind: "unmeasured", reason: "not_attempted" } as const;

function enginesFor(index: number): readonly EngineCell[] {
  return [
    { engine: "ai_overview", cell: cellFor(index) },
    { engine: "ai_mode", cell: NOT_ASKED },
    { engine: "chatgpt", cell: NOT_ASKED },
  ];
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
  // The version this file's shape actually is. Written as a literal and
  // not as `REPORT_VERSION`: this file is reachable from
  // `src/middleware.ts`, and a **runtime** import of `@/lib/scan/report`
  // pulls the db and env chain into the Edge bundle and fails the build —
  // the same edge its header records for `matrix.ts`. Pinned against the
  // constant in `tests/app/scan-address/report-view.test.tsx`, which runs
  // in node and may import it, so the two cannot drift (#352; the label
  // had been left at 3 through two migrations).
  version: 6,
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
  rivalSizes: { kind: "unmeasured", reason: "not_attempted", at: MEASURED_AT },
  ownRanked: { kind: "unmeasured", reason: "not_attempted", at: MEASURED_AT },
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
  | "rivalSizes"
  | "ownRanked"
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
  // reads none of these members — except the market, below.
  ...FIXTURE_RECORD,
  // The one record member the screen *does* read: the category has one
  // home (`market.profile.category`, #103) and the header strip names it
  // beside the measured date (UI-SPEC S2). The record's own arm above is
  // `unmeasured`, which draws a report with no category at all — a real
  // state, kept for the degraded fixture, and the wrong one for the
  // complete report the owner reviews.
  //
  // `totalVolume` is here because `MarketSet` declares it, and no surface
  // renders it: REQ-008 c3 forbids a total monthly volume for the twelve
  // searches anywhere on the presence card, and the owner removed that
  // footnote on 2026-09-03.
  market: measured(
    {
      profile: {
        category: "product analytics",
        job: "measure how people use the product",
        offeringType: "software",
        audienceTerms: ["product teams", "founders"],
        namedRivals: [...RIVALS],
        vocabulary: ["analytics", "funnel", "cohort"],
        brandTokens: ["example"],
      },
      suggestions: SEARCHES.map((keyword, index) => ({ keyword, volume: 8100 - index * 600 })),
      totalVolume: 12400,
    },
    MEASURED_AT
  ),
  verdict: {
    domain: OWN_DOMAIN as CanonicalDomain,
    measuredAt: MEASURED_AT,
    scoreAndBand: measured({ score: 62, band: "findable" }, MEASURED_AT),
    // The three the score is composed of (ruling 1b: the header strip
    // draws them). Invented like every figure here, and invented
    // *coherently*: `∛(70 × 90 × 40)` is 62, which is the score above, and
    // presence is the smallest of the three, which is the factor the
    // limiting line below names. The header draws them as 7/10, 9/10 and
    // 4/10 — the set's own bars.
    factors: {
      foundations: measured(70, MEASURED_AT),
      answerability: measured(90, MEASURED_AT),
      presence: measured(40, MEASURED_AT),
    },
    limiting: { kind: "factor", factor: "presence" },
    missing: [],
    unmeasuredElsewhere: [],
    blockedReaders: measured(4, MEASURED_AT),
  },
  blockedAgents: AI_READER_AGENTS.slice(0, 4),
  aiAnswers: {
    measuredSearches: 12,
    answeredSearches: 9,
    customerCitations: 0,
    measuredAt: MEASURED_AT,
    ownDomain: OWN_DOMAIN,
    rivals: RIVALS.map((domain, offset) => ({ domain, cells: rivalCells(offset) })),
    rows: QUESTIONS.map((question, index) => ({ question, cell: cellFor(index), engines: enginesFor(index) })),
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
/** The cold-start fixture is a **different customer, in a different
 *  market** — and its own measurement says so.
 *
 *  It used to share the complete fixture's twelve searches and the brands
 *  its answers named, which made the report for a domain that ranks for
 *  nothing carry another fixture's rivals and searches: REQ-091 c3's
 *  "nothing stands in the place of what the customer does not have",
 *  caught by `tests/presentation/sweeps/coldstart.test.tsx` the moment the
 *  approved copy landed and those provenance lines started rendering
 *  their slots (#352). Two customers, two markets, no borrowing possible.
 *
 *  Its AI answers name nobody at all: the answers appeared and cited no
 *  brand, which is a measurement and not an absence — the same reading
 *  `QuestionRow` gives it ("a question whose answer named nobody names
 *  none"). */
const COLD_SEARCHES = [
  "invoicing software for freelancers",
  "best invoicing tool",
  "send an invoice online",
  "recurring invoice software",
  "invoice reminders automatic",
  "quotes and invoices in one place",
  "invoicing for small studios",
  "vat invoice template",
  "invoice in two currencies",
  "time tracking to invoice",
  "invoice approval workflow",
  "invoicing software pricing",
] as const;

/** The deterministic fallback shape, which is code and not copy
 *  (DECISIONS 2026-09-05, #82): a search becomes the question a buyer asks
 *  about it. The complete fixture above carries model-worded questions;
 *  this one carries the template form, which is the other of the two
 *  shapes the product actually stores. */
const COLD_QUESTIONS: readonly StoredQuestion[] = COLD_SEARCHES.map((search, index) => ({
  n: index + 1,
  wording: fromStored("questions.wording", `What's the best ${search}?`),
  search,
}));

/** Three of the twelve returned no AI answer; the nine that did named no
 *  brand at all. */
function coldCellFor(index: number): AnswerCell {
  if (index >= 9) return { kind: "no_answer" };
  return { kind: "answered", citedDomains: [], namesCustomer: false };
}

export const FIXTURE_COLD_START_REPORT: StoredReport = {
  ...FIXTURE_REPORT,
  market: measured(
    {
      profile: {
        category: "invoicing software",
        job: "get paid for work already done",
        offeringType: "software",
        audienceTerms: ["freelancers", "small studios"],
        namedRivals: [],
        vocabulary: ["invoice", "quote", "reminder"],
        brandTokens: ["example"],
      },
      suggestions: COLD_SEARCHES.map((keyword, index) => ({ keyword, volume: 2400 - index * 150 })),
      totalVolume: 9800,
    },
    MEASURED_AT
  ),
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
    rows: COLD_QUESTIONS.map((question, index) => ({
      question,
      cell: coldCellFor(index),
      engines: [
        { engine: "ai_overview", cell: coldCellFor(index) },
        { engine: "ai_mode", cell: NOT_ASKED },
        { engine: "chatgpt", cell: NOT_ASKED },
      ] as readonly EngineCell[],
    })),
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

/** The one reserved name every fixture arm hangs under. A domain is a
 *  fixture domain when it is this name or a subdomain of it — never when
 *  it merely ends with the same characters, which `evilexample.com` does. */
const FIXTURE_SUFFIX = "example.com";

export function isFixtureDomain(domain: string): boolean {
  return domain === FIXTURE_SUFFIX || domain.endsWith(`.${FIXTURE_SUFFIX}`);
}

/**
 * What a reserved domain resolves to, or `null` for every domain that is
 * not one. Reads nothing, writes nothing, starts no scan.
 *
 * `null` and not "the complete report" is the whole gate: a caller that
 * forgets to check `isFixtureDomain` still cannot be handed invented
 * figures for a real address, because there are none to hand back.
 * `example.com` itself resolves to the complete report — the screen the
 * owner reviews first is the one a stranger actually lands on.
 */
export function fixtureStateFor(domain: CanonicalDomain): AddressState | null {
  if (!isFixtureDomain(domain)) return null;
  const arm = FIXTURE_ARMS[domain];
  if (arm !== undefined) return arm(domain);
  return {
    kind: "report",
    report: { ...FIXTURE_REPORT, verdict: { ...FIXTURE_REPORT.verdict, domain } },
    notice: null,
    control: { kind: "none" },
  };
}
