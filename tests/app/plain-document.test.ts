// The two plain 410 pages share one builder; their bodies are pinned byte for byte as main served them.
import { describe, expect, it } from "vitest";
import { GET } from "@/app/(public)/gone/route";
import { REMOVED_RESPONSE_INIT, removedDocument } from "@/app/(public)/scan/[domain]/_address/removal";
import { plainDocument } from "@/lib/publish/render/plain-document";
import type { CanonicalDomain } from "@/lib/scan/domain";

const GONE_BODY =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>This page is gone</title></head><body><main><h1>This page is gone</h1><p>It belonged to an earlier version of ReachKit and has no replacement. The free scan is the place to start.</p><p><a href="/">Scan my site for free</a></p></main></body></html>';

const REMOVED_BODY =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>This report was removed</title></head><body><main><h1>This report was removed</h1><p>The site’s owner asked us to remove this report. To scan roofer.example.com again, write to remove@reachkit.app.</p><p><a href="/">Scan a different site</a></p></main></body></html>';

describe("plain 410 pages", () => {
  it("/gone answers the same body, status and headers", async () => {
    const response = GET();
    expect(response.status).toBe(410);
    expect([...response.headers]).toEqual([
      ["cache-control", "public, max-age=3600"],
      ["content-type", "text/html; charset=utf-8"],
    ]);
    expect(await response.text()).toBe(GONE_BODY);
  });

  it("a removed report's document is the same body", () => {
    expect(removedDocument("roofer.example.com" as CanonicalDomain)).toBe(REMOVED_BODY);
    expect(REMOVED_RESPONSE_INIT.status).toBe(410);
  });

  it("escapes markup in every slot", () => {
    const html = plainDocument({ head: "<h>", line: "a & <b>", onward: '"go"' });
    expect(html).toContain("<title>&lt;h&gt;</title>");
    expect(html).toContain("<h1>&lt;h&gt;</h1>");
    expect(html).toContain("<p>a &amp; &lt;b&gt;</p>");
    expect(html).toContain('<a href="/">&quot;go&quot;</a>');
    expect(html).not.toContain("<b>");
  });
});
