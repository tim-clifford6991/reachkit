// BUILD §4.2 — the opt-out token: one capability, no expiry, idempotent. Signed over an email address, it only suppresses that address's follow-up.
// It is ADR-042's second format, apart from the kind-scoped unsubscribe; HKDF labels separate the keys so neither token passes as the other.
// No expiry, so a mail found a year later can still be switched off.
// Applied on arrival, not by a button: a prefetch that over-stops follow-up costs nothing (`first-page` is unstoppable), a button can cost the only way out.
// The key is derived by HKDF from an existing server-only secret with a unique label; a dedicated binding would be one line here.
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

/** Signed on the normalised address, so a mixed-case address is the same person. */
export function optOutTokenFor(email: string): string {
  const payload = normaliseAddress(email);
  return `${base64url(payload)}${SEPARATOR}${base64url(macOf(payload))}`;
}

/** Pure: verifies the signature and returns the address, so the format is assertable without a database. */
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

/** The only writer, idempotent on the suppression's primary key. `'unavailable'` is not "invalid link": our store being down is not the reader's fault. */
export async function applyOptOutToken(
  token: string
): Promise<{ email: string } | { error: "invalid" } | { error: "unavailable" }> {
  const read = readOptOutToken(token);
  if ("error" in read) return read;

  const suppressed = await suppressAddress(read.email, "opt_out");
  if (!suppressed.suppressed) return { error: "unavailable" };
  return { email: read.email };
}
