// RFC 9116's security.txt: the fields a researcher reads, and an expiry
// that is in the future and inside a year.
import { describe, expect, it } from "vitest";
import { GET } from "@/app/(public)/.well-known/security.txt/route";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function fields(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of body.split("\n")) {
    const at = line.indexOf(": ");
    if (at > 0) out.set(line.slice(0, at), line.slice(at + 2));
  }
  return out;
}

describe("/.well-known/security.txt", () => {
  it("answers 200 text/plain with Contact, Preferred-Languages and its own Canonical address", async () => {
    const res = GET(new Request("https://reachkit.app/.well-known/security.txt"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    const f = fields(await res.text());
    expect(f.get("Contact")).toBe("mailto:hello@reachkit.app");
    expect(f.get("Preferred-Languages")).toBe("en");
    expect(new URL(f.get("Canonical")!).pathname).toBe("/.well-known/security.txt");
  });

  it("expires after now and within a year", async () => {
    const before = Date.now();
    const expires = Date.parse(fields(await GET(new Request("https://reachkit.app/.well-known/security.txt")).text()).get("Expires")!);
    expect(expires).toBeGreaterThan(before);
    expect(expires).toBeLessThanOrEqual(Date.now() + YEAR_MS);
  });
});
