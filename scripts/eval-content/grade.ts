// scripts/eval-content/grade.ts — the rubric of #1132.
//
// Two halves. `checklist` is computed in code from the draft the pipeline
// wrote, over the product's own Markdown model (`parseMarkdown`, the one
// serialiser the screen, the hosted page and WordPress share). `modelGrade`
// is one model call that judges what code cannot: business fit, what the page
// adds beside the top results, navigation text and invented figures.
//
// The rubric reads SPEC §7's 2026-09-29 lines (*What every page carries*,
// *Length and the writer*). Byline and dates are the hosted page's chrome
// (#1140), not the draft's, so they are not checked here.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import { costCentsFor, tierBinding } from "@/lib/llm/tiers";
import type { OpportunityType } from "@/lib/opportunities/types";
import { headingsUnderTitle, parseMarkdown, type Block, type Inline } from "@/lib/publish/render/markdown";

/** SPEC §7 (2026-09-29) *Length and the writer*, in words of body text. The
 *  SPEC names three kinds of page; each Write type is read as the nearest
 *  one: a listing or a format page compares options, a keyword page answers
 *  a problem or a how-to. A search that asks for the best, the top, an
 *  alternative or a versus compares options whatever its type
 *  (`targetOf`). */
export const LENGTH_TARGETS: Readonly<Record<string, { floor: number; ceiling: number; kind: string }>> = Object.freeze({
  answer_page: { floor: 1200, ceiling: 1800, kind: "answer" },
  comparison_page: { floor: 1500, ceiling: 2500, kind: "comparison" },
  listed_page: { floor: 1500, ceiling: 2500, kind: "comparison" },
  format_page: { floor: 1500, ceiling: 2500, kind: "comparison" },
  keyword_page: { floor: 1200, ceiling: 2000, kind: "problem or how-to" },
});

function inlineText(nodes: readonly Inline[]): string {
  return nodes.map((node) => ("text" in node ? node.text : inlineText(node.children))).join("");
}

export function blockText(block: Block): string {
  switch (block.kind) {
    case "heading":
    case "paragraph":
    case "quote":
      return inlineText(block.children);
    case "list":
      return block.items.map(inlineText).join(" ");
    case "code":
      return block.text;
    case "table":
      return [block.head, ...block.rows].map((row) => row.map(inlineText).join(" ")).join(" ");
    case "answer":
      return block.children.map(blockText).join(" ");
    case "guides":
      return block.items.map((item) => item.label).join(" ");
    case "rule":
      return "";
  }
}

function links(nodes: readonly Inline[]): string[] {
  return nodes.flatMap((node) =>
    node.kind === "link" ? [node.href, ...links(node.children)] : "children" in node ? links(node.children) : []
  );
}

export function blockLinks(block: Block): string[] {
  switch (block.kind) {
    case "heading":
    case "paragraph":
    case "quote":
      return links(block.children);
    case "list":
      return block.items.flatMap(links);
    case "table":
      return [block.head, ...block.rows].flatMap((row) => row.flatMap(links));
    case "answer":
      return block.children.flatMap(blockLinks);
    default:
      return [];
  }
}

const words = (text: string): number => (text.match(/\S+/g) ?? []).length;

function hostOf(href: string): string | null {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const COMPARATIVE = /\b(best|top|vs|versus|alternatives?|compar\w*)\b/i;

/** The length a page is held to: a comparison's where the search compares
 *  options, else its type's. */
export function targetOf(type: OpportunityType, query: string): { floor: number; ceiling: number; kind: string } | null {
  return COMPARATIVE.test(query) ? LENGTH_TARGETS.comparison_page! : (LENGTH_TARGETS[type] ?? null);
}

export interface Checklist {
  words: number;
  target: { floor: number; ceiling: number; kind: string } | null;
  /** Each required block, and whether the draft carries it. `null` where the
   *  block is not required of this page. */
  blocks: Record<string, boolean | null>;
  businessFacts: number;
  /** Distinct public pages the body links to, off the business's own domain. */
  marketFacts: number;
  /** Passages the draft stood on that appear on three or more of the site's
   *  pages — navigation, by SPEC §5's drafted rule of 2026-09-29. */
  navigationFacts: number;
}

export function checklist(a: {
  bodyMarkdown: string;
  type: OpportunityType;
  query: string;
  domain: string;
  businessName: string;
  factsUsed: readonly { passage: string; url: string }[];
  faq: unknown;
  pages: readonly { text: string }[];
}): Checklist {
  // Headings as the hosted page sets them: the shallowest becomes an H2.
  const blocks = headingsUnderTitle(parseMarkdown(a.bodyMarkdown));
  const own = a.domain.replace(/^www\./, "");
  const isOwn = (href: string) => {
    const host = hostOf(href);
    return host !== null && (host === own || host.endsWith(`.${own}`));
  };

  const headings = blocks.flatMap((block, index) => (block.kind === "heading" ? [{ block, index }] : []));
  const h2 = headings.filter(({ block }) => block.level === 2);
  const firstH2 = h2[0]?.index ?? blocks.length;
  const first = blocks[0];
  const answerWords = first?.kind === "answer" ? words(blockText(first)) : 0;
  const lead = blocks.slice(0, firstH2);
  const takeaways = lead.find((block) => block.kind === "list");
  const takeawayCount = takeaways?.kind === "list" ? takeaways.items.length : 0;

  let levelsInOrder = headings.length > 0 && headings[0]!.block.level === 2;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i]!.block.level > headings[i - 1]!.block.level + 1 || headings[i]!.block.level < 2) levelsInOrder = false;
  }
  const opensWithAnswer =
    h2.length > 0 && h2.every(({ index }) => blocks[index + 1]?.kind === "paragraph" || blocks[index + 1]?.kind === "answer");

  const name = a.businessName.toLowerCase();
  const businessSection = h2.some(({ block, index }) => {
    const end = h2.find((next) => next.index > index)?.index ?? blocks.length;
    const section = blocks.slice(index, end);
    const text = section.map(blockText).join(" ").toLowerCase();
    return (inlineText(block.children).toLowerCase().includes(name) || text.includes(name)) && section.flatMap(blockLinks).some(isOwn);
  });

  const sourcesAt = headings.find(({ block }) => /\b(sources|references)\b/i.test(inlineText(block.children)));
  const sources =
    sourcesAt !== undefined &&
    blocks
      .slice(sourcesAt.index + 1)
      .flatMap(blockLinks)
      .some((href) => !isOwn(href));

  const last = [...blocks].reverse().find((block) => block.kind === "paragraph");
  const faq = Array.isArray(a.faq) ? a.faq.length : 0;
  const text = blocks.filter((block) => block.kind !== "guides").map(blockText).join(" ");
  const target = targetOf(a.type, a.query);

  const external = new Set(blocks.flatMap(blockLinks).filter((href) => hostOf(href) !== null && !isOwn(href)));
  const navigationFacts = a.factsUsed.filter(
    (fact) => a.pages.filter((page) => page.text.includes(fact.passage)).length >= 3
  ).length;

  return {
    words: words(text),
    target,
    blocks: {
      "short answer (40–60 words)": answerWords >= 40 && answerWords <= 60,
      "3–5 takeaways": takeawayCount >= 3 && takeawayCount <= 5,
      "question headings": h2.length > 0 && h2.every(({ block }) => inlineText(block.children).trim().endsWith("?")),
      "H2 then H3, in order": levelsInOrder,
      "sections open with an answer": opensWithAnswer,
      "6–10 sections": h2.length >= 6 && h2.length <= 10,
      "a table": target?.kind === "comparison" ? blocks.some((block) => block.kind === "table") : null,
      "how the business handles it": businessSection,
      "3–6 buyer questions (meta.faq)": faq >= 3 && faq <= 6,
      "sources list": sources,
      "closing action": last !== undefined && links(last.kind === "paragraph" ? last.children : []).length > 0,
    },
    businessFacts: a.factsUsed.length,
    marketFacts: external.size,
    navigationFacts,
  };
}

// ── The model's half ───────────────────────────────────────────────────

// A tool answer sometimes carries a number or a flag as a string.
const score = z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().int().min(0).max(3));
const flag = z.preprocess((v) => (v === "true" ? true : v === "false" ? false : v), z.boolean());
const GRADE = z.object({
  fit: score,
  fitWhy: z.string(),
  adds: score,
  addsWhy: z.string(),
  navigationText: flag,
  inventedFigures: flag,
  inventedWhy: z.string().default(""),
});
export type ModelGrade = z.infer<typeof GRADE>;

const GRADE_TOOL = {
  name: "grade",
  description: "Record the grade of one draft.",
  input_schema: {
    type: "object" as const,
    properties: {
      fit: { type: "integer", minimum: 0, maximum: 3, description: "Business fit of the topic: 3 the business's own offering is the answer to the search, 2 it plainly helps, 1 it can only be mentioned, 0 no relation." },
      fitWhy: { type: "string", description: "One sentence." },
      adds: { type: "integer", minimum: 0, maximum: 3, description: "What the draft adds that the listed top results lack: 0 nothing, 1 a little, 2 a clear addition, 3 a lot." },
      addsWhy: { type: "string", description: "One sentence naming what it adds, or what is missing." },
      navigationText: { type: "boolean", description: "True if the draft quotes or leans on menu, button, footer or demo-widget text as if it were a fact." },
      inventedFigures: { type: "boolean", description: "True if the draft states a number, price, percentage or count that none of the listed facts holds." },
      inventedWhy: { type: "string", description: "The first such figure, or an empty string." },
    },
    required: ["fit", "fitWhy", "adds", "addsWhy", "navigationText", "inventedFigures", "inventedWhy"],
  },
};

const GRADE_MAX_OUTPUT_TOKENS = 600;

/** One call, on the product's own tier and price, inside the page's own cost
 *  context — so the draft and its grade together stay inside
 *  `CAPS.DRAFT_C`. `null` where the cap refused it or the answer did not
 *  parse. */
export async function modelGrade(
  cost: CostContext,
  a: {
    business: { domain: string; category: string; job: string | null; products: readonly string[]; audience: readonly string[] };
    target: string;
    topResults: readonly { title: string; domain: string }[];
    title: string;
    bodyMarkdown: string;
    facts: readonly string[];
  }
): Promise<ModelGrade | null> {
  const binding = tierBinding("haiku");
  const prompt = [
    "You grade one web page a writing tool drafted for a business. Judge only what is written below.",
    "",
    `Business: ${a.business.domain}. Category: ${a.business.category}. What it does: ${a.business.job ?? "unknown"}.`,
    `Products: ${a.business.products.join("; ") || "unknown"}. Serves: ${a.business.audience.join("; ") || "unknown"}.`,
    `Target search: "${a.target}".`,
    "Top results for that search today (titles only):",
    ...a.topResults.map((row, i) => `${i + 1}. ${row.title} (${row.domain})`),
    "",
    "Facts the writer was given:",
    ...a.facts.map((fact, i) => `${i + 1}. ${fact}`),
    "",
    `Draft title: ${a.title}`,
    "Draft body (Markdown):",
    a.bodyMarkdown,
  ].join("\n");
  const inputTokens = Math.ceil(prompt.length / 3);

  const ask = () => cost.recordFetch<{ grade: ModelGrade | null; tokensIn: number; tokensOut: number }>({
    source: "eval.grade",
    cacheKey: `eval.grade:${a.business.domain}:${a.title}`,
    freshnessDays: 0,
    costCents: costCentsFor("haiku", inputTokens, GRADE_MAX_OUTPUT_TOKENS),
    settleCents: (payload) => costCentsFor("haiku", payload.tokensIn, payload.tokensOut),
    run: async () => {
      const client = new Anthropic({ apiKey: binding.apiKey, timeout: 60_000, maxRetries: 1 });
      const message = await client.messages.create({
        model: binding.modelId,
        max_tokens: GRADE_MAX_OUTPUT_TOKENS,
        tools: [GRADE_TOOL],
        tool_choice: { type: "tool", name: GRADE_TOOL.name },
        messages: [{ role: "user", content: prompt }],
      });
      const use = message.content.find((block) => block.type === "tool_use");
      const parsed = GRADE.safeParse(use?.type === "tool_use" ? use.input : null);
      if (!parsed.success) {
        // Field names only, never the answer.
        console.log(`   grade did not parse: ${parsed.error.issues.map((i) => `${i.path.join(".")}:${i.code}`).join(", ")}`);
      }
      return {
        grade: parsed.success ? parsed.data : null,
        tokensIn: message.usage.input_tokens,
        tokensOut: message.usage.output_tokens,
      };
    },
  });

  // One more ask where the answer did not parse, inside the same cap.
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await ask();
    if ("skipped" in result) return null;
    if (result.payload.grade !== null) return result.payload.grade;
  }
  return null;
}
