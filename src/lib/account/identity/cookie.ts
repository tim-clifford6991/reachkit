// src/lib/account/identity/cookie.ts — BUILD §13
//
// The session cookie's format, signing and verification — pure, so the
// suites can assert what a tampered cookie does without a request, a
// database or a browser.
//
// **A real signed session, not a marker.** `src/middleware.ts` checks that
// the cookie is present and nothing else, by design ("Reads no database:
// the check is a cookie's presence, nothing about its contents"). That is
// safe only if the value itself cannot be forged, because the middleware's
// answer is the last word for every route that never calls
// `currentSession()`. So the value carries a MAC over its own payload, and
// a payload whose MAC does not verify is not a session at all.
//
// **Signing key.** `BUILD.md` §15's binding list carries no session secret
// and `src/lib/config/env.ts` is where a new binding would have to land, so
// the key is derived from an existing server-only secret through HKDF with
// a fixed, unique label — exactly what `src/lib/mail/leads/optout.ts` and
// `src/lib/mail/notifications/unsubscribe.ts` already do, and separated
// from both by that label, so no token of one kind can ever be presented as
// another. Owner-owed: a dedicated `SESSION_SECRET` binding would be
// better, and swapping to one is one line here. Rotating the secret ends
// every live session, which is a blunt but honest recovery control.
//
// **Expiry is inside the signature, not only on the cookie.** A browser's
// `Max-Age` is advice a client may ignore; `issuedAt` is signed, so a
// cookie kept past `SESSION_TTL_DAYS` verifies and is still not a session.
import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";
import { SESSION_TTL_DAYS } from "@/lib/config/constants";

const HKDF_INFO = "reachkit/session-cookie/v1";
const KEY_BYTES = 32;
const SEPARATOR = ".";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** What a session cookie says. Short keys because this rides in a header on
 *  every request; internal names, never anything a person reads. */
interface Payload {
  /** `users.id`. */
  readonly u: string;
  /** The account's one site, or `null` where setup has not made one yet. */
  readonly s: string | null;
  /** Milliseconds since the epoch. Compared against `users.sessions_valid_from`
   *  by `currentSession()`, which is how a completed email change ends every
   *  other session (BP-061 decision 4). */
  readonly i: number;
}

export interface SessionClaims {
  readonly userId: string;
  readonly siteId: string | null;
  readonly issuedAt: Date;
}

function signingKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", env.IP_HASH_SALT, "", HKDF_INFO, KEY_BYTES));
}

function macOf(payload: string): Buffer {
  return createHmac("sha256", signingKey()).update(payload).digest();
}

/** How long a browser is asked to keep the cookie, in seconds. The same
 *  window the signature enforces, so the two cannot drift. */
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

export function mintSessionCookie(a: {
  userId: string;
  siteId: string | null;
  issuedAt: Date;
}): string {
  const payload: Payload = { u: a.userId, s: a.siteId, i: a.issuedAt.getTime() };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}${SEPARATOR}${macOf(encoded).toString("base64url")}`;
}

/**
 * Pure. Verifies the signature and the signed expiry and returns what the
 * cookie claims. `null` for anything else — a malformed value, a tampered
 * payload, a foreign signature, a cookie past its window. There is no arm
 * that says *which*: a caller that told them apart would be an oracle for
 * whoever is holding the cookie, and no caller needs to know.
 */
export function readSessionCookie(value: string, now: Date): SessionClaims | null {
  const parts = value.split(SEPARATOR);
  if (parts.length !== 2) return null;
  const [encoded, encodedMac] = parts as [string, string];

  let mac: Buffer;
  try {
    mac = Buffer.from(encodedMac, "base64url");
  } catch {
    return null;
  }

  const expected = macOf(encoded);
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;

  let payload: Payload;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!isPayload(parsed)) return null;
    payload = parsed;
  } catch {
    return null;
  }

  if (now.getTime() - payload.i >= SESSION_TTL_DAYS * MS_PER_DAY) return null;

  return { userId: payload.u, siteId: payload.s, issuedAt: new Date(payload.i) };
}

function isPayload(value: unknown): value is Payload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate["u"] === "string" &&
    candidate["u"].length > 0 &&
    (typeof candidate["s"] === "string" || candidate["s"] === null) &&
    typeof candidate["i"] === "number" &&
    Number.isFinite(candidate["i"])
  );
}
