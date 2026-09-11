/**
 * The tone vocabulary, and the two §2.5 meaning rules made executable.
 *
 * A palette does not enforce meaning (tokens.md §6) — but a type can. These
 * are the two places the static sheets could only *say* the rule and this
 * app can *refuse* the call.
 */

export type Tone = "neutral" | "accent" | "ok" | "warn" | "bad";

/**
 * §2.5: "an empty queue is a success state", and an intended-empty state
 * never takes --bad or --warn. A component whose state IS the empty state
 * takes this type, so `tone="bad"` on an empty queue does not compile.
 */
export type IntendedEmptyTone = Extract<Tone, "neutral" | "ok">;

/**
 * §2.5: "Rival strength is neutral gray, never red." Outside a chart a
 * rival is a badge or a table cell, and those DO take a tone — so the tone
 * a rival may carry is narrowed to one member. Inside a chart the rival
 * props accept no tone at all (see charts.tsx) and this type is not needed.
 */
export type RivalTone = Extract<Tone, "neutral">;

/**
 * A measurement ReachKit could not take is ReachKit's problem, not the
 * customer's, so it takes `warn` — proposed in components.md §6, drawn on
 * previews/WO-033.html §7.2, still proposed.
 */
export type FailedMeasurementTone = Extract<Tone, "warn">;

export const toneClass = (tone: Tone) => `tone-${tone}`;
