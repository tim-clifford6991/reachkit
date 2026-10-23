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
  /** The file and the function the number is computed by: `path#name`. */
  readonly source: string;
  /** When the number is read again. */
  readonly cadence: string;
}

export const MEASURES: readonly Measure[] = Object.freeze(
  // measures:begin
  [
    {
      id: "page-questions-cited",
      shown: { on: "mail", key: "mail.weekly.number.pageQuestions" },
      definition:
        "Of the published pages' own questions asked this week, how many AI answers linked the site. A week that asked none has no such row.",
      source: "src/lib/scan/weekly/movement.ts#weekMovement",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "ai-visits",
      shown: { on: "mail", key: "mail.weekly.number.aiVisits" },
      definition:
        "Pages an answer engine fetched on the hosted blog over the last {BLOG_READS_WINDOW_D} days, stated as at least that many. Only on a hosted blog with a page live; anywhere else there is no such row.",
      source: "src/lib/publish/reads/model.ts#assembleBlogReads",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "top-20-pages",
      shown: { on: "mail", key: "mail.weekly.number.top20" },
      definition:
        "Published pages whose search the site holds a place 1 to 20 for, counted from the week's stored verdict rows, with the change on the Monday before where both weeks stored places. A week that judged pages and stored no place is not measured.",
      source: "src/lib/mail/weekly/index.ts#top20Pages",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "pages-cited",
      shown: { on: "mail", key: "mail.weekly.number.pagesCited" },
      definition: "Distinct pages of the site the tracked AI answers cited over the last {ANSWER_RATE_WEEKS} weeks.",
      source: "src/lib/market/prompts/rate.ts#measurePrompts",
      cadence: "Weekly, in the Monday mail.",
    },
    {
      id: "ai-mention-rate",
      shown: { on: "mail", key: "mail.weekly.number.mentionRate" },
      definition:
        "The share of the tracked buyer prompts' AI answers over the last {ANSWER_RATE_WEEKS} weeks that named or linked the site, as a whole percentage with the range it likely sits in. Before {MENTION_RATE_MIN_WEEKS} weeks of the current prompt set, the count of answers that named it, with its sample.",
      source: "src/lib/market/prompts/rate.ts#measurePrompts",
      cadence: "Weekly, in the Monday mail.",
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
      source: "src/lib/measure/drivers.ts#searchPresenceOf",
      cadence: "Each free scan, and each re-score of a stored report.",
    },
    {
      id: "report-ai-presence",
      shown: { on: "report", key: "verdict.factor.ai" },
      definition:
        "Of the market's searches that showed an AI answer, how often that answer named or cited the site, with the pages' own questions counted beside them; shown in tenths, n/10. Where no AI answer was read, the bar shows a dash and the report says why.",
      source: "src/lib/measure/drivers.ts#aiPresenceOf",
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
        "x of N: of the market's searches whose Google AI Overview came back with an answer, how many answers named the site. Where AI answered none of enough searches read, the card says so instead of a figure.",
      source: "src/lib/market/questions/matrix.ts#buildAiAnswersCard",
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
      source: "src/app/(account)/app/_overview/figures.ts#aiPagesOf",
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
      source: "src/app/(account)/app/_overview/figures.ts#bestMoverOf",
      cadence: "Weekly, each Monday's pass.",
    },
    {
      id: "overview-score-month",
      shown: { on: "tile", key: "overview-tile-score" },
      definition:
        "The Visibility Score the weekly pass of the month's first Monday stored, beside the score at the customer's own scan. Before the first such pass there is no figure, and the day it is taken is named.",
      source: "src/app/(account)/app/_overview/store.ts#monthFiguresOf",
      cadence: "Monthly, on the first Monday.",
    },
    {
      id: "overview-market-month",
      shown: { on: "tile", key: "overview-tile-market" },
      definition:
        "x of N: of the market's biggest searches the month's first Monday pass measured, how many show the site on Google's first page, beside the count at the customer's own scan.",
      source: "src/app/(account)/app/_overview/store.ts#monthFiguresOf",
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
);

