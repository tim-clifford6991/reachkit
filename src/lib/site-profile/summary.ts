// SPEC.md §2 Rules, verbatim: the scan "stores the page inventory …, the
// site name, its products and claims, and a brand-voice summary (tone,
// person, vocabulary, claims to keep, claims to avoid)". §12 ruling 8
// (2026-09-12) is the ruling behind it.
//
// **Risk: money, and the customer's own text leaving the system.** This is
// the one module that turns what the crawl read into a billable call, so
// the same two guards `src/lib/market/questions/profile.ts` carries apply
// here and are the reason this file is shaped like that one:
//   1. **Spend** — the call is issued through `llm()`, the single seam
//      every model call's cost passes through. This file opens no `fetch`
//      and makes no call of its own outside it.
//   2. **What crosses the boundary** — of the customer's, the input
//      carries the crawled pages' own sampled text and their addresses,
//      bounded together to `SITE_PROFILE.VOICE_INPUT_MAX_CHARS`, beside
//      the fixed instruction below. The crawl has already cut each page to
//      `SITE_PROFILE.PAGE_SAMPLE_CHARS`; this bounds their sum, because a
//      hundred small samples is still a large prompt. **Only the prompt is
//      bounded** — the inventory records every page that was read.
//
// **`voice.text` is the model's prose, not ours.** It is the paragraph the
// customer reads in the voice box at setup and in settings, and — once it
// is on `sites.voice_text` — the string drafting appends to its prompt. It
// describes the customer's own site in the customer's own register, so it
// is derived content on the same footing as a draft, never a sentence the
// product speaks and never a copy key.
//
// **Degrade, never throw.** An answer that does not parse is a failed
// call: `llm()` already returns `unmeasured` for it, and this module hands
// that back untouched — no default voice, no site name guessed from the
// domain, no empty `VoiceSummary` substituted for one that was not read.
import { z } from "zod";
import { SITE_PROFILE } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { llm } from "@/lib/llm";
import type { Tier } from "@/lib/measure";
import type { Measured } from "@/lib/measure/measured";
import type { CrawledPage } from "./crawl";
import type { VoiceSummary } from "./types";

/** What one call reads off a site: everything the profile stores that is
 *  not the inventory itself. */
export interface SiteReading {
  siteName: string | null;
  products: readonly string[];
  claims: readonly string[];
  voice: VoiceSummary;
}

/** How many entries each list the model answers with may carry. The lists
 *  are bounded for the reason issue #462 bounded the profile's: an
 *  unbounded list is how one answer spends the whole of a call's output
 *  budget. The schema and the instruction below read the same numbers, so
 *  what the model is asked for and what is accepted cannot disagree. */
export const VOICE_LIST_MAX = Object.freeze({
  products: 8,
  claims: 8,
  vocabulary: 8,
  claimsToKeep: 6,
  claimsToAvoid: 6,
} as const);

/** Parsed against exactly the fields below and no others (`strictObject`),
 *  the same posture `PROFILE_SCHEMA` takes: an answer carrying a field
 *  nobody asked for does not parse, and a call that does not parse is a
 *  failed call rather than a rescued one. */
export const SITE_READING_SCHEMA = z.strictObject({
  siteName: z.string().nullable(),
  products: z.array(z.string()).max(VOICE_LIST_MAX.products),
  claims: z.array(z.string()).max(VOICE_LIST_MAX.claims),
  voice: z.strictObject({
    text: z.string(),
    tone: z.string(),
    person: z.string(),
    vocabulary: z.array(z.string()).max(VOICE_LIST_MAX.vocabulary),
    claimsToKeep: z.array(z.string()).max(VOICE_LIST_MAX.claimsToKeep),
    claimsToAvoid: z.array(z.string()).max(VOICE_LIST_MAX.claimsToAvoid),
  }),
});

/** One key per schema field, in the schema's own order — the profile
 *  module's lesson (issue #462): a model that is not told the fields its
 *  answer must carry parses by luck. */
export const SITE_READING_FIELDS: Readonly<Record<string, string>> = Object.freeze({
  siteName: "one string: the name the business calls itself on its own pages, or null if the pages never name it",
  products: `at most ${VOICE_LIST_MAX.products} short strings: what this business sells, as its own pages name it`,
  claims: `at most ${VOICE_LIST_MAX.claims} short strings: claims the pages make about the business, quoted as written`,
  "voice.text": "one short paragraph describing how these pages sound, addressed to the business owner, in the plain register of the pages themselves; it is shown to them to edit, so write what is true of their writing and nothing about us",
  "voice.tone": "one string: the tone of the writing",
  "voice.person": "one string: the grammatical person the pages address the reader in",
  "voice.vocabulary": `at most ${VOICE_LIST_MAX.vocabulary} short strings: words these pages use for their own subject, and the words they avoid in their place`,
  "voice.claimsToKeep": `at most ${VOICE_LIST_MAX.claimsToKeep} short strings: specific claims the pages already make that later writing should keep making`,
  "voice.claimsToAvoid": `at most ${VOICE_LIST_MAX.claimsToAvoid} short strings: kinds of claim these pages never make and later writing should not start making`,
});

export const SITE_READING_TASK =
  "Read the pages of one business's website below and describe the business and how its pages sound. " +
  "Answer with one JSON object and nothing else: no prose, no code fence. It has exactly the fields " +
  "listed under `fields` and no other; each entry says what goes in that field. Every answer is read off " +
  "the pages themselves — where the pages do not say, answer with an empty list or null rather than a guess.";

/** How many characters a string becomes inside the JSON `llm()`
 *  serialises its input into, quotes excluded — the figure the cost
 *  reservation is estimated from, which is why the bound is on this and
 *  not on `length` (the same arithmetic `boundPageText` uses). */
function serialisedLength(text: string): number {
  return JSON.stringify(text).length - 2;
}

const LAST_WHITESPACE_RE = /\s\S*$/;

/** The longest prefix of `text` whose serialised length fits `budget`,
 *  cut at a word boundary and never through a surrogate pair. */
function cutAtWord(text: string, budget: number): string {
  let spent = 0;
  let end = 0;
  for (const char of text) {
    const cost = serialisedLength(char);
    if (spent + cost > budget) break;
    spent += cost;
    end += char.length;
  }
  if (end === text.length) return text;
  const prefix = text.slice(0, end);
  const cut = Math.max(0, prefix.search(LAST_WHITESPACE_RE));
  return text.slice(0, cut).trimEnd();
}

/** What one prompt may carry of the crawl: the pages in the order they
 *  were read, each contributing its address and its sampled text, until
 *  `maxChars` of serialised text is spent. The page that does not fit
 *  whole is cut at a word; pages after it are not sent. Nothing here
 *  touches the caller's own array — the inventory keeps every page. */
export function boundPages(
  pages: readonly CrawledPage[],
  maxChars: number
): readonly { url: string; title: string; text: string }[] {
  const sent: { url: string; title: string; text: string }[] = [];
  let spent = 0;
  for (const page of pages) {
    if (spent >= maxChars) break;
    const text = cutAtWord(page.text, maxChars - spent);
    // Nothing of this page fitted. Where the page had text, the budget is
    // gone and the walk stops — the pages after it would be sent as bare
    // addresses, which is a prompt that costs money and says nothing.
    // Where the page genuinely has no text, it is simply skipped.
    if (text === "") {
      if (page.text !== "") break;
      continue;
    }
    spent += serialisedLength(text);
    sent.push({ url: page.url, title: page.title, text });
  }
  return sent;
}

/**
 * One `llm()` call, `site: "site-profile"`, at the tier the pass runs
 * under. The `CostContext` is passed straight through and the `Measured`
 * result handed back unaltered.
 *
 * The tier is the caller's because the same pipeline runs at every tier
 * (`src/lib/scan/run.ts` branches on none): the free pass buys this call
 * against `CAPS.FREE_C` and the weekly refresh against `CAPS.WEEKLY_C`,
 * which is one parameter rather than two code paths.
 */
export function deriveVoice(
  c: CostContext,
  a: { domain: string; pages: readonly CrawledPage[]; tier: Tier }
): Promise<Measured<SiteReading>> {
  const pages = boundPages(a.pages, SITE_PROFILE.VOICE_INPUT_MAX_CHARS);
  return llm(c, {
    site: "site-profile",
    // The fixed instruction, then the customer's own pages and nothing
    // else of theirs: no keyword, no market, no rival, no score.
    input: { task: SITE_READING_TASK, fields: SITE_READING_FIELDS, domain: a.domain, pages },
    schema: SITE_READING_SCHEMA,
    tier: "nano",
  }).then((result) => {
    logVoiceOutcome(result);
    return result;
  });
}

/** The outcome kind and nothing else — never the reading's own fields,
 *  which are the customer's own text and have no seam that permits them
 *  into a log line (the rule `logProfileOutcome` keeps). */
function logVoiceOutcome(result: Measured<SiteReading>): void {
  console.log(
    JSON.stringify(
      result.kind === "unmeasured"
        ? { event: "site_profile_voice_outcome", kind: result.kind, reason: result.reason }
        : { event: "site_profile_voice_outcome", kind: result.kind }
    )
  );
}
