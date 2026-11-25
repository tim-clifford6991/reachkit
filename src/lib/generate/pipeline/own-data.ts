// SPEC §7 *Two pools of facts*: a page carries one fact from the site's own measured data,
// where one exists and is on its topic.
//
// Read from the stored report at 0¢: a tracked prompt's mention rate with its sample, a page's Google position, or
// how many tracked AI answers named a rival. Each states the measurement and its date only, in the business's voice
// ("our measurements"), never an outcome the sample cannot carry and never who measured it. An ask that did not
// answer is not in the sample, so a reading that was not measured is never offered as 0.
import type { Language } from "@/lib/locale/locales";
import type { StoredReport } from "@/lib/scan/report";
import { topicWords } from "../rules/gaps";

/** The one own-data fact a page states once. */
export interface OwnDataFact {
  passage: string;
  /** The day it was measured, `YYYY-MM-DD`. */
  measuredAt: string;
  /** The plain source line: what was measured. */
  source: string;
}

type Report = Pick<StoredReport, "complete" | "verdict" | "prompts" | "ownRankedRows">;

/** Below this many answers a share is no finding: the passage says all or none plainly, and a split is not offered. */
const COUNTED_FROM = 5;

/** "2 of 7 AI answers", or below `COUNTED_FROM` the plain whole ("both AI answers", "neither AI answer"), else `null`. */
function answersSaid(count: number, total: number): string | null {
  if (total >= COUNTED_FROM) return `${count} of ${total} AI answers`;
  if (count === total) return total === 1 ? "the one AI answer" : total === 2 ? "both AI answers" : `all ${total} AI answers`;
  if (count === 0) return total === 2 ? "neither AI answer" : `none of the ${total} AI answers`;
  return null;
}

/** How many of the topic's words a text shares. */
const shared = (topic: ReadonlySet<string>, text: string): number => [...topicWords(text)].filter((word) => topic.has(word)).length;

/** The on-topic own-data fact for a page on `searches`, or `null` where the report measured none on its topic. */
export function ownDataFact(report: Report, searches: readonly string[], business: string, language: Language = "en"): OwnDataFact | null {
  const at = new Date(report.verdict?.measuredAt ?? NaN);
  // A reading with no date is not a measurement anyone can check.
  if (!report.complete || searches.length === 0 || Number.isNaN(at.getTime())) return null;
  const topic = topicWords(searches.join(" "));
  const measuredAt = at.toISOString().slice(0, 10);
  // As a person writes the day in the page's language; the search is named by the page's subject, never quoted raw.
  const date = new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(at);
  const prompts = report.prompts;
  const prompt = (prompts?.asked ?? [])
    .map((asked) => ({ answers: (prompts?.answers ?? []).filter((answer) => answer.promptId === asked.id), on: shared(topic, asked.text) }))
    .map((row) => {
      const named = row.answers.filter((answer) => answer.named || answer.linked).length;
      const rivals = row.answers.filter((answer) => answer.rivals.length > 0).length;
      // A rival count says more than a mention rate of none.
      const [count, what] = named === 0 && rivals > 0 ? [rivals, "named a competitor"] : [named, `named ${business}`];
      return { ...row, said: answersSaid(count, row.answers.length), what };
    })
    .filter((row) => row.on > 0 && row.answers.length > 0 && row.said !== null)
    .sort((a, b) => b.on - a.on)[0];
  if (prompt !== undefined) {
    return {
      passage: `In our measurements on ${date}, ${prompt.said} on this subject ${prompt.what}.`,
      measuredAt,
      source: `Our own measurements of AI answers, ${date}`,
    };
  }
  const ranked = report.ownRankedRows
    .filter((row) => Number.isFinite(row.position) && row.position > 0 && shared(topic, row.keyword) > 0)
    .sort((a, b) => shared(topic, b.keyword) - shared(topic, a.keyword) || a.position - b.position)[0];
  if (ranked === undefined) return null;
  return {
    passage: `In our measurements on ${date}, our page ${ranked.url} was at position ${ranked.position} in Google's results for a search on this subject.`,
    measuredAt,
    source: `Our own measurements of Google's results, ${date}`,
  };
}
