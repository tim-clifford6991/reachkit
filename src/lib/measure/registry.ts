// Each number a customer is shown has one definition, here. `docs/MEASUREMENT.md`
// is generated from this list (`node scripts/measurement-doc.mjs`) and `audit`
// fails when the two differ, so the document cannot drift from the code.
//
// The list between the markers is plain JavaScript: the audit job has no
// TypeScript, and the generator evaluates that literal as it stands.
// `{NAME}` in a definition is a constant of `src/lib/config/constants.ts`,
// written into the document with its value.

/** Where a number is shown: an Overview tile by its test id, or a Monday
 *  mail row by its label's copy key. */
export interface Shown {
  readonly on: "tile" | "mail";
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
  ]
  // measures:end
);

