// SPEC §5 (2026-09-20, #908, #923) — the voice step's right-hand side.
//
// "One sample paragraph written from the customer's own pricing/about
// passages in the voice on the left, with the grounded fact marked and
// sourced; one writing call, inside `CAPS.DEEP_C`; *Write the sample again*
// bounded to a few presses."
//
// **This file is pure.** The projection the model is asked with, the shape
// it must answer in, and the bound on how many times a founder may ask —
// all decided here, so a test with no network holds them. Making the call
// is `POST /api/setup/voice-sample`'s.
//
// **A sample is never invented.** The paragraph is grounded in a passage
// the scan actually read off the customer's own pages, and the answer
// carries that passage back so the screen can mark the grounded sentence
// and say which page it came from. A sample with no passage behind it is
// not written at all — there is nothing for it to be true about, and a
// paragraph of plausible prose about a business nobody read is the one
// thing this product does not ship.
//
// **It writes no sentence the customer reads.** The paragraph is the
// model's, shown as the model's; every word of chrome around it is the
// registry's.
import { z } from "zod";

/**
 * How many times one founder may ask for a sample.
 *
 * "*Write the sample again* bounded to a few presses" (#923). Three: the
 * first write plus two more. Each is a paid model call under `CAPS.DEEP_C`,
 * and the bound is what keeps a founder leaning on the button from
 * spending the pass's own ceiling before the pass has run. Enforced on the
 * server — the browser's count is a courtesy that greys the control, and a
 * count a client holds is a count a client can reset.
 */
export const VOICE_SAMPLES_MAX = 3;

/** What the model is asked to answer with. Three members and no fourth:
 *  there is nowhere for a claim, a price or a promise to travel. */
export const voiceSampleSchema = z.object({
  /** The sample itself — one paragraph, in the customer's own voice. */
  paragraph: z.string(),
  /** The sentence inside `paragraph` that carries the grounded fact, quoted
   *  back exactly so the screen can mark it without searching for it. */
  grounded: z.string(),
  /** Which of the passages it was grounded in, by index. The screen turns
   *  that into the page's address; the model never sees a URL. */
  passageIndex: z.number().int().nonnegative(),
});

export type VoiceSample = z.infer<typeof voiceSampleSchema>;

/** One passage the scan read, and the page it came from. The model is given
 *  the text; the address stays on this side of the call. */
export interface VoicePassage {
  url: string;
  passage: string;
}

/**
 * What the model is asked.
 *
 * The voice is the customer's own — the paragraph on the left of this very
 * step, which they may have edited — and the passages are their pages'. The
 * instruction names the one thing the answer is for: a sample that sounds
 * like them and says something true about them.
 */
export function voiceSampleInput(a: {
  voice: string;
  businessName: string | null;
  passages: readonly VoicePassage[];
}): Record<string, unknown> {
  return {
    task: "Write one short paragraph a reader would meet on this business's blog.",
    rules: [
      "Sound like the voice below. Match its rhythm and its plainness; do not imitate its subject.",
      "Say exactly one thing that is true of this business, taken from the passages below.",
      "Quote that sentence back in `grounded`, word for word as it appears in `paragraph`.",
      "Name the passage you used by its index in `passageIndex`.",
      "Claim nothing the passages do not support. No price, no promise, no statistic of your own.",
    ],
    voice: a.voice,
    ...(a.businessName === null ? {} : { business: a.businessName }),
    passages: a.passages.map((p, index) => ({ index, text: p.passage })),
  };
}

/** What the screen is given back: the sample, and where the grounded
 *  sentence came from. `null` is "not written" — there is one arm for every
 *  reason, and the screen states it in the registry's words. */
export interface VoiceSampleAnswer {
  paragraph: string;
  grounded: string;
  /** The page the grounded sentence stands on, or `null` where the model
   *  named a passage that does not exist. A sample whose source cannot be
   *  named is still shown — it is the model's prose either way — but the
   *  screen does not invent an address for it. */
  sourceUrl: string | null;
  /** How many asks this founder has left, after this one. */
  remaining: number;
}

/**
 * The answer, settled against the passages it was written from.
 *
 * `grounded` is trusted only where it actually appears in `paragraph`: a
 * model that quoted back a sentence it did not write would have the screen
 * mark a phrase that is not there, and marking nothing is better than
 * marking the wrong thing.
 */
export function settleVoiceSample(
  sample: VoiceSample,
  passages: readonly VoicePassage[],
  remaining: number
): VoiceSampleAnswer {
  const grounded = sample.paragraph.includes(sample.grounded) ? sample.grounded : "";
  const source = passages[sample.passageIndex];
  return {
    paragraph: sample.paragraph,
    grounded,
    sourceUrl: source?.url ?? null,
    remaining,
  };
}
