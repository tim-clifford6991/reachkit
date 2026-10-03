// SPEC §7 (2026-09-20) · issue #927 — the confirmed business profile, as a
// prompt may carry it.
//
// "**What a page is written from.** The confirmed business profile — what the
// business does, sells and promises, who it serves, its vocabulary — joins
// the writer's inputs, beside the voice, the target search, the facts read
// from the site and the site's own pages. This supersedes the closed
// seven-member prompt."
//
// The owner's bar for this issue: **content must be business specific and
// always relevant to this user, never generic.** That is what this block
// buys — a page about a bike workshop names services a bike workshop sells,
// to the people it serves, in its own words.
//
// **Confirmed, never derived.** What arrives here is
// `@/lib/site-profile/business/confirm`'s output: the crawled reading with
// the customer's own decisions applied over it. So an item they removed has
// no path into a page — not because a writer remembered to filter it, but
// because the only shape the prompt accepts is the one the overlay produced
// (`../../site-profile/business/confirm.ts` says why that is a property
// rather than a promise).
//
// **It is a projection, not the profile.** Five members, each bounded, and
// nothing that could grow:
//
//   · `job` — one sentence, what the business does;
//   · `products` — what it sells;
//   · `audience` — who it serves;
//   · `promises` — what it promises;
//   · `vocabulary` — the words it uses.
//
// `claimsToKeep` and `claimsToAvoid` are deliberately **not** here, and both
// omissions are load-bearing. A claim to avoid is the do-not-claim list,
// which already reaches the prompt as `doNotClaim` and is enforced after
// generation by the claim check — carrying it twice would be two places to
// change one rule. A claim to keep is a promise the customer wants repeated,
// which is what `promises` already is; a second list of the same sentences
// would spend the block's budget saying them twice.
//
// **The knowledge base rides in it** (SPEC §5, 2026-09-29, #1133): the
// writer's `profile` "becomes the knowledge base". `knowledge` is the
// offerings with their features, prices and uses, who the business serves,
// the problems it solves, how it differs, its proof, its buyers' questions,
// integrations and places — each with the address it was read from, or
// `founder` where the founder gave it. It is absent, not empty, on a site
// nothing has been read for, so that site's prompt is unchanged.
//
// **Every fact rule stands.** This block carries what the business *is* — no
// price, no figure, no person, no review. Those still come only from the
// grounded passages, word for word and linked, and the hard rules still
// refuse a page that states one this block could have suggested. A promise
// may be repeated, and only as the customer's own confirmed wording, which
// is the only wording there is here.
//
// Pure. No database, no clock, no model call — which is what lets #927's
// whole behaviour be asserted without a substrate.
import { PROFILE_PROMPT_CAPS } from "@/lib/config/constants";
import type { BusinessProfile } from "@/lib/site-profile/business/types";
import {
  KNOWLEDGE_LISTS,
  type KnowledgeBase,
  type KnowledgeList,
  type KnowledgeSource,
} from "@/lib/site-profile/knowledge/types";

/** An item of the knowledge base as a prompt carries it: its text and
 *  where it is from — a page's address, or `founder`. */
export interface PromptKnowledgeItem {
  readonly text: string;
  readonly from: string;
}

export interface PromptKnowledge extends Readonly<Record<KnowledgeList, readonly PromptKnowledgeItem[]>> {
  readonly offerings: readonly {
    readonly name: string;
    readonly features: readonly string[];
    readonly prices: readonly string[];
    readonly uses: readonly string[];
    readonly from: string;
  }[];
  readonly differentiators: readonly (PromptKnowledgeItem & { readonly rival: string | null })[];
  readonly byline: string | null;
}

/** The five members, as the prompt carries them. Every list is already
 *  trimmed to its cap and every string to its own, so a consumer cannot
 *  receive one that is not. */
export interface PromptProfile {
  readonly job: string | null;
  readonly products: readonly string[];
  readonly audience: readonly string[];
  readonly promises: readonly string[];
  readonly vocabulary: readonly string[];
  /** The knowledge base (#1133). Absent where nothing was read or said. */
  readonly knowledge?: PromptKnowledge;
}

/** One string, trimmed to `chars` at a word boundary where there is one.
 *  Cut mid-word only when the first word is itself longer than the cap,
 *  which is the one case a boundary cannot serve. */
function cut(value: string, chars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= chars) return trimmed;
  const head = trimmed.slice(0, chars);
  const lastSpace = head.lastIndexOf(" ");
  return (lastSpace > 0 ? head.slice(0, lastSpace) : head).trimEnd();
}

/** A list, capped in length and per item, with blanks dropped. */
function list(values: readonly string[], max: number): string[] {
  return values
    .map((value) => cut(value, PROFILE_PROMPT_CAPS.itemChars))
    .filter((value) => value !== "")
    .slice(0, max);
}

/** How many characters a projection would serialise to, counting the text
 *  the prompt actually carries. Not `JSON.stringify().length`: the member
 *  names are fixed and the same for every site, so measuring them would
 *  make the budget depend on this file's field names rather than on the
 *  customer's content. */
function weight(p: PromptProfile): number {
  const k = p.knowledge;
  const knowledge =
    k === undefined
      ? []
      : [
          ...k.offerings.flatMap((o) => [o.name, o.from, ...o.features, ...o.prices, ...o.uses]),
          ...k.differentiators.flatMap((d) => [d.text, d.from, d.rival ?? ""]),
          ...KNOWLEDGE_LISTS.flatMap((name) => k[name].flatMap((item) => [item.text, item.from])),
          k.byline ?? "",
        ];
  return (
    (p.job?.length ?? 0) +
    [...p.products, ...p.audience, ...p.promises, ...p.vocabulary, ...knowledge].reduce(
      (total, item) => total + item.length,
      0
    )
  );
}

function fromOf(source: KnowledgeSource): string {
  return source.kind === "founder" ? "founder" : source.url;
}

/** The knowledge base, bounded per list and per item; `undefined` where it
 *  says nothing. */
function promptKnowledge(base: KnowledgeBase | null): PromptKnowledge | undefined {
  if (base === null) return undefined;
  const max = PROFILE_PROMPT_CAPS.knowledgeItems;
  const text = (value: string): string => cut(value, PROFILE_PROMPT_CAPS.knowledgeItemChars);
  const short = (values: readonly string[]): string[] => values.map(text).filter((v) => v !== "").slice(0, max);
  const built: PromptKnowledge = {
    offerings: base.offerings.slice(0, max).map((offering) => ({
      name: text(offering.name),
      features: short(offering.features),
      prices: short(offering.prices),
      uses: short(offering.uses),
      from: fromOf(offering.source),
    })),
    differentiators: base.differentiators
      .slice(0, max)
      .map((entry) => ({ text: text(entry.text), rival: entry.rival, from: fromOf(entry.source) })),
    ...(Object.fromEntries(
      KNOWLEDGE_LISTS.map((name) => [
        name,
        base[name].slice(0, max).map((item) => ({ text: text(item.text), from: fromOf(item.source) })),
      ])
    ) as Record<KnowledgeList, PromptKnowledgeItem[]>),
    byline: base.byline === null ? null : text(base.byline),
  };
  const empty =
    built.offerings.length === 0 &&
    built.differentiators.length === 0 &&
    built.byline === null &&
    KNOWLEDGE_LISTS.every((name) => built[name].length === 0);
  return empty ? undefined : built;
}

/**
 * The bounded projection, or `null` where the profile says nothing.
 *
 * **`null` and not an empty shape**, because the two are different facts to
 * a prompt: a site whose crawl has not run has no profile, and the prompt
 * that carries `profile: null` is byte-for-byte the prompt this product
 * built before #927. A shape of empty lists would be a new prompt for every
 * such site, and a new prompt is a new cost and a new output.
 *
 * **The whole-block ceiling is applied last, by dropping from the end of the
 * least load-bearing list first.** The order is `vocabulary`, then
 * `promises`, then `audience`, then `products`: a page that names the wrong
 * words still names the right services, and a page that names no service is
 * not about the business. `job` is never dropped — one sentence saying what
 * the business does is the smallest thing that makes a page specific, which
 * is the owner's bar for this issue.
 */
export function promptProfile(
  confirmed: BusinessProfile | null,
  base: KnowledgeBase | null = null
): PromptProfile | null {
  const knowledge = promptKnowledge(base);
  if (confirmed === null && knowledge === undefined) return null;

  const built: PromptProfile = {
    job:
      confirmed === null || confirmed.job === null
        ? null
        : cut(confirmed.job.text, PROFILE_PROMPT_CAPS.jobChars),
    products: list(
      (confirmed?.lists.products ?? []).map((item) => item.text),
      PROFILE_PROMPT_CAPS.products
    ),
    audience: list(
      (confirmed?.lists.audienceTerms ?? []).map((item) => item.text),
      PROFILE_PROMPT_CAPS.audience
    ),
    promises: list(
      (confirmed?.lists.claims ?? []).map((item) => item.text),
      PROFILE_PROMPT_CAPS.promises
    ),
    vocabulary: list(
      (confirmed?.lists.vocabulary ?? []).map((item) => item.text),
      PROFILE_PROMPT_CAPS.vocabulary
    ),
    ...(knowledge === undefined ? {} : { knowledge }),
  };

  // Nothing read: the same `null` a site with no profile row gets, for the
  // same reason. A `job` of nothing and five empty lists is not a profile.
  if (
    knowledge === undefined &&
    (built.job === null || built.job === "") &&
    built.products.length === 0 &&
    built.audience.length === 0 &&
    built.promises.length === 0 &&
    built.vocabulary.length === 0
  ) {
    return null;
  }

  return fitBlock(built);
}

/** What the knowledge base gives up first, least load-bearing first. The
 *  offerings go last of all: what the business sells is what a page is
 *  about. A founder's answer leads its list, so it is the last of that list
 *  to go. */
const KNOWLEDGE_TRIM_ORDER = [
  "places",
  "integrations",
  "questions",
  "problems",
  "audience",
  "proof",
  "differentiators",
] as const satisfies readonly (KnowledgeList | "differentiators")[];

/** The whole-block ceiling: the knowledge base's own lists first, then the
 *  order named above, then the offerings. */
function fitBlock(p: PromptProfile): PromptProfile {
  const over = (out: PromptProfile): boolean => weight(out) > PROFILE_PROMPT_CAPS.blockChars;
  let out: PromptProfile = p;

  for (const key of KNOWLEDGE_TRIM_ORDER) {
    while (over(out) && out.knowledge !== undefined && out.knowledge[key].length > 0) {
      out = { ...out, knowledge: { ...out.knowledge, [key]: out.knowledge[key].slice(0, -1) } };
    }
    if (!over(out)) return out;
  }

  const order: readonly ("vocabulary" | "promises" | "audience" | "products")[] = [
    "vocabulary",
    "promises",
    "audience",
    "products",
  ];
  for (const key of order) {
    while (over(out) && out[key].length > 0) {
      out = { ...out, [key]: out[key].slice(0, -1) };
    }
    if (!over(out)) return out;
  }

  while (over(out) && out.knowledge !== undefined && out.knowledge.offerings.length > 0) {
    out = { ...out, knowledge: { ...out.knowledge, offerings: out.knowledge.offerings.slice(0, -1) } };
  }
  // Every list emptied and the job alone still over the ceiling: the job is
  // never dropped (it is what makes a page specific at all), and it is
  // already capped at `jobChars`, which is well inside `blockChars`.
  return out;
}

/** Which items this projection actually carried, as flat text — what the
 *  draft records so the viewer can list what the page was written from
 *  (#927: "Record on the draft which profile items and facts were used").
 *  A stable order, the projection's own, so two runs of the same profile
 *  record the same list. */
export function profileItemsUsed(p: PromptProfile | null): readonly string[] {
  if (p === null) return [];
  return [
    ...(p.job === null ? [] : [p.job]),
    ...p.products,
    ...p.audience,
    ...p.promises,
    ...p.vocabulary,
    // Of the knowledge base, what the business sells and what the founder
    // said: the two a reader of "written from" can check at a glance.
    ...(p.knowledge?.offerings.map((offering) => offering.name) ?? []),
    ...(p.knowledge === undefined
      ? []
      : [...KNOWLEDGE_LISTS.flatMap((name) => p.knowledge![name]), ...p.knowledge.differentiators]
          .filter((item) => item.from === "founder")
          .map((item) => item.text)),
  ];
}
