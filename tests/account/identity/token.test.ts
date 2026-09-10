// tests/account/identity/token.test.ts — BUILD §13, issues #35, #468
//
// Issue #35 kept its own sign-in secret: "SHA-256 of a 256-bit random
// token; constant-time comparison" (BP-061 decision 3). Owner ruling
// 2026-09-10 moved it into Supabase Auth (#468), and the Done-when is
// structural: "no code path mints or verifies its own sign-in secret".
// This suite is that sentence as a check — the identity directory holds no
// randomness, no hash, no MAC and no constant-time comparison, so a secret
// of our own has nowhere to be minted or checked.
//
// The mutation it catches: a helper that quietly brings a token back
// "just for" one flow.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const IDENTITY_DIR = path.resolve(import.meta.dirname, "../../../src/lib/account/identity");

/** Comments stripped: the headers *name* the old mechanism to say it is
 *  gone, and prose must not fail the check that it is. */
function code(file: string): string {
  return readFileSync(path.join(IDENTITY_DIR, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const FILES = readdirSync(IDENTITY_DIR).filter((f) => f.endsWith(".ts"));

describe('#468 — "no code path mints or verifies its own sign-in secret"', () => {
  it("the directory is read at all — an empty listing would pass everything below", () => {
    expect(FILES).toContain("links.ts");
    expect(FILES).toContain("auth.ts");
  });

  it("the home-made token and cookie modules are gone", () => {
    expect(FILES).not.toContain("token.ts");
    expect(FILES).not.toContain("cookie.ts");
  });

  it.each(FILES)("%s imports no crypto and mints, hashes, signs or compares nothing", (file) => {
    const source = code(file);
    expect(source).not.toMatch(/["'](node:)?crypto["']/);
    expect(source).not.toMatch(/\b(randomBytes|randomUUID|getRandomValues|createHash|createHmac|timingSafeEqual|hkdf|hkdfSync)\b/);
  });

  it("no file reads a secret binding that could key a signature", () => {
    for (const file of FILES) {
      expect(code(file), file).not.toMatch(/IP_HASH_SALT|SESSION_SECRET/);
    }
  });

  it("the token is Supabase's: links are minted by `generateLink` and redeemed by `verifyOtp`", () => {
    const auth = code("auth.ts");
    expect(auth).toMatch(/\.generateLink\(/);
    expect(auth).toMatch(/\.verifyOtp\(/);
  });
});
