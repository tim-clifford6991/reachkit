"use server";

/**
 * Server action: persist the user's active-app choice in a cookie. The page
 * re-reads it via activeAppId() on the next render (the switcher calls
 * router.refresh() after this resolves).
 */

import { cookies } from "next/headers";
import { ACTIVE_APP_COOKIE } from "./active-app";
import { currentUser } from "@/lib/auth/server";

export async function setActiveApp(appId: string): Promise<void> {
  // Defence in depth: only ever persist an app the caller actually owns.
  // `activeAppId()` already re-validates the cookie against user.app_ids on
  // every read, so a foreign id here is inert today — but that puts the only
  // ownership check one hop away from the mutation. Checking at the write site
  // too means the cookie can never hold someone else's app id, even if a future
  // caller reads it directly. (Server action = a public POST endpoint.)
  const viewer = await currentUser();
  if (!viewer || !(viewer.user.app_ids ?? []).includes(appId)) return;

  (await cookies()).set(ACTIVE_APP_COOKIE, appId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
