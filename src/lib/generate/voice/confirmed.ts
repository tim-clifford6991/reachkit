// SPEC §7 (2026-09-20) · issue #927 — reading the confirmed profile for a
// prompt.
//
// The one seam between the writer and #926's overlay. The three readings are
// `readConfirmedBusiness`'s (#978) — the crawl's, the market's and the
// customer's — and this turns them into the bounded block a prompt carries.
//
// **No new model call and no new table.** Two database reads on the draft
// path, both through the read both screens already use.
//
// **It cannot return the derived row.** `promptProfile` takes a
// `BusinessProfile`, which only `confirmedProfile` produces, and
// `confirmedProfile` subtracts the customer's removals every time it runs.
// So "an item the customer removed can never reach a page" is a property of
// the types rather than a rule a writer has to remember — the derived
// reading does not fit through this door.
//
// **A read that fails writes no page from a guess.** The crawl's reading
// missing means the site has not been read, which is a state §7 already has
// a shape for. A failed read of the *customer's corrections* is different,
// and `editsRead` is why it is visible here at all — see
// `confirmedForWriting` below.
import { confirmedProfile } from "@/lib/site-profile/business/confirm";
import { promptProfile, type PromptProfile } from "./profile-block";

export interface ConfirmedForWriting {
  /** The bounded block a prompt carries, or `null`. */
  readonly profile: PromptProfile | null;
  /** The passages the customer switched off, so the caller can subtract
   *  them from the grounding read (`../pipeline/grounding.ts`'s
   *  `allowedFacts`). */
  readonly factsOff: readonly string[];
}

/** What a site with nothing read and nothing refused looks like. The prompt
 *  this product built before #927, and every passage still allowed. */
const NOTHING_CONFIRMED: ConfirmedForWriting = Object.freeze({
  profile: null,
  factsOff: Object.freeze([]),
});

/**
 * The confirmed profile as a prompt may carry it, and the passages the
 * customer refused.
 *
 * **One read, and it is the one both screens use.** `readConfirmedBusiness`
 * (#978) is the single path to the three readings — the crawl's, the
 * market's and the customer's — so the writer does not get a third. It
 * costs the draft path one `scans` query the caller has in hand already;
 * that is the price of there being one path rather than two, and it is worth
 * paying, because a second path is how the writer and the screen come to
 * disagree about what a customer confirmed.
 *
 * **A decisions read that failed carries no profile.** `editsRead` is what
 * makes that visible: `edits` falls back to "no decisions", which for a
 * screen is right and for the writer is the one thing that must not happen —
 * rather than write from the uncorrected reading, which may hold an item
 * they removed, the profile is dropped entirely and the page is written as
 * it was before #927. A page that is generic is a disappointment; a page
 * that names a service the customer deleted is a promise they never made.
 */
export async function confirmedForWriting(a: {
  siteId: string;
  domain: string;
}): Promise<ConfirmedForWriting> {
  const { readConfirmedBusiness } = await import("@/lib/site-profile/business/confirmed");
  const readings = await readConfirmedBusiness({ siteId: a.siteId, domain: a.domain });
  if (!readings.editsRead) return NOTHING_CONFIRMED;

  return {
    profile: promptProfile(
      confirmedProfile({
        profile: readings.profile,
        market: readings.market,
        edits: readings.edits,
      })
    ),
    factsOff: readings.edits.factsOff,
  };
}

/**
 * Just the passages the customer switched off.
 *
 * The edit path holds no profile to have read them with — it re-grounds an
 * edited body against the customer's own pages — so it asks for this alone.
 * It goes through this module rather than reading the store itself so that
 * there is one door the writer and the editor both open, and one seam a
 * suite doubles.
 *
 * A read that failed refuses nothing: there is nothing to subtract, and the
 * edit re-grounds on the passages alone, exactly as it did before #927.
 */
export async function refusedPassages(a: { siteId: string }): Promise<readonly string[]> {
  try {
    const { readBusinessEdits } = await import("@/lib/site-profile/business/edits");
    return (await readBusinessEdits(a.siteId)).factsOff;
  } catch {
    return [];
  }
}
