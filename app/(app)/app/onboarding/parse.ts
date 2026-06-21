/**
 * Pure parsing/sanitization for the onboarding form.
 *
 * Kept separate from `actions.ts` (which is `"use server"`, so it may only export
 * async Server Actions) so the input caps/filters can be unit-tested in isolation.
 */

export interface OnboardingInput {
  displayName: string;
  goal: string;
  icp: string[];
}

export function parseOnboardingForm(formData: FormData): OnboardingInput {
  const displayName = String(formData.get("display_name") ?? "")
    .trim()
    .slice(0, 120);
  const goal = String(formData.get("distribution_goal") ?? "")
    .trim()
    .slice(0, 200);
  const icpRaw = String(formData.get("icp_confirmed") ?? "").trim();
  const icp = icpRaw
    ? icpRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];

  return { displayName, goal, icp };
}
