// SPEC §7 (owner, 2026-10-10, issue 1390) — the library half of the prose
// check: `slopless`'s rules, run over an English page through textlint's
// kernel.
//
// **Why a library.** The turns of phrase a model reaches for are a moving
// list somebody else already keeps; the rules read structure ("not X. It's
// Y."), not a word list alone. The rules run here are the ones whose habit
// the owner named and the measurement found on stored pages
// (`docs/walk/prose-gate.md`): the reframe and the aphorism, the summing-up
// ending, signposting and stock openers, stacked fragments and the stock
// vocabulary. Its orthography, readability and fiction rules are not run:
// they flag what people's pages do as often as ours.
//
// **Loaded when a page is checked, never before.** The kernel and the rules
// are a server's: nothing a browser bundle imports reaches this file
// (`../rules/index.ts` imports it lazily, inside `runHardRules`).
//
// A run that fails — a rule that throws, a module that did not load — flags
// nothing and logs once: the page is still held to every count in
// `./prose.ts`, and is never stopped for a check that did not run.
import { TextlintKernel, type TextlintKernelRule } from "@textlint/kernel";
import markdown from "@textlint/textlint-plugin-markdown";
import type { Tell } from "./prose-english";

type RuleModule = { default: TextlintKernelRule["rule"] };

/** The plugin is CommonJS with a `default` of its own: a bundler hands over
 *  that default, Node's own loader the module around it. */
const plugin = (markdown as unknown as { default?: typeof markdown }).default ?? markdown;

/** The `slopless` rules run, each loaded by its own path. `word` marks the
 *  vocabulary rules, which flag one word at a time. */
const RULES: readonly { id: string; word?: true; load: () => Promise<RuleModule> }[] = [
  { id: "negation-reframe", load: () => import("slopless/rules/syntactic-patterns/contrast/negation-reframe") },
  { id: "contrastive-aphorism", load: () => import("slopless/rules/syntactic-patterns/contrast/contrastive-aphorism") },
  { id: "summative-closer", load: () => import("slopless/rules/syntactic-patterns/closers/summative-closer") },
  { id: "boilerplate-conclusion", load: () => import("slopless/rules/syntactic-patterns/closers/boilerplate-conclusion") },
  { id: "affirmation-closers", load: () => import("slopless/rules/syntactic-patterns/closers/affirmation-closers") },
  { id: "generic-signposting", load: () => import("slopless/rules/syntactic-patterns/lead-ins/generic-signposting") },
  { id: "boilerplate-framing", load: () => import("slopless/rules/syntactic-patterns/lead-ins/boilerplate-framing") },
  { id: "llm-openers", load: () => import("slopless/rules/syntactic-patterns/lead-ins/llm-openers") },
  { id: "lesson-framing", load: () => import("slopless/rules/syntactic-patterns/lead-ins/lesson-framing") },
  { id: "response-wrapper", load: () => import("slopless/rules/syntactic-patterns/llm-artifacts/response-wrapper") },
  { id: "fragment-stacking", load: () => import("slopless/rules/syntactic-patterns/repetition/fragment-stacking") },
  { id: "repeated-sentence-starts", load: () => import("slopless/rules/syntactic-patterns/repetition/repeated-sentence-starts") },
  { id: "llm-vocabulary", word: true, load: () => import("slopless/rules/words/llm-vocabulary") },
  { id: "llm-vocabulary-density", word: true, load: () => import("slopless/rules/words/llm-vocabulary-density") },
  { id: "prohibited-words", word: true, load: () => import("slopless/rules/words/prohibited-words") },
];

let loaded: Promise<TextlintKernelRule[]> | null = null;
const rules = (): Promise<TextlintKernelRule[]> =>
  (loaded ??= Promise.all(
    RULES.map(async (row) => {
      const read = await row.load();
      const rule = (read.default as unknown as Partial<RuleModule>).default ?? read.default;
      return { ruleId: row.id, rule, options: true };
    })
  ));

const WORDS = new Set(RULES.filter((row) => row.word === true).map((row) => row.id));
/** As much of a flagged passage as a fix note carries. */
const FOUND_MAX_CHARS = 160;

/** What `slopless` flags in `text` (Markdown): each turn of phrase in the
 *  page's own words, with the rule that flagged it. Empty where the run
 *  failed. */
export async function lintProse(text: string): Promise<Tell[]> {
  try {
    const result = await new TextlintKernel().lintText(text, {
      ext: ".md",
      plugins: [{ pluginId: "markdown", plugin }],
      rules: await rules(),
    });
    const counts = new Map<string, Tell>();
    for (const message of result.messages) {
      const [from, to] = message.range;
      const found = text.slice(from, Math.max(to, from + 1)).replace(/\s+/g, " ").trim().slice(0, FOUND_MAX_CHARS).toLowerCase();
      const key = `${message.ruleId}\n${found}`;
      const held = counts.get(key);
      if (held !== undefined) held.count++;
      else counts.set(key, { pattern: message.ruleId, text: found, count: 1, ...(WORDS.has(message.ruleId) ? { word: true as const } : {}) });
    }
    return [...counts.values()];
  } catch (error) {
    console.warn(JSON.stringify({ event: "prose_lint_failed", error: String(error).slice(0, 200) }));
    return [];
  }
}
