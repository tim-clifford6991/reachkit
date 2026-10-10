// SPEC §2 (issue 1379) — a bot-protection page is told from the site's own.
//
// The pages are real: what each site answered the `reachkit-measure` reader
// on 2026-10-10, with the reader's address replaced. The long ones are cut
// to the part the detector reads.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { challengeOf, isProtectionName } from "@/lib/measure/challenge";

const page = (name: string): string => readFileSync(join(__dirname, "fixtures/challenge", name), "utf8");

describe("challengeOf", () => {
  it.each([
    ["Cloudflare's block page (sage.com)", 403, {}, "cloudflare-block.sage.com.html", "Cloudflare"],
    ["a firewall refusal behind Cloudflare (udemy.com)", 403, {}, "cloudflare-forbidden.udemy.com.html", "Cloudflare"],
    ["DataDome's captcha (g2.com)", 403, {}, "datadome.g2.com.html", "DataDome"],
    ["PerimeterX's press-and-hold (zillow.com)", 403, {}, "perimeterx.zillow.com.html", "PerimeterX"],
    [
      "a managed challenge under the site's own title (glassdoor.com)",
      403,
      { "cf-mitigated": "challenge", server: "cloudflare" },
      "cloudflare-managed.glassdoor.com.html",
      "Cloudflare",
    ],
  ] as const)("reads %s as the protection's page", (_what, status, headers, file, vendor) => {
    expect(challengeOf({ status, headers, html: page(file) })).toBe(vendor);
  });

  it("reads a challenge title at any status", () => {
    const html = "<html><head><title>Just a moment...</title></head><body></body></html>";
    expect(challengeOf({ status: 200, html })).toBe("Cloudflare");
  });

  it.each([
    // The script Cloudflare adds to every page it lets through.
    ["a page behind Cloudflare (crunchbase.com)", { server: "cloudflare" }, "site.crunchbase.com.html"],
    ["a page behind Akamai (nike.com)", { server: "AkamaiGHost" }, "site.nike.com.html"],
  ] as const)("reads %s as the site's own", (_what, headers, file) => {
    expect(challengeOf({ status: 200, headers, html: page(file) })).toBeNull();
  });

  it("does not call a site's own error page a challenge", () => {
    const html = "<html><head><title>Page not found | Example</title></head><body><h1>Not found</h1></body></html>";
    expect(challengeOf({ status: 404, html })).toBeNull();
    expect(challengeOf({ status: 503, html: "<title>Down for maintenance</title>" })).toBeNull();
  });
});

describe("isProtectionName", () => {
  it("refuses a protection's name for another site and keeps it for its own", () => {
    expect(isProtectionName("Cloudflare", "sage.com")).toBe(true);
    expect(isProtectionName("Just a moment...", "example.com")).toBe(true);
    expect(isProtectionName("Cloudflare", "cloudflare.com")).toBe(false);
    expect(isProtectionName("Sage", "sage.com")).toBe(false);
  });
});
