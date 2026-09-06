// src/lib/account/identity/token.ts — BUILD §13
//
// The credential itself: a 256-bit random token, the SHA-256 this schema
// stores in its place, and a comparison that takes the same time whether it
// matches or not.
//
// BP-061 decision 3, verbatim: "SHA-256 of a 256-bit random token;
// constant-time comparison." No salt — a salt buys nothing against a
// secret with 256 bits of entropy, and a per-row salt would mean a
// redemption could not look its own row up by primary key.
//
// **This module exports no function that returns a stored plaintext,
// because none is stored.** `mintToken()` is the only place a plaintext
// exists, it is returned once, and every other module here handles the
// hash. `tests/account/identity/redaction.test.ts` asserts nothing in this
// directory logs either.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { LINK_TOKEN_BYTES } from "@/lib/config/constants";

/** A fresh token and the hash that will stand for it. The plaintext is
 *  returned exactly once — to the caller that mails it — and is never
 *  written anywhere. */
export function mintToken(): { token: string; hash: string } {
  const token = randomBytes(LINK_TOKEN_BYTES).toString("base64url");
  return { token, hash: hashToken(token) };
}

/** The stored form of a token. Deterministic, so a redemption finds its row
 *  by primary key with one indexed read. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time over two hex digests of equal length. A `===` here would
 *  leak, byte by byte, how much of a guessed token was right. */
export function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
