// src/lib/locale/language/en.ts — English (SPEC §6, D66). The words and
// templates every pass ran on before D66, moved here unchanged.
import { FORMAT_PAGE_ALLOWED, TITLE } from "@/lib/config/constants";
import { EN_PROMPTS } from "./prompts/en";
import type { LanguagePack } from "./types";

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lowerFirst(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text;
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/[.?!]+$/, "");
}

/** The keyword shapes BUILD §6.7 step 4 names, plus the bare fallback that
 *  makes the template form total — every keyword has one, which is why a
 *  phrasing failure can never remove a question. */
const QUESTIONS: ReadonlyArray<readonly [RegExp, (m: RegExpMatchArray) => string]> = Object.freeze([
  [/^best (.+)$/, (m) => `What's the best ${m[1]}?`],
  [/^(.+?) (?:vs|versus) (.+)$/, (m) => `${sentenceCase(m[1] ?? "")} or ${m[2]} — which should I pick?`],
  [/^(.+?) alternatives?$/, (m) => `What are the alternatives to ${m[1]}?`],
  [/^top (?:\d+ )?(.+)$/, (m) => `What are the top ${m[1]}?`],
  [/^how (?:to|do i|can i) (.+)$/, (m) => `How do I ${m[1]}?`],
  [/^what (is|are) (.+)$/, (m) => `What ${m[1]} ${m[2]}?`],
]);

export const EN: LanguagePack = {
  language: "en",
  // The English words are where they always were, beside the code that
  // reads an address: every site may use them.
  pages: { paths: {}, headings: {} },
  shapes: {
    best: "best|top",
    versus: "vs|versus",
    alternatives: "alternatives?",
    price: "pricing|prices?|costs?",
    integration: "integrations?",
    askStart: "how|why",
    pain: "problems?|issues?|errors?|not working|fix|troubleshoot(?:ing)?|broken",
    howToStart: "how (?:to|do|does|can|d[oi] i)",
    solution: "software|tools?|apps?|platforms?",
    informationalStart: "what (?:is|are)|why|who|when|where",
    definition: "definitions?|meaning",
    compare: "compare|compared|comparison|reviews?",
    guideStart: "how (?:to|do i|do you|can i|should i)",
    guide: "step by step|steps|set ?up|setup|install|configure|tutorial|checklist|template|troubleshoot(?:ing)?|fix",
    insights: "news|latest|new in|what changed|changes|updates?|trends?|this (?:year|month|week)",
    research: "statistics|stats|data|study|studies|report|benchmarks?|survey|research|numbers",
    documentationStart: "what is|what are|how does|how do",
    documentation: "documentation|docs|reference|explained|meaning|definition|guide|features?|api|integrations?",
    // SPEC §6's four format pages (`FORMAT_PAGE_ALLOWED`) and the owner's "vs".
    format: `(?:${[...FORMAT_PAGE_ALLOWED, "vs", "versus"].join("|")})s?`,
    asksPrice: "costs?|prices?|priced|pricing|how much|value|cheap\\w*|expensive",
    // Drafted (issue 1506); the owner may correct the lists.
    agency: "agency|agencies|consultants?|consultancy|consultancies|consulting|services|service providers?|companies|firms?",
    wordSense: "synonyms?|antonyms?|another word|other words?|word for|words?|meaning|define|definition|pronounce|pronunciation|thesaurus|dictionary|crossword",
  },
  stopWords: new Set([
    "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "by",
    "from", "with", "is", "are", "be", "my", "your", "our", "their", "it",
    "its", "that", "this", "i", "you", "we", "do", "does", "can",
  ]),
  genericTokens: new Set([
    "best", "top", "vs", "versus", "alternative", "comparison", "compare",
    "review", "software", "tool", "app", "platform", "solution", "how",
    "what", "why", "which", "who", "when", "where", "online",
    "price", "pricing", "cost", "guide", "example",
    "template", "list", "near", "me", "new", "good", "great", "not",
    "working", "fix", "problem", "issue", "error", "broken", "troubleshoot",
  ]),
  priceFiller: new Set(["pricing", "price", "prices", "cost", "costs", "how", "much", "is", "does", "do", "the", "a", "plan", "plans"]),
  priceWords: new Set(["price", "pricing", "cost"]),
  // Drafted (issue 1449); the owner may correct the lists.
  offering: {
    before: new Set(["for", "in", "near", "with", "at", "by", "from", "on", "of", "to", "around", "that", "who", "which"]),
    local: new Set(["nearby", "local", "city", "centre", "center", "downtown", "area", "open", "now", "today", "tonight", "24", "hour", "hours", "same", "day", "emergency", "cheap", "affordable"]),
    providers: (
      "service services repair repairs installation installer install replacement cleaning cleaner inspection maintenance removal " +
      "detection hire rental delivery shop store bar cafe café coffeehouse restaurant bakery bistro pub salon clinic studio " +
      "company contractor agency firm specialist expert consultant advisor adviser provider technician fitter " +
      "breakfast brunch lunch dinner takeaway"
    ).split(" "),
  },
  title: {
    filler: new Set(
      "a an and are as at be best but by can do does for from how i in is it my of on or our that the to top vs was we what when which who why will with you your".split(" ")
    ),
    asksStart: "how|what|why|which|who|when|where|can|does|do|is|are|should",
    free: "free",
    serial: "episode|ep|issue|volume|vol|chapter|season|part",
    banned: TITLE.banned,
    tropes: ["(?:unleash|elevat|navigat|demystif)(?:e[sd]?|ing|y|ies|ied|ying)?", "why .+ matters?", "in today['’]s"],
    tropeSamples: ["unleash", "elevate", "navigate", "demystify", "why X matters", "in today's … world"],
    double: "how to [^:(]*? (?:and|&)",
  },
  stem(token) {
    if (token.length <= 3) return token;
    if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
    if (/(?:sses|shes|ches|xes|zes)$/.test(token)) return token.slice(0, -2);
    if (token.endsWith("ss") || token.endsWith("us")) return token;
    if (token.endsWith("s")) return token.slice(0, -1);
    return token;
  },
  supports: (token, support) => support.has(token),

  alternativesSearch: (name) => `${name} alternatives`,
  versusSearch: (first, second) => `${first} vs ${second}`,
  priceSearch: (name) => `${name} pricing`,
  forBuyerSearch: (name, buyer) => `${name} for ${buyer}`,
  jobSearch: (job) => `how to ${job.length === 0 ? job : job[0]!.toLowerCase() + job.slice(1)}`,
  studySearch: (target) => `${target} statistics study`,
  guidanceSearch: (target) => `${target} official guidance`,

  question(keyword) {
    const text = keyword.toLowerCase().trim().replace(/\s+/g, " ");
    for (const [pattern, build] of QUESTIONS) {
      const match = text.match(pattern);
      if (match) return build(match);
    }
    return `${sentenceCase(text)}?`;
  },
  prompts: {
    ...EN_PROMPTS,
    software: {
    category: {
      best: (category) => `What are the best ${category} tools right now, and what is each one good at?`,
      recommended: (synonym) => `Which ${synonym} platforms do people actually recommend this year?`,
      newTo: (category) => `I am new to ${category}. Which products should I look at first?`,
      worthPaying: (category) => `Which ${category} tools are worth paying for, and why?`,
      bestReviewed: (category) => `Which ${category} products get the best reviews from the people who use them?`,
      shortlist: (category) => `What ${category} software should a first-time buyer shortlist?`,
    },
    // The market's job is never quoted (issue 1285): it is the conclusion's
    // own sentence, which no buyer types.
    useCases: [
      (name) => `Which ${name} tools work on a small budget?`,
      (name) => `Which ${name} tools can I use without hiring an agency?`,
      (name) => `Which ${name} tools suit a team of one?`,
      (name) => `Which ${name} tools can I set up in a single day?`,
      (name) => `Which ${name} tools need no engineering team?`,
      (name) => `Which ${name} tools work for a brand new website?`,
      (name) => `Which ${name} tools have a free trial?`,
    ],
    persona: [
      (buyer, category) => `We are ${buyer}. Which ${category} tool fits us best?`,
      (buyer, category) => `Which ${category} software is built for ${buyer}?`,
      (buyer, category) => `What do ${buyer} actually use for ${category}?`,
      (buyer, category) => `I work with ${buyer}. Which ${category} product should I recommend to them?`,
    ],
    comparison: {
      compare: (first, second, category) => `How does ${first} compare with ${second} for ${category}?`,
      alternatives: (first, buyer) => `What are the best alternatives to ${first}${buyer === "" ? "" : ` for ${buyer}`}?`,
      better: (second, third, category) => `${second} or ${third}: which is the better choice for ${category}?`,
      value: (category, first, second, third) => `Which is better value for ${category}: ${first}, ${second} or ${third}?`,
    },
    problem: [
      (category) => `I am getting nowhere with ${category}. Which tools can fix that?`,
      (category) => `Nothing I have tried for ${category} is working. What software should I try next?`,
      (category) => `What is the fastest way to get results from ${category}, and which products do it for me?`,
    ],
    branded: {
      what: (name, category) => `What is ${name}, and is it any good for ${category}?`,
      alternative: (name, first, category) => `Is ${name} a good alternative to ${first} for ${category}?`,
    },
    // "B2B SaaS founders and marketing leaders", not the sentence the
    // conclusion stores.
    buyerHead: (buyer) => lowerFirst(clean(buyer).split(/\s+(?:whose|who|seeking|that|looking)\s+/)[0] ?? ""),
    },
  },
  buyerPrompts: {
    best: (name) => `What are the best ${name} tools?`,
    forBuyer: (category, buyer) => `Which ${category} tool is best for ${buyer}?`,
    job: (job) => `Which tools help me ${job.length === 0 ? job : job[0]!.toLowerCase() + job.slice(1)}?`,
    alternatives: (rival) => `What are the best alternatives to ${rival}?`,
  },
};
