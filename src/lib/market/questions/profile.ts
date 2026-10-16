// src/lib/market/questions/profile.ts — WO-071, BP-025 `## Public interface`
// (BUILD §6.7 step 1).
//
// **Risk: high — seams: money, and data leaving the system.** This is the
// order that turns a domain's own home (and optional pricing) text into a
// billable nano call, and decides which of that customer's own text
// crosses to the vendor. Mutation-tested (doctrine 0.13.2, rule 2b):
//   1. **Spend** — the call is issued through `llm()`, which is the one
//      seam every model call's cost passes through (`CostContext.
//      recordFetch`, BP-009/BP-007). This file makes no call of its own
//      outside `llm()` and opens no `fetch`.
//   2. **What crosses the boundary** — of the customer's, `input` carries
//      exactly `{ home, pricing }` as the caller supplied it (or `{ search }`,
//      the site's listing in search, where its pages could not be read), bounded
//      together to `PROFILE_INPUT_MAX_CHARS` (issue #523, `boundPageText`
//      below), beside the fixed `PROFILE_TASK` / `PROFILE_FIELDS`
//      instruction: no keyword,
//      no search term, no selection state, nothing else in this module's
//      future siblings is read here. `deriveProfile` synthesises nothing: an `unmeasured`
//      `llm()` result is returned unaltered, with no default `Profile`
//      substituted for it — a test that survives deleting that pass-through
//      would turn an unreadable home page into a paid call over invented
//      output.
import type { Locale } from "@/lib/locale/locales";
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import type { Measured } from "@/lib/measure/measured";
import { isPlaceholder } from "@/lib/measure/placeholder";
import { PROFILE_INPUT_MAX_CHARS, PROFILE_LIST_BOUNDS } from "@/lib/config/constants";
import { llm } from "@/lib/llm";
import { BUSINESS_KIND_NAMES, isBusinessKind } from "@/lib/market/kinds";
import { REACHES, type Offering, type Profile, type Reach } from "./profile-types";

export { REACHES, type Offering, type Profile, type Reach };

/**
 * A list of short strings bounded by its `PROFILE_LIST_BOUNDS` row.
 *
 * **Over-full is trimmed, never fatal (issue 898).** A production scan of
 * `figma.com` on 2026-09-18 answered with seven brand tokens against a cap
 * of six, and the whole seven-field answer was thrown away for it — twice,
 * since the seam re-asked. With no profile there is no category, so the
 * pass bought no suggestions at all and the visitor was shown a report
 * with no questions, no score and no band. A well-known brand with several
 * names for itself is not an edge case.
 *
 * These caps exist so a prompt cannot return a thousand items and spend
 * the call's whole output budget on one list (issue #462). They were never
 * a claim that a model answering one item past the cap has failed. So an
 * over-full list is cut to `max` **in the model's own order** — the model
 * put its answer in the order it thought best, and the first `max` of it
 * is what we asked for — and the answer is kept.
 *
 * `z.preprocess`, deliberately, rather than a `.transform` after the
 * array: the pipe still reports `minItems`/`maxItems` through
 * `z.toJSONSchema`, so the forced tool `src/lib/llm/index.ts` builds still
 * tells the model the cap (a `.transform` cannot be represented in JSON
 * Schema at all, and `forcedToolFor` would quietly fall back to the plain
 * text path issue #512 exists to avoid).
 *
 * Only the over-full case moves. A list that is empty where `min > 0`, an
 * entry that is not a string, a value that is not a list, a missing field
 * and an eighth field all still refuse the answer — see `PROFILE_SCHEMA`.
 */
function boundedList(bounds: { readonly min: number; readonly max: number }) {
  return z.preprocess(
    (value) => (Array.isArray(value) && value.length > bounds.max ? value.slice(0, bounds.max) : value),
    z.array(z.string()).min(bounds.min).max(bounds.max)
  );
}

/** The offerings as the model answers them: at most 4, none read as none,
 *  an over-full list cut to
 *  the cap in the model's order, as `boundedList` cuts a list of strings.
 *  A weight is a share the model estimates, so it is read generously: a
 *  missing or unreadable one is 1, and `normaliseOfferings` makes them a
 *  share. */
const OFFERING_SCHEMA = z.object({
  name: z.string(),
  category: z.string(),
  weight: z.preprocess((value) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1), z.number()),
});
function offeringList() {
  const bounds = PROFILE_LIST_BOUNDS.offerings;
  return z.preprocess(
    (value) => (value === undefined || value === null ? [] : Array.isArray(value) && value.length > bounds.max ? value.slice(0, bounds.max) : value),
    z.array(OFFERING_SCHEMA).min(bounds.min).max(bounds.max)
  );
}

/** A value from a closed list, or `""` for anything else: a kind or a
 *  reach the model could not place is no kind, never a refused answer. */
function oneOf(values: readonly string[]) {
  return z.preprocess((value) => (typeof value === "string" && values.includes(value.trim().toLowerCase()) ? value.trim().toLowerCase() : ""), z.string());
}

/** The model's output, parsed against exactly `Profile`'s seven fields —
 *  `.strictObject` so a response carrying an eighth field (a keyword, a
 *  selected search) does not parse (`## Steps` step 2). A response that
 *  does not parse is a failed call: `llm()`'s own seam already returns
 *  `unmeasured` for it, and no rescue path is added here.
 *
 *  Every list is bounded (issue #462): an unbounded `vocabulary` is what
 *  let one answer run to 888 tokens and the whole of the call's budget.
 *  A list one past its bound is trimmed rather than refused (issue 898) —
 *  `boundedList` above says why, and says what is still refused. */
export const PROFILE_SCHEMA = z.strictObject({
  category: z.string(),
  job: z.string(),
  offeringType: z.string(),
  audienceTerms: boundedList(PROFILE_LIST_BOUNDS.audienceTerms),
  namedRivals: boundedList(PROFILE_LIST_BOUNDS.namedRivals),
  vocabulary: boundedList(PROFILE_LIST_BOUNDS.vocabulary),
  brandTokens: boundedList(PROFILE_LIST_BOUNDS.brandTokens),
  // Absent or long is never fatal: a town is a nicety the free pass checks
  // against the vendor's list before it trusts it.
  town: z.preprocess((value) => (typeof value === "string" ? value.slice(0, 80) : value === undefined || value === null ? "" : value), z.string()),
  // Issue 1454. The offerings are what selection spreads its searches
  // across; a kind or a reach the model could not place is read as none.
  offerings: offeringList(),
  kind: oneOf(BUSINESS_KIND_NAMES),
  reach: oneOf(REACHES),
});

/** What `PROFILE_SCHEMA` parses, before `normaliseProfile` reads it. */
type ProfileAnswer = Omit<Profile, "offerings" | "kind" | "reach"> & {
  offerings?: readonly Offering[];
  kind?: string;
  reach?: string;
};

/** How a bounded list is described to the model — the same two numbers
 *  the schema enforces, read from the same pin. */
function listOf(bounds: { readonly min: number; readonly max: number }, what: string): string {
  const count = bounds.min > 0 ? `${bounds.min} to ${bounds.max}` : `at most ${bounds.max}`;
  return `${count} short strings: ${what}`;
}

/** What the model is asked for (BUILD §6.7 step 1). Before issue #462 the
 *  call carried the customer's pages and nothing else — the model was
 *  never told the seven fields `PROFILE_SCHEMA` requires, so a first
 *  attempt that parsed was luck. One key per schema field, in the
 *  schema's own order; `tests/market/questions/profile.test.ts` asserts
 *  the key set and every list's bounds against the schema itself. */
export const PROFILE_FIELDS: Readonly<Record<Exclude<keyof Profile, "language">, string>> = Object.freeze({
  category:
    "one string: the product category in the words a buyer would type into Google, not the site's own marketing language",
  job: "one string: the job the product does for the person who buys it",
  offeringType: "one string: the kind of offering",
  audienceTerms: listOf(PROFILE_LIST_BOUNDS.audienceTerms, "the audiences or use cases it serves"),
  namedRivals: listOf(
    PROFILE_LIST_BOUNDS.namedRivals,
    "competitors the pages themselves name, as written there; none if they name none"
  ),
  vocabulary: listOf(PROFILE_LIST_BOUNDS.vocabulary, "the words and phrases a buyer uses for this kind of product"),
  brandTokens: listOf(PROFILE_LIST_BOUNDS.brandTokens, "the business's own brand and product names"),
  town:
    "one string: the one town or city whose customers the business serves in person, as the pages say it (an address in the footer or contact block, \"based in\", \"serving\"), with its state or region after a comma where the pages give one; \"\" where the pages name none or the business sells across a country or online",
  offerings:
    `at most ${PROFILE_LIST_BOUNDS.offerings.max} objects { name, category, weight }, one for each distinct line the business sells, the biggest first: ` +
    "`name` as the site calls it, `category` that line in the words a buyer types into Google (the first one's is `category`), " +
    "`weight` the share of the site about it from 0 to 1. A business that sells one thing has one",
  kind: `one of ${BUSINESS_KIND_NAMES.map((kind) => `"${kind}"`).join(", ")}: which describes the business best`,
  reach:
    "one of \"local\" (customers in one town or city and around it), \"national\" (one country), \"international\" (several countries, or anyone online): how far it sells",
});

export const PROFILE_TASK =
  "Describe the business whose home page (and pricing page, when given) follow, the way a buyer would. " +
  "Answer with one JSON object and nothing else: no prose, no code fence. It has exactly the fields " +
  "listed under `fields` and no other; each entry says what goes in that field.";

/** SPEC §2 (owner, 2026-10-10, issue 1387): the same seven fields, asked of
 *  a site whose own pages bot protection kept the reader off. What it is
 *  given is the site's listing in search (`src/lib/scan/search-footprint.ts`),
 *  and it is told so, and told to name no category the listing does not
 *  support: a placeholder there is read as no market, and the pass stops
 *  rather than guessing. */
export const PROFILE_SEARCH_TASK =
  "Describe a business the way a buyer would. Its own pages could not be read, so what follows under `search` " +
  "is how its site appears in Google: the title and snippet Google shows for each of its pages, and the searches " +
  "it ranks for. Read from them what the business sells, to whom and where. A search that names only the brand, " +
  "a login, a job or a help page says nothing of what it sells. `category` is one category as a buyer types it " +
  "into Google, a single search term: never two joined by \"and\", and never the wording of a page title. " +
  "Where the listing does not say what the business sells, answer `category` with \"<UNKNOWN>\" and do not guess. " +
  "Answer with one JSON object and nothing else: no prose, no code fence. It has exactly the fields " +
  "listed under `fields` and no other; each entry says what goes in that field.";

/** How many characters `text` becomes inside the JSON `llm()` serialises
 *  its input into, quotes excluded. The bound is on this, not on
 *  `text.length`: the cost reservation is estimated from the serialised
 *  prompt (`src/lib/llm/index.ts`), and an escaped character (a quote, a
 *  backslash, a control character) is two to six characters there. */
function serialisedLength(text: string): number {
  return JSON.stringify(text).length - 2;
}

const WHITESPACE_RE = /\s/;
const LAST_WHITESPACE_RE = /\s\S*$/;

/** The longest prefix of `text` whose serialised length fits `budget`, cut
 *  at a whitespace boundary — never mid-word, and never through a
 *  surrogate pair — with the whitespace it was cut at dropped. A text that
 *  fits is returned whole. */
function cutAtWord(text: string, budget: number): { text: string; spent: number } {
  let spent = 0;
  let end = 0;
  for (const char of text) {
    const cost = serialisedLength(char);
    if (spent + cost > budget) break;
    spent += cost;
    end += char.length;
  }
  if (end === text.length) return { text, spent };
  const prefix = text.slice(0, end);
  const cut = WHITESPACE_RE.test(text.charAt(end)) ? end : Math.max(0, prefix.search(LAST_WHITESPACE_RE));
  const kept = text.slice(0, cut).trimEnd();
  return { text: kept, spent: serialisedLength(kept) };
}

/** The customer's two pages as one `profile` prompt may carry them (issue
 *  #523): the home text first, the pricing text in whatever of `maxChars`
 *  the home text left, each cut at a word boundary, their serialised
 *  lengths together at most `maxChars`. A pricing page with no room left
 *  is not sent. Only the prompt is bounded — the caller's text, and the
 *  measurement it came from, are untouched. */
export function boundPageText(
  a: { home: string; pricing?: string },
  maxChars: number
): { home: string; pricing?: string } {
  const home = cutAtWord(a.home, maxChars);
  if (a.pricing === undefined) return { home: home.text };
  const pricing = cutAtWord(a.pricing, maxChars - home.spent);
  return pricing.text === "" ? { home: home.text } : { home: home.text, pricing: pricing.text };
}

/** BP-025 `## Public interface`, verbatim signature. One `llm()` call,
 *  `site: 'profile'`, `tier: 'nano'`; the `CostContext` passed straight
 *  through and the `Measured<Profile>` `llm()` returns handed back
 *  unaltered but for a placeholder category, which is emptied (issue
 *  1377) — no default category, no fallback to the site's own
 *  marketing wording, no retry (`llm()` already retries once on a parse
 *  failure; this function does not retry again). */
export function deriveProfile(
  c: CostContext,
  a: ({ home: string; pricing?: string } | { search: string }) & { locale?: Locale }
): Promise<Measured<Profile>> {
  const language = a.locale?.language ?? "en";
  return llm<ProfileAnswer>(c, {
    site: "profile",
    // The fixed instruction, then the customer's own two pages and nothing
    // else of theirs: no keyword, no search term, no selection state. Where
    // those pages could not be read (issue 1387), the site's listing in
    // search in their place, under its own instruction and bounded the same.
    input:
      "search" in a
        ? { task: PROFILE_SEARCH_TASK, fields: PROFILE_FIELDS, search: boundPageText({ home: a.search }, PROFILE_INPUT_MAX_CHARS).home }
        : { task: PROFILE_TASK, fields: PROFILE_FIELDS, ...boundPageText(a, PROFILE_INPUT_MAX_CHARS) },
    schema: PROFILE_SCHEMA,
    tier: "nano",
    ...(a.locale === undefined ? {} : { locale: a.locale }),
  }).then((result): Measured<Profile> => {
    logProfileOutcome(result);
    if (result.kind === "unmeasured") return result;
    const value = normaliseProfile(result.value);
    // The profile carries its language where that is not English, so every
    // later reader of a stored report reads its searches the same way.
    return { ...result, value: language === "en" ? value : { ...value, language } };
  });
}

/**
 * The model's answer as a `Profile` (issues 1377, 1454). Pure.
 *
 * - A placeholder (`<UNKNOWN>`, "n/a") is no category: it is stored empty,
 *   which every reader already takes as none, and nothing is put in its
 *   place. An offering whose category is a placeholder is dropped.
 * - The offerings are ordered by weight, the weights made shares of 1, and
 *   two with the same category are one. Where the model's `category` is
 *   not among them it leads them, with the largest weight's share: the
 *   category is what the first seed is bought on, so the first offering
 *   is always that line.
 * - A kind or a reach the model could not place is absent.
 * - A town is kept only for a business that sells locally: a national or
 *   international business is measured across its country, whatever
 *   address its footer carries.
 */
export function normaliseProfile(answer: ProfileAnswer): Profile {
  const { offerings: answered, kind, reach, ...rest } = answer;
  const category = isPlaceholder(rest.category) ? "" : rest.category;
  const offerings = normaliseOfferings(category, answered ?? []);
  const reachOf = (REACHES as readonly string[]).includes(reach ?? "") ? (reach as Reach) : undefined;
  return {
    ...rest,
    category,
    ...(offerings.length === 0 ? {} : { offerings }),
    ...(isBusinessKind(kind) ? { kind } : {}),
    ...(reachOf === undefined ? {} : { reach: reachOf }),
    ...(rest.town !== undefined && reachOf !== undefined && reachOf !== "local" ? { town: "" } : {}),
  };
}

function normaliseOfferings(category: string, answered: readonly Offering[]): Offering[] {
  const kept: Offering[] = [];
  const key = (text: string): string => text.trim().toLowerCase();
  for (const offering of [...answered].sort((x, y) => y.weight - x.weight)) {
    const name = offering.name.trim();
    const offered = offering.category.trim();
    if (offered === "" || isPlaceholder(offered)) continue;
    const held = kept.find((o) => key(o.category) === key(offered));
    if (held !== undefined) held.weight += offering.weight;
    else kept.push({ name: name === "" ? offered : name, category: offered, weight: offering.weight });
  }
  if (category !== "" && !kept.some((o) => key(o.category) === key(category))) {
    kept.unshift({ name: category, category, weight: kept[0]?.weight ?? 1 });
  } else if (category !== "") {
    const first = kept.findIndex((o) => key(o.category) === key(category));
    kept.unshift(...kept.splice(first, 1));
  }
  const total = kept.reduce((sum, o) => sum + o.weight, 0);
  return kept.slice(0, PROFILE_LIST_BOUNDS.offerings.max).map((o) => ({ ...o, weight: Number((o.weight / total).toFixed(3)) }));
}

/** BP-025 `## NFR budget`: "Observability: profile outcome kind, …" — the
 *  outcome kind (`measured` / `zero` / `unmeasured` + reason) and nothing
 *  else. Never the profile's own fields: `category`, `vocabulary` and the
 *  rest are the customer's own derived text and have no seam that permits
 *  them into a log line. */
function logProfileOutcome(result: Measured<unknown>): void {
  console.log(
    JSON.stringify(
      result.kind === "unmeasured"
        ? { event: "profile_outcome", kind: result.kind, reason: result.reason }
        : { event: "profile_outcome", kind: result.kind }
    )
  );
}
