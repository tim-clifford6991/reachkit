// SPEC §2 (issue 1379) — a bot-protection page is told from the site's own.
//
// The pages are real: what each site answered the `reachkit-measure` reader
// on 2026-10-10 (gusto.com and freshworks.com: their stored `fetches` rows),
// with the reader's address replaced. The long ones are cut to the part the
// detector reads.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { challengeOf, isProtectionName, notTheSiteOf } from "@/lib/measure/challenge";

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
    // Issue 1418: stored before issue 1379, so no headers were kept. Both
    // were scored 0, Invisible, off the page's `noindex`.
    ["Cloudflare's managed challenge, stored without headers (gusto.com, 2026-10-08)", 403, {}, "cloudflare-challenge.gusto.com.html", "Cloudflare"],
    ["Cloudflare's managed challenge, stored without headers (freshworks.com, 2026-10-09)", 403, {}, "cloudflare-challenge.freshworks.com.html", "Cloudflare"],
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

// Issue 1427: tattly.com's home read answered a 429 with the bare string
// `local_rate_limited`, and its profile was read off it.
describe("notTheSiteOf", () => {
  const NGINX_429 =
    "<html>\r\n<head><title>429 Too Many Requests</title></head>\r\n<body>\r\n<center><h1>429 Too Many Requests</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>";

  it("reads a stored 429 page as an error answer, with the wait the server asked", () => {
    expect(notTheSiteOf({ status: 429, headers: { "retry-after": "2" }, html: NGINX_429 })).toEqual({
      kind: "error",
      status: 429,
      retryAfterMs: 2000,
    });
  });

  it("reads a bare `local_rate_limited` body as an error answer, whatever its status", () => {
    expect(notTheSiteOf({ status: 429, html: "local_rate_limited" })).toMatchObject({ kind: "error", status: 429 });
    expect(notTheSiteOf({ status: 200, html: "local_rate_limited" })).toMatchObject({ kind: "error", status: 200 });
    expect(notTheSiteOf({ status: 200, html: "  " })).toMatchObject({ kind: "error" });
  });

  it("reads a short rate-limit page served with a 200 as an error answer", () => {
    const html = "<html><body><h1>Too Many Requests</h1><p>Please slow down.</p></body></html>";
    expect(notTheSiteOf({ status: 200, html })).toMatchObject({ kind: "error", status: 200, retryAfterMs: null });
  });

  it("dates a `Retry-After` given as a date from the read", () => {
    const answer = notTheSiteOf({
      status: 503,
      headers: { "retry-after": "Wed, 14 Oct 2026 10:00:03 GMT" },
      html: "<title>Service Unavailable</title>",
      readAt: "2026-10-14T10:00:00.000Z",
    });
    expect(answer).toEqual({ kind: "error", status: 503, retryAfterMs: 3000 });
  });

  it("keeps a protection's page the protection's", () => {
    expect(notTheSiteOf({ status: 403, html: page("cloudflare-block.sage.com.html") })).toEqual({ kind: "protection", vendor: "Cloudflare" });
  });

  it("reads the site's own page as the site, a large one that names a rate limit in its scripts too", () => {
    expect(notTheSiteOf({ status: 200, headers: { server: "cloudflare" }, html: page("site.crunchbase.com.html") })).toBeNull();
    const app = `<html><body><h1>Design together</h1><script>${'{"modal_error_rate_limit_exceeded":"Signup attempt rate limit exceeded"}'.repeat(2000)}</script></body></html>`;
    expect(notTheSiteOf({ status: 200, html: app })).toBeNull();
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
