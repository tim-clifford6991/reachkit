// SPEC §7 (2026-09-20) · issue #926 — the customer's decisions, applied.
//
// **This file is why nothing in the scan pipeline changed.**
//
// #926's done-when is "an item removed on Sunday is still gone after
// Monday's pass", and the obvious way to get it is to teach the refresh to
// check before it writes. That way is wrong twice over: `site_profiles` is
// keyed by *domain* and shared with free scans of the same domain, so one
// account's corrections would reach a stranger's report; and the refresh
// upserts the row whole, so every future writer would have to remember the
// same check.
//
// So the derived reading is left exactly as it is and the decisions are
// applied here, at read time. A removed item cannot come back, because
// there is no write that could bring it back — the refresh overwrites the
// derived list and this function subtracts the same decision from it again.
// It is a property of the shape rather than a promise about a code path.
//
// Pure: it takes the two readings and returns the third. No database, no
// clock, no vendor — which is what lets the whole of #926's behaviour be
// asserted without a substrate.
import type { InventoryRow, SiteProfile } from "../types";
import { purposeCounts } from "../types";
import {
  BUSINESS_LISTS,
  type BusinessEdits,
  type BusinessItem,
  type BusinessList,
  type BusinessProfile,
  type QuotableFact,
} from "./types";

/** The market reading this file needs, as its own interface.
 *
 *  **Declared here rather than imported from `@/lib/market/questions/profile`
 *  on purpose.** That module reaches the language-model seam, and a `import
 *  type` from it is still an edge in the module graph that
 *  `tests/app/overview/page.test.tsx`'s guard counts — the Overview's own
 *  screen was broken that way once. Settings has no business reaching the
 *  model either. Four fields, structurally identical to the four #926 names,
 *  and the reader that fills them (`../../../app/(account)/app/settings/
 *  business-store.ts`) takes them off the stored report blob. */
export interface MarketReading {
  readonly job: string;
  readonly offeringType: string;
  readonly audienceTerms: readonly string[];
  readonly vocabulary: readonly string[];
}

/** Trimmed, and empty strings dropped. The crawl writes what it read, which
 *  on a real site includes a stray blank; a blank item is not a fact about a
 *  business and must never become a row with a remove control on it. */
function clean(values: readonly string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value !== "");
}

/** Deduplicated, first spelling wins, case-insensitively.
 *
 *  `words` is the union of two readings — the voice's vocabulary and the
 *  market's — and the two overlap heavily by design: both are "the words
 *  this site uses". One list and not two, because a customer looking at
 *  "Words you use" is looking at one fact about their business, and two
 *  lists with the same word in both is two places to remove it from. */
function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/** The derived members of one list, before any decision is applied. */
function derivedList(
  list: BusinessList,
  profile: SiteProfile | null,
  market: MarketReading | null
): string[] {
  switch (list) {
    case "products":
      return clean(profile?.products ?? []);
    case "claims":
      return clean(profile?.claims ?? []);
    case "audienceTerms":
      return clean(market?.audienceTerms ?? []);
    case "vocabulary":
      return unique(clean([...(profile?.voice?.vocabulary ?? []), ...(market?.vocabulary ?? [])]));
    case "claimsToKeep":
      return clean(profile?.voice?.claimsToKeep ?? []);
    case "claimsToAvoid":
      return clean(profile?.voice?.claimsToAvoid ?? []);
  }
}

/** A value with nothing in it is absent, never an empty string. Keeps the
 *  screen's "we have not read this" arm a single check. */
function stated(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The confirmed profile: the derived reading with the customer's decisions
 * over it.
 *
 * Three rules, each one #926 states in as many words:
 *
 *   1. **A removed item stays removed.** It is subtracted from the derived
 *      list every time this runs, so no refresh can restore it.
 *   2. **An added item stays.** It is theirs, it is appended after the
 *      site's own, and nothing derived can displace it. An item they added
 *      that the crawl later reads off the site too is one item, not two —
 *      matched case-insensitively, and shown as the site's, because by then
 *      the site does say it.
 *   3. **A new finding is a suggestion.** A derived item the customer has
 *      never been shown (`seen`) is marked `isNew`, so Monday's additions
 *      arrive visible rather than folded into a list they curated.
 */
export function confirmedProfile(a: {
  profile: SiteProfile | null;
  market: MarketReading | null;
  edits: BusinessEdits;
}): BusinessProfile {
  const { profile, market, edits } = a;

  const lists = Object.fromEntries(
    BUSINESS_LISTS.map((list) => {
      const removed = new Set(clean(edits.removed[list] ?? []).map((v) => v.toLocaleLowerCase()));
      const seen = new Set(clean(edits.seen[list] ?? []).map((v) => v.toLocaleLowerCase()));
      const derived = derivedList(list, profile, market).filter(
        (text) => !removed.has(text.toLocaleLowerCase())
      );
      const derivedKeys = new Set(derived.map((text) => text.toLocaleLowerCase()));

      const fromSite: BusinessItem[] = derived.map((text) => ({
        text,
        source: "site",
        // Rule 3. A profile that has never been read has no `seen` list and
        // no customer decisions either; marking its every item as new would
        // greet a first-time reader with a screen of suggestions, so newness
        // only exists once they have been shown something.
        isNew: seen.size > 0 && !seen.has(text.toLocaleLowerCase()),
      }));

      // Rule 2, and its one subtlety: an added item the site now states
      // itself is already above, so it is not repeated here.
      const ours: BusinessItem[] = clean(edits.added[list] ?? [])
        .filter((text) => !removed.has(text.toLocaleLowerCase()))
        .filter((text) => !derivedKeys.has(text.toLocaleLowerCase()))
        .map((text) => ({ text, source: "yours", isNew: false }));

      return [list, [...fromSite, ...ours]] as const;
    })
  ) as Record<BusinessList, readonly BusinessItem[]>;

  const ownJob = stated(edits.job);
  const derivedJob = stated(market?.job);
  const job =
    ownJob !== null
      ? { text: ownJob, source: "yours" as const }
      : derivedJob !== null
        ? { text: derivedJob, source: "site" as const }
        : null;

  return {
    job,
    offeringType: stated(market?.offeringType),
    tone: stated(profile?.voice?.tone),
    person: stated(profile?.voice?.person),
    lists,
    purposes: purposeCounts(profile?.inventory ?? []),
    pagesRead: profile === null ? null : profile.pagesRead,
    readAt: profile === null ? null : profile.refreshedAt,
  };
}

/** Whether the confirmed profile says anything at all.
 *
 *  A site whose crawl has not run and whose market has not been measured has
 *  every field empty, and the screen states *that* — one written line — in
 *  place of nine empty groups. #926: never a placeholder for a field the
 *  crawl does not have. */
export function profileIsEmpty(p: BusinessProfile): boolean {
  return (
    p.job === null &&
    p.offeringType === null &&
    p.tone === null &&
    p.person === null &&
    p.purposes.length === 0 &&
    BUSINESS_LISTS.every((list) => p.lists[list].length === 0)
  );
}

/**
 * The passages ReachKit may quote, with the customer's switches applied.
 *
 * `pages` answers #926's "how many pages used each": the same passage on
 * more than one of the site's pages is one fact the site repeats, and a
 * reader deciding whether to let us quote it wants to know that. Counted
 * over the passages as read, so a passage on one page reads "1 page", which
 * is the ordinary case and is stated rather than hidden.
 *
 * The order is grounding's own — the order a brief meets them — so the fact
 * at the top of this list is the fact most likely to be used.
 */
export function quotableFacts(a: {
  facts: readonly { readonly passage: string; readonly url: string }[];
  edits: BusinessEdits;
}): QuotableFact[] {
  const off = new Set(a.edits.factsOff);
  const pages = new Map<string, Set<string>>();
  for (const fact of a.facts) {
    const urls = pages.get(fact.passage) ?? new Set<string>();
    urls.add(fact.url);
    pages.set(fact.passage, urls);
  }

  const out: QuotableFact[] = [];
  const emitted = new Set<string>();
  for (const fact of a.facts) {
    if (emitted.has(fact.passage)) continue;
    emitted.add(fact.passage);
    out.push({
      passage: fact.passage,
      url: fact.url,
      pages: pages.get(fact.passage)?.size ?? 1,
      on: !off.has(fact.passage),
    });
  }
  return out;
}

/**
 * A screen's final lists, as decisions over the derived reading (#970).
 *
 * Setup's step two shows four of the six lists and lets the founder take
 * items out and add their own, then hands back what each list ended up
 * holding. What is stored is never a list — it is the two decisions — so
 * this turns one back into the other against the same derived reading the
 * screen drew:
 *
 *   **removed** = what the site says and the founder's list no longer has,
 *   plus every removal already standing that they did not put back. A
 *   removal of something the crawl no longer reads is kept: the crawl may
 *   read it again next Monday, and their decision has to outlive that.
 *
 *   **added** = what their list has and the site does not say.
 *
 * Only the lists in `chosen` are touched. A screen that edits four fields
 * cannot clear the two it never showed, and `job`, `factsOff` and `seen`
 * are carried through untouched — `seen` because it is a fact about a
 * screen and is written beside this by the caller.
 */
export function editsForLists(a: {
  stored: BusinessEdits;
  profile: SiteProfile | null;
  market: MarketReading | null;
  chosen: Readonly<Partial<Record<BusinessList, readonly string[]>>>;
}): BusinessEdits {
  const removed: Partial<Record<BusinessList, readonly string[]>> = { ...a.stored.removed };
  const added: Partial<Record<BusinessList, readonly string[]>> = { ...a.stored.added };

  for (const list of BUSINESS_LISTS) {
    const chosen = a.chosen[list];
    if (chosen === undefined) continue;
    const kept = new Set(clean([...chosen]).map((text) => text.toLocaleLowerCase()));
    const derived = derivedList(list, a.profile, a.market);
    const derivedKeys = new Set(derived.map((text) => text.toLocaleLowerCase()));

    const standing = clean([...(a.stored.removed[list] ?? [])]);
    const takenOut = derived.filter((text) => !kept.has(text.toLocaleLowerCase()));
    removed[list] = unique([...standing, ...takenOut]).filter(
      (text) => !kept.has(text.toLocaleLowerCase())
    );
    added[list] = unique(clean([...chosen])).filter(
      (text) => !derivedKeys.has(text.toLocaleLowerCase())
    );
  }

  return { ...a.stored, removed, added };
}

/** Every derived item of every list, as the `seen` record to store.
 *
 *  Written on every edit, which is what keeps rule 3 honest: the customer
 *  has just been shown this screen, so everything on it has been in front of
 *  them, and only what arrives *after* is new. Taken from the derived
 *  reading and not from the confirmed one — a removed item is still an item
 *  they have seen, and leaving it out would make it new again if the crawl
 *  read it twice. */
export function seenNow(a: {
  profile: SiteProfile | null;
  market: MarketReading | null;
}): Record<BusinessList, string[]> {
  return Object.fromEntries(
    BUSINESS_LISTS.map((list) => [list, derivedList(list, a.profile, a.market)] as const)
  ) as Record<BusinessList, string[]>;
}

/** Re-exported so a caller that needs the inventory shape does not reach
 *  past this module for it. */
export type { InventoryRow };
