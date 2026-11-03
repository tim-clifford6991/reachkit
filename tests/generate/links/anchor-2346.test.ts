// tests/generate/links/anchor-2346.test.ts — SPEC §7 *Descriptive link text*:
// a link into the site is anchored on words that name the page it leads to,
// never on a price. The body is stored draft 0f95686d, which linked Otterly's
// "$29" to an unrelated compare page three times.
import "../env";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyLinks } from "../../../src/lib/generate/links/apply";
import type { LinkTarget } from "../../../src/lib/generate/links/select";
import { linkTextProblem } from "../../../src/lib/generate/links/text";

const BODY = readFileSync(new URL("../fixtures/stopped-0f95686d-2026-11.md", import.meta.url), "utf8");

const site = (path: string, label: string): LinkTarget => ({ source: "site", purpose: "other", url: `https://reachkit.app${path}`, label, said: [label] });

/** The pages the body links, named as the link step names them. */
const TARGETS: LinkTarget[] = [
  site("/pricing", "Pricing"),
  site("/compare/seositecheckup", "ReachKit vs SEO SiteCheckup"),
  site("/compare/google-search-console", "ReachKit vs Google Search Console"),
  site("/tools", "Free SEO tools"),
  site("/compare/seobility", "ReachKit vs Seobility"),
  site("/compare/seobility-competitor-analysis", "ReachKit vs Seobility Competitor Analysis"),
  { source: "cluster", url: "https://content.reachkit.app/best-answer-engine-optimization-services-for-ai-visibility", label: "Best Answer Engine Optimization Services for AI Visibility" },
];

const apply = (markdown: string, targets: LinkTarget[] = TARGETS): string =>
  applyLinks(markdown, { domain: "reachkit.app", targets, groundedUrl: "https://reachkit.app/" });

const links = (markdown: string): string[] => [...markdown.matchAll(/\[([^\]\n]*)\]\(([^)\s]+)\)/g)].map((m) => m[0]);

describe("no link into the site is anchored on a figure", () => {
  it.each(["$29", "€1.597", "29 USD", "£ 1,200", "10k+", "65+"])("%s is a figure", (label) => {
    expect(linkTextProblem(label)).toBe("number");
  });

  it("the stored body keeps Otterly's $29 as words, and links nothing on it", () => {
    const out = apply(BODY);
    expect(BODY.match(/\[\$29\]\(https:\/\/reachkit\.app\/compare\/seositecheckup\)/g)).toHaveLength(3);
    expect(out).not.toMatch(/\[[^\]]*\$29[^\]]*\]\(https:\/\/(?:[a-z]+\.)?reachkit\.app/);
    expect(out).toContain("Otterly starts at $29/month for tracking");
    expect(out).toContain("- Otterly's pricing starts at $29/month and covers");
    expect(out).toContain("a published entry price of $29/month, and");
  });

  it("every other link of the body stands as it was", () => {
    const refused = new Set(["[$29](https://reachkit.app/compare/seositecheckup)", "[€49 a month](https://reachkit.app/pricing)"]);
    expect(links(apply(BODY))).toEqual(links(BODY).filter((link) => !refused.has(link)));
  });

  it("a figure linked to its source elsewhere stands", () => {
    const line = "Otterly starts at [$29](https://otterly.ai/pricing) a month.";
    expect(apply(line, [])).toBe(line);
  });
});

describe("a link's words name the page it leads to", () => {
  it("a sentence about something else is unwrapped, and the page is listed under its own name", () => {
    const out = apply("Otterly [tracks seven engines](https://reachkit.app/compare/seositecheckup) today.", [TARGETS[1]!]);
    expect(out).toContain("Otterly tracks seven engines today.");
    expect(out).toContain("- [ReachKit vs SEO SiteCheckup](https://reachkit.app/compare/seositecheckup)");
  });

  it("words its name, heading or address shares stand", () => {
    for (const line of [
      "See [how ReachKit compares](https://reachkit.app/compare/seositecheckup).",
      "Read [the SiteCheckup comparison](https://reachkit.app/compare/seositecheckup).",
      "See the [pricing page](https://reachkit.app/pricing).",
    ]) {
      expect(apply(line, [TARGETS[0]!, TARGETS[1]!, TARGETS[3]!]).split("\n")[0]).toBe(line);
    }
  });
});
