// A limiter that cannot be reached never locks anyone out, and says so in one line with no key in it.
import "../generate/env";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NetworkKey } from "@/lib/scan/admission";

const rpc = vi.fn();
vi.mock("@/lib/db", () => ({ dbAdmin: () => ({ rpc }) }));
const { takeLimits } = await import("@/lib/limits");

const network = "a".repeat(64) as NetworkKey;

afterEach(() => vi.restoreAllMocks());

describe("takeLimits", () => {
  it.each([
    ["an error answer", () => Promise.resolve({ data: null, error: { message: "relation does not exist" } })],
    ["a thrown call", () => Promise.reject(new Error("fetch failed"))],
  ])("fails open on %s and logs rate_limit_unavailable", async (_, answer) => {
    rpc.mockImplementationOnce(answer);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(takeLimits("sign_in", { network, email: "Owner@Example.com" })).resolves.toBe(true);
    expect(warn.mock.calls.map((c) => JSON.parse(String(c[0])))).toEqual([
      { event: "rate_limit_unavailable", rule: "sign_in" },
    ]);
  });

  it("refuses only on the database's false", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(takeLimits("tool_check", { network })).resolves.toBe(false);
  });
});
