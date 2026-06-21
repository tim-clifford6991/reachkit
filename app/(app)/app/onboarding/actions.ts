"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { serverDb } from "@/lib/db/client";
import { parseOnboardingForm } from "./parse";

/**
 * Persist the post-checkout onboarding backfill and mark onboarding complete.
 * Setting `onboarded_at` is what lifts the dashboard gate.
 */
export async function saveOnboarding(formData: FormData): Promise<void> {
  const { user } = await requireUser();

  const { displayName, goal, icp } = parseOnboardingForm(formData);

  const { error } = await serverDb()
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

  redirect("/app");
}
