// SPEC §3 — "this browser asked for a link of this kind before this time", and nothing else.
// A mail scanner never holds it, so the confirm page sends its own form only in the browser that asked;
// spending still needs the mailed `token_hash`. Stateless: an HMAC keyed by HKDF from an existing secret.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { EMAIL_CHANGE_TTL_H, SIGNIN_LINK_TTL_H } from "@/lib/config/constants";
import { env } from "@/lib/config/env";
import type { ConfirmType } from "./identity/addresses";

/** `__Host-` so a subdomain cannot plant it. */
export const PENDING_COOKIE = "__Host-rk_signin_pending";

const HKDF_INFO = "reachkit/signin-pending/v1";
const KEY_BYTES = 32;
const MS_PER_HOUR = 3_600_000;
const TTL_H: Record<ConfirmType, number> = { magiclink: SIGNIN_LINK_TTL_H, email_change: EMAIL_CHANGE_TTL_H };
const ATTRIBUTES = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const;

export type PendingCookie = {
  name: typeof PENDING_COOKIE;
  value: string;
  options: typeof ATTRIBUTES & { maxAge: number };
};

function macOf(purpose: ConfirmType, expiresAtMs: number): Buffer {
  const key = Buffer.from(hkdfSync("sha256", env.IP_HASH_SALT, "", HKDF_INFO, KEY_BYTES));
  return createHmac("sha256", key).update(`signin-pending:${purpose}:${expiresAtMs}`).digest();
}

/** The cookie to set when a link of `purpose` is asked for; it lives as long as the link does. */
export function pendingCookieFor(purpose: ConfirmType, now = Date.now()): PendingCookie {
  const ttlMs = TTL_H[purpose] * MS_PER_HOUR;
  const expiresAtMs = now + ttlMs;
  const value = `${purpose}.${expiresAtMs}.${macOf(purpose, expiresAtMs).toString("base64url")}`;
  return { name: PENDING_COOKIE, value, options: { ...ATTRIBUTES, maxAge: ttlMs / 1000 } };
}

/** The same name and attributes, emptied, for the redeem that spent the link. */
export const PENDING_CLEARED: PendingCookie = { name: PENDING_COOKIE, value: "", options: { ...ATTRIBUTES, maxAge: 0 } };

/** True only for an unexpired cookie this deployment signed for a link of `purpose`. */
export function isPendingFor(value: string | undefined, purpose: ConfirmType, now = Date.now()): boolean {
  const [kind, expires, mac, ...rest] = (value ?? "").split(".");
  if (rest.length > 0 || kind !== purpose || mac === undefined || !/^\d+$/.test(expires ?? "")) return false;
  const expiresAtMs = Number(expires);
  if (expiresAtMs <= now) return false;
  const given = Buffer.from(mac, "base64url");
  const expected = macOf(purpose, expiresAtMs);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
