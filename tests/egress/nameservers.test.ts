// tests/egress/nameservers.test.ts — SPEC §5, issue 760
//
// `nameserversOf`: the NS lookup that names where a founder's DNS is. It
// decorates guidance beside the CNAME record, so its one promise is that it
// never holds that record up: bounded, and every failure is `null`. The
// resolver is doubled; nothing here reaches the network.
import dns from "node:dns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nameserversOf } from "../../src/lib/egress";
import { DNS_TIMEOUT_MS } from "../../src/lib/config/constants";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("nameserversOf · bounded and failure-tolerant (issue 760)", () => {
  it("asks for the zone's NS records and answers them lowercased, without the trailing dot", async () => {
    const resolveNs = vi.spyOn(dns.promises, "resolveNs").mockResolvedValue(["HASSLO.NS.Cloudflare.com."]);
    await expect(nameserversOf("reachkit.app.")).resolves.toEqual(["hasslo.ns.cloudflare.com"]);
    expect(resolveNs).toHaveBeenCalledWith("reachkit.app");
  });

  it("a lookup that hangs answers null once the bound has passed", async () => {
    vi.useFakeTimers();
    vi.spyOn(dns.promises, "resolveNs").mockReturnValue(new Promise(() => {}));
    const answer = nameserversOf("acme.com");
    await vi.advanceTimersByTimeAsync(DNS_TIMEOUT_MS);
    await expect(answer).resolves.toBeNull();
  });

  it("no records, a rejection or an empty name is null, never a thrown error", async () => {
    vi.spyOn(dns.promises, "resolveNs").mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("ENODATA"));
    await expect(nameserversOf("acme.com")).resolves.toBeNull();
    await expect(nameserversOf("acme.com")).resolves.toBeNull();
    await expect(nameserversOf("  ")).resolves.toBeNull();
  });
});
