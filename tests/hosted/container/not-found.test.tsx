/** @vitest-environment jsdom */
// tests/hosted/container/not-found.test.tsx — BUILD §9, issue #49
//
// The unknown-Host 404 and the 410 that is not one. Both answer on a domain
// that is not ours, and the assertion that matters for both is the same:
// nothing on the response identifies the operator of a stranger's domain.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const NotFound = (await import("@/app/(hosted)/not-found")).default;
const gone = await import("@/app/(hosted)/hosted-gone/route");
const { HOSTED_GONE_STATUS } = await import("@/lib/config/constants");

function notFoundHtml(): string {
  return renderToStaticMarkup(React.createElement(NotFound));
}

describe("an unknown or unmapped Host is 404, and never a ReachKit page", () => {
  it("the body names ReachKit nowhere", () => {
    expect(notFoundHtml().toLowerCase()).not.toContain("reachkit");
  });

  it("it carries no link and no navigation off the stranger's own domain", () => {
    const html = notFoundHtml();
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
    expect(html).not.toContain("<nav");
  });

  it("it offers no control at all — nothing to click, nothing to submit", () => {
    const html = notFoundHtml();
    for (const element of ["<button", "<form", "<input", "<select", "<textarea"]) {
      expect(html, element).not.toContain(element);
    }
  });

  it("it speaks no sentence at all — the status is the whole message", () => {
    // A word of ours here would have to come from the registry (which
    // WO-028 forbids on a stranger's domain) or from a literal (which
    // REQ-093 c1's sweep forbids anywhere). There is neither.
    const document = new DOMParser().parseFromString(notFoundHtml(), "text/html");
    expect(document.body.textContent?.trim()).toBe("");
  });

  it("it is a screen root and declares its band arms (ADR-093)", () => {
    expect(notFoundHtml()).toContain("data-surface");
  });
});

describe("REQ-076 c10 / REQ-079 c6 — a stopped address is 410 Gone", () => {
  it("the status is the pinned 410 — not 404, not 200, not a redirect", async () => {
    const response = await gone.GET();
    expect(response.status).toBe(HOSTED_GONE_STATUS);
    expect(response.status).toBe(410);
    expect(response.status).not.toBe(404);
    expect(response.headers.get("Location")).toBeNull();
  });

  it("it is never cached, so a takedown never waits on a TTL", async () => {
    expect((await gone.GET()).headers.get("Cache-Control")).toBe("no-store");
  });

  it("it is marked against indexing", async () => {
    const response = await gone.GET();
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(gone.GONE_DOCUMENT).toContain('<meta name="robots" content="noindex">');
  });

  it("its document names ReachKit nowhere and carries no link or control", async () => {
    const body = await (await gone.GET()).text();
    expect(body.toLowerCase()).not.toContain("reachkit");
    expect(body).not.toContain("href=");
    for (const element of ["<button", "<form", "<input", "<a "]) {
      expect(body, element).not.toContain(element);
    }
    // The body is empty; the `<title>` is HTML's required document name.
    expect(body).toContain("<body></body>");
  });

  it("the status, the robots directive and the cache policy travel as one value", () => {
    expect(gone.HOSTED_GONE_RESPONSE_INIT).toEqual({
      status: 410,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex",
      },
    });
  });
});
