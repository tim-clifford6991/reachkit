// tests/app/scan-address/removed-route.test.tsx — issue #104.
//
// A removed domain's report address answers `410 Gone` at the address it
// was asked for. Two halves decide that: the route handler that can set a
// status, and the rewrite that sends the report address to it without
// changing the URL. Both are here, because either alone is not the
// promise.
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../scan/run/harness";
import { NextRequest } from "next/server";
import { REPORT_REMOVED_STATUS } from "@/lib/config/constants";

const isDomainRemoved = vi.fn<(domain: string) => Promise<boolean>>();
vi.mock("@/lib/scan/removal", () => ({
  isDomainRemoved: (domain: string) => isDomainRemoved(domain),
  isRemovedWith: (_client: unknown, domain: string) => isDomainRemoved(domain),
}));

const { GET } = await import("@/app/api/report/[domain]/removed/route");
const { middleware } = await import("@/middleware");

const REMOVED = "gone.example.net";

function requestFor(domain: string): Request {
  return new Request(`https://app.example.com/api/report/${domain}/removed`);
}

function params(domain: string): { params: Promise<{ domain: string }> } {
  return { params: Promise.resolve({ domain }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  isDomainRemoved.mockResolvedValue(true);
});

describe("the route handler — the status a page cannot set", () => {
  it("answers 410, with the robots directive and the cache policy that travel with it", async () => {
    const res = await GET(requestFor(REMOVED), params(REMOVED));
    expect(res.status).toBe(REPORT_REMOVED_STATUS);
    expect(res.status).toBe(410);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Type")).toMatch(/^text\/html/);
  });

  it("serves the removal line, the removal address, and nothing else about the report", async () => {
    const html = await (await GET(requestFor(REMOVED), params(REMOVED))).text();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain(REMOVED);
    // REQ-001 c18 / REQ-002 c3: no control, no route back — the one way
    // back is a second written request, which is a sentence, not a button.
    for (const tag of ["<button", "<form", "<input", "<a "]) expect(html).not.toContain(tag);
    // Nothing of the report itself survives a removal.
    for (const leak of ["score", "rival", "Copy link"]) expect(html).not.toContain(leak);
    // `noindex` twice over (ADR-002): the header above and the meta tag.
    expect(html).toContain('<meta name="robots" content="noindex">');
  });

  it("re-checks the removal itself — a 410 for a live report is a lie a stranger could make us tell", async () => {
    isDomainRemoved.mockResolvedValue(false);
    const res = await GET(requestFor("live.example.net"), params("live.example.net"));
    expect(res.status).toBe(404);
    expect(isDomainRemoved).toHaveBeenCalledTimes(1);
  });

  it("answers a segment that does not parse with 404, and asks nothing", async () => {
    const res = await GET(requestFor("not a domain"), params("not a domain"));
    expect(res.status).toBe(404);
    expect(isDomainRemoved).not.toHaveBeenCalled();
  });
});

describe("the rewrite — the visitor stays at the one address for the domain", () => {
  function reportRequest(path: string, method = "GET"): NextRequest {
    return new NextRequest(new URL(path, "https://app.example.com"), { method });
  }

  it("rewrites a removed domain's report address to the handler, and does not redirect", async () => {
    const res = await middleware(reportRequest(`/scan/${REMOVED}`));
    // A rewrite, not a redirect: the browser's URL is untouched, so the
    // 410 lands on the address REQ-001 c2 promises per domain.
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-rewrite")).toContain(`/api/report/${REMOVED}/removed`);
  });

  it("leaves a live domain's report address alone", async () => {
    isDomainRemoved.mockResolvedValue(false);
    const res = await middleware(reportRequest("/scan/live.example.net"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("asks about nothing but the report address, and nothing but a GET", async () => {
    await middleware(reportRequest("/"));
    await middleware(reportRequest("/api/scan", "POST"));
    await middleware(reportRequest(`/scan/${REMOVED}`, "POST"));
    await middleware(reportRequest(`/scan/${REMOVED}/something`));
    expect(isDomainRemoved).not.toHaveBeenCalled();
  });

  it("a read that cannot be answered rewrites nothing — the report renders", async () => {
    isDomainRemoved.mockRejectedValue(new Error("connection reset"));
    const res = await middleware(reportRequest(`/scan/${REMOVED}`));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("asks about the canonical form only — a non-canonical one is 308'd there first and matches on the way back", async () => {
    // `page.tsx` issues its 308 before it resolves anything, so a
    // non-canonical form renders nothing and comes back here canonical.
    // That is what lets this function keep the whole domain parser — and
    // its `node:net` import — out of the Edge bundle it is built into.
    await middleware(reportRequest(`/scan/${encodeURIComponent(`WWW.${REMOVED}`)}`));
    expect(isDomainRemoved).toHaveBeenCalledWith(`www.${REMOVED}`);
    expect(isDomainRemoved).not.toHaveBeenCalledWith(REMOVED);

    isDomainRemoved.mockClear();
    await middleware(reportRequest(`/scan/${REMOVED.toUpperCase()}`));
    expect(isDomainRemoved).toHaveBeenCalledWith(REMOVED);
  });
});
