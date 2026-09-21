// BUILD §8 hard rule 7 — "brand voice = one free-text field appended to the
// prompt. Nothing learned."
//
// `DraftPromptInputs` is the closed struct that is how "nothing learned" is
// kept. It is the **only** path into a generation prompt, and its eight
// members are the whole of what a prompt may know about a customer: their
// name, their domain, their category, their voice text, the opportunity
// being written, the grounded fact, the pages of their own site the page
// links to, and the **confirmed business profile**. There is no `summary`,
// no `embedding` and no `history` — so a derived per-site artifact has no
// field to arrive through, and the promise is checkable by reading a type
// rather than by auditing a pipeline.
//
// **The eighth member is the profile, and "nothing learned" still holds**
// (SPEC §7, 2026-09-20: the confirmed profile "joins the writer's inputs …
// This supersedes the closed seven-member prompt"). §8 hard rule 7 bans a
// *learned* artifact — something this product inferred about a customer
// behind their back and then wrote from. The confirmed profile is the
// opposite of that and is the reason the distinction is worth stating: it
// is what ReachKit read off their own site, shown to them on Settings ›
// Your business, with every item removable and their own additions kept
// (#926). A customer who takes an item out has taken it out of this member
// too, because the only thing that can produce a `PromptProfile` is the
// overlay that applied their decisions. So the prompt learns nothing; it is
// *told*, by them.
//
// It is a **bounded projection** and not the profile
// (`./profile-block.ts`): five members, each capped in items and
// characters, with a ceiling over the block. A prompt's budget is the
// draft's cost, and a customer may keep adding to their own lists.
//
// `links` is the one piece of the site profile a prompt carries (SPEC §7,
// "Drafting and linking use the site profile", 2026-09-12): addresses and
// the customer's own page headings, chosen in code by `../links/select.ts`
// and held to by `../links/apply.ts` whatever the model writes.
//
// The voice text is read from `sites.voice_text` **now**, carried in full
// and unaltered, and is not copied onto the draft, not cached and not
// logged. A site that has written none is generated without one and nothing
// is inferred in its place.
//
// A voice instruction that asks for something §8 forbids — an invented
// persona, a claim on the do-not-claim list — loses: the hard rules run
// after generation and stop the draft, which then takes ADR-070's one path.
// The voice text is an input to the prompt, never an input to the battery.
import type { Opportunity } from "@/lib/opportunities";
import type { LinkTarget } from "../links/select";
import type { GroundedFact } from "../rules/types";
import type { PromptProfile } from "./profile-block";

/** Every site-scoped input to a generation prompt. Closed: eight members
 *  and no ninth. */
export interface DraftPromptInputs {
  businessName: string | null;
  domain: string;
  category: string;
  /** `sites.voice_text`, read now, carried verbatim, never stored here. */
  voiceText: string | null;
  /** The opportunity being written, evidence included. */
  opportunity: Opportunity;
  grounded: GroundedFact;
  /** The customer's own pages this page links to, chosen in code. */
  links: readonly LinkTarget[];
  /** The confirmed business profile, bounded (`./profile-block.ts`), or
   *  `null` where nothing has been read of the site.
   *
   *  `null` is not an empty profile: a prompt carrying `profile: null` is
   *  byte-for-byte the prompt this product built before #927, which is what
   *  keeps a site with no reading generating exactly as it did. */
  profile: PromptProfile | null;
}

/** The keys `DraftPromptInputs` has, as a value, so a runtime assertion can
 *  check that the object handed to the model carries exactly these and no
 *  eighth. Derived from the type by `Record<keyof DraftPromptInputs, true>`
 *  — adding a member to the interface without adding it here is a compile
 *  error, and adding one here that the interface lacks is too. */
export const DRAFT_PROMPT_KEYS: Readonly<Record<keyof DraftPromptInputs, true>> = Object.freeze({
  businessName: true,
  domain: true,
  category: true,
  voiceText: true,
  opportunity: true,
  grounded: true,
  links: true,
  profile: true,
});

/** Assembles the struct from what the pipeline already holds. It reads
 *  nothing of its own and stores nothing: no earlier voice text is read,
 *  copied, cached or written, because there is nowhere it could be kept. */
export function buildPromptInputs(a: {
  businessName: string | null;
  domain: string;
  category: string;
  voiceText: string | null;
  opportunity: Opportunity;
  grounded: GroundedFact;
  links: readonly LinkTarget[];
  profile: PromptProfile | null;
}): DraftPromptInputs {
  return {
    businessName: a.businessName,
    domain: a.domain,
    category: a.category,
    voiceText: a.voiceText,
    opportunity: a.opportunity,
    grounded: a.grounded,
    links: a.links,
    profile: a.profile,
  };
}
