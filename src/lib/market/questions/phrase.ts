// BUILD §6.7 step 4 — phrase the selected searches as questions (issue #26; WO-075's plan)
//
// "Template-first … the LLM only words the question. **Phrasing never changes
// which searches were selected**." Two things make that structural rather
// than aspirational:
//
//   1. `Question.search` is carried by reference from the selection. Nothing
//      here reads it, rewrites it, or lets the model supply one.
//   2. The schema this call parses admits `{ id, text }` and nothing else, so
//      a model that returns a keyword has produced an **unparseable
//      response**, not a re-selection — and an unparseable response is
//      `llm()`'s own `unmeasured`, which degrades to the template below.
//
// **This is the free path's second nano call, and that is deliberate.** BUILD
// §6.7 step 4 reads "nano, same call as step 1", which is arithmetically
// impossible: deterministic selection sits between step 1 and step 4, so this
// call's input does not exist when the profile call is issued. BP-025
// decision 2 settles it at two nano calls, ≈0.6¢ against a 12¢ cap. Folding
// them back into one would let the model see the candidate set before
// selection runs — exactly the coupling §6.7 forbids.
//
// **A failed phrasing degrades, it never drops.** The returned array is
// always exactly as long as the selection handed in: a missing question would
// silently change the denominator every other number on the AI-answers card
// is read against. `phrasing` records which of the two produced each wording.
//
// **Cold-start law (§6.6).** An empty selection is a complete result —
// `zero` with `[]`, and no model call, because there is nothing to word.
//
// The template forms are mechanical transforms of the keyword — BUILD §6.7
// step 4's own "best X" / "X vs Y" shapes — not sentences the product speaks
// in its own voice, so no copy key is minted here (BP-025 decision 3).
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import { measured, measuredZero, type Measured } from "@/lib/measure/measured";
import type { SelectedSearch } from "./select";

/** BP-025 `## Public interface`. */
export interface Question {
  id: string; // stable within a scan; the matrix keys on it
  text: string; // the wording only
  search: SelectedSearch; // carried, never returned by the model
  phrasing: "template" | "model";
}

/** `.strictObject` per element: a response carrying a `keyword`, a `volume`
 *  or a `rank` does not parse, so the model has no field to re-select in.
 *
 *  The list rides inside one `questions` field (issue #512): `llm()` asks
 *  for every answer as a forced tool call, and a tool's input is an object,
 *  so a top-level array is wrapped here and unwrapped below. */
const PHRASING_SCHEMA = z.strictObject({
  questions: z.array(z.strictObject({ id: z.string(), text: z.string() })),
});

/** The keyword shapes BUILD §6.7 step 4 names, plus the bare fallback that
 *  makes the template form total — every keyword has one, which is why a
 *  phrasing failure can never remove a question. */
const TEMPLATES: ReadonlyArray<readonly [RegExp, (m: RegExpMatchArray) => string]> = Object.freeze([
  [/^best (.+)$/, (m) => `What's the best ${m[1]}?`],
  [/^(.+?) (?:vs|versus) (.+)$/, (m) => `${sentenceCase(m[1] ?? "")} or ${m[2]} — which should I pick?`],
  [/^(.+?) alternatives?$/, (m) => `What are the alternatives to ${m[1]}?`],
  [/^top (?:\d+ )?(.+)$/, (m) => `What are the top ${m[1]}?`],
  [/^how (?:to|do i|can i) (.+)$/, (m) => `How do I ${m[1]}?`],
  [/^what (is|are) (.+)$/, (m) => `What ${m[1]} ${m[2]}?`],
]);

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Total over every keyword: the shapes above where one matches, otherwise
 *  the search itself as a question. */
export function templateQuestion(keyword: string): string {
  const text = keyword.toLowerCase().trim().replace(/\s+/g, " ");
  for (const [pattern, build] of TEMPLATES) {
    const match = text.match(pattern);
    if (match) return build(match);
  }
  return `${sentenceCase(text)}?`;
}

/**
 * One question per selected search, in the selection's own order, each
 * carrying the search it stands for.
 *
 * Exactly one `llm()` call is issued, and only for a non-empty selection. Its
 * input is the ids and keywords of the selected searches and nothing else —
 * no volume, no intent, no rank, no unselected row of the market — so the
 * model cannot see, and therefore cannot influence, what selection decided.
 */
export async function phraseQuestions(
  c: CostContext,
  a: { selected: SelectedSearch[] }
): Promise<Measured<Question[]>> {
  if (a.selected.length === 0) {
    logPhrasing(0, 0);
    return measuredZero<Question[]>([], new Date());
  }

  const ids = a.selected.map((search) => `q${search.rank}`);
  const worded = await llm(c, {
    site: "question-phrasing",
    input: a.selected.map((search, index) => ({ id: ids[index], keyword: search.keyword })),
    schema: PHRASING_SCHEMA,
    tier: "nano",
  });

  const wordings = new Map<string, string>();
  if (worded.kind !== "unmeasured") {
    for (const item of worded.value.questions) {
      if (!wordings.has(item.id)) wordings.set(item.id, item.text);
    }
  }

  const questions: Question[] = a.selected.map((search, index) => {
    const id = ids[index]!;
    const text = wordings.get(id)?.trim();
    return text !== undefined && text !== ""
      ? { id, text, search, phrasing: "model" }
      : { id, text: templateQuestion(search.keyword), search, phrasing: "template" };
  });

  logPhrasing(questions.length, questions.filter((q) => q.phrasing === "template").length);
  // Always `measured`: the questions exist however they were worded. The
  // wording is not the measurement — the searches are.
  return measured(questions, worded.at);
}

/** BP-025 `## NFR budget`: "phrasing fallbacks". Counts only — never a
 *  question's wording and never a keyword. */
function logPhrasing(questions: number, fallbacks: number): void {
  console.log(JSON.stringify({ event: "question_phrasing", questions, fallbacks }));
}
