// A root rotation must not strand a stored credential or a link already mailed: both open under (new, previous).
import { afterEach, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../mail/env-fixture";

async function under(current: string, previous?: string) {
  vi.resetModules();
  applyEnvFixture();
  process.env.IP_HASH_SALT = current;
  if (previous === undefined) delete process.env.IP_HASH_SALT_PREVIOUS;
  else process.env.IP_HASH_SALT_PREVIOUS = previous;
  return {
    config: await import("@/lib/publish/destinations/config/seal"),
    optOut: await import("@/lib/mail/leads/optout"),
  };
}

afterEach(() => void delete process.env.IP_HASH_SALT_PREVIOUS);

it("a credential sealed under A opens under (B, previous A) and is re-sealed under B", async () => {
  const sealedA = (await under("root-a")).config.seal({ password: "p" });
  const { value, resealed } = (await under("root-b", "root-a")).config.open(sealedA);
  expect(value).toEqual({ password: "p" });
  expect((await under("root-b")).config.open(resealed!)).toEqual({ value: { password: "p" }, resealed: null });
});

it("a link minted under A verifies under (B, previous A), not under (C, previous B)", async () => {
  const token = (await under("root-a")).optOut.optOutTokenFor("a@example.com");
  expect((await under("root-b", "root-a")).optOut.readOptOutToken(token)).toEqual({ email: "a@example.com" });
  expect((await under("root-c", "root-b")).optOut.readOptOutToken(token)).toEqual({ error: "invalid" });
});
