// The pending cookie proves only "this browser asked for a link of this kind before this time".
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

const { PENDING_CLEARED, isPendingFor, pendingCookieFor } = await import("@/lib/account/signin-pending");

const NOW = Date.parse("2026-11-06T12:00:00Z");
const HOUR = 3_600_000;

describe("the pending cookie", () => {
  it("lives as long as the link, holds no address, and is cleared under the same attributes", () => {
    const cookie = pendingCookieFor("magiclink", NOW);
    expect(cookie.options).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 24 * 3600 });
    expect(cookie.value.split(".").slice(0, 2)).toEqual(["magiclink", String(NOW + 24 * HOUR)]);
    expect(PENDING_CLEARED).toEqual({ ...cookie, value: "", options: { ...cookie.options, maxAge: 0 } });
  });

  it("holds for its own kind until it expires, and for nothing else", () => {
    const value = pendingCookieFor("email_change", NOW).value;
    const [kind, expires, mac] = value.split(".") as [string, string, string];
    expect(isPendingFor(value, "email_change", NOW + 23 * HOUR)).toBe(true);
    expect(isPendingFor(value, "email_change", NOW + 24 * HOUR)).toBe(false);
    expect(isPendingFor(value, "magiclink", NOW)).toBe(false);
    for (const junk of [`${kind}.${Number(expires) + 1}.${mac}`, `${value}.x`, undefined, "", "email_change..", "email_change.-1.x"]) {
      expect(isPendingFor(junk, "email_change", NOW)).toBe(false);
    }
  });
});
