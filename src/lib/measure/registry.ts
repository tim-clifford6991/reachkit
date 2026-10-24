// Each number a customer is shown has one definition, here. `docs/MEASUREMENT.md`
// is generated from this list (`node scripts/measurement-doc.mjs`) and `audit`
// fails when the two differ, so the document cannot drift from the code.
//
// The list between the markers is plain JavaScript: the audit job has no
// TypeScript, and the generator evaluates that literal as it stands.
// `{NAME}` in a definition is a constant of `src/lib/config/constants.ts`,
// written into the document with its value.

/** Where a number is shown: an Overview tile by its test id, a Monday mail
 *  row by its label's copy key, or a free-report figure by the copy key of
 *  the name it is shown under. */
export interface Shown {
  readonly on: "tile" | "mail" | "report";
  readonly key: string;
}

export interface Measure {
  readonly id: string;
  readonly shown: Shown;
  /** What the number counts, and what is shown where nothing was measured. */
  readonly definition: string;
  /** The file and the function that decides what the number counts:
   *  `path#name`. Two figures shown under one name on one surface share it. */
  readonly source: string;
  /** When the number is read again. */
  readonly cadence: string;
}

const LIST = (
  // measures:begin
  [
    {
      id: "mail-pages-live",
      shown: { on: "mail", key: "mail.weekly.pages.live" },
      definition:
        "Overview's live pages, read by the same reader: published, not taken down, and live by the time the mail is sent. A page list that could not be read is not measured.",
      source: "src/lib/measure/page-ladder.ts#pageLadderOf",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "mail-pages-planned",
      shown: { on: "mail", key: "mail.weekly.pages.planned" },
      definition:
        "The pages this week carries, by Plan's rule: each date's scheduled draft, else its committed row.",
      source: "src/lib/opportunities/days.ts#plannedByDay",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "mail-google-found",
      shown: { on: "mail", key: "draft.ladder.found" },
      definition:
        "Overview's ladder step, read by the same function: of the live pages Google can be read on, how many Google fetched. Not measured where no page was read.",
      source: "src/lib/measure/page-ladder.ts#pageLadderOf",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "mail-google-showing",
      shown: { on: "mail", key: "draft.ladder.showing" },
      definition:
        "Overview's ladder step, read by the same function: of the live pages, how many are in the top 100 for their own search. Before any page shows, the mail says it is too early instead of a 0.",
      source: "src/lib/measure/page-ladder.ts#pageLadderOf",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "mail-google-first-page",
      shown: { on: "mail", key: "draft.ladder.first-page" },
      definition:
        "Overview's ladder step, read by the same function: of the live pages, how many hold places 1 to 10 for their own search. Before any page shows, the mail says it is too early instead of a 0.",
      source: "src/lib/measure/page-ladder.ts#pageLadderOf",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "mail-google-visits",
      shown: { on: "mail", key: "mail.weekly.google.visits" },
      definition:
        "Overview's visits from Google this week, counted on the hosted pages over the last {BLOG_READS_WINDOW_D} days. Said alone in the first week with a visit. No row off a hosted blog or with none counted.",
      source: "src/lib/publish/reads/store.ts#readSearchVisitsWeekly",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "mail-google-visits-up",
      shown: { on: "mail", key: "mail.weekly.google.visits.up" },
      definition:
        "The Google tab's last two weekly bars, read by the same function: this week's visits from Google above the {BLOG_READS_WINDOW_D} days before.",
      source: "src/lib/publish/reads/store.ts#readSearchVisitsWeekly",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "mail-google-visits-down",
      shown: { on: "mail", key: "mail.weekly.google.visits.down" },
      definition:
        "The Google tab's last two weekly bars, read by the same function: this week's visits from Google below the {BLOG_READS_WINDOW_D} days before.",
      source: "src/lib/publish/reads/store.ts#readSearchVisitsWeekly",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "mail-google-visits-same",
      shown: { on: "mail", key: "mail.weekly.google.visits.same" },
      definition:
        "The Google tab's last two weekly bars, read by the same function: this week's visits from Google equal to the {BLOG_READS_WINDOW_D} days before.",
      source: "src/lib/publish/reads/store.ts#readSearchVisitsWeekly",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "mail-ai-linked",
      shown: { on: "mail", key: "mail.weekly.ai.linked" },
      definition:
        "The overview-ai-linked figure, read by the same function: of the live pages whose own question was asked, how many the answer linked. Before any is asked, the mail says it is too early.",
      source: "src/lib/measure/figures.ts#aiPagesOf",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "mail-ai-reads",
      shown: { on: "mail", key: "mail.weekly.ai.reads" },
      definition:
        "The overview-ai-reads figure, read by the same function over the last {BLOG_READS_WINDOW_D} days. Only on a hosted blog with a page live.",
      source: "src/lib/publish/reads/model.ts#assembleBlogReads",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "mail-score-month",
      shown: { on: "mail", key: "mail.weekly.month.score" },
      definition:
        "The overview-score-month figure, in the first mail of a month only, with its change since the customer's scan.",
      source: "src/lib/measure/figures.ts#monthFiguresOf",
      cadence: "Monthly, in the first Monday mail of the month.",
    },
    {
      id: "mail-market-month",
      shown: { on: "mail", key: "mail.weekly.month.market" },
      definition:
        "The overview-market-month figure, in the first mail of a month only, with its change since the customer's scan.",
      source: "src/lib/measure/figures.ts#monthFiguresOf",
      cadence: "Monthly, in the first Monday mail of the month.",
    },
    {
      id: "mail-reputation",
      shown: { on: "mail", key: "mail.weekly.month.reputation" },
      definition:
        "The overview-reputation figure, in the first mail of a month only: of the tracked prompts' AI answers over the {ANSWER_RATE_WEEKS} weeks to that Monday, how many named or linked the site, of every such answer read.",
      source: "src/lib/market/prompts/rate.ts#measurePrompts",
      cadence: "Monthly, in the first Monday mail of the month.",
    },
    {
      id: "report-readiness",
      shown: { on: "report", key: "verdict.factor.foundations" },
      definition:
        "Whether the home page and robots.txt let search engines and AI readers in, and whether the home page carries structured data, social tags, headings and text, as two equal halves; shown in tenths, n/10. A home page or robots.txt that could not be read draws no bar and says why.",
      source: "src/lib/measure/drivers.ts#foundationsOf",
      cadence: "Each free scan, and each re-score of a stored report.",
    },
    {
      id: "report-content",
      shown: { on: "report", key: "verdict.factor.answerability" },
      definition:
        "How answer-shaped the text of the pages read is: headings worded as questions, headings answered directly, and figures, dates and citations per 1,000 characters, pooled over every page read; shown in tenths, n/10. No page read draws no bar and says why.",
      source: "src/lib/measure/drivers.ts#answerabilityOf",
      cadence: "Each free scan, and each re-score of a stored report.",
    },
    {
      id: "report-google-presence",
      shown: { on: "report", key: "verdict.factor.google" },
      definition:
        "Of the market's searches whose Google results were read, the share on whose first page the site is, local pack included: the presence card's own count over its own denominator; shown in tenths, n/10. Where no search was read the bar shows a dash and the report says why.",
      source: "src/lib/market/rivals/presence.ts#buildPresenceCard",
      cadence: "Each free scan, and each re-score of a stored report.",
    },
    {
      id: "report-ai-presence",
      shown: { on: "report", key: "verdict.factor.ai" },
      definition:
        "Of the market's searches whose AI answer was read, the share whose answer named or linked the site: the AI-answers card's own count over its own denominator, with the pages' own questions counted beside them on a paid scan; shown in tenths, n/10. Where no AI answer was read, the bar shows a dash and the report says why.",
      source: "src/lib/measure/drivers.ts#namesOrLinks",
      cadence: "Each free scan, and each re-score of a stored report.",
    },
    {
      id: "report-presence",
      shown: { on: "report", key: "verdict.factor.presence" },
      definition:
        "Google and AI presence as one bar, at equal weight, or Google alone where AI answered none of the searches read; shown in tenths, n/10, on a stored report that did not keep the two halves apart. Never below 1.",
      source: "src/lib/measure/score.ts#presenceOf",
      cadence: "Each free scan, and each re-score of a stored report.",
    },
    {
      id: "report-ai-answers-mention",
      shown: { on: "report", key: "ai-answers.finding" },
      definition:
        "x of N: of the market's searches whose Google AI Overview came back with an answer, how many answers named or linked the site. Where AI answered none of enough searches read, the card says so instead of a figure.",
      source: "src/lib/measure/drivers.ts#namesOrLinks",
      cadence: "Each free scan.",
    },
    {
      id: "report-google-first-page",
      shown: { on: "report", key: "presence.finding" },
      definition:
        "x of N: of the market's searches whose Google results were read, how many show the site in the top ten or the local pack. A search not read counts in neither number.",
      source: "src/lib/market/rivals/presence.ts#buildPresenceCard",
      cadence: "Each free scan.",
    },
    {
      id: "overview-ai-linked",
      shown: { on: "tile", key: "overview-tile-ai-linked" },
      definition:
        "x of N: of the live pages whose own question was asked, how many the AI answer to that question linked, read off each page's stored weekly reading. Before any page's question is asked there is no figure.",
      source: "src/lib/measure/figures.ts#aiPagesOf",
      cadence: "Weekly, each Monday's pass.",
    },
    {
      id: "overview-ai-reads",
      shown: { on: "tile", key: "overview-tile-ai-reads" },
      definition:
        "Times an answer engine fetched a hosted page to answer someone over the last {BLOG_READS_WINDOW_D} days, with one bar per week kept; training crawlers and search indexers are not counted. Only on a hosted blog with a page live; anywhere else there is no figure.",
      source: "src/lib/publish/reads/model.ts#assembleBlogReads",
      cadence: "As the pages are read.",
    },
    {
      id: "overview-best-mover",
      shown: { on: "tile", key: "overview-tile-mover" },
      definition:
        "The live page whose place on its own search rose most since the reading before, of those above where they were first seen: its place, and the places gained since it was first seen. A week where none rose says so; with no place read there is no figure.",
      source: "src/lib/measure/figures.ts#bestMoverOf",
      cadence: "Weekly, each Monday's pass.",
    },
    {
      id: "overview-score-month",
      shown: { on: "tile", key: "overview-tile-score" },
      definition:
        "The Visibility Score the weekly pass of the month's first Monday stored, beside the score at the customer's own scan. Before the first such pass there is no figure, and the day it is taken is named.",
      source: "src/lib/measure/figures.ts#monthFiguresOf",
      cadence: "Monthly, on the first Monday.",
    },
    {
      id: "overview-market-month",
      shown: { on: "tile", key: "overview-tile-market" },
      definition:
        "x of N: of the market's biggest searches the month's first Monday pass measured, how many show the site on Google's first page, beside the count at the customer's own scan.",
      source: "src/lib/measure/figures.ts#monthFiguresOf",
      cadence: "Monthly, on the first Monday.",
    },
    {
      id: "overview-reputation",
      shown: { on: "tile", key: "overview-tile-reputation" },
      definition:
        "x of N: of the unbranded tracked prompts' AI answers read over the {ANSWER_RATE_WEEKS} weeks to the month's first Monday, how many named or linked the site; N is every such answer read, never the prompts. The range beside it is shown once {MENTION_RATE_MIN_WEEKS} weeks of the set exist.",
      source: "src/lib/market/prompts/rate.ts#measurePrompts",
      cadence: "Monthly, on the first Monday.",
    },
  ]
  // measures:end
) as const satisfies readonly Measure[];

export const MEASURES: readonly Measure[] = Object.freeze(LIST);

type Keys = { readonly [M in (typeof LIST)[number] as M["id"]]: M["shown"]["key"] };
export type MeasureId = keyof Keys;

const KEYS = Object.fromEntries(LIST.map((measure) => [measure.id, measure.shown.key])) as Keys;

/** The key a registered number is drawn under: a tile or a mail row reads
 *  it from here, so a number with no entry does not typecheck. */
export function shownKey<I extends MeasureId>(id: I): Keys[I] {
  return KEYS[id];
}
