/**
 * Repo-wide tripwire: no `app/(app)/**` or `components/app/**` surface may link
 * or navigate to a `/scan/<id>` REPORT page. `/scan/[id]` renders `PublicReport`
 * unconditionally — deliberately entitlement-blind (a shareable report must
 * never leak paid data based on who is looking) — so any authenticated in-shell
 * surface that sends a viewer there reproduces the exact bug this branch exists
 * to fix: a paying Growth user watching their own scan lands on a redacted
 * "Unlock full report" CTA for a product they already pay for.
 *
 * This generalizes (for the `/scan/<id>` leak specifically) the switcher-only
 * guard in components/app/captured/app-switcher-menu.test.tsx, which caught
 * exactly one call site (the switcher's old link) and would have missed both
 * regressions this branch actually shipped with: the dashboard's in-flight
 * "Watch progress" link (app/(app)/app/dashboard/page.tsx) and
 * ScanCurrentButton's router.push (components/app/scan-current-button.tsx).
 * That test's own third assertion — no bare `"/scan"` funnel reference at all,
 * anywhere in the switcher — is a narrower, complementary invariant this file
 * does NOT duplicate (bare `/scan`, the public entry point, is legitimately
 * linked from marketing surfaces, just never from inside the app shell) — so
 * that test stays; only its `/scan/`-leak coverage is now redundant with this
 * file, which checks every file under both roots instead of one component.
 *
 * Same idiom as app/api/costed-routes.test.ts / add-product-policy.test.ts:
 * read real source, fail on the literal pattern — no jsdom/render needed.
 *
 * Pattern: a string/template literal that OPENS with `/scan/` — a quote or
 * backtick immediately followed by `/scan/`. This catches `href="/scan/…"`,
 * `` router.push(`/scan/${id}`) ``, `redirect("/scan/" + id)`, etc., while
 * never matching `@/lib/scan/...` import specifiers (the quote there is
 * immediately followed by `@/lib`, not `/scan`), `` `/api/scan/${id}/stream` ``
 * (immediately followed by `/api`, not `/scan`), or prose mentioning `/scan/`
 * inside a comment (no quote/backtick immediately precedes it there).
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOTS = ["app/(app)", "components/app"];
const EXT = /\.(ts|tsx)$/;
const LEAK = /(["'`])\/scan\//;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (EXT.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("no in-shell (app) surface links or pushes to a /scan/<id> report (ratchet)", () => {
  const files = ROOTS.flatMap((r) => walk(resolve(process.cwd(), r)));

  // Sanity: the walk actually found files, so a broken glob can't silently
  // pass this test by finding nothing.
  it("found source files to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    const rel = file.replace(resolve(process.cwd()) + "/", "");
    it(`${rel} never links/pushes to /scan/<id>`, () => {
      const src = readFileSync(file, "utf8");
      const m = src.match(LEAK);
      expect(
        m,
        `${rel} contains a quoted/templated "/scan/" — that's the PublicReport ejection ` +
          `this branch fixes. Route around it via an in-shell surface instead (e.g. ` +
          `router.refresh() + a dashboard component fed by /api/scan/[id]/stream), never a ` +
          `navigation to /scan/<id>.`,
      ).toBeNull();
    });
  }
});
