// scripts/panel/checks.ts — the customer panel's automatic checks (SPEC §0,
// owner 2026-10-07, issue 1304).
//
// One site's result in, one verdict a check out. Every rule here is general:
// it reads what the pass concluded against what `sites.json` says the
// business is (its country, its language, whether it is itself a listing),
// and names no site. A result the code cannot judge is `review`, listed for
// a person to read, never passed.
//
// Plain data only: no database, no network, and of the product only its
// types, its pinned bounds and one pure rule, so the checks are tested on
// fixtures.
import { KNOWLEDGE_BASE } from "@/lib/config/constants";
import type { MarketConclusion } from "@/lib/market/infer/types";
import { malformedSearch, type Malformed } from "@/lib/market/questions/well-formed";

export interface PanelSite {
  domain: string;
  /** What kind of business this is, in the issue's own words. */
  kind: string;
  /** ISO 3166-1 alpha-2, where its buyers are. */
  country: string;
  /** ISO 639-1, the language its site is written in. */
  language: string;
  /** Word roots of what the business is, in its own language ("plumb",
   *  "restaurant"): the concluded category has to be spoken in one of them. */
  market: readonly string[];
  /** Where a business that trades in one place trades, as its buyers type
   *  it ("austin"). Absent for a business with no one place. */
  place?: readonly string[];
  /** The kinds of business the conclusion may record it as (D69), from the
   *  product's closed list. Absent, any kind passes. */
  kinds?: readonly string[];
  /** True where the business is itself a publisher, an aggregator, a
   *  marketplace or a directory: its rivals may be too. */
  listsOthers?: boolean;
  /** Why this site is on the panel. */
  why: string;
}

/** One vendor read's market: where and in which language it was asked. */
export interface VendorLocale {
  location: string;
  language: string;
}

export interface PanelTopic {
  query: string;
  status: string;
  type: string;
  /** The pass's own business fit, 0–3; `null` where it judged none. */
  fit: number | null;
  volume: number | null;
  /** Whether the pass left it ready to fill a day; `null` or absent where a
   *  stored result did not record it. */
  ready?: boolean | null;
}

export interface SiteResult {
  site: PanelSite;
  /** The site's name as its home page gives it, where the pass read one. */
  siteName: string | null;
  /** How the pass ended; `null` where it stored no report. */
  status: string | null;
  stoppedReason: string | null;
  market: MarketConclusion | null;
  /** Every market a paid vendor read was asked in, once each. */
  locales: readonly VendorLocale[];
  /** The country and language the pass stored on the site (D66): what it
   *  read of the site, since the panel answers no setup question. Absent
   *  on a run stored before D66. */
  stored?: { country: string | null; language: string | null };
  /** Rival domains that do not resolve: no such site exists. */
  deadRivals: readonly string[];
  /** Rival domains whose home page was read and never names the rival:
   *  another company's site. Absent where a stored result did not read them. */
  wrongRivals?: readonly string[];
  /** The pass's AI Mode reads, and how many met the request bound; `reads`
   *  is `null` where a stored result kept only its timeouts. */
  aiMode?: { reads: number | null; timeouts: number } | null;
  /** How many questions the site's own pages ask, in their FAQ schema, FAQ
   *  sections and headings; `null` or absent where it was not counted. */
  pageQuestions?: number | null;
  /** The measured searches the pass seeded (the twelve). */
  searches: readonly string[];
  /** How many of the site's pages the knowledge base was read from; `null`
   *  where a stored result did not record it. */
  knowledgePages: number | null;
  /** The knowledge base's buyer questions, and who it says the site serves. */
  questions: readonly string[];
  audience: readonly string[];
  topics: readonly PanelTopic[];
  cents: number;
  costBySource: Readonly<Record<string, number>>;
  /** Where the pass stored the business as serving (D67): its place, and
   *  the search vendor's name for it where the vendor lists it. `place` is
   *  `null` for a business stored as selling nationally. Absent on a run
   *  stored before D67. */
  area?: { place: string | null; location: string | null } | null;
  /** Every domain this pass's own results showed: its top tens, its local
   *  packs and the sites its AI answers cited. Absent before D67. */
  resultDomains?: readonly string[];
  /** The tracked prompts the market yields (D69): a first pass asks none,
   *  so they are generated here, at 0¢. Absent on a run stored before D69. */
  prompts?: readonly { kind: string; text: string }[];
}

export type Verdict = "pass" | "fail" | "review";

export interface CheckResult {
  check: string;
  verdict: Verdict;
  detail: string;
  /** What failed, or what a person has to read. */
  items: readonly string[];
}

// ── Words ──────────────────────────────────────────────────────────────────

const STOP = new Set(
  "a an and the of for to in on at by with or & von für und der die das den dem im in zu mit auf".split(" ")
);

export function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => !STOP.has(word));
}

/** ` text ` with every run of non-letters as one space, so a phrase is
 *  found only on word boundaries. */
function padded(text: string): string {
  return ` ${words(text).join(" ")} `;
}

const holds = (text: string, phrase: string): boolean => words(phrase).length > 0 && padded(text).includes(padded(phrase));

/** A word with the endings a plural or a German case adds taken off, so
 *  "plumber" meets "plumbers" and "zahnarzt" meets "zahnärzte" less often
 *  than it should but never wrongly. */
function stem(word: string): string {
  return word.length > 4 ? word.replace(/(ies|es|s|en|e)$/u, "") : word;
}

// ── 1. The category ────────────────────────────────────────────────────────

/** Words that name no market on their own, in the panel's languages. */
const GENERIC_CATEGORY = new Set(
  (
    "software service services business businesses company companies solution solutions product products platform " +
    "platforms tool tools app apps application applications online website websites web shop store provider providers " +
    "firm firms consulting technology tech digital professional general local " +
    "dienstleistung dienstleistungen unternehmen firma firmen produkt produkte lösung lösungen anbieter geschäft"
  ).split(" ")
);

export function checkCategory(r: SiteResult): CheckResult {
  const check = "the category is specific, and is the business's own";
  const category = r.market?.category?.trim() ?? "";
  if (category === "") return { check, verdict: "fail", detail: "no category was concluded", items: [] };
  const naming = words(category).filter((word) => !GENERIC_CATEGORY.has(word));
  if (naming.length === 0) return { check, verdict: "fail", detail: `"${category}" names no market`, items: [category] };
  // Specific is not right: a restaurant concluded as a product it once
  // promoted is a specific category of another business.
  const spoken = words([category, ...(r.market?.synonyms ?? []), r.market?.searchTerm ?? ""].join(" "));
  const roots = r.site.market.map((root) => root.toLowerCase());
  if (roots.length === 0) return { check, verdict: "review", detail: `"${category}"; the panel says nothing of what this business is`, items: [] };
  if (!spoken.some((word) => roots.some((root) => word.includes(root)))) {
    return { check, verdict: "fail", detail: `"${category}" is not this business's market (${r.site.kind}: ${r.site.market.join(", ")})`, items: [category, ...(r.market?.synonyms ?? [])] };
  }
  return { check, verdict: "pass", detail: `"${category}"`, items: [] };
}

// ── 2. The search term and its market ──────────────────────────────────────

/** The vendor's own location names, by country. A country not listed here
 *  cannot be judged and is sent to review. */
const VENDOR_LOCATION: Readonly<Record<string, string>> = {
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  AT: "Austria",
  CH: "Switzerland",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  CA: "Canada",
  AU: "Australia",
  IE: "Ireland",
};

export function checkSearchTerm(r: SiteResult): CheckResult {
  const check = "the search term has volume";
  const term = r.market?.searchTerm ?? null;
  const terms = r.market?.terms ?? [];
  if (r.market === null) return { check, verdict: "fail", detail: "no market was concluded", items: [] };
  if (terms.length === 0) return { check, verdict: "fail", detail: "no terms were read", items: [] };
  if (term === null || term === "") {
    return { check, verdict: "fail", detail: `none of the ${terms.length} terms is searched`, items: terms.map((t) => `${t.term} ${t.volume}`) };
  }
  const volume = terms.find((t) => t.term.toLowerCase() === term.toLowerCase())?.volume ?? 0;
  if (volume <= 0) return { check, verdict: "fail", detail: `"${term}" carries no volume`, items: [] };
  return { check, verdict: "pass", detail: `"${term}" ${volume}/mo`, items: [] };
}

export function checkLocale(r: SiteResult): CheckResult {
  const check = "the terms are in the site's own language and country";
  const expected = VENDOR_LOCATION[r.site.country];
  const terms = (r.market?.terms ?? []).map((t) => t.term);
  if (r.locales.length === 0) return { check, verdict: "review", detail: "no vendor read was seen, so where the volumes were read is unknown", items: terms };
  if (expected === undefined) {
    return { check, verdict: "review", detail: `${r.site.country} is not a country this check knows the vendor's name for`, items: r.locales.map((l) => `${l.location} / ${l.language}`) };
  }
  // D66: what the pass read of the site and stored on it is the site's own.
  if (r.stored !== undefined && (r.stored.country !== r.site.country || r.stored.language !== r.site.language)) {
    return {
      check,
      verdict: "fail",
      detail: `a ${r.site.language} site in ${r.site.country} was read as ${r.stored.country ?? "no country"} / ${r.stored.language ?? "no language"}`,
      items: terms,
    };
  }
  // D67: a read made from the city the business serves is made in its country.
  const city = r.area?.location ?? null;
  const here = (location: string): boolean => location === expected || (city !== null && location === city && city.endsWith(`,${expected}`));
  const wrong = r.locales.filter((l) => !here(l.location) || l.language !== r.site.language);
  if (wrong.length > 0) {
    return {
      check,
      verdict: "fail",
      detail: `a ${r.site.language} site in ${expected} was read in ${wrong.map((l) => `${l.location} / ${l.language}`).join(", ")}`,
      items: terms,
    };
  }
  // The vendor was asked in the right market. Whether the words themselves
  // are the site's language is read by a person where it is not English.
  if (r.site.language !== "en") return { check, verdict: "review", detail: `read in ${expected} / ${r.site.language}; the terms' own wording is read by hand`, items: terms };
  return { check, verdict: "pass", detail: `read in ${expected} / ${r.site.language}`, items: [] };
}

// ── 3. The rivals ──────────────────────────────────────────────────────────

/**
 * Sites that list, sell or write about other businesses and are never a
 * business's rival (SPEC §0 Rival, D24) — unless the site is one itself. A
 * closed list of the ones a top ten or an AI answer most often holds, in
 * the panel's countries. A listing not on it is not caught here: every
 * rival is printed for a person to read.
 */
const LISTINGS = new Set(
  (
    "yelp.com yelp.co.uk tripadvisor.com tripadvisor.co.uk tripadvisor.de google.com facebook.com instagram.com linkedin.com " +
    "youtube.com tiktok.com x.com twitter.com pinterest.com reddit.com quora.com wikipedia.org medium.com substack.com " +
    "amazon.com amazon.co.uk amazon.de ebay.com ebay.co.uk ebay.de etsy.com walmart.com otto.de zalando.de idealo.de " +
    "g2.com capterra.com getapp.com softwareadvice.com trustpilot.com trustradius.com producthunt.com clutch.co sortlist.com " +
    "goodfirms.co designrush.com upwork.com fiverr.com angi.com angieslist.com homeadvisor.com thumbtack.com houzz.com " +
    "bbb.org yellowpages.com nextdoor.com checkatrade.com trustatrader.com mybuilder.com ratedpeople.com bark.com yell.com " +
    "freeindex.co.uk which.co.uk gelbeseiten.de dasoertliche.de 11880.com golocal.de kennstdueinen.de jameda.de doctolib.de " +
    "myhammer.de check24.de zocdoc.com healthgrades.com webmd.com treatwell.co.uk treatwell.de fresha.com booksy.com " +
    "opentable.com opentable.co.uk thefork.com resy.com doordash.com ubereats.com grubhub.com deliveroo.co.uk lieferando.de " +
    "booking.com expedia.com airbnb.com eater.com timeout.com infatuation.com michelin.com udemy.com coursera.org " +
    "skillshare.com apps.apple.com play.google.com forbes.com nytimes.com theguardian.com techcrunch.com nerdwallet.com " +
    "legal500.com chambers.com lawsociety.org.uk icaew.com unbiased.co.uk"
  ).split(" ")
);

const bare = (domain: string): string => domain.toLowerCase().replace(/^www\./, "");

export function isListing(domain: string): boolean {
  const host = bare(domain);
  for (const listing of LISTINGS) if (host === listing || host.endsWith(`.${listing}`)) return true;
  return false;
}

export function checkRivals(r: SiteResult): CheckResult {
  const check = "3–5 rivals, none a listing, each with demand or seen by the pass";
  const rivals = r.market?.rivals ?? [];
  const items: string[] = [];
  if (rivals.length < 3 || rivals.length > 5) items.push(`${rivals.length} rivals, not 3–5`);
  for (const rival of rivals) {
    if (bare(rival.domain) === bare(r.site.domain)) items.push(`${rival.domain} is the site itself`);
    else if (r.site.listsOthers !== true && isListing(rival.domain)) items.push(`${rival.domain} lists or writes about businesses; it is not one`);
    if (r.deadRivals.includes(rival.domain)) items.push(`${rival.domain} does not resolve: no such site`);
    if (r.wrongRivals?.includes(rival.domain) === true) items.push(`${rival.domain} is not ${rival.name}'s site: its home page never names it`);
    // A rival the pass's own top tens hold is one whatever its brand's
    // volume (SPEC §6, 2026-10-09, issue 1365); `ranks` is a basis the
    // conclusion keeps only where the evidence bears it out.
    if ((rival.volume ?? 0) <= 0 && rival.basis === "same_job") items.push(`${rival.name} (${rival.domain}) has no brand demand, and no AI answer or top ten of this pass shows it`);
  }
  // Demand orders rivals that do the same job; it never puts a different
  // product first.
  const lead = rivals[0];
  if (lead?.closeness === "partial") items.push(`${lead.name} leads the rivals and does only part of this business's job`);
  const named = rivals.map((rival) => `${rival.name} — ${rival.domain}, ${rival.volume ?? "unread"}/mo, ${rival.basis}`).join("; ");
  if (items.length > 0) return { check, verdict: "fail", detail: named === "" ? "no rivals were concluded" : named, items };
  return { check, verdict: "pass", detail: named, items: [] };
}

// ── 4 and 7. Searches and topics on the market ─────────────────────────────

/** Words of someone looking for a site they already know, not for a thing
 *  to buy. */
const NAVIGATIONAL_RE =
  /\b(log ?in|sign ?in|sign ?up|anmelden|einloggen|www|https?|customer service|phone number|contact number|telefonnummer|kontakt|opening hours|öffnungszeiten|careers|jobs|karriere|stellenangebote|impressum)\b|\.(com|de|co\.uk|org|net|io|app)\b/iu;

/** What makes the site's own name: its domain's label and the name its home
 *  page gives. A two-letter label names nothing. */
function ownNames(r: SiteResult): string[] {
  const label = bare(r.site.domain).split(".")[0] ?? "";
  return [label, label.replace(/-/g, " "), r.siteName ?? ""].map((name) => name.trim().toLowerCase()).filter((name) => name.length > 2);
}

function rivalNames(market: MarketConclusion | null): string[] {
  const names = new Set<string>();
  for (const rival of market?.rivals ?? []) {
    for (const name of [rival.name, ...(rival.searchNames ?? []), bare(rival.domain).split(".")[0] ?? ""]) {
      if (name.trim().length > 2) names.add(name.trim().toLowerCase());
    }
  }
  return [...names];
}

/** Every word the market is spoken in: its category and other names, its
 *  terms, the job and the buyer. */
function marketWords(market: MarketConclusion | null): Set<string> {
  if (market === null) return new Set();
  const text = [market.category, ...market.synonyms, ...(market.terms ?? []).map((t) => t.term), market.job, market.buyer, ...market.differentiators];
  return new Set(text.flatMap(words).filter((word) => !GENERIC_CATEGORY.has(word)).map(stem));
}

export type QueryFinding = { verdict: "fail" | "review"; why: string } | null;

/**
 * One search or topic against the market. `only` decides the rival rule: a
 * measured search that names a rival at all is that rival's search; a topic
 * may compare with a rival ("x alternatives") and fails only where the
 * rival's name is all it is.
 */
export function judgeQuery(query: string, r: SiteResult, rivalRule: "names" | "only"): QueryFinding {
  const off = (r.market?.notOurMarket ?? []).find((phrase) => holds(query, phrase));
  if (off !== undefined) return { verdict: "fail", why: `off-market: "${off}" is a market this site is not in` };
  const rival = rivalNames(r.market).find((name) => holds(query, name));
  if (rival !== undefined) {
    const rest = words(padded(query).replace(padded(rival), " "));
    if (rest.length === 0) return { verdict: "fail", why: `a rival's brand ("${rival}")` };
    if (rivalRule === "names") return { verdict: "fail", why: `names a rival ("${rival}")` };
  }
  // A topic that sets the site beside a rival names both, and is neither's
  // navigational search.
  const compares = rivalRule === "only" && rival !== undefined;
  const own = ownNames(r).find((name) => holds(query, name));
  if (own !== undefined && !compares) return { verdict: "fail", why: `navigational: names the site itself ("${own}")` };
  const navigational = NAVIGATIONAL_RE.exec(query);
  if (navigational !== null) return { verdict: "fail", why: `navigational ("${navigational[0].trim()}")` };
  const market = marketWords(r.market);
  if (!compares && market.size > 0 && !words(query).some((word) => market.has(stem(word)))) return { verdict: "review", why: "shares no word with the market" };
  return null;
}

const NOT_A_SEARCH: Readonly<Record<Malformed, string>> = {
  repeated_phrase: "says a phrase twice",
  empty_comparison: "compares with nothing",
  web_address: "holds a web address in place of a name",
  domain_for_name: "calls a rival by its domain, not its name",
};

/** The site's name as it reads with every letter outside ASCII dropped,
 *  where that differs from the name: "zuni caf" for Zuni Café. */
function nameWithLettersDropped(r: SiteResult): string | null {
  const name = (r.siteName ?? "").toLowerCase();
  const kept = words(name).join(" ");
  const dropped = name.replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  return kept === "" || dropped === "" || dropped === kept ? null : dropped;
}

/** Why a search or a topic is not a search anyone would type, whatever the
 *  market: the product's own rule, and a name that lost its letters. */
export function notASearch(query: string, r: SiteResult): string | null {
  const malformed = malformedSearch(query, r.market?.rivals ?? []);
  if (malformed !== null) return NOT_A_SEARCH[malformed];
  const dropped = nameWithLettersDropped(r);
  const kept = words(r.siteName ?? "").join(" ");
  if (dropped !== null && holds(query, dropped) && !holds(query, kept)) return `the site's name lost its letters ("${dropped}")`;
  return null;
}

function judged(check: string, queries: readonly string[], r: SiteResult, rivalRule: "names" | "only", none: CheckResult): CheckResult {
  if (queries.length === 0) return none;
  const failed: string[] = [];
  const unsure: string[] = [];
  for (const query of queries) {
    const malformed = notASearch(query, r);
    if (malformed !== null) {
      failed.push(`${query} — ${malformed}`);
      continue;
    }
    const finding = judgeQuery(query, r, rivalRule);
    if (finding?.verdict === "fail") failed.push(`${query} — ${finding.why}`);
    else if (finding?.verdict === "review") unsure.push(`${query} — ${finding.why}`);
  }
  if (failed.length > 0) return { check, verdict: "fail", detail: `${failed.length} of ${queries.length}`, items: [...failed, ...unsure] };
  if (unsure.length > 0) return { check, verdict: "review", detail: `${unsure.length} of ${queries.length} to read by hand`, items: unsure };
  return { check, verdict: "pass", detail: `${queries.length} read`, items: [] };
}

export function checkSearches(r: SiteResult): CheckResult {
  const check = "no measured search is off-market, a rival's brand or navigational";
  return judged(check, r.searches, r, "names", { check, verdict: "fail", detail: "no measured search was seeded", items: [] });
}

export function checkTopics(r: SiteResult): CheckResult {
  const check = "topics are all on-market";
  const open = r.topics.filter((topic) => topic.status === "open");
  const none: CheckResult = { check, verdict: "review", detail: `no open topic was derived (${r.topics.length} held)`, items: [] };
  const result = judged(check, open.map((topic) => topic.query), r, "only", none);
  // The pass's own judgement outranks a word match: a topic it scored as no
  // fit, or as one the business can only be mentioned in, is off-market. The
  // pass keeps such a row with its reason and holds it back from every day
  // (`low_fit`); one left ready to be written is the defect. A stored result
  // from before readiness was recorded cannot say which, and is read by hand.
  const lowFit = open.filter((topic) => topic.fit !== null && topic.fit <= 1);
  const ready = lowFit.filter((topic) => topic.ready === true).map((topic) => `${topic.query} — ready to be written at business fit ${topic.fit}`);
  const unknown = lowFit.filter((topic) => topic.ready === null || topic.ready === undefined).map((topic) => `${topic.query} — open at business fit ${topic.fit}; whether it was held back was not recorded`);
  if (ready.length > 0) return { check, verdict: "fail", detail: `${ready.length} of ${open.length} ready at fit 0 or 1`, items: [...ready, ...unknown, ...result.items] };
  if (unknown.length === 0 || result.verdict === "fail") return { ...result, items: [...result.items, ...unknown] };
  return { check, verdict: "review", detail: `${unknown.length} of ${open.length} open at fit 0 or 1, readiness not recorded`, items: [...unknown, ...result.items] };
}

// ── 5. The knowledge base's questions ──────────────────────────────────────

const ASKS_RE =
  /^(who|whom|whose|what|when|where|why|how|which|can|could|do|does|did|is|are|am|was|were|will|would|should|shall|may|must|have|has|wer|was|wann|wo|woher|wohin|warum|wieso|weshalb|wie|wieviel|welche[rsnm]?|kann|können|könnte|darf|dürfen|muss|müssen|soll|sollte|ist|sind|gibt|hat|haben|wird|werden|brauche|bietet|bieten)\b/iu;

/** A question a buyer would ask: it asks, in a sentence. A heading lifted
 *  off a page ("Pricing", "Our services", "FAQ") does neither. */
export function isRealQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (words(trimmed).length + (trimmed.match(/\b(a|an|the|of|for|to|in|on|at|by|with|or)\b/giu)?.length ?? 0) < 3) return false;
  return trimmed.endsWith("?") || ASKS_RE.test(trimmed);
}

export function checkQuestions(r: SiteResult): CheckResult {
  const check = "knowledge-base buyer questions are real questions, not headings";
  if (r.knowledgePages === 0) return { check, verdict: "fail", detail: "the knowledge base was not built: no page of the site was read into it", items: [] };
  if (r.questions.length === 0) {
    // A site whose pages ask nothing is fine, and the result says so.
    if (r.pageQuestions === 0) return { check, verdict: "pass", detail: "the site's own pages ask no question, and none is kept", items: [] };
    if (typeof r.pageQuestions === "number") {
      return { check, verdict: "fail", detail: `the site's own pages ask ${r.pageQuestions} questions and the knowledge base holds none`, items: [] };
    }
    return { check, verdict: "review", detail: "the knowledge base holds no buyer question", items: [] };
  }
  const headings = r.questions.filter((question) => !isRealQuestion(question));
  if (headings.length > 0) return { check, verdict: "fail", detail: `${headings.length} of ${r.questions.length} are not questions`, items: headings };
  return { check, verdict: "pass", detail: `${r.questions.length} questions`, items: [] };
}

// ── 6. The audience ────────────────────────────────────────────────────────

/** Words that name no one in particular. */
const GENERIC_BUYER = new Set(
  (
    "business businesses company companies customer customers client clients people person user users consumer consumers " +
    "everyone anyone anybody individual individuals organization organizations organisation organisations team teams " +
    "brand brands buyer buyers owner owners small medium large sized mid size all any every b2b b2c smb smbs sme smes " +
    "who that need want looking seeking their them they " +
    "kunden kunde unternehmen firmen menschen personen nutzer alle jeder"
  ).split(" ")
);

export function checkAudience(r: SiteResult): CheckResult {
  const check = "the audience is specific";
  const buyer = r.market?.buyer?.trim() ?? "";
  if (buyer === "") return { check, verdict: "fail", detail: "no buyer was concluded", items: [] };
  const naming = words(buyer).filter((word) => !GENERIC_BUYER.has(word) && !GENERIC_CATEGORY.has(word));
  if (naming.length === 0) return { check, verdict: "fail", detail: `"${buyer}" names no one in particular`, items: [buyer] };
  return { check, verdict: "pass", detail: `"${buyer}"`, items: [] };
}

// ── A business that trades in one place ────────────────────────────────────

const NEAR_RE = /\b(near me|nearby|in der nähe|in meiner nähe)\b/iu;

/**
 * A business is measured where it serves (SPEC §6, owner D67, issue 1318).
 * One with a place: the pass stored that place, every searched term and
 * measured search names it or says "near me", Google's results were read
 * from it where the vendor lists it, and a national chain is a rival only
 * where the pass's own results show it. One with no place: the pass stored
 * none. A run stored before D67 is for a person to read, as it was.
 */
export function checkPlace(r: SiteResult): CheckResult | null {
  const place = r.site.place ?? [];
  const check = "a local business is measured in its own place";
  if (place.length === 0) {
    const stored = r.area?.place ?? null;
    if (stored === null) return null;
    return { check: "a business that sells everywhere is not measured in one place", verdict: "fail", detail: `stored as serving ${stored}`, items: [stored] };
  }
  const local = (text: string): boolean => NEAR_RE.test(text) || place.some((name) => holds(text, name));
  const said = [...(r.market?.terms ?? []).filter((t) => t.volume > 0).map((t) => `${t.term} ${t.volume}/mo`), ...r.searches];
  const elsewhere = said.filter((text) => !local(text));
  const rivals = (r.market?.rivals ?? []).map((rival) => `rival: ${rival.name} (${rival.domain})`);
  const counted = `${said.length - elsewhere.length} of ${said.length} terms and searches name ${place.join(" or ")} or "near me"`;
  if (r.area === undefined) {
    return { check, verdict: "review", detail: `${counted}; are the rest, and the rivals, this place's?`, items: [...elsewhere, ...rivals] };
  }
  const items: string[] = [];
  const stored = r.area?.place ?? null;
  if (stored === null) items.push("the pass stored no place: it was measured as a business that sells nationally");
  else if (!place.some((name) => holds(stored, name))) items.push(`stored as serving ${stored}`);
  for (const text of elsewhere) items.push(`not asked of the place: ${text}`);
  if (said.length === 0) items.push("no searched term and no measured search");
  const location = r.area?.location ?? null;
  if (stored !== null && location === null) items.push(`the search vendor lists no city for ${stored}: its results were read from the country`);
  if (location !== null && !r.locales.some((locale) => locale.location === location)) items.push(`no result was read from ${location}`);
  const shown = new Set((r.resultDomains ?? []).map(bare));
  for (const rival of r.market?.rivals ?? []) {
    if (rival.national === true && !shown.has(bare(rival.domain))) items.push(`${rival.name} (${rival.domain}) is a national chain no result of this pass showed`);
  }
  if (items.length > 0) return { check, verdict: "fail", detail: `${counted}; ${items.length} things are not this place's`, items };
  return { check, verdict: "pass", detail: `${counted}; read from ${location ?? "the country"}; ${rivals.length} rivals, every national one shown in this place's results`, items: [] };
}

// ── The tracked prompts fit the kind of business ───────────────────────────

/** Words a software buyer's prompt uses and no other kind's does. */
const SOFTWARE_WORDS_RE = /\b(tools?|software|platforms?|free trial|engineering team|anbieter|testphase|entwickler)\b/iu;
/** The prompt kinds that name the market, and so its place. */
const NAMES_MARKET = new Set(["category", "use-case", "persona", "problem"]);

/**
 * The tracked prompts are a buyer of this kind of business's own questions
 * (SPEC §6, owner D69, issue 1318): the conclusion recorded a kind the
 * panel allows, a kind that is not software asks nothing in software's
 * words, and a local business's prompts name its place (D67).
 */
export function checkPrompts(r: SiteResult): CheckResult {
  const check = "the tracked prompts fit the kind of business";
  if (r.prompts === undefined) return { check, verdict: "review", detail: "stored before the kind of business was recorded (D69)", items: [] };
  const kind = r.market?.kind ?? null;
  const allowed = r.site.kinds ?? [];
  const items: string[] = [];
  if (kind === null) items.push("no kind of business was recorded");
  else if (allowed.length > 0 && !allowed.includes(kind)) items.push(`recorded as ${kind}; it is ${allowed.join(" or ")}`);
  if (r.prompts.length === 0) items.push("the market yields no prompt");
  if (kind !== null && kind !== "software") {
    for (const prompt of r.prompts) if (SOFTWARE_WORDS_RE.test(prompt.text)) items.push(`asks as a software buyer does: ${prompt.text}`);
  }
  const place = r.site.place ?? [];
  if (place.length > 0) {
    for (const prompt of r.prompts) {
      if (NAMES_MARKET.has(prompt.kind) && !place.some((name) => holds(prompt.text, name))) items.push(`does not name the place: ${prompt.text}`);
    }
  }
  if (items.length > 0) return { check, verdict: "fail", detail: `${kind ?? "no kind"}; ${items.length} of its ${r.prompts.length} prompts or facts do not fit`, items };
  return { check, verdict: "pass", detail: `${kind}; ${r.prompts.length} prompts${place.length > 0 ? `, each naming ${place[0]}` : ""}`, items: [] };
}

// ── What the pass paid for ─────────────────────────────────────────────────

/** The share of a pass's AI Mode reads that may time out (the pass's own
 *  `serp_timeouts` bound), and the count that fails a stored result which
 *  kept no total. */
const TIMEOUT_SHARE = 0.2;
const TIMEOUTS_WITHOUT_TOTAL = 3;

/** The model call the knowledge base is read with, as the ledger names it. */
const KNOWLEDGE_SOURCE = "site-knowledge";

/**
 * Two bounds on what a pass buys, whatever the site's size: the knowledge
 * base's read stays inside its budget, and AI Mode reads are answered, not
 * timed out and billed.
 */
export function checkSpend(r: SiteResult): CheckResult {
  const check = "the pass pays for answers: the knowledge base is bounded, AI Mode reads come back";
  const items: string[] = [];
  const knowledge = r.costBySource[KNOWLEDGE_SOURCE] ?? 0;
  if (knowledge > KNOWLEDGE_BASE.BUDGET_C) {
    items.push(`the knowledge base cost ${knowledge.toFixed(2)}¢ for ${r.knowledgePages ?? "an unrecorded number of"} pages; its bound is ${KNOWLEDGE_BASE.BUDGET_C}¢`);
  }
  const ai = r.aiMode ?? null;
  if (ai !== null) {
    const failing = ai.reads === null ? ai.timeouts >= TIMEOUTS_WITHOUT_TOTAL : ai.reads > 0 && ai.timeouts / ai.reads > TIMEOUT_SHARE;
    if (failing) items.push(`${ai.timeouts} of ${ai.reads ?? "its"} AI Mode reads timed out and were billed`);
  }
  if (items.length > 0) return { check, verdict: "fail", detail: items.join("; "), items };
  return { check, verdict: "pass", detail: `knowledge base ${knowledge.toFixed(2)}¢${ai === null ? "" : `; ${ai.timeouts} of ${ai.reads ?? "an unrecorded number of"} AI Mode reads timed out`}`, items: [] };
}

// ── All of them ────────────────────────────────────────────────────────────

export function checkSite(r: SiteResult): CheckResult[] {
  const place = checkPlace(r);
  return [checkCategory(r), checkSearchTerm(r), checkLocale(r), checkRivals(r), checkSearches(r), checkQuestions(r), checkAudience(r), checkTopics(r), checkSpend(r), checkPrompts(r), ...(place === null ? [] : [place])];
}

/** A defect kind and the sites it affects, for the run's summary. */
export function defectsByKind(results: readonly { domain: string; checks: readonly CheckResult[] }[]): { check: string; sites: { domain: string; detail: string; items: readonly string[] }[] }[] {
  const kinds = new Map<string, { domain: string; detail: string; items: readonly string[] }[]>();
  for (const result of results) {
    for (const check of result.checks) {
      if (check.verdict !== "fail") continue;
      const sites = kinds.get(check.check) ?? [];
      sites.push({ domain: result.domain, detail: check.detail, items: check.items });
      kinds.set(check.check, sites);
    }
  }
  return [...kinds].map(([check, sites]) => ({ check, sites })).sort((a, b) => b.sites.length - a.sites.length || a.check.localeCompare(b.check));
}
