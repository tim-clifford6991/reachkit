// BUILD §12 · §4.7 — the kind-scoped unsubscribe token.
//
// One mail off, the other two untouched, and nothing outside the three
// reached at all. The token is signed over `(userId, kind)` — ADR-042's
// `/unsubscribe/{token}`, which is a different token over a different
// subject from the lead opt-out's `/opt-out/{token}` (signed on an
// address, `src/lib/mail/leads/**`, issue #31). Two formats, permanently;
// a shared HMAC helper would be a signing utility, never a shared format.
// This module never writes the address-wide suppression store and imports
// nothing that does.
//
// **No expiry is encoded**, so none can be checked. An unsubscribe link
// that stopped working would leave the reader holding a mail they cannot
// switch off, which is the one thing this control exists to prevent.
//
// **Reading does not write.** `readUnsubscribeToken` is pure, so the page
// behind the link can render from a GET without a mail client's or a
// security scanner's link prefetch silently switching off mail nobody
// chose to stop. `applyUnsubscribeToken` is the only writer, and it is
// idempotent: using the same link twice succeeds twice.
//
// **Signing key.** `SPEC.md` §15's binding list carries no unsubscribe
// secret and `src/lib/config/env.ts` is the owner's file, so the key is
// derived from an existing server-only secret through HKDF with a fixed,
// unique label — domain-separated, so it is not the salt itself and
// cannot be exchanged with any other use of it. Owner-owed: a dedicated
// binding would be better, and swapping to one is one line here.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";
import { TOGGLABLE_KINDS, setNotifyPref, type NotifyKind } from "./index";

const HKDF_INFO = "reachkit/unsubscribe-token/v1";
const KEY_BYTES = 32;
const SEPARATOR = ".";

function signingKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", env.IP_HASH_SALT, "", HKDF_INFO, KEY_BYTES));
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function payloadOf(a: { userId: string; kind: NotifyKind }): string {
  // The user id is a uuid and the kind is one of three fixed words, so
  // neither can contain the separator; the payload is unambiguous without
  // escaping. Asserted in `tests/mail/notifications/unsubscribe.test.ts`.
  return `${a.userId}:${a.kind}`;
}

function macOf(payload: string): Buffer {
  return createHmac("sha256", signingKey()).update(payload).digest();
}

export function unsubscribeTokenFor(a: { userId: string; kind: NotifyKind }): string {
  const payload = payloadOf(a);
  return `${base64url(payload)}${SEPARATOR}${base64url(macOf(payload))}`;
}

function isNotifyKind(value: string): value is NotifyKind {
  return (TOGGLABLE_KINDS as readonly string[]).includes(value);
}

/** Pure. Verifies the signature and returns what the token names, or says
 *  it is invalid. Writes nothing, reads nothing, touches no store. */
export function readUnsubscribeToken(
  token: string
): { userId: string; kind: NotifyKind } | { error: "invalid" } {
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

  const separator = payload.lastIndexOf(":");
  if (separator <= 0) return { error: "invalid" };
  const userId = payload.slice(0, separator);
  const kind = payload.slice(separator + 1);
  if (userId === "" || !isNotifyKind(kind)) return { error: "invalid" };
  return { userId, kind };
}

/** The only writer. Switches off exactly the kind the token was signed
 *  for; the other two are left as they are, and no mail outside the three
 *  is reachable from here at all. Idempotent — a second use returns the
 *  same answer. */
export async function applyUnsubscribeToken(
  token: string
): Promise<{ switchedOff: NotifyKind } | { error: "invalid" } | { error: "unavailable" }> {
  const read = readUnsubscribeToken(token);
  if ("error" in read) return read;
  try {
    await setNotifyPref({ userId: read.userId, kind: read.kind, on: false });
  } catch {
    // The store could not be read or written. Saying "invalid" would tell
    // the reader their link is broken when it is ours that is; this is
    // its own answer and the page behind the link says so.
    return { error: "unavailable" };
  }
  return { switchedOff: read.kind };
}
