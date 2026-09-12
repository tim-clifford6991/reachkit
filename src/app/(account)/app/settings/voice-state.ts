// SPEC.md §5 (2026-09-12) — the voice card's wire name.
//
// A file of its own for the reason `./market-state.ts` is one: a
// `"use server"` module may export only async functions, so the field name
// the panel writes and the action reads cannot live beside the Server
// Function that reads it.
//
// One constant and no state union: unlike a market change, storing the
// voice answers nothing the card must then state — there is no effective
// date, no refusal, and no value to keep intact, because any text a
// customer writes about how their pages should sound is a text they may
// have. The card states what is stored; the press stores it.

/** The native `name` on the voice field. Internal (rule 1.1), not a
 *  sentence: it is the wire name a browser puts in `FormData`. */
export const VOICE_FIELD = "voice_text";
