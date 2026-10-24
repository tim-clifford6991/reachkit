// BUILD §12 · §4.7 — the kind-scoped unsubscribe token: one mail off, the other two untouched, nothing outside the three reachable.
// Signed over `(userId, kind)`, ADR-042's `/unsubscribe/{token}`, a separate format from the lead opt-out's address-signed token.
// No expiry, so a link never stops working. Reading is pure, so a scanner's prefetch switches nothing off; `applyUnsubscribeToken`,
// reached by the page's button and RFC 8058's POST, is the only writer and is idempotent.
// The key is derived by HKDF from an existing server-only secret with a unique label; a dedicated binding would be one line here.
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
  // A uuid and a fixed word cannot contain the separator, so no escaping is needed.
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

/** Pure: verifies the signature and returns what the token names, or invalid. */
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

/** The only writer: switches off exactly the signed kind. Idempotent. */
export async function applyUnsubscribeToken(
  token: string
): Promise<{ switchedOff: NotifyKind } | { error: "invalid" } | { error: "unavailable" }> {
  const read = readUnsubscribeToken(token);
  if ("error" in read) return read;
  try {
    await setNotifyPref({ userId: read.userId, kind: read.kind, on: false });
  } catch {
    // Our store failed, so not "invalid": the link is not what is broken.
    return { error: "unavailable" };
  }
  return { switchedOff: read.kind };
}
