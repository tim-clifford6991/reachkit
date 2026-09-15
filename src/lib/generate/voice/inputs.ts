// BUILD §8 hard rule 7 — "brand voice = one free-text field appended to the
// prompt. Nothing learned."
//
// `DraftPromptInputs` is the closed struct that is how "nothing learned" is
// kept. It is the **only** path into a generation prompt, and its seven
// members are the whole of what a prompt may know about a customer: their
// name, their domain, their category, their voice text, the opportunity
// being written, the grounded fact, and the pages of their own site the
// page links to. There is no `profile` member, no `summary`, no `embedding`
// and no `history` — so a derived per-site artifact has no field to arrive
// through, and the promise is checkable by reading a type rather than by
// auditing a pipeline.
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

/** Every site-scoped input to a generation prompt. Closed: seven members
 *  and no eighth. */
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
}): DraftPromptInputs {
  return {
    businessName: a.businessName,
    domain: a.domain,
    category: a.category,
    voiceText: a.voiceText,
    opportunity: a.opportunity,
    grounded: a.grounded,
    links: a.links,
  };
}
