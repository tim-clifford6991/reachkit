// Owner R-B (2026-11-07), and the hash policy (2026-11-10): the marketing pages are prerendered,
// never regenerated, and served under a CSP that names every inline script they ship by hash, with no
// `'unsafe-inline'`. Read from the build the layout job just made and the server it started.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isStaticPage } from "@/app/_root/csp";
import { inlineScriptHashes } from "../../../scripts/static-csp.mjs";
import { getBaseURL } from "./browser";

const manifest = JSON.parse(readFileSync(path.resolve(__dirname, "../../../.next/prerender-manifest.json"), "utf8")) as {
  routes: Record<string, { initialRevalidateSeconds: number | false; dataRoute: string | null }>;
};
const prerendered = Object.entries(manifest.routes).filter(([route]) => isStaticPage(route));

const NAMED = ["/", "/pricing", "/about", "/how-it-works", "/privacy", "/terms", "/imprint", "/compare", "/teardowns", "/tools", "/teardowns/rss.xml"];
const UNDER = ["/compare/", "/answers/"];

describe("the static pages", () => {
  it("are all prerendered and never regenerated", () => {
    const paths = prerendered.map(([route]) => route);
    expect(paths).toEqual(expect.arrayContaining(NAMED));
    for (const prefix of UNDER) expect(paths.some((p) => p.startsWith(prefix)), prefix).toBe(true);
    for (const [route, entry] of prerendered) expect(entry.initialRevalidateSeconds, route).toBe(false);
  });

  it("answer with a policy that names every inline script they ship, and never 'unsafe-inline'", async () => {
    for (const [route] of prerendered.filter(([, e]) => e.dataRoute !== null)) {
      const response = await fetch(`${getBaseURL()}${route}`);
      const scriptSrc = /script-src([^;]*)/.exec(response.headers.get("content-security-policy") ?? "")?.[1] ?? "";
      const allowed = new Set(scriptSrc.trim().split(/\s+/));
      expect(scriptSrc, route).not.toMatch(/'unsafe-inline'|'nonce-/);
      const hashes = inlineScriptHashes(await response.text());
      expect(hashes.length, `${route} ships its flight data inline`).toBeGreaterThan(0);
      expect(hashes.filter((h) => !allowed.has(h)), `${route} ships an inline script its policy refuses`).toEqual([]);
    }
  });
});
