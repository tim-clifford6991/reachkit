/**
 * Doc-rot tripwire — the map must not reference guards that don't exist.
 *
 * CLAUDE.md's harness table + invariants (and docs/REQUIREMENTS.md /
 * docs/architecture.md) are the owner's view into the enforcement system; a
 * row pointing at a deleted/renamed file is a guard that LOOKS present and
 * isn't — the "green check whose instrument you have not verified" class.
 * This parses every backtick-quoted repo-file path out of those docs and
 * asserts each exists on disk.
 *
 * Conservative by design (never brittle): only tokens that contain a `/`,
 * carry a known source extension, and contain no glob/placeholder characters
 * (`* { } < > space`) count as paths; a trailing `:line` suffix is stripped.
 * Anti-vacuity: the parser must find a healthy minimum of paths in CLAUDE.md
 * (a regex drift can't silently match nothing), and the extractor is
 * self-tested against an inline doc containing a known-good and a known-bad
 * path. Mutation proof: add a nonexistent path to CLAUDE.md → this fails.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const EXT = /\.(ts|tsx|mjs|mts|cjs|sql|css|json|md)$/;

/** Build-output prefixes that are legitimately absent from a fresh checkout
 *  (each named in the docs as gitignored/generated). */
const GENERATED_PREFIXES = ["ds-bundle/"];

/** Extract repo-file-path candidates from backtick spans in markdown.
 *  CONVENTION this tripwire establishes: backticks around a path assert the
 *  file EXISTS. A historical mention of a deleted file uses italics, never
 *  backticks. Contextual shorthands ("referral/keyword-gap.ts") are not
 *  allowed in the maps — write the full repo path. */
export function extractRepoPaths(markdown: string): string[] {
  const out = new Set<string>();
  for (const m of markdown.matchAll(/`([^`\n]+)`/g)) {
    // Strip a trailing :lineNumber reference (`lib/app/diagnostics.ts:153`)
    // and the tsconfig alias prefix (`@/components/…` resolves to repo root).
    const token = (m[1] ?? "").replace(/:\d+$/, "").replace(/^@\//, "");
    if (!token.includes("/")) continue;
    if (/[*{}<>\s]/.test(token)) continue; // globs, brace-lists, placeholders
    if (token.includes("://")) continue; // URLs
    if (token.startsWith("/")) continue; // absolute/route paths, not repo files
    if (GENERATED_PREFIXES.some((p) => token.startsWith(p))) continue;
    if (!EXT.test(token)) continue;
    out.add(token);
  }
  return [...out];
}

const DOCS = ["CLAUDE.md", "docs/REQUIREMENTS.md", "docs/architecture.md"];

describe("doc-rot tripwire — every repo file path referenced by the maps exists", () => {
  for (const doc of DOCS) {
    it(`${doc}: every backtick-quoted file path resolves on disk`, () => {
      const text = readFileSync(join(process.cwd(), doc), "utf8");
      const paths = extractRepoPaths(text);
      const missing = paths.filter((p) => !existsSync(join(process.cwd(), p)));
      expect(missing, `${doc} references files that do not exist:\n${missing.join("\n")}`).toEqual([]);
    });
  }

  it("anti-vacuity: the parser finds a healthy number of paths in CLAUDE.md (a regex drift can't silently match nothing)", () => {
    const text = readFileSync(join(process.cwd(), "CLAUDE.md"), "utf8");
    expect(extractRepoPaths(text).length).toBeGreaterThanOrEqual(15);
  });

  it("self-test: the extractor finds a good path, flags a bad one, skips globs/URLs/line-refs correctly", () => {
    const doc = [
      "See `lib/scan/report.ts` and `lib/scan/does-not-exist.ts`.",
      "Skip `lib/scan/fixtures/report-corpus/*.json` and `https://x.dev/a.ts`.",
      "Line refs like `lib/app/diagnostics.ts:153` resolve to the file.",
      "Skip brace-lists `a/{b.ts,c.ts}` and bare names `report.ts`.",
    ].join("\n");
    const paths = extractRepoPaths(doc);
    expect(paths).toContain("lib/scan/report.ts");
    expect(paths).toContain("lib/scan/does-not-exist.ts"); // extracted — existence is the caller's check
    expect(paths).toContain("lib/app/diagnostics.ts");
    expect(paths).not.toContain("lib/scan/fixtures/report-corpus/*.json");
    expect(paths.some((p) => p.startsWith("https"))).toBe(false);
    expect(paths).not.toContain("report.ts");
    expect(existsSync(join(process.cwd(), "lib/scan/does-not-exist.ts"))).toBe(false);
  });
});
