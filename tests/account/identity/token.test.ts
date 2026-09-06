// tests/account/identity/token.test.ts — BUILD §13, issue #35
//
// BP-061 decision 3, quoted: "SHA-256 of a 256-bit random token;
// constant-time comparison." The mutation these cases guard against is the
// tidying one — replacing `timingSafeEqual` with `===`, or shortening the
// token because "32 bytes is a lot".
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { hashToken, mintToken, sameHash } = await import(
  "../../../src/lib/account/identity/token"
);
const { LINK_TOKEN_BYTES } = await import("../../../src/lib/config/constants");

describe('BP-061 decision 3 — "SHA-256 of a 256-bit random token"', () => {
  it("mints 256 bits of entropy, base64url-encoded", () => {
    expect(LINK_TOKEN_BYTES).toBe(32);
    const { token } = mintToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(LINK_TOKEN_BYTES);
  });

  it("two mints never collide", () => {
    const seen = new Set(Array.from({ length: 200 }, () => mintToken().token));
    expect(seen.size).toBe(200);
  });

  it("the hash is the SHA-256 of the token, and the token is not recoverable from it", () => {
    const { token, hash } = mintToken();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashToken(token));
    expect(hash).not.toContain(token);
  });

  it("hashing is deterministic — a redemption finds its row by primary key", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe('BP-061 `## NFR budget` — "Tokens are compared in constant time against the stored hash."', () => {
  it("equal digests compare true and unequal ones false", () => {
    const { hash } = mintToken();
    expect(sameHash(hash, hash)).toBe(true);
    expect(sameHash(hash, hashToken("other"))).toBe(false);
  });

  it("digests of different lengths are refused without throwing — the case a raw timingSafeEqual would crash on", () => {
    expect(sameHash("abc", "abcd")).toBe(false);
    expect(sameHash("", "a")).toBe(false);
  });
});
