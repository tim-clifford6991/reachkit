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

import type { WritingVoice } from "@/lib/generate/voice/register";
import type { CopyKey } from "@/lib/presentation/copy";

/** The native `name` on the voice field. Internal (rule 1.1), not a
 *  sentence: it is the wire name a browser puts in `FormData`. */
export const VOICE_FIELD = "voice_text";

/** The native `name` on the page-voice select (SPEC §7, issue 1390), and
 *  the value that hands the choice back to ReachKit. */
export const WRITING_VOICE_FIELD = "writing_voice";
export const WRITING_VOICE_AUTO = "auto";

/** The three voices a customer may fix, each with the key of its option's
 *  words. Type-only import: this file is a browser's too. */
export const WRITING_VOICE_OPTIONS = [
  { voice: "ours", key: "settings.voice.writing.ours" },
  { voice: "guide", key: "settings.voice.writing.guide" },
  { voice: "short", key: "settings.voice.writing.short" },
] as const satisfies readonly { voice: WritingVoice; key: CopyKey }[];
