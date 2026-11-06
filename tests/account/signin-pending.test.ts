// The pending cookie proves only "this browser asked for a link of this kind before this time".
import { expect, it } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

applyEnvFixture();

const { isPendingFor, pendingCookieFor } = await import("@/lib/account/signin-pending");

it("holds for its own kind until the link expires, and cannot be re-dated", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  const { value } = pendingCookieFor("email_change", now);
  const [kind, expires, mac] = value.split(".") as [string, string, string];
  expect([isPendingFor(value, "email_change", now + 23 * 3_600_000), isPendingFor(value, "email_change", now + 24 * 3_600_000)]).toEqual([true, false]);
  for (const forged of [`${kind}.${Number(expires) + 1}.${mac}`, `${value}.x`, undefined, "email_change.-1.x"]) {
    expect(isPendingFor(forged, "email_change", now)).toBe(false);
  }
});
