"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { serverDb } from "@/lib/db/client";
import { parseOnboardingForm } from "./parse";
import { notifyWelcome } from "@/lib/email/notify";

/**
 * Persist the profile backfill and mark onboarding complete. Setting
 * `onboarded_at` is what advances the app-wide SetupOverlay past the
 * profile step (and, historically, lifted the dashboard gate).
 */
async function persistOnboarding(formData: FormData): Promise<void> {
  const { user } = await requireUser();

  const { displayName, goal, icp } = parseOnboardingForm(formData);

  const db = serverDb();
  // Read the prior state so the welcome email fires exactly ONCE — the first
  // time onboarding completes, not on every re-save of the profile.
  const { data: before } = await db.from("users").select("onboarded_at").eq("id", user.id).maybeSingle();
  const firstCompletion = before?.onboarded_at == null;

  const { error } = await db
    .from("users")
    .update({
      display_name: displayName || null,
      distribution_goal: goal || null,
      icp_confirmed: icp.length > 0 ? icp : null,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(`saveOnboarding: failed to update user ${user.id}: ${error.message}`);
  }

  // Welcome email — best-effort, once, after the account is set up. The magic
  // link (transactional) already went out at provision; this is the warmer
  // "here's your first week" follow-up on first login.
  if (firstCompletion) await notifyWelcome(user.id);
}

/** Legacy full-page variant: persists, then navigates to the app. */
export async function saveOnboarding(formData: FormData): Promise<void> {
  await persistOnboarding(formData);
  redirect("/app/dashboard");
}

/**
 * Overlay variant: persists and RETURNS (no redirect) so the client-side
 * setup stepper can advance to the next step in place. Same persistence
 * path as `saveOnboarding` — only the navigation behaviour differs.
 */
export async function saveOnboardingStep(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await persistOnboarding(formData);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save" };
  }
}
