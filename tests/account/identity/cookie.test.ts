// tests/account/identity/cookie.test.ts — BUILD §13, issue #35
//
// The session cookie is a real signed session, not a marker. That claim is
// what `src/middleware.ts` leans on when it checks presence and nothing
// else, so the cases below are the ones that decide whether the lean is
// safe: a forged payload, a tampered payload, a foreign signature and a
// cookie kept past its window all read as no session at all.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { mintSessionCookie, readSessionCookie, SESSION_MAX_AGE_SECONDS } = await import(
  "../../../src/lib/account/identity/cookie"
);
const { SESSION_TTL_DAYS } = await import("../../../src/lib/config/constants");

const NOW = new Date("2026-09-06T12:00:00.000Z");
const CLAIMS = { userId: "user-1", siteId: "site-1", issuedAt: NOW };

describe("a minted cookie reads back as what was signed", () => {
  it("round-trips the user, the site and the moment it was issued", () => {
    const read = readSessionCookie(mintSessionCookie(CLAIMS), NOW);
    expect(read).toEqual({ userId: "user-1", siteId: "site-1", issuedAt: NOW });
  });

  it("carries a null site — an account can precede its site row (§13's scanless purchase)", () => {
    const read = readSessionCookie(
      mintSessionCookie({ ...CLAIMS, siteId: null }),
      NOW
    );
    expect(read?.siteId).toBeNull();
  });

  it("the value carries no readable account id of its own beyond the signed payload", () => {
    const value = mintSessionCookie(CLAIMS);
    expect(value.split(".")).toHaveLength(2);
  });
});

describe("anything that is not this product's signature is not a session", () => {
  it("a value with no signature is refused", () => {
    expect(readSessionCookie("nonsense", NOW)).toBeNull();
    expect(readSessionCookie("", NOW)).toBeNull();
  });

  it("a payload edited by its holder is refused — the forgery this exists to stop", () => {
    const forged = Buffer.from(
      JSON.stringify({ u: "somebody-else", s: null, i: NOW.getTime() }),
      "utf8"
    ).toString("base64url");
    const [, mac] = mintSessionCookie(CLAIMS).split(".") as [string, string];
    expect(readSessionCookie(`${forged}.${mac}`, NOW)).toBeNull();
  });

  it("a truncated signature is refused rather than compared short", () => {
    const [payload, mac] = mintSessionCookie(CLAIMS).split(".") as [string, string];
    expect(readSessionCookie(`${payload}.${mac.slice(0, 8)}`, NOW)).toBeNull();
  });

  it("dropping the signature check would let the forged payload through — the mutation these guard", () => {
    const forged = Buffer.from(
      JSON.stringify({ u: "somebody-else", s: null, i: NOW.getTime() }),
      "utf8"
    ).toString("base64url");
    // Read without a MAC at all: the payload decodes perfectly well, which
    // is exactly why the MAC is what decides.
    expect(JSON.parse(Buffer.from(forged, "base64url").toString("utf8"))).toEqual({
      u: "somebody-else",
      s: null,
      i: NOW.getTime(),
    });
    expect(readSessionCookie(`${forged}.`, NOW)).toBeNull();
  });
});

describe("expiry is signed, not only advised to the browser", () => {
  it("a cookie inside its window verifies", () => {
    const almost = new Date(NOW.getTime() + (SESSION_TTL_DAYS * 24 - 1) * 60 * 60 * 1000);
    expect(readSessionCookie(mintSessionCookie(CLAIMS), almost)).not.toBeNull();
  });

  it("a cookie kept past the window is not a session, whatever the browser did", () => {
    const after = new Date(NOW.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    expect(readSessionCookie(mintSessionCookie(CLAIMS), after)).toBeNull();
  });

  it("the browser's max-age and the signed window are the same number", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(SESSION_TTL_DAYS * 24 * 60 * 60);
  });
});
