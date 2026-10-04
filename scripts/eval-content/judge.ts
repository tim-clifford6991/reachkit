// scripts/eval-content/judge.ts — the model half of the grader: two pages,
// read blind, in pairs (#1158).
//
// Round 1 scored each page alone, 0–3, on the small tier, and everything
// bunched at 3. A judge is far better at saying which of two pages is the
// better one than at placing one page on a scale, so that is all it is asked:
// page X or page Y, on four criteria and overall. Each pair is read twice
// with the order swapped, because a judge favours a position; a page wins a
// pair only where it wins both readings. What is reported is how often a
// page won, never a score.
//
// The judge is told today's date (round 1's took 2026-09-29 for a future
// date), what the business's own site and founder say (so "accurate about
// the business" is checked against something), and what the target's top
// results claim (so "adds" is too). It is not told which arm wrote a page.
// Whether a figure is invented is not asked of it: `grade.ts` traces every
// number in code.
import Anthropic from "@anthropic-ai/sdk";
import { costCentsFor, tierBinding } from "@/lib/llm/tiers";

export const CRITERIA = {
  accuracy: "Accurate about the business: what it says the business is, does, costs and measures matches the business facts below, and it claims nothing they do not state.",
  adds: "Adds beyond the top results: a reader who had read the top results' claims below would still learn something specific and useful here.",
  intent: "Matches the searcher's intent: someone who typed the page's target search gets what they came for, fully and near the top.",
  editorial: "Editorial quality: clear, well organised, specific, free of filler, repetition, leftover markup or internal labels; a reader would trust it and an editor would publish it.",
} as const;
export type Criterion = keyof typeof CRITERIA;
const CRITERION_NAMES = Object.keys(CRITERIA) as Criterion[];

export interface JudgedPage {
  id: string;
  search: string;
  title: string;
  body: string;
  /** What the target's top results claim, in their words. */
  resultClaims: readonly string[];
}

export interface Reading {
  /** The page shown as X, then the page shown as Y. */
  order: [string, string];
  /** The page id that won each criterion, or `null` for a tie. */
  criteria: Record<Criterion, { winner: string | null; why: string }>;
  overall: string;
  why: string;
}

export interface PairVerdict {
  pages: [string, string];
  readings: Reading[];
  /** The page that won both readings overall; `null` where they split. */
  pick: string | null;
  /** Of the decisions made across both readings — four criteria and the
   *  overall call, ties left out — the share each page won. */
  winRate: Record<string, number>;
}

export interface JudgeCall {
  model: string;
  tokensIn: number;
  tokensOut: number;
  cents: number;
}

export interface JudgeSpend {
  /** Throws where the call may not be made. */
  guard(reserveCents: number): void;
  record(call: JudgeCall): void;
}

const side = { type: "string", enum: ["X", "Y", "tie"] } as const;
const JUDGE_TOOL: Anthropic.Tool = {
  name: "verdict",
  description: "Record which of the two pages is better.",
  input_schema: {
    type: "object",
    properties: {
      ...Object.fromEntries(
        CRITERION_NAMES.flatMap((name) => [
          [`${name}_why`, { type: "string", description: `One sentence comparing X and Y on: ${CRITERIA[name]}` }],
          [name, side],
        ])
      ),
      overall_why: { type: "string", description: "Two sentences: what decides it." },
      overall: { type: "string", enum: ["X", "Y"], description: "The page a business owner should publish. No tie." },
    },
    required: [...CRITERION_NAMES.flatMap((name) => [`${name}_why`, name]), "overall_why", "overall"],
  },
};

const MAX_TOKENS = 900;

export function judgePrompt(a: { today: string; business: string; domain: string; businessFacts: readonly string[]; x: JudgedPage; y: JudgedPage }): string {
  const shared = a.x.search === a.y.search;
  const claims = (page: JudgedPage) => (page.resultClaims.length === 0 ? ["(none could be read)"] : page.resultClaims.map((claim) => `- ${claim}`));
  return [
    `Today is ${a.today}. You are an editor choosing between two web pages written for ${a.business} (${a.domain}) to publish on its own site. A date on a page that is on or before today is not an error.`,
    "Read both pages whole, then say which is better on each criterion and overall. Judge each page against its own target search. Judge what a reader would meet; do not reward length for its own sake, and do not guess who wrote either page.",
    "",
    "CRITERIA",
    ...CRITERION_NAMES.map((name) => `- ${name}: ${CRITERIA[name]}`),
    "",
    "=== BUSINESS FACTS (from the business's own site and its founder)",
    ...a.businessFacts.map((fact) => `- ${fact}`),
    "",
    ...(shared
      ? [`=== WHAT THE TOP RESULTS FOR "${a.x.search}" CLAIM`, ...claims(a.x)]
      : [`=== WHAT THE TOP RESULTS FOR X'S SEARCH, "${a.x.search}", CLAIM`, ...claims(a.x), "", `=== WHAT THE TOP RESULTS FOR Y'S SEARCH, "${a.y.search}", CLAIM`, ...claims(a.y)]),
    "",
    `=== PAGE X — target search: "${a.x.search}"`,
    `# ${a.x.title}`,
    "",
    a.x.body.trim(),
    "",
    `=== PAGE Y — target search: "${a.y.search}"`,
    `# ${a.y.title}`,
    "",
    a.y.body.trim(),
  ].join("\n");
}

async function read(
  spend: JudgeSpend,
  a: { today: string; business: string; domain: string; businessFacts: readonly string[]; x: JudgedPage; y: JudgedPage }
): Promise<Reading | null> {
  // Sonnet 5: the page's own writer tier, the floor #1158 sets for a judge.
  const binding = tierBinding("writer");
  const prompt = judgePrompt(a);
  spend.guard(costCentsFor("writer", Math.ceil(prompt.length / 3), MAX_TOKENS));
  const message = await new Anthropic({ apiKey: binding.apiKey, timeout: 180_000, maxRetries: 2 }).messages.create({
    model: binding.modelId,
    max_tokens: MAX_TOKENS,
    // A forced tool and thinking do not go together on this tier.
    thinking: { type: "disabled" },
    tools: [JUDGE_TOOL],
    tool_choice: { type: "tool", name: JUDGE_TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });
  spend.record({
    model: binding.modelId,
    tokensIn: message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
    cents: costCentsFor("writer", message.usage.input_tokens, message.usage.output_tokens),
  });
  const use = message.content.find((block) => block.type === "tool_use");
  const input = use?.type === "tool_use" ? (use.input as Record<string, unknown>) : null;
  if (input === null || (input.overall !== "X" && input.overall !== "Y")) return null;
  const idOf = (value: unknown): string | null => (value === "X" ? a.x.id : value === "Y" ? a.y.id : null);
  return {
    order: [a.x.id, a.y.id],
    criteria: Object.fromEntries(
      CRITERION_NAMES.map((name) => [name, { winner: idOf(input[name]), why: String(input[`${name}_why`] ?? "") }])
    ) as Reading["criteria"],
    overall: idOf(input.overall)!,
    why: String(input.overall_why ?? ""),
  };
}

/** What two readings add up to. */
export function tally(pages: [string, string], readings: readonly Reading[]): PairVerdict {
  const wins: Record<string, number> = { [pages[0]]: 0, [pages[1]]: 0 };
  for (const reading of readings) {
    for (const name of CRITERION_NAMES) {
      const winner = reading.criteria[name].winner;
      if (winner !== null) wins[winner] = (wins[winner] ?? 0) + 1;
    }
    wins[reading.overall] = (wins[reading.overall] ?? 0) + 1;
  }
  const decided = wins[pages[0]]! + wins[pages[1]]!;
  const overall = new Set(readings.map((reading) => reading.overall));
  return {
    pages,
    readings: [...readings],
    pick: readings.length === 2 && overall.size === 1 ? readings[0]!.overall : null,
    winRate: { [pages[0]]: decided === 0 ? 0 : wins[pages[0]]! / decided, [pages[1]]: decided === 0 ? 0 : wins[pages[1]]! / decided },
  };
}

/** One pair, read twice with the order swapped. */
export async function judgePair(
  spend: JudgeSpend,
  a: { today: string; business: string; domain: string; businessFacts: readonly string[]; first: JudgedPage; second: JudgedPage; held: readonly Reading[] }
): Promise<PairVerdict> {
  const readings: Reading[] = [];
  for (const [x, y] of [[a.first, a.second], [a.second, a.first]] as const) {
    // A reading already bought, in this order, is not bought again.
    const reading = a.held.find((each) => each.order[0] === x.id && each.order[1] === y.id) ?? (await read(spend, { ...a, x, y }));
    if (reading !== null) readings.push(reading);
  }
  return tally([a.first.id, a.second.id], readings);
}
