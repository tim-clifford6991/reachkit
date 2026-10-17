// BUILD §8 hard rule 6 — no invented rival metrics.
//
// "No rival metrics invented; every rival claim links its public source."
// A statement that names a rival and carries a numeral must carry a link in
// **the same sentence** — and, since the two pools (SPEC §7, 2026-09-29;
// issue 1135), that link is to a page one of the page's facts was read from.
// The research step supplies those pages; an address the model reached for
// on its own sources nothing.
//
// Sentence rather than paragraph, deliberately: a paragraph-wide scope lets
// one sourced figure legitimise three unsourced ones standing beside it,
// which is the failure the rule exists to prevent.
//
// The figure the failure carries is the numeral as it appears in the draft
// — a stored value read straight out of the text, never a sentence and
// never anything a model wrote.
import { urlKey } from "../links/select";
import { sentencesOf } from "./text";
import type { RuleFailure } from "./types";

/** A numeral a reader would meet as a figure: digits, optionally with
 *  grouping separators, a decimal part, a percent sign or a currency
 *  symbol. A bare year is still a figure — "raised $4M in 2019" states two
 *  things about a rival and both want a source. */
const FIGURE_RE = /[$€£]?\d[\d,.]*\s*%?/g;

/** A rival is named by its domain or by its name. Both are stored values on
 *  the site; nothing here recognises a company it was not given. */
function namesRival(sentence: string, rivals: readonly string[]): boolean {
  const haystack = sentence.toLowerCase();
  return rivals.some((rival) => {
    const token = rival.trim().toLowerCase();
    if (token.length === 0) return false;
    if (haystack.includes(token)) return true;
    // A rival recorded as a domain is also named by its registrable label.
    const label = token.split(".")[0] ?? "";
    return label.length > 2 && haystack.includes(label);
  });
}

function firstFigure(sentence: string): string | null {
  FIGURE_RE.lastIndex = 0;
  const match = FIGURE_RE.exec(sentence);
  return match === null ? null : match[0].trim();
}

/** The figure a sentence states about a rival with no fact's page beside
 *  it, or `null`. `pages` is the fact pages' keys; `null` is a page written
 *  before the research step, where any link sources it. */
export function unsourcedRivalFigure(
  sentence: { text: string; hasLink: boolean; links?: readonly string[] },
  rivals: readonly string[],
  pages: ReadonlySet<string | null> | null
): string | null {
  const cited = pages === null ? sentence.hasLink : (sentence.links ?? []).some((link) => pages.has(urlKey(link)));
  if (cited || !namesRival(sentence.text, rivals)) return null;
  return firstFigure(sentence.text);
}

/** The fact pages, as the rule compares them. */
export function factPageKeys(factPages: readonly string[] | undefined): ReadonlySet<string | null> | null {
  return factPages === undefined ? null : new Set(factPages.map(urlKey));
}

export function checkRivalSource(a: {
  markdown: string;
  rivals: string[];
  /** The pages the page's facts were read from, either pool. Absent on a
   *  page written before the research step: any link sources it, as then. */
  factPages?: readonly string[];
}): RuleFailure | null {
  if (a.rivals.length === 0) return null;
  const pages = factPageKeys(a.factPages);
  for (const sentence of sentencesOf(a.markdown)) {
    const figure = unsourcedRivalFigure(sentence, a.rivals, pages);
    if (figure === null) continue;
    return { rule: "rival_source", detail: { rule: "rival_source", figure } };
  }
  return null;
}

// ── Issue 1485: a rival's claim keeps its plan and its own page ─────────
//
// Found live on content.reachkit.app/profound-alternatives: Profound's
// free trial ("50 prompts run daily for 7 days", three engines) stood as the
// product, a third-party "$99" stood beside Profound's own pricing page, and
// the FAQ said Profound has no free tier — which its own page contradicts.
//
// Two faults of `rival_source`, and one rule of its own:
//
//   * **its own page first.** A sentence that names a rival and links a page
//     that is not that rival's, where the page was handed a claim from the
//     rival's own page, cites the lesser source. It fails.
//   * **its plan.** A claim the rival's own page states of one plan is true
//     of that plan only. A sentence that uses it without naming the plan
//     fails. A claim from a rival's price list recorded before plans were
//     has no plan to name, and is used only where its own words name the
//     plan they price ("Standard $ 189 /month").
//   * **`rival_negative`.** "X has no / doesn't / lacks Y" about a rival
//     fails unless a stored fact about that rival says so: one read off its
//     own page or naming it, that denies something too and shares a word
//     with what the sentence denies.

/** A rival as the site's market names it: its domain, and its name where
 *  one is stored. */
export interface NamedRival {
  domain: string;
  name: string | null;
}

/** The site's rivals with their names: the domains recorded for the site,
 *  named as `market.rivals` names them. */
export function namedRivals(domains: readonly string[], market: unknown): NamedRival[] {
  const stored = (market as { rivals?: unknown } | null)?.rivals;
  const named = Array.isArray(stored) ? (stored as { name?: unknown; domain?: unknown }[]) : [];
  const out = new Map<string, NamedRival>();
  for (const domain of domains) {
    const key = domain.trim().toLowerCase();
    if (key !== "") out.set(key, { domain: key, name: null });
  }
  for (const rival of named) {
    if (typeof rival?.domain !== "string") continue;
    const key = rival.domain.trim().toLowerCase();
    const name = typeof rival.name === "string" && rival.name.trim() !== "" ? rival.name.trim() : null;
    out.set(key, { domain: key, name: name ?? out.get(key)?.name ?? null });
  }
  return [...out.values()];
}

const escapedRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The words a rival is named by: its domain, its registrable label and its
 *  stored name, each as a whole word. */
function rivalTokens(rival: NamedRival): RegExp[] {
  const label = rival.domain.split(".")[0] ?? "";
  return [rival.domain, ...(label.length > 2 ? [label] : []), ...(rival.name === null ? [] : [rival.name])].map(
    (token) => new RegExp(`(?<![\\p{L}\\p{N}])${escapedRe(token)}(?![\\p{L}\\p{N}])`, "iu")
  );
}

/** The rivals a stretch of text names. */
export function rivalsNamedIn(text: string, rivals: readonly NamedRival[]): NamedRival[] {
  return rivals.filter((rival) => rivalTokens(rival).some((token) => token.test(text)));
}

const sameHost = (url: string, domain: string): boolean => {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  return host === domain || host.endsWith(`.${domain}`);
};

/** A rival's price list, by its address. */
const PRICE_LIST_RE = /\/(?:pricing|prices?|plans?)(?![a-z])[^/]*\/?$/i;
const PRICED_RE = /[$€£¥]\s?\d|\d\s?(?:usd|eur|gbp|[$€£¥])/i;
/** A pricing line that says the price is agreed, not published: how the
 *  whole product is priced, not one plan (D56). */
const CUSTOM_RE = /\b(?:custom|tailored|bespoke|on request|quote|contact (?:us|sales)|talk to (?:us|sales))\b/i;
/** A price line whose own words name what they price: a word, then the
 *  figure ("Standard $ 189 /month", "Pro: €29"). */
const NAMED_PRICE_RE = /^\s*[\p{L}][\p{L}\p{N} +&-]*[:\s]\s*(?:[$€£¥]\s?\d|\d)/iu;

const squash = (text: string): string => text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();

/** What a rival's own claim must say beside it where it is used: its plan's
 *  name, nothing (true of the product), or `false` — no plan is known and
 *  its words name none, so no sentence can state it truthfully. */
export function planToName(claim: MarketFactLike): string | null | false {
  if (claim.product === undefined) return null;
  if (typeof claim.plan === "string") return claim.plan;
  if (claim.plan === null) return null;
  const fromPriceList = claim.kind === "rival_pricing" || PRICE_LIST_RE.test(claim.url);
  if (!fromPriceList || (CUSTOM_RE.test(claim.passage) && !PRICED_RE.test(claim.passage))) return null;
  return PRICED_RE.test(claim.passage) && NAMED_PRICE_RE.test(claim.passage) ? null : false;
}

interface MarketFactLike {
  url: string;
  passage: string;
  kind?: string;
  product?: string;
  about?: string;
  plan?: string | null;
}

/** Whether a sentence states this claim: its words stand in it. */
const uses = (sentence: string, claim: MarketFactLike): boolean => squash(sentence).includes(squash(claim.passage));

/** The rivals whose own pages the page was handed a claim from. */
const ownRead = (facts: readonly MarketFactLike[]): Set<string> =>
  new Set(facts.flatMap((fact) => (fact.product === undefined ? [] : [fact.product.toLowerCase()])));

/**
 * The sentence that cites a rival's lesser source or drops a claim's plan,
 * or `null`. `facts` is every market fact the page was handed.
 */
export function rivalScopeBreach(
  sentence: { text: string; links?: readonly string[] },
  rivals: readonly NamedRival[],
  facts: readonly MarketFactLike[]
): "third_party" | "plan" | null {
  const own = ownRead(facts);
  for (const rival of rivalsNamedIn(sentence.text, rivals)) {
    if (!own.has(rival.domain)) continue;
    const factPages = new Set(facts.map((fact) => urlKey(fact.url)));
    // A link to one of the page's own fact pages that is not this rival's,
    // standing for a claim about it.
    const lesser = (sentence.links ?? []).some((link) => {
      if (sameHost(link, rival.domain) || !factPages.has(urlKey(link))) return false;
      return facts.some((fact) => fact.product === undefined && urlKey(fact.url) === urlKey(link) && (fact.about === rival.domain || rivalsNamedIn(fact.passage, [rival]).length > 0 || uses(sentence.text, fact)));
    });
    if (lesser) return "third_party";
  }
  for (const fact of facts) {
    if (fact.product === undefined || !uses(sentence.text, fact)) continue;
    const plan = planToName(fact);
    if (plan === false) return "plan";
    if (plan !== null && !squash(sentence.text).includes(squash(plan))) return "plan";
  }
  return null;
}

export function checkRivalScope(a: {
  markdown: string;
  rivals: readonly NamedRival[];
  facts: readonly MarketFactLike[] | undefined;
}): RuleFailure | null {
  if (a.rivals.length === 0 || a.facts === undefined || a.facts.length === 0) return null;
  for (const sentence of sentencesOf(a.markdown)) {
    const fault = rivalScopeBreach(sentence, a.rivals, a.facts);
    if (fault === null) continue;
    return { rule: "rival_source", detail: { rule: "rival_source", figure: firstFigure(sentence.text) ?? "", fault, sentence: sentence.text } };
  }
  return null;
}

/** A clause says a rival has no, lacks or does not do something. "Not only"
 *  and "not just" add rather than deny; "no-code" is a word. */
const NEGATION_RE =
  /(?<![\p{L}-])(?:no(?![-\p{L}])|not(?!\s+(?:only|just)\b)|none|never|neither|nor|without|lacks?|lacking|doesn['’]t|don['’]t|isn['’]t|aren['’]t|hasn['’]t|haven['’]t|can['’]t|cannot|won['’]t|didn['’]t)(?![\p{L}])/iu;
/** Where one claim ends and the next begins inside a sentence. */
const CLAUSE_RE = /[,;:()—–]|\s-\s/;

export function isNegative(text: string): boolean {
  return NEGATION_RE.test(text);
}

/** Each clause of a sentence that denies a rival something, with the
 *  rival: a clause that names one and says no, not, lacks or without. */
function denials(text: string, rivals: readonly NamedRival[]): { rival: NamedRival; clause: string }[] {
  return text.split(CLAUSE_RE).flatMap((clause) => (isNegative(clause) ? rivalsNamedIn(clause, rivals).map((rival) => ({ rival, clause })) : []));
}

/** The rivals a sentence denies something of. */
export function deniedRivals(text: string, rivals: readonly NamedRival[]): NamedRival[] {
  return [...new Set(denials(text, rivals).map((each) => each.rival))];
}

/** A fact that denies something: a negative, or "rather than" and
 *  "instead of", which deny what they set aside ("tailored pricing rather
 *  than a one-size-fits-all list"). */
const DENIES_RE = /\b(?:rather than|instead of)\b/i;
const STOP = new Set(["this", "that", "with", "from", "have", "does", "doesn", "their", "they", "them", "here", "there", "which", "what", "when", "will", "your", "only", "also", "than", "into", "more", "most", "each", "every", "page", "pages", "rather"]);

/** The words a clause is about, as four-letter stems, without the rival's
 *  own name: "price" and "pricing" are one subject. */
function subjectsOf(text: string, rival: NamedRival): Set<string> {
  const named = new Set([rival.domain, rival.domain.split(".")[0] ?? "", ...(rival.name === null ? [] : rival.name.toLowerCase().split(/\s+/))]);
  return new Set(
    (text.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []).filter((word) => !STOP.has(word) && !named.has(word)).map((word) => word.slice(0, 4))
  );
}

/** Whether a stored fact about this rival says what the sentence denies: a
 *  fact read off the rival's own page or naming it, that denies something
  *  and shares a subject with the sentence. */
function supported(rival: NamedRival, sentence: string, facts: readonly MarketFactLike[]): boolean {
  const wanted = subjectsOf(sentence, rival);
  // Its own page outranks a third party's here too: where it was read, only
  // it can say what the rival does not do.
  const ownOnly = facts.some((fact) => fact.product === rival.domain);
  return facts.some((fact) => {
    if (!(isNegative(fact.passage) || DENIES_RE.test(fact.passage))) return false;
    const about = ownOnly ? fact.product === rival.domain : fact.product === rival.domain || fact.about === rival.domain || rivalsNamedIn(fact.passage, [rival]).length > 0;
    if (!about) return false;
    return [...subjectsOf(fact.passage, rival)].some((word) => wanted.has(word));
  });
}

/** Issue 1485: "X has no / doesn't / lacks Y" about a rival, in the body or
 *  the FAQ stored beside it, unless a stored source says so. */
export function checkRivalNegative(a: {
  markdown: string;
  faq?: readonly { question: string; answer: string }[];
  rivals: readonly NamedRival[];
  facts: readonly MarketFactLike[] | undefined;
}): RuleFailure | null {
  if (a.rivals.length === 0) return null;
  const facts = a.facts ?? [];
  const body = sentencesOf(a.markdown).map((sentence) => sentence.text);
  const faq = (a.faq ?? []).flatMap((entry) => sentencesOf(entry.answer).map((sentence) => sentence.text));
  for (const sentence of [...body, ...faq]) {
    // A sentence's other clauses say what its denial is about ("doesn't
    // publish a number, … pricing is tailored").
    if (denials(sentence, a.rivals).some((each) => !supported(each.rival, sentence, facts))) {
      return { rule: "rival_negative", detail: { rule: "rival_negative", sentence } };
    }
  }
  return null;
}
