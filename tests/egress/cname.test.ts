// tests/egress/cname.test.ts — SPEC §5, issue 856
//
// `publicRecordOf`: what public DNS answers for the founder's host, the first
// step of "check connection". A resolver that could not answer is `null`,
// never "no record": the founder is not told to wait for a record they may
// already have. The resolver is doubled; nothing here reaches the network.
import dns from "node:dns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publicRecordOf } from "../../src/lib/egress";
import { DNS_TIMEOUT_MS } from "../../src/lib/config/constants";

const code = (c: string) => Object.assign(new Error(c), { code: c });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("publicRecordOf · bounded, and a failure is never 'no record' (issue 856)", () => {
  it("a CNAME answers its target, lowercased without the trailing dot", async () => {
    const asked = vi.spyOn(dns.promises, "resolveCname").mockResolvedValue(["CNAME.Vercel-DNS.com."]);
    await expect(publicRecordOf("content.acme.com.")).resolves.toEqual({ kind: "cname", target: "cname.vercel-dns.com" });
    expect(asked).toHaveBeenCalledWith("content.acme.com");
  });

  it("NXDOMAIN is no record, and no address is asked for", async () => {
    vi.spyOn(dns.promises, "resolveCname").mockRejectedValue(code("ENOTFOUND"));
    const a = vi.spyOn(dns.promises, "resolve4");
    await expect(publicRecordOf("content.acme.com")).resolves.toEqual({ kind: "none" });
    expect(a).not.toHaveBeenCalled();
  });

  it("no CNAME but addresses — a proxy in front — answers the address; neither is no record", async () => {
    vi.spyOn(dns.promises, "resolveCname").mockRejectedValue(code("ENODATA"));
    vi.spyOn(dns.promises, "resolve4").mockResolvedValueOnce(["104.21.1.1"]).mockRejectedValueOnce(code("ENODATA"));
    await expect(publicRecordOf("content.acme.com")).resolves.toEqual({ kind: "addresses", address: "104.21.1.1" });
    await expect(publicRecordOf("content.acme.com")).resolves.toEqual({ kind: "none" });
  });

  it("a resolver error or a hang is null", async () => {
    vi.spyOn(dns.promises, "resolveCname").mockRejectedValueOnce(code("ESERVFAIL"));
    await expect(publicRecordOf("content.acme.com")).resolves.toBeNull();

    vi.useFakeTimers();
    vi.spyOn(dns.promises, "resolveCname").mockReturnValue(new Promise(() => {}));
    const answer = publicRecordOf("content.acme.com");
    await vi.advanceTimersByTimeAsync(DNS_TIMEOUT_MS);
    await expect(answer).resolves.toBeNull();
  });
});
