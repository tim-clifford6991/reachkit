"use server";

/**
 * Server action: persist the user's active-app choice in a cookie. The page
 * re-reads it via activeAppId() on the next render (the switcher calls
 * router.refresh() after this resolves).
 */

import { cookies } from "next/headers";
import { ACTIVE_APP_COOKIE } from "./active-app";

export async function setActiveApp(appId: string): Promise<void> {
  (await cookies()).set(ACTIVE_APP_COOKIE, appId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
