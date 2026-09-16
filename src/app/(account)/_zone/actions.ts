// §4 — REQ-073 c1's first sign-in write, given its caller (#753).
//
// `adoptBrowserTimezone` was written, tested and exported, and nothing
// called it, so `sites.timezone` stayed null for every founder and the app
// — which draws every date in the site's own zone — would not open. The
// browser is the only party that knows its zone, and it can only say so from
// script, so this is the Server Function `BrowserZone` calls from the first
// account screen a browser renders.
//
// **It decides nothing `adoptBrowserTimezone` does not.** The site is the
// session's own — never one the browser names — and the zone goes through
// the function unchanged: the IANA check a patch uses, and a write only
// while the column is null, so a customer who set their zone and signs in
// from somewhere else keeps it.
"use server";

import type { AdoptResult } from "@/lib/publish/settings";

/** The browser's reported zone, adopted for the signed-in founder's site.
 *  `null` where no session names a site to adopt it for. */
export async function reportBrowserZone(reported: unknown): Promise<AdoptResult | null> {
  if (typeof reported !== "string") return { adopted: false, reason: "invalid" };

  // Imported at the call: both reach `@/lib/db`, which parses the
  // environment the moment it is evaluated (`_session/account.ts` says why
  // that matters for every screen this layout serves).
  const { currentSession } = await import("@/lib/account/identity");
  const session = await currentSession();
  if (session === null || session.siteId === null) return null;

  const { adoptBrowserTimezone } = await import("@/lib/publish/settings");
  return adoptBrowserTimezone(session.siteId, reported);
}
