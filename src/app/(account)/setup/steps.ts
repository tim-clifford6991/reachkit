// SPEC §5 (2026-09-20, #908) — "setup is **five saved steps** — your site,
// your business, rivals, your voice, publishing — one decision each, with
// Back, and an equal-column step indicator."
//
// The order, and nothing else. It is a module of its own because three
// places read it and none of them may disagree: the client wizard (which
// step is on screen, what Back and Continue lead to), the URL (`?step=`,
// held by `nuqs`), and the server (which step a returning founder is put
// back on, and which step a save names).
//
// No sentence lives here. A step's one-word label, its question and its
// panel title are copy keys, read where they are rendered.

/** The five, in the order the founder meets them. */
export const SETUP_STEPS = ["site", "business", "rivals", "voice", "publishing"] as const;

export type SetupStepId = (typeof SETUP_STEPS)[number];

/** Where a founder with nothing saved starts. */
export const FIRST_STEP: SetupStepId = SETUP_STEPS[0];

/** Where the pass is started: SPEC §5 (2026-09-20) — "The deep pass starts
 *  when rivals are confirmed … so voice and publishing overlap the wait."
 *  Named here rather than spelled in the save path, so the step and the
 *  rule cannot drift apart. */
export const PASS_STARTS_AFTER: SetupStepId = "rivals";

export function isSetupStep(value: unknown): value is SetupStepId {
  return typeof value === "string" && (SETUP_STEPS as readonly string[]).includes(value);
}

export function stepIndex(step: SetupStepId): number {
  return SETUP_STEPS.indexOf(step);
}

/** The step after this one, or `null` where this one finishes setup. */
export function nextStep(step: SetupStepId): SetupStepId | null {
  return SETUP_STEPS[stepIndex(step) + 1] ?? null;
}

/** The step before this one, or `null` where Back has nowhere to go. */
export function previousStep(step: SetupStepId): SetupStepId | null {
  const at = stepIndex(step);
  return at <= 0 ? null : (SETUP_STEPS[at - 1] ?? null);
}

/** Whether this step is the last — the one whose control finishes setup. */
export function isLastStep(step: SetupStepId): boolean {
  return nextStep(step) === null;
}
