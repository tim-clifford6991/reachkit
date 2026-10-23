// SPEC §5 (docs/spec/decisions/2026-10-22-1737.md) — setup is three saved
// steps: Site, Check, Connect.
//
// The order, and nothing else. It is a module of its own because three
// places read it and none of them may disagree: the client wizard (which
// step is on screen, what Back and Continue lead to), the URL (`?step=`,
// held by `nuqs`), and the server (which step a returning founder is put
// back on, and which step a save names).
//
// No sentence lives here. A step's one-word label and its question are copy
// keys, read where they are rendered. `publishing` is the step the founder
// reads as *Connect*; its handle stays so a stored resume point still reads.

/** The three, in the order the founder meets them. */
export const SETUP_STEPS = ["site", "check", "publishing"] as const;

export type SetupStepId = (typeof SETUP_STEPS)[number];

/** Where a founder with nothing saved starts. */
export const FIRST_STEP: SetupStepId = SETUP_STEPS[0];

/** The deep pass starts when the rivals are confirmed, and they are confirmed on Check. */
export const PASS_STARTS_AFTER: SetupStepId = "check";

/** Resume points a five-step build stored, read as the step that now holds them. */
const STORED_BEFORE: Readonly<Record<string, SetupStepId>> = {
  business: "check",
  rivals: "check",
  voice: "check",
};

export function isSetupStep(value: unknown): value is SetupStepId {
  return typeof value === "string" && (SETUP_STEPS as readonly string[]).includes(value);
}

/** The step a stored resume point names, or `null` where it names none. */
export function storedStep(value: unknown): SetupStepId | null {
  if (isSetupStep(value)) return value;
  return typeof value === "string" ? (STORED_BEFORE[value] ?? null) : null;
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
