// BUILD §4.2 — the opt-out token: one capability, no expiry, idempotent.
//
// The link every lead-directed mail carries (REQ-010 criterion 11, "any of
// these emails"). It is signed over an **email address** and it can do
// exactly one thing: suppress that address's follow-up. It is a different
// token, over a different subject, from the kind-scoped
// `/unsubscribe/{token}` the three notification switches use — ADR-042
// fixes two formats permanently, and the two signing keys are separated by
// their HKDF labels so neither token can ever be presented as the other.
//
// **No expiry is encoded**, so none can be checked: a link in a mail
// someone finds a year later must still work, or the reader is holding a
// mail they cannot switch off.
//
// **Applying is the arrival.** `applyOptOutToken` writes, and the page
// behind the link calls it on arrival rather than offering a button to
// press. The kind-scoped unsubscribe deliberately splits reading from
// writing so a mail client's link prefetch cannot switch a customer's mail
// off; here the trade runs the other way. A prefetch that suppresses
// follow-up costs the reader nothing they cannot undo — submitting the
// capture control again still delivers the page they ask for, because
// `first-page` is unstoppable — while a button costs a reader who cannot
// press one their only way out. Over-stopping follow-up is the safe
// direction, and REQ-010 c11 says using the link stops the mail, not that
// pressing a second control does.
//
// **Signing key.** `SPEC.md` §15's binding list carries no opt-out secret
// and `src/lib/config/env.ts` is the owner's file, so the key is derived
// from an existing server-only secret through HKDF with a fixed, unique
// label — domain-separated, so it is neither the salt itself nor
// exchangeable with the unsubscribe token's key. Owner-owed: a dedicated
// binding would be better, and swapping to one is one line here.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";
import { normaliseAddress, suppressAddress } from "./suppress";

const HKDF_INFO = "reachkit/opt-out-token/v1";
const KEY_BYTES = 32;
const SEPARATOR = ".";

function signingKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", env.IP_HASH_SALT, "", HKDF_INFO, KEY_BYTES));
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function macOf(payload: string): Buffer {
  return createHmac("sha256", signingKey()).update(payload).digest();
}

/** Signed on the normalised address, so the token for `Anna@Example.com`
 *  and the token for `anna@example.com` verify to one person. */
export function optOutTokenFor(email: string): string {
  const payload = normaliseAddress(email);
  return `${base64url(payload)}${SEPARATOR}${base64url(macOf(payload))}`;
}

/** Pure. Verifies the signature and returns the address it names. Writes
 *  nothing and touches no store — the suites and the route both read
 *  through it, and it is what makes the token's format assertable without
 *  a database. */
export function readOptOutToken(token: string): { email: string } | { error: "invalid" } {
  const parts = token.split(SEPARATOR);
  if (parts.length !== 2) return { error: "invalid" };
  const [encodedPayload, encodedMac] = parts as [string, string];

  let payload: string;
  let mac: Buffer;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    mac = Buffer.from(encodedMac, "base64url");
  } catch {
    return { error: "invalid" };
  }

  const expected = macOf(payload);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return { error: "invalid" };
  if (payload === "") return { error: "invalid" };
  return { email: payload };
}

/** The only writer. Idempotent: applying the same link twice succeeds both
 *  times, because the suppression insert is idempotent on its primary key.
 *
 *  `'unavailable'` is a third arm BP-029 does not print, and it is the same
 *  arm `applyUnsubscribeToken` already ships (§12): telling a reader their
 *  link is invalid when it is our store that is down is a false statement
 *  about the one thing they came here to do. */
export async function applyOptOutToken(
  token: string
): Promise<{ email: string } | { error: "invalid" } | { error: "unavailable" }> {
  const read = readOptOutToken(token);
  if ("error" in read) return read;

  const suppressed = await suppressAddress(read.email, "opt_out");
  if (!suppressed.suppressed) return { error: "unavailable" };
  return { email: read.email };
}
