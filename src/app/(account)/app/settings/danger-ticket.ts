// BUILD §4.7, REQ-079 c2/c3 — where the danger ticket's cookie is named.
//
// A file of its own for the reason `src/lib/account/identity/addresses.ts`
// is one: two modules must agree on a wire name, and neither can import the
// other. `src/app/api/danger/[action]/route.ts` sets the cookie after it has
// handed the archive over; `danger-actions.ts` — a `"use server"` module,
// which may export only async functions — reads it back. A constant in
// either would be a second copy in the other.
//
// **The ticket is a capability, so the cookie is the strictest one this
// product sets.** `httpOnly` (no script reads it), `sameSite=strict` — not
// `lax` like the session, because nothing arrives at this cookie from a
// mail client and a confirmation must never ride on a cross-site
// navigation — `path` scoped to the app, and a lifetime that is the
// ticket's own. It authorises one confirmation of one action and expires
// with the row it names.
//
// Every name here is internal (constitution rule 1.1): a cookie's wire
// name and its attributes. None is a sentence anybody reads.
import { DANGER_TICKET_TTL_MINUTES } from "@/lib/config/constants";

/** The cookie the handover's ticket rides in. */
export const DANGER_TICKET_COOKIE = "rk_danger_ticket";

/** Where it is sent back: the settings screen's own tree and nothing
 *  wider. The confirming Server Function is posted to the page it is on. */
const DANGER_TICKET_PATH = "/app";

const SECONDS_PER_MINUTE = 60;

/** The attributes, as a `Set-Cookie` fragment. Read from the same pin the
 *  ticket's own `expires_at` is written from, so the browser stops sending
 *  it at the moment the row stops accepting it — one number, not two. */
export function dangerTicketCookieOptions(secure = true): string {
  const maxAge = DANGER_TICKET_TTL_MINUTES * SECONDS_PER_MINUTE;
  return [
    "HttpOnly",
    "SameSite=Strict",
    `Path=${DANGER_TICKET_PATH}`,
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
