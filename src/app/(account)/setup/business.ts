// SPEC §5 (2026-09-20, #908) — step two, *what we learned about your
// business*: "what the site does, sells and promises, who it serves, the
// words it uses, and the facts that may be quoted with the page each was
// read from. Every item can be removed and the founder can add their own."
//
// The four groups below are the ones the stored profile actually carries
// (`src/lib/site-profile/types.ts`): what the site sells (`products`), what
// it promises (`claims`), the words it uses (`voice.vocabulary`) and the
// claims later writing should keep making (`voice.claimsToKeep`). What the
// site *does* in one sentence, who it *serves*, and the page a quoted fact
// was read from have no member on that shape yet — #926 owns the confirmed
// profile's storage and the editor over it, and adds them there. Nothing is
// invented here to fill a group: a group the scan read nothing for opens
// empty, with its own Add.
//
// Pure, and no sentence: a group's head, its note and its Add label are
// copy keys, read where the panel draws them.
import type { SiteProfile } from "@/lib/site-profile/types";

/** The four groups, in the order the founder reads them. */
export const BUSINESS_GROUPS = ["products", "claims", "vocabulary", "facts"] as const;

export type BusinessGroupId = (typeof BUSINESS_GROUPS)[number];

/** What the founder has taken out of and added to each group. Plain arrays
 *  of the site's own words: every entry is either something the scan read
 *  off their pages or something they typed themselves. */
export type BusinessDraft = Readonly<Record<BusinessGroupId, readonly string[]>>;

/**
 * How long each list may grow.
 *
 * These mirror `VOICE_LIST_MAX` in `src/lib/site-profile/summary.ts`, which
 * bounds what the model may answer with for the same four fields. They are
 * restated rather than imported because that module reaches
 * `@/lib/llm`, and nothing a browser downloads may: #926, which gives this
 * profile a store and an editor of its own, is where the bound becomes one
 * fact read twice.
 */
export const BUSINESS_MAX: Readonly<Record<BusinessGroupId, number>> = Object.freeze({
  products: 8,
  claims: 8,
  vocabulary: 8,
  facts: 6,
});

/** The profile as the founder first meets it. A site nobody has read yet —
 *  the free scan reads no profile — opens with four empty groups rather
 *  than no groups: there is still something for them to add. */
export function businessFrom(profile: SiteProfile | null): BusinessDraft {
  return Object.freeze({
    products: Object.freeze([...(profile?.products ?? [])]),
    claims: Object.freeze([...(profile?.claims ?? [])]),
    vocabulary: Object.freeze([...(profile?.voice?.vocabulary ?? [])]),
    facts: Object.freeze([...(profile?.voice?.claimsToKeep ?? [])]),
  });
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
