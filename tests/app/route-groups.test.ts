// tests/app/route-groups.test.ts
//
// WO-002 `## Test plan` — two rows, both quoted verbatim from BP-001:
//
//   1. Decision "three route groups — `(public)`, `(account)`, `(hosted)`
//      — with the authorisation rule attached to the group rather than to
//      the route." (BP-001's current numbering is decision 3; WO-002's own
//      table cites it as "decision 2" — the quote is unchanged, only the
//      ordinal has drifted since this work order was cut.) — asserts all
//      three directories exist.
//   2. `## Module / boundary`: "It does **not** own `src/app/(hosted)/**`,
//      which is BP-004's." — fails if this work order writes any file
//      under `(hosted)` other than the placeholder that makes the empty
//      directory exist in git (the same mechanism `src/app/.gitkeep` and
//      its siblings already use elsewhere in this repo).
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = path.resolve(import.meta.dirname, "../../src/app");

describe('BP-001 decision — "three route groups ... with the authorisation rule attached to the group rather than to the route"', () => {
  it.each(["(public)", "(account)", "(hosted)"])("the %s route-group directory exists", (group) => {
    const dir = path.join(APP_ROOT, group);
    expect(existsSync(dir), `${dir} must exist`).toBe(true);
  });

  it("(public) and (account) each carry this work order's pass-through layout", () => {
    expect(existsSync(path.join(APP_ROOT, "(public)", "layout.tsx"))).toBe(true);
    expect(existsSync(path.join(APP_ROOT, "(account)", "layout.tsx"))).toBe(true);
  });
});

describe('BP-001 `## Module / boundary` — "It does **not** own `src/app/(hosted)/**`, which is BP-004\'s."', () => {
  // Until issue #49 the assertion here was that `(hosted)` held nothing but
  // a `.gitkeep` — the strongest statement available while the hosted edge
  // was unbuilt, and the reason the placeholder existed at all. #49 built
  // it, so the boundary is now asserted the other way round: the group
  // carries BP-004's and BP-047's own files and nothing WO-002 wrote.
  const hostedDir = path.join(APP_ROOT, "(hosted)");

  it("(hosted) is BP-004's, and every file in it is one BP-004 or BP-047 names", () => {
    const entries = readdirSync(hostedDir).sort();
    expect(entries).toEqual(
      [
        "edge.ts",
        "hosted-gone",
        "hosted-page",
        "layout.tsx",
        "not-found.tsx",
        "policies.ts",
        "resolve-host.ts",
        "robots.txt",
        "sitemap.xml",
      ].sort()
    );
  });

  it("the group's own four surfaces are on disk", () => {
    for (const file of [
      "layout.tsx",
      "not-found.tsx",
      "resolve-host.ts",
      "hosted-page/[...slug]/page.tsx",
      "robots.txt/route.ts",
      "sitemap.xml/route.ts",
      "hosted-gone/route.ts",
    ]) {
      expect(existsSync(path.join(hostedDir, file)), file).toBe(true);
    }
  });

  it("(hosted) carries no `.gitkeep` any more — the directory holds real files", () => {
    expect(existsSync(path.join(hostedDir, ".gitkeep"))).toBe(false);
  });
});
