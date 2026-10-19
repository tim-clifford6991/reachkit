// BUILD §7 — the shape the three family derivations produce.
//
// A `Candidate` is an `Opportunity` minus the three fields the database
// assigns: its id, its status (always `open` at creation) and its creation
// time. Internal to this directory — it is not part of the engine's public
// surface, because nothing outside derivation may hold an opportunity that
// has not been persisted.
import { languagePack } from "@/lib/locale/language";
import type { Language } from "@/lib/locale/locales";
import type { Opportunity, RejectionCount } from "../types";
import { noRejections } from "../types";

/** The cluster and readiness fields are omitted too: the database defaults
 *  them, and the cluster step that fills them is not this file's. */
export type Candidate = Omit<
  Opportunity,
  "id" | "status" | "createdAt" | "clusterKey" | "absorbedQueries" | "ready" | "unreadyReason"
>;

export interface DerivationResult {
  candidates: Candidate[];
  /** How many targets were looked at, whether or not they became
   *  candidates. `assessed - candidates.length` is the number rejected,
   *  and every rejection lands in exactly one counter below. */
  assessed: number;
  rejected: RejectionCount;
}

export function emptyDerivation(): DerivationResult {
  return { candidates: [], assessed: 0, rejected: noRejections() };
}

/** Letters Unicode does not take apart into a base letter and a mark. */
const LETTERS: Readonly<Record<string, string>> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ð: "d", ł: "l", þ: "th", ı: "i" };

/** A URL-safe slug from a search. Deterministic and ASCII-only: the same
 *  query always proposes the same slug, which is what lets the partial
 *  unique index recognise a weekly re-derivation of the same target. A
 *  letter outside ASCII is written in ASCII, never dropped (issue 1314):
 *  "zuni café" is `zuni-cafe`, "straße" is `strasse`. In the site's
 *  language (D66) a letter is written as that language writes it without
 *  its accent (SPEC §6, 2026-10-18, issue 1514): a German site's "bäckerei
 *  düsseldorf" is `baeckerei-duesseldorf`. It names a new page's address
 *  only: a live page keeps the address it was published at. */
export function slugify(query: string, language: Language = "en"): string {
  const own = languagePack(language).slugLetters;
  // Composed first (NFC): an "ä" typed as "a" plus a combining mark is the
  // same letter, and the language's own rule must see it as one.
  return query
    .normalize("NFC")
    .toLowerCase()
    .replace(/./gu, (letter) => own[letter] ?? letter)
    .replace(/[ßæœøđðłþı]/g, (letter) => LETTERS[letter] ?? letter)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A stored slug written again in its site's language (issue 1545): the slug
 * an open topic was given before its language's letters were known
 * (issue 1514) — `backerei-dusseldorf` — is `baeckerei-duesseldorf`.
 *
 * The slug may be the model's (`refineType`), not the search's, so it is not
 * derived again: each word the search wrote in English letters is swapped
 * for the same word in the language's, and every other word stays. The two
 * spellings of a search differ only inside its words, so they split into
 * the same number of words. A slug already in the language's letters, and
 * any slug in English, is returned as it is.
 */
export function reslugged(a: { targetQuery: string; slug: string; language: Language }): string {
  const plain = slugify(a.targetQuery).split("-");
  const own = slugify(a.targetQuery, a.language).split("-");
  if (plain.length !== own.length) return a.slug;
  const swap = new Map(plain.flatMap((word, at): [string, string][] => (own[at] === word ? [] : [[word, own[at] ?? word]])));
  return a.slug
    .split("-")
    .map((word) => swap.get(word) ?? word)
    .join("-");
}
