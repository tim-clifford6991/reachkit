// src/lib/account/checkout/return-to.ts — BUILD §13
//
// Where the buyer comes back to, checked against our own address.
//
// **Compared after parsing, never by prefix.** A prefix match on
// `https://reachkit.app` admits `https://reachkit.app.attacker.example`,
// which is the whole of the attack: a checkout link that returns a paying
// customer to somebody else's page. Scheme, host and port are compared as
// the URL parser resolved them, so a default port and an explicit one are
// the same origin and a lookalike host is not.
import { env } from "@/lib/config/env";

export type ReturnToCheck = { ok: true; url: URL } | { ok: false; reason: "return_to_not_ours" };

export function checkReturnTo(returnTo: string): ReturnToCheck {
  let candidate: URL;
  let ours: URL;
  try {
    candidate = new URL(returnTo);
    ours = new URL(env.NEXT_PUBLIC_APP_URL);
  } catch {
    return { ok: false, reason: "return_to_not_ours" };
  }
  // `URL.origin` is the parsed triple — scheme, host and port with the
  // scheme's default applied — which is exactly the comparison a prefix
  // match gets wrong.
  return candidate.origin === ours.origin
    ? { ok: true, url: candidate }
    : { ok: false, reason: "return_to_not_ours" };
}
