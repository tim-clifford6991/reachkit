// scripts/eval-content/prototype/arm-b.ts — arm B of #1153: the 2026-09-29
// content rulings (SPEC §0, §5, §6, §7), applied by one script so they can
// be judged beside today's pipeline before any of them is built. It is not
// product code and changes nothing under `src/`: it reads the #1132
// snapshot, calls the model and reads public pages, and returns a page.
// Nothing is published and nothing is written to a database.
//
//   1. **Knowledge base.** The snapshot's page text, kept only where it is
//      prose: a run of words repeated on three or more pages is navigation
//      and is dropped (SPEC §5's drafted rule), as are demo-widget runs. The
//      approved product copy in `README.md` stands in for the founder's five
//      answers, which setup does not ask yet, marked `founder`.
//   2. **Topic.** One small-tier call scores the report's candidates for
//      business fit 0–3 and proposes AI-answer-gap and product-anchored
//      searches (SPEC §6 *Topics by business fit*).
//   3. **Research.** The target's top three readable results — from the
//      stored top ten, or one web search where none is stored — and their
//      claims, copied word for word with address and read date. A statistic
//      older than three years is dropped.
//   4. **Write.** One Sonnet 5 call with the new rules as one prompt.
//   5. **Critic.** One Sonnet 5 call that scores the draft and may rewrite
//      it once. Both versions are kept.
//
// The model id is the one #1153 names, `claude-sonnet-5`, at $2 / $10 per
// million tokens (the claude-api skill's model table, cached 2026-09-25).
// The small tier is the product's own (`tierBinding("haiku")`).
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/config/env";
import { costCentsFor, tierBinding } from "@/lib/llm/tiers";
import { visibleText } from "@/lib/measure/parse";
import type { Snapshot } from "../snapshot";

export const WRITER_MODEL = "claude-sonnet-5";
const WRITER_CENTS_PER_M = { in: 200, out: 1000 } as const;
const WRITER_MAX_TOKENS = 32_000;
/** A web search is $10 per thousand. */
const SEARCH_CENTS = 1;

// ── Money ──────────────────────────────────────────────────────────────

export interface CallRow {
  page: string;
  step: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  searches: number;
  cents: number;
}

/** What every call is checked against before it is made, and recorded in
 *  after. The run's ceiling is #1153's 300¢; `guard` throws rather than let a
 *  call's most-possible cost carry the run past it. */
export interface Spend {
  guard(page: string, step: string, reserveCents: number): void;
  record(row: CallRow): void;
}

export const writerCents = (tokensIn: number, tokensOut: number): number =>
  (tokensIn / 1_000_000) * WRITER_CENTS_PER_M.in + (tokensOut / 1_000_000) * WRITER_CENTS_PER_M.out;

const estimateTokens = (text: string): number => Math.ceil(text.length / 3);

function client(): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 15 * 60_000, maxRetries: 2 });
}

/** One small-tier call that answers through one tool. */
async function smallTool<T>(
  spend: Spend,
  page: string,
  step: string,
  a: { prompt: string; tool: Anthropic.Tool; maxTokens: number }
): Promise<T | null> {
  const binding = tierBinding("haiku");
  spend.guard(page, step, costCentsFor("haiku", estimateTokens(a.prompt), a.maxTokens));
  const message = await client().messages.create({
    model: binding.modelId,
    max_tokens: a.maxTokens,
    tools: [a.tool],
    tool_choice: { type: "tool", name: a.tool.name },
    messages: [{ role: "user", content: a.prompt }],
  });
  spend.record({
    page,
    step,
    model: binding.modelId,
    tokensIn: message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
    searches: 0,
    cents: costCentsFor("haiku", message.usage.input_tokens, message.usage.output_tokens),
  });
  const use = message.content.find((block) => block.type === "tool_use");
  return use?.type === "tool_use" ? (use.input as T) : null;
}

/** A tool's array field. The small tier sometimes sends a nested array as
 *  a JSON string; both are read. */
export function arrayOf(value: unknown): Record<string, unknown>[] {
  let v = value;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v) as unknown;
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null) : [];
}

// ── 1. Knowledge base ──────────────────────────────────────────────────

export interface Fact {
  id: string;
  pool: "business" | "market";
  text: string;
  /** The page it was read from, or `founder`. */
  source: string;
  readAt: string;
}

const NGRAM = 4;
/** Demo widgets and form furniture: bullets and arrows, the demo's
 *  placeholder domains, a template slot, an input's placeholder address. */
const DEMO = /[·▲→]|example\.(com|net|org)|\[\[|\S+@\S+\.\w+ |^\//;

/** Each page's words, with every run of `NGRAM` words that appears on three
 *  or more pages cut out — header, menu and footer. What is left is split
 *  into sentences and kept where it reads as prose. */
function proseOf(pages: Snapshot["pages"]): { url: string; readAt: string; sentence: string }[] {
  const words = pages.map((page) => page.text.split(/\s+/).filter(Boolean));
  const seen = new Map<string, Set<number>>();
  words.forEach((list, p) => {
    for (let i = 0; i + NGRAM <= list.length; i++) {
      const key = list.slice(i, i + NGRAM).join(" ");
      const on = seen.get(key) ?? new Set<number>();
      on.add(p);
      seen.set(key, on);
    }
  });
  const out: { url: string; readAt: string; sentence: string }[] = [];
  words.forEach((list, p) => {
    const cut = new Array<boolean>(list.length).fill(false);
    for (let i = 0; i + NGRAM <= list.length; i++) {
      if ((seen.get(list.slice(i, i + NGRAM).join(" "))?.size ?? 0) >= 3) cut.fill(true, i, i + NGRAM);
    }
    const runs: string[] = [];
    let run: string[] = [];
    list.forEach((word, i) => {
      if (cut[i]) {
        if (run.length > 0) runs.push(run.join(" "));
        run = [];
      } else run.push(word);
    });
    if (run.length > 0) runs.push(run.join(" "));
    for (const text of runs) {
      for (const raw of text.split(/(?<=[.!?])\s+/)) {
        const sentence = raw.replace(/^\d{2}\s+/, "").trim();
        const tokens = sentence.split(/\s+/);
        const numeric = tokens.filter((t) => /^[\d.,:/]+$/.test(t)).length;
        if (tokens.length < 5 || tokens.length > 70) continue;
        if (!/[.!?]$/.test(sentence) || DEMO.test(sentence) || numeric / tokens.length > 0.2) continue;
        out.push({ url: pages[p]!.url, readAt: pages[p]!.readAt, sentence });
      }
    }
  });
  const unique = new Map(out.map((row) => [row.sentence, row]));
  return [...unique.values()];
}

/** The approved product copy in `README.md`: the quoted lines of its opening
 *  and the nine features' "what the user gets", each a founder's answer. */
export function founderAnswers(readme: string): string[] {
  const opening = readme.split("\n## ")[0] ?? "";
  const quoted = [...opening.replace(/\n/g, " ").matchAll(/"([^"]+)"/g)].map((m) => m[1]!.trim());
  const who = /For a founder[^.]*\./.exec(opening.replace(/\n/g, " "))?.[0];
  const price = quoted.filter((q) => q.startsWith("€") || q.startsWith("per month"));
  const sentences = quoted.filter((q) => !price.includes(q));
  const featureTable = /## The nine MVP features([\s\S]*?)\n## /.exec(readme)?.[1] ?? "";
  const features = [...featureTable.matchAll(/^\| \d \| ([^|]+) \| ([^|]+) \|$/gm)].map(
    (m) => `${m[1]!.trim()}: ${m[2]!.trim()}.`
  );
  return [
    ...(who === undefined ? [] : [who.replace(/;.*$/, ".").trim()]),
    ...sentences,
    ...(price.length > 0 ? [`One plan, ${price.join(" ")}.`] : []),
    ...features,
  ];
}

export function knowledgeBase(snapshot: Snapshot, readme: string, today: string): Fact[] {
  const read = proseOf(snapshot.pages).map((row, i) => ({
    id: `F${i + 1}`,
    pool: "business" as const,
    text: row.sentence,
    source: row.url,
    readAt: row.readAt.slice(0, 10),
  }));
  const founder = founderAnswers(readme).map((text, i) => ({
    id: `F${read.length + i + 1}`,
    pool: "business" as const,
    text,
    source: "founder",
    readAt: today,
  }));
  return [...read, ...founder];
}

// ── 2. Topic ───────────────────────────────────────────────────────────

export type PageKind = "answer" | "comparison" | "problem_howto";
export type TopicSource = "ai_gap" | "product" | "problem" | "buyer_question" | "best_x";

export interface Candidate {
  search: string;
  volume: number | null;
  /** The measured question's index in the report, where it is one. */
  question: number | null;
  /** Domains the AI answers cited for it, where it is a measured question. */
  aiCited: string[];
  origin: "question" | "suggestion" | "rival_keyword";
}

export interface Topic {
  search: string;
  fit: number;
  why: string;
  kind: PageKind;
  source: TopicSource;
  volume: number | null;
  question: number | null;
  proposed: boolean;
}

const SOURCE_ORDER: Readonly<Record<TopicSource, number>> = { ai_gap: 0, product: 1, problem: 2, buyer_question: 3, best_x: 4 };

const TOPIC_TOOL: Anthropic.Tool = {
  name: "topics",
  description: "Record the business fit of candidate searches, and proposed searches.",
  input_schema: {
    type: "object",
    properties: {
      scored: {
        type: "array",
        description: "Every numbered question, and every other candidate whose fit is 2 or 3.",
        items: {
          type: "object",
          properties: {
            search: { type: "string", description: "The candidate exactly as listed." },
            fit: { type: "integer", minimum: 0, maximum: 3 },
            kind: { type: "string", enum: ["answer", "comparison", "problem_howto"] },
            source: { type: "string", enum: ["product", "problem", "buyer_question", "best_x"] },
            why: { type: "string", description: "One short sentence." },
          },
          required: ["search", "fit", "kind", "source", "why"],
        },
      },
      proposed: {
        type: "array",
        description: "Up to eight searches a buyer types that the list lacks.",
        items: {
          type: "object",
          properties: {
            search: { type: "string", description: "Lower case, as typed into Google." },
            fit: { type: "integer", minimum: 0, maximum: 3 },
            kind: { type: "string", enum: ["answer", "comparison", "problem_howto"] },
            source: { type: "string", enum: ["ai_gap", "product", "problem", "buyer_question"] },
            why: { type: "string" },
          },
          required: ["search", "fit", "kind", "source", "why"],
        },
      },
    },
    required: ["scored", "proposed"],
  },
};

export async function chooseTopics(
  spend: Spend,
  a: { business: string; category: string; job: string; audience: string[]; rivals: string[]; kb: Fact[]; candidates: Candidate[] }
): Promise<{ all: Topic[]; ranked: Topic[] }> {
  const questions = a.candidates.filter((c) => c.origin === "question");
  const others = a.candidates.filter((c) => c.origin !== "question");
  const prompt = [
    `You choose what a content tool writes for ${a.business} (${a.category}): ${a.job}.`,
    `Serves: ${a.audience.join("; ")}. Rivals measured: ${a.rivals.join(", ")}.`,
    "",
    "What the business sells and says, from its site and its founder:",
    ...a.kb.map((f) => `- ${f.text}`),
    "",
    "Business fit, 0–3: 3 the business's own offering is the answer to the search; 2 it plainly helps; 1 it can only be mentioned; 0 no relation. Judge only from what is above — the business cannot be said to do anything it does not state.",
    "",
    "Measured buyer questions (AI answers cited the domains shown and never this business):",
    ...questions.map((c, i) => `${i + 1}. ${c.search} — volume ${c.volume ?? "?"}; AI cited: ${c.aiCited.join(", ") || "nothing"}`),
    "",
    "Other candidates (suggestions and rivals' ranked keywords):",
    others.map((c) => `${c.search} (${c.volume ?? "?"})`).join("; "),
    "",
    "Score every numbered question, and any other candidate at fit 2 or more. Then propose up to eight searches the list lacks, in this order of preference: questions where an AI answer names rivals and not this business (ai_gap); searches anchored on the product — the product against a named rival, a rival's alternatives, the category for one audience or use, price and cost, an integration (product); problems the product solves (problem); buyers' questions (buyer_question). Never propose two wordings of one question. kind: answer (a direct question), comparison (options compared), problem_howto (a problem or a how-to).",
  ].join("\n");
  const answer = await smallTool<{ scored?: unknown; proposed?: unknown }>(spend, "topics", "topic", {
    prompt,
    tool: TOPIC_TOOL,
    maxTokens: 4000,
  });
  const rows = arrayOf;
  const byKey = new Map(a.candidates.map((c) => [c.search.toLowerCase(), c]));
  const topic = (row: Record<string, unknown>, proposed: boolean): Topic | null => {
    const search = String(row.search ?? "").trim().toLowerCase();
    const fit = Number(row.fit);
    if (search === "" || !Number.isInteger(fit)) return null;
    const known = byKey.get(search);
    const kind = (["answer", "comparison", "problem_howto"] as const).find((k) => k === row.kind) ?? "answer";
    let source = (["ai_gap", "product", "problem", "buyer_question", "best_x"] as const).find((s) => s === row.source) ?? "buyer_question";
    // An AI-answer gap is a fact of the report, not the model's call.
    if (known?.origin === "question" && known.aiCited.length > 0) source = "ai_gap";
    return {
      search,
      fit,
      why: String(row.why ?? ""),
      kind,
      source,
      volume: known?.volume ?? null,
      question: known?.question ?? null,
      proposed: known === undefined && proposed,
    };
  };
  const all = [...rows(answer?.scored).map((r) => topic(r, false)), ...rows(answer?.proposed).map((r) => topic(r, true))].filter(
    (t): t is Topic => t !== null
  );
  const unique = [...new Map(all.map((t) => [t.search, t])).values()];
  const ranked = unique
    .filter((t) => t.fit >= 2)
    .sort((x, y) => y.fit - x.fit || SOURCE_ORDER[x.source] - SOURCE_ORDER[y.source] || (y.volume ?? 0) - (x.volume ?? 0));
  return { all: unique, ranked };
}

// ── 3. Research ────────────────────────────────────────────────────────

export interface Read {
  url: string;
  title: string;
  readAt: string;
  text: string;
}

export interface Research {
  search: string;
  /** Where the addresses came from. */
  from: "stored top ten" | "web search";
  /** Every address considered, in order, and why one was passed over. */
  tried: { url: string; note: string }[];
  reads: Read[];
  /** The top results' titles, as the grader reads them. */
  titles: { title: string; domain: string }[];
}

const READ_WORDS_MIN = 250;

export async function readPage(url: string, minWords = READ_WORDS_MIN): Promise<{ text: string; title: string } | string> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ReachKit-eval/1153; +https://reachkit.app)", accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return `HTTP ${response.status}`;
    const html = await response.text();
    const title = visibleText(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
    const text = visibleText(html);
    return text.split(/\s+/).length < minWords ? `under ${minWords} words readable` : { text, title };
  } catch (error) {
    return String((error as Error).message ?? error).slice(0, 80);
  }
}

/** One web search on the small tier, for a target with no stored top ten. */
export async function searchTopTen(spend: Spend, page: string, search: string): Promise<{ url: string; title: string }[]> {
  const binding = tierBinding("haiku");
  spend.guard(page, "search", SEARCH_CENTS + costCentsFor("haiku", 20_000, 200));
  const message = await client().messages.create({
    model: binding.modelId,
    max_tokens: 200,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1, user_location: { type: "approximate", country: "US" } }],
    messages: [{ role: "user", content: `Search the web once for exactly: ${search}\nThen reply with the single word: done.` }],
  });
  const searches = message.usage.server_tool_use?.web_search_requests ?? 0;
  spend.record({
    page,
    step: "search",
    model: binding.modelId,
    tokensIn: message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
    searches,
    cents: searches * SEARCH_CENTS + costCentsFor("haiku", message.usage.input_tokens, message.usage.output_tokens),
  });
  return message.content.flatMap((block) =>
    block.type === "web_search_tool_result" && Array.isArray(block.content)
      ? block.content.map((result) => ({ url: result.url, title: result.title }))
      : []
  );
}

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** The target's top three readable results. An address that does not answer,
 *  or answers with too little text to read, is passed over for the next. */
export async function research(
  a: { search: string; ownDomain: string; stored: { url: string; title: string }[] | null },
  spend: Spend,
  page: string
): Promise<Research> {
  const from = a.stored !== null && a.stored.length > 0 ? "stored top ten" : "web search";
  const list = from === "stored top ten" ? a.stored! : await searchTopTen(spend, page, a.search);
  const tried: Research["tried"] = [];
  const reads: Read[] = [];
  for (const row of list) {
    if (reads.length === 3) break;
    if (hostOf(row.url) === a.ownDomain) {
      tried.push({ url: row.url, note: "the business's own page" });
      continue;
    }
    const got = await readPage(row.url);
    if (typeof got === "string") {
      tried.push({ url: row.url, note: got });
      continue;
    }
    tried.push({ url: row.url, note: "read" });
    reads.push({ url: row.url, title: got.title || row.title, readAt: new Date().toISOString().slice(0, 10), text: got.text });
  }
  return { search: a.search, from, tried, reads, titles: list.slice(0, 10).map((r) => ({ title: r.title, domain: hostOf(r.url) })) };
}

// ── 3b. Claims ─────────────────────────────────────────────────────────

/** A page is read up to this many words for its claims. */
export const CLAIM_READ_WORDS = 4000;
const STAT_YEAR_FLOOR = 2023;

const CLAIM_TOOL: Anthropic.Tool = {
  name: "claims",
  description: "Record the claims the pages make.",
  input_schema: {
    type: "object",
    properties: {
      claims: {
        type: "array",
        items: {
          type: "object",
          properties: {
            page: { type: "integer", description: "The page's number." },
            quote: { type: "string", description: "One or two sentences copied exactly, character for character." },
            year: { type: ["integer", "null"], description: "For a statistic, the year its data is from; else null." },
          },
          required: ["page", "quote", "year"],
        },
      },
    },
    required: ["claims"],
  },
};

const squash = (text: string): string => text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

export const truncateWords = (text: string, n: number): string => text.split(/\s+/).slice(0, n).join(" ");

/** Claims read from the top results, each kept only where it is on its page
 *  word for word, and a statistic only where its data is from the last three
 *  years. */
export async function marketFacts(
  spend: Spend,
  page: string,
  found: Research,
  firstId: number
): Promise<{ facts: Fact[]; dropped: { quote: string; why: string }[] }> {
  if (found.reads.length === 0) return { facts: [], dropped: [] };
  const prompt = [
    `Below are the top results for the search "${found.search}". Copy out the claims a writer could cite: statistics, prices, dates, named findings, definitions, specific recommendations. Up to 20 per page. Copy each word for word — never paraphrase, never join sentences from different places. Skip menus, ads, author bios and calls to action.`,
    "",
    ...found.reads.flatMap((read, i) => [`=== Page ${i + 1}: ${read.url}`, truncateWords(read.text, CLAIM_READ_WORDS), ""]),
  ].join("\n");
  const answer = await smallTool<{ claims?: unknown }>(spend, page, "claims", { prompt, tool: CLAIM_TOOL, maxTokens: 8000 });
  const claims = arrayOf(answer?.claims);
  if (claims.length === 0) console.log(`   ${page} claims: the answer carried no claims`);
  const facts: Fact[] = [];
  const dropped: { quote: string; why: string }[] = [];
  for (const claim of claims) {
    const read = found.reads[Number(claim.page) - 1];
    const quote = squash(String(claim.quote ?? ""));
    if (read === undefined || quote === "") continue;
    if (!squash(read.text).includes(quote)) {
      dropped.push({ quote, why: "not on the page word for word" });
      continue;
    }
    const year = typeof claim.year === "number" ? claim.year : null;
    const older = [...quote.matchAll(/\b(19\d{2}|20[0-2]\d)\b/g)].map((m) => Number(m[1]));
    const statYear = year ?? (/\d/.test(quote.replace(/\b(19|20)\d{2}\b/g, "")) && older.length > 0 ? Math.max(...older) : null);
    if (statYear !== null && statYear < STAT_YEAR_FLOOR && /\d/.test(quote.replace(/\b(19|20)\d{2}\b/g, ""))) {
      dropped.push({ quote, why: `a statistic from ${statYear}, older than three years` });
      continue;
    }
    if (facts.some((f) => f.text === quote)) continue;
    facts.push({ id: `M${firstId + facts.length}`, pool: "market", text: quote, source: read.url, readAt: read.readAt });
  }
  return { facts, dropped };
}

// ── 4. Write, 5. Critic ────────────────────────────────────────────────

export interface Written {
  title: string;
  body: string;
  faq: { question: string; answer: string }[];
  factsUsed: string[];
  nonCommodity: string[];
}

export interface PagePlan {
  business: string;
  domain: string;
  category: string;
  job: string;
  audience: string[];
  voice: string | null;
  search: string;
  kind: PageKind;
  /** Anchored on the product (the product is the subject) or a market
   *  comparison (the business is one honest row). */
  anchored: boolean;
  length: { floor: number; ceiling: number };
  facts: Fact[];
  topTitles: { title: string; domain: string }[];
}

function factLines(facts: readonly Fact[]): string[] {
  return facts.map((f) =>
    f.pool === "business"
      ? `[${f.id}] ${f.text} — ${f.source === "founder" ? "the founder" : f.source}`
      : `[${f.id}] ${f.text} — ${f.source}, read ${f.readAt}`
  );
}

export function rules(plan: PagePlan): string {
  const home = `https://${plan.domain}/`;
  const pricing = `https://${plan.domain}/pricing`;
  const honesty = plan.anchored
    ? `This page is anchored on the product: ${plan.business} is its subject.`
    : `This page is a market comparison: ${plan.business} is one honest option among several, shown with its real limits beside its strengths. Never rank it first, never call it the best, and never claim it fits a case its facts do not support.`;
  return [
    `You write one web page for ${plan.business} (${plan.domain}), a ${plan.category}: ${plan.job}. It serves ${plan.audience.join("; ")}.`,
    `The page answers the search "${plan.search}". It must be something an AI answer or a search engine would quote, and something a buyer would trust.`,
    "",
    "FACTS",
    "1. You have two numbered pools. Business facts [F#] are passages from the business's own site, or answers its founder gave. Market facts [M#] are claims read today from the search's top results, each with its address and read date.",
    "2. Every number on the page — a price, a percentage, a count, a duration, a multiple — must appear in a fact you list in <facts_used>, written as that fact writes it. A year is not a number for this rule. Where no fact holds a number, write without one.",
    "3. Use a market fact only with a Markdown link to its address in the same sentence. Every market fact you use is also named in the Sources list.",
    "4. Quote only word for word from a fact, with its link. Never invent a person, a customer, a review, a test, a case study or a result. Never say the business does, has or measures anything its facts do not state.",
    `5. When a business fact read from a page is used, link that page where it fits. Founder facts need no link.`,
    "",
    "HONESTY",
    `6. ${honesty}`,
    "",
    "BLOCKS — in this order, in exactly this syntax; the renderer admits only this Markdown subset",
    "7. First, a short answer of 40 to 60 words that answers the search plainly, inside",
    ":::answer",
    "…",
    ":::",
    "8. Then the line **Key takeaways** and a flat list of three to five bullets.",
    '9. Then six to ten sections. Each heading is an H2 (##) written as a question a reader asks, ending in "?". Sub-points are H3 (###) under their H2, never deeper. Each section opens with a paragraph of two or three sentences that answers its heading on its own, before any list or table.',
    "10. A GFM table wherever options, prices or plans are compared.",
    `11. One section, headed as a question, on how ${plan.business} itself handles this, linking its product page ${home} and its pricing page ${pricing}.`,
    '12. A section headed "## Sources" — the one heading that is not a question — with a flat list naming every market fact\'s page as a link: "- Publisher, [Title](address), read YYYY-MM-DD".',
    "13. The last paragraph is one line pointing to the one action this page's reader should take, with a link.",
    "14. A blockquote is one paragraph. Lists are flat, never nested. No images, no HTML, no H1 (the title is set apart), no footnotes.",
    "",
    "LENGTH",
    `15. ${plan.length.floor} to ${plan.length.ceiling} words of body text. Short of ${plan.length.floor} fails.`,
    "",
    "NOT COMMODITY",
    "16. The page carries at least three claims that are in neither the top results nor the business's site, and at least one of them is a business fact (a founder's answer counts). Specific, checkable and useful to the buyer — not filler. List them in <non_commodity>.",
    "",
    "BUYER QUESTIONS",
    "17. Three to six questions buyers ask about this search, each answered in two or three sentences, as JSON in <faq>. They are stored with the page, not written in the body.",
    "",
    ...(plan.voice === null ? [] : ["VOICE", plan.voice, ""]),
    "OUTPUT — exactly these tags, nothing outside them:",
    "<title>the page title: the buyer's question, in the buyer's words</title>",
    "<body>",
    "the Markdown body",
    "</body>",
    '<faq>[{"question": "…", "answer": "…"}]</faq>',
    "<facts_used>F1, M3, …</facts_used>",
    "<non_commodity>",
    "- the claim — business or market — why it is in neither the top results nor the site",
    "</non_commodity>",
  ].join("\n");
}

function inputs(plan: PagePlan): string {
  return [
    "BUSINESS FACTS",
    ...factLines(plan.facts.filter((f) => f.pool === "business")),
    "",
    "MARKET FACTS",
    ...factLines(plan.facts.filter((f) => f.pool === "market")),
    "",
    `TODAY'S TOP RESULTS FOR "${plan.search}"`,
    ...plan.topTitles.map((t, i) => `${i + 1}. ${t.title} (${t.domain})`),
  ].join("\n");
}

const tag = (text: string, name: string): string | null => {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text);
  return match === null ? null : match[1]!.trim();
};

export function parseWritten(text: string): Written | null {
  const title = tag(text, "title");
  const body = tag(text, "body");
  if (title === null || body === null) return null;
  let faq: Written["faq"] = [];
  try {
    const parsed = JSON.parse(tag(text, "faq") ?? "[]") as unknown;
    if (Array.isArray(parsed)) {
      faq = parsed
        .filter((q): q is Record<string, unknown> => typeof q === "object" && q !== null)
        .map((q) => ({ question: String(q.question ?? ""), answer: String(q.answer ?? "") }));
    }
  } catch {
    faq = [];
  }
  return {
    title,
    body,
    faq,
    factsUsed: (tag(text, "facts_used") ?? "").match(/[FM]\d+/g) ?? [],
    nonCommodity: (tag(text, "non_commodity") ?? "")
      .split("\n")
      .map((line) => line.replace(/^\s*-\s*/, "").trim())
      .filter(Boolean),
  };
}

/** One Sonnet 5 call, streamed, adaptive thinking at medium effort. */
async function writerCall(spend: Spend, page: string, step: string, system: string, user: string): Promise<string> {
  spend.guard(page, step, writerCents(estimateTokens(system + user), WRITER_MAX_TOKENS));
  const message = await client()
    .messages.stream({
      model: WRITER_MODEL,
      max_tokens: WRITER_MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system,
      messages: [{ role: "user", content: user }],
    })
    .finalMessage();
  spend.record({
    page,
    step,
    model: WRITER_MODEL,
    tokensIn: message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
    searches: 0,
    cents: writerCents(message.usage.input_tokens, message.usage.output_tokens),
  });
  if (message.stop_reason !== "end_turn") throw new Error(`${page} ${step}: the model stopped with ${message.stop_reason}`);
  return message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
}

export async function write(spend: Spend, page: string, plan: PagePlan): Promise<Written> {
  const text = await writerCall(spend, page, "write", rules(plan), `${inputs(plan)}\n\nWrite the page.`);
  const written = parseWritten(text);
  if (written === null) throw new Error(`${page} write: the answer carried no <title> or <body>`);
  return written;
}

export interface Critique {
  scores: Record<string, unknown> | null;
  decision: "keep" | "rewrite";
  rewritten: Written | null;
}

/** `measured` is what code found in the draft: its length against the
 *  target, the blocks it lacks, and the numbers no fact holds. */
export async function critic(spend: Spend, page: string, plan: PagePlan, draft: Written, measured: string): Promise<Critique> {
  const system = [
    "You are the critic of a page a writer drafted under the rules below. Score the draft, then decide whether to rewrite it once.",
    "",
    "Score each 0–3: adds — what it adds beyond the top results (the market pool is what they say); specificity; fit to the business; blocks — every required block present and correct; length — within the target.",
    "Rewrite where a score is below 3 and a rewrite can raise it. You may add as well as cut. A rewrite obeys every rule and is the whole page, in the writer's output format.",
    "",
    "Answer with:",
    '<scores>{"adds": n, "specificity": n, "fit": n, "blocks": n, "length": n, "why": "two sentences"}</scores>',
    "<decision>keep</decision> or <decision>rewrite</decision>",
    "and, only after rewrite, the full page in the writer's tags.",
    "",
    "=== THE WRITER'S RULES",
    rules(plan),
  ].join("\n");
  const user = [
    inputs(plan),
    "",
    "=== WHAT CODE MEASURED IN THE DRAFT",
    measured,
    "",
    "=== THE DRAFT",
    `<title>${draft.title}</title>`,
    "<body>",
    draft.body,
    "</body>",
    `<faq>${JSON.stringify(draft.faq)}</faq>`,
    `<facts_used>${draft.factsUsed.join(", ")}</facts_used>`,
    "<non_commodity>",
    ...draft.nonCommodity.map((line) => `- ${line}`),
    "</non_commodity>",
  ].join("\n");
  const text = await writerCall(spend, page, "critic", system, user);
  let scores: Record<string, unknown> | null = null;
  try {
    scores = JSON.parse(tag(text, "scores") ?? "null") as Record<string, unknown> | null;
  } catch {
    scores = null;
  }
  const decision = (tag(text, "decision") ?? "keep").toLowerCase().includes("rewrite") ? "rewrite" : "keep";
  // The draft's own tags sit in the prompt, not in the answer, so a <title>
  // here is the rewrite's.
  const rewritten = decision === "rewrite" ? parseWritten(text) : null;
  return { scores, decision: rewritten === null ? "keep" : "rewrite", rewritten };
}
