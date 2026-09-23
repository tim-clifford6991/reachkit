// SPEC §5 (2026-09-20, #908, #970) — step two, *what we learned about your
// business*: "what the site does, sells and promises, who it serves, the
// words it uses, and the facts that may be quoted with the page each was
// read from. Every item can be removed and the founder can add their own."
//
// **This is a view of the confirmed profile, not a store.** Until #970 this
// module held setup's own vocabulary for those lists and its own reading of
// them, and the founder's removals and additions lived in the browser for
// the length of one setup and were stored nowhere. Both are gone. The lists
// are `site_profile_edits`' own — `BusinessList` names, the stored fields'
// names — the reading is `confirmedProfile`'s, and leaving the step records
// the decisions through `@/lib/site-profile/business/confirmed`. A
// correction made here is in Settings › Your business, and one made there
// is here.
//
// What is left is the step's own: which five of the six lists it shows, and
// the one sentence of what the business does above them (#1038); how long
// each list may grow; and what taking one out and adding one do to what is
// on screen. Pure, and no sentence: a group's head, its note and its Add
// label are copy keys, read where the panel draws them.
import type { BusinessList, BusinessProfile } from "@/lib/site-profile/business/types";

/**
 * The lists step two shows, in the order the founder reads them — the
 * board's (`R3-ON-Business`): what you sell, who you serve, what you
 * promise, the words you use, the facts we can quote. *What you do* comes
 * first and is not a list; it is `job`, below.
 *
 * Five of the six. `claimsToAvoid` is left out on purpose: it is a list the
 * founder builds later, out of what they veto, and the voice step asks for
 * it. A list absent here is untouched by this step — never cleared.
 */
export const BUSINESS_GROUPS = [
  "products",
  "audienceTerms",
  "claims",
  "vocabulary",
  "claimsToKeep",
] as const satisfies readonly BusinessList[];

export type BusinessGroupId = (typeof BUSINESS_GROUPS)[number];

/** What the founder has taken out of and added to each group. Plain arrays
 *  of the site's own words: every entry is either something the scan read
 *  off their pages or something they typed themselves. */
export type BusinessDraft = Readonly<Record<BusinessGroupId, readonly string[]>>;

/**
 * How long each list may grow.
 *
 * These mirror `VOICE_LIST_MAX` in `src/lib/site-profile/summary.ts`, and
 * `audienceTerms` the market profile's own bound, which bound what the
 * model may answer with for the same fields. They are
 * restated rather than imported because that module reaches `@/lib/llm`,
 * and nothing a browser downloads may.
 *
 * It is a bound on this screen and not on the stored shape: Settings adds
 * to the same lists one press at a time and states no ceiling, because a
 * customer curating their own profile a year in is not the founder meeting
 * it for the first time.
 */
export const BUSINESS_MAX: Readonly<Record<BusinessGroupId, number>> = Object.freeze({
  products: 8,
  // The market reading asks for two to four (`PROFILE_LIST_BOUNDS`), and
  // the board prints the same rule beside the head.
  audienceTerms: 4,
  claims: 8,
  vocabulary: 8,
  claimsToKeep: 6,
});

/**
 * The profile as the founder first meets it — the confirmed one.
 *
 * Their own additions and removals are already in it (`confirmedProfile`
 * applied them), which is what makes a correction made in Settings visible
 * here. A site nobody has read yet — the free scan reads no profile — opens
 * with five empty groups rather than no groups: there is still something
 * for them to add.
 */
export function businessFrom(profile: BusinessProfile | null): BusinessDraft {
  return Object.freeze(
    Object.fromEntries(
      BUSINESS_GROUPS.map((group) => [
        group,
        Object.freeze((profile?.lists[group] ?? []).map((item) => item.text)),
      ])
    ) as Record<BusinessGroupId, readonly string[]>
  );
}

/** One item out. Removing by value, because that is what the founder sees
 *  and what the group holds — two identical entries cannot exist, because
 *  `added` refuses one. */
export function removed(draft: BusinessDraft, group: BusinessGroupId, item: string): BusinessDraft {
  return Object.freeze({
    ...draft,
    [group]: Object.freeze(draft[group].filter((entry) => entry !== item)),
  });
}

/** One item in, at the end of its group. An empty entry, a duplicate and a
 *  full group each leave the draft exactly as it was — the screen says why
 *  a full group took nothing, and the other two are a founder pressing Add
 *  on a field they have not filled. */
export function added(draft: BusinessDraft, group: BusinessGroupId, item: string): BusinessDraft {
  const entry = item.trim();
  if (entry === "") return draft;
  if (draft[group].includes(entry)) return draft;
  if (draft[group].length >= BUSINESS_MAX[group]) return draft;
  return Object.freeze({ ...draft, [group]: Object.freeze([...draft[group], entry]) });
}

export function isFull(draft: BusinessDraft, group: BusinessGroupId): boolean {
  return draft[group].length >= BUSINESS_MAX[group];
}

/** *What you do* as the field opens: the founder's own wording where they
 *  have reworded it, else the market reading's sentence, else empty — a
 *  market not yet measured has nothing to offer, and the founder may write
 *  the sentence themselves. */
export function jobFrom(profile: BusinessProfile | null): string {
  return profile?.job?.text ?? "";
}
