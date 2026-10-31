// The network key reads the platform's client address: on Vercel a client-written
// first x-forwarded-for entry never chooses the key.
import "../generate/env";
import { afterEach, describe, expect, it, vi } from "vitest";

const { networkKeyOf } = await import("@/lib/scan/admission");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("networkKeyOf reads the platform address", () => {
  it("spoofed first XFF entry is ignored on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    const spoofed = networkKeyOf(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4", "x-vercel-forwarded-for": "1.2.3.4" }));
    expect(spoofed).toBe(networkKeyOf(new Headers({ "x-vercel-forwarded-for": "1.2.3.4" })));
    expect(spoofed).not.toBe(networkKeyOf(new Headers({ "x-vercel-forwarded-for": "6.6.6.6" })));
  });

  it("x-real-ip stands in when the Vercel header is absent", () => {
    vi.stubEnv("VERCEL", "1");
    const real = networkKeyOf(new Headers({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "1.2.3.4" }));
    expect(real).toBe(networkKeyOf(new Headers({ "x-vercel-forwarded-for": "1.2.3.4" })));
    expect(real).not.toBe(networkKeyOf(new Headers()));
  });

  it("no platform header on Vercel never trusts XFF", () => {
    vi.stubEnv("VERCEL", "1");
    const key = networkKeyOf(new Headers({ "x-forwarded-for": "6.6.6.6" }));
    expect(key).toBe(networkKeyOf(new Headers()));
    expect(key).not.toBe(networkKeyOf(new Headers({ "x-vercel-forwarded-for": "6.6.6.6" })));
  });

  it("off Vercel reads XFF", () => {
    vi.stubEnv("VERCEL", undefined);
    const key = networkKeyOf(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }));
    expect(key).toBe(networkKeyOf(new Headers({ "x-real-ip": "6.6.6.6" })));
    expect(key).not.toBe(networkKeyOf(new Headers()));
  });

  it("a headers object that throws still yields the unknown key", () => {
    const broken = { get: (): string | null => { throw new Error("boom"); } };
    expect(() => networkKeyOf(broken)).not.toThrow();
    expect(networkKeyOf(broken)).toBe(networkKeyOf(new Headers()));
  });
});
