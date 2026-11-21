// Each number a customer is shown has one definition, and this registry is it.

/** Where a number is shown: an Overview tile by its test id, which the Monday
 *  mail draws under the same words, or a free-report figure by the copy key of
 *  the name it is shown under. */
export interface Shown {
  readonly on: "tile" | "report";
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
      id: "overview-ai-reads",
      shown: { on: "tile", key: "overview-tile-ai-reads" },
      definition:
        "Times an answer engine fetched a hosted page to answer someone over the last {BLOG_READS_WINDOW_D} days, beside the week before where one was counted; training crawlers and search indexers are not counted. Only on a hosted blog with a page live; anywhere else there is no figure.",
      source: "src/lib/publish/reads/model.ts#assembleBlogReads",
      cadence: "As the pages are read.",
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
      id: "overview-total-ai",
      shown: { on: "tile", key: "overview-total-ai" },
      definition:
        "Times AI mentioned you, so far: the sum over each week's weekly pass that passed its own health checks of the tracked-prompt answers that mention or link the site, the branded prompts left out, from the first such pass. A week with no healthy pass adds nothing and says so; an answer not read is not counted. Before the first, a dash and the day it is taken.",
      source: "src/lib/measure/totals.ts#totalsOf",
      cadence: "Weekly, each Monday's pass.",
    },
    {
      id: "overview-total-google",
      shown: { on: "tile", key: "overview-total-google" },
      definition:
        "Google searches that have shown you, so far: the distinct searches on which a page ReachKit published, live at the time, was read at places 1 to 100 in any weekly pass, each counted once from the first week it was. Counted from the first pass after a page went live.",
      source: "src/lib/measure/totals.ts#totalsOf",
      cadence: "Weekly, each Monday's pass.",
    },
    {
      id: "overview-total-pages",
      shown: { on: "tile", key: "overview-total-pages" },
      definition:
        "Pages published so far: every distinct address ReachKit has published a page at, counted from the week it first went live; a page stopped or merged later stays counted.",
      source: "src/lib/measure/totals.ts#totalsOf",
      cadence: "As each page goes live.",
    },
  ]
  // measures:end
) as const satisfies readonly Measure[];

type Keys = { readonly [M in (typeof LIST)[number] as M["id"]]: M["shown"]["key"] };
export type MeasureId = keyof Keys;

const KEYS = Object.fromEntries(LIST.map((measure) => [measure.id, measure.shown.key])) as Keys;

/** The key a registered number is drawn under: a tile reads
 *  it from here, so a number with no entry does not typecheck. */
export function shownKey<I extends MeasureId>(id: I): Keys[I] {
  return KEYS[id];
}
