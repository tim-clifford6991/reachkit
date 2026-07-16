"use server";

/**
 * Server action behind /app/add — adding a tracked product from INSIDE the
 * app. This is deliberately an ORCHESTRATOR: `addTrackedProduct` (Task 3,
 * lib/app/add-product.ts) already owns tier-cap enforcement, already-tracked
 * refusal, URL canonicalisation, the SCANNING_ENABLED kill switch, the shared
 * resolveProductScan policy, and app creation/linking + scan start. This file
 * must not duplicate any of that — it maps AddProductError.code → the inline
 * form error (via the error's own message, already user-facing copy) and
 * sequences the two side effects that only make sense at the UI layer:
 * activating the new app and navigating to the dashboard.
 *
 * NOT assertPaid-gated — deliberately (see lib/app/add-product.ts's own
 * comment). requireUser() is the only auth gate; the tier cap inside
 * addTrackedProduct is what actually limits how many products a user tracks.
 */
import { redirect } from "next/navigation";
import { requireUser, AuthError } from "@/lib/auth/server";
import { addTrackedProduct, AddProductError } from "@/lib/app/add-product";
import { setActiveApp } from "@/lib/app/set-active-app";

export type AddState = { error: string | null };

export async function addProduct(_prev: AddState, form: FormData): Promise<AddState> {
  const url = String(form.get("url") ?? "").trim();
  if (!url) return { error: "Enter your product's website address." };

  let userId: string;
  try {
    ({
      user: { id: userId },
    } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) redirect("/login?next=/app/add");
    throw e;
  }

  let appId: string;
  try {
    ({ appId } = await addTrackedProduct(userId, url));
  } catch (e) {
    if (e instanceof AddProductError) return { error: e.message };
    console.error("[add-product] failed", e);
    return { error: "Couldn't add that product. Please try again." };
  }

  // ORDER IS LOAD-BEARING: addTrackedProduct already linked appId into
  // users.app_ids before returning — setActiveApp re-checks ownership against
  // that list and silently no-ops for an app not yet in it (PR #68), so this
  // call must come AFTER addTrackedProduct resolves, never before/in parallel.
  await setActiveApp(appId);
  // scanId may be null (scan insert failed) — that's DELIBERATE, not an
  // error: the app still links, and the dashboard offers a retry. Never
  // strand a paid slot on a transient blip by throwing here.
  redirect("/app/dashboard");
}
