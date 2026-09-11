// Every route names the approved screen it is built against (issue #358).
// tests/ui/design/reference.test.ts
//
// The owner approved twenty screens and ruled them the reference for every
// UI issue. That only holds if "which screen is this route?" has one answer,
// and until this test it had three places to disagree: the route tree, the
// index a person reads (`docs/design-reference.md`), and whatever a PR body
// happened to claim. This holds the first two equal and checks both against
// `UI-SPEC.md` itself, so a screen cannot be rebuilt against nothing and a
// new route cannot arrive without saying what it is.
//
// **It lives here, beside the other design gates, and not under
// `tests/ui/layout/`, on purpose.** Everything in that directory is the
// browser project: a `next build`, a seeded database and Chromium, four
// minutes before it can say anything. This reads three files and enumerates
// the route tree, so in the `ui` project it answers in seconds on every PR —
// which is when a missing reference is cheap to fix.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { enumerateRoutes, ROUTE_REFERENCE } from "../layout/routes";

const REPO = path.resolve(import.meta.dirname, "../../..");
const APP_DIR = path.join(REPO, "src/app");
const INDEX_MD = path.join(REPO, "docs/design-reference.md");
const UI_SPEC = path.join(REPO, "SPEC.md");

const index = readFileSync(INDEX_MD, "utf8");
const spec = readFileSync(UI_SPEC, "utf8");

/** Every `S<id>` `UI-SPEC.md` actually has a section for. */
function specScreens(): ReadonlySet<string> {
  return new Set([...spec.matchAll(/^### (S\d+)\b/gm)].map((m) => m[1]!));
}

/**
 * The screen ids `docs/design-reference.md` gives a route, keyed by the
 * route as the index writes it — SPEC.md's `{param}` spelling, which is not
 * the enumerator's filled-in fixture path. `routeInIndex` below bridges the
 * two rather than a second table doing it.
 */
function indexRows(): Map<string, string[]> {
  const rows = new Map<string, string[]>();
  for (const line of index.split("\n")) {
    if (!line.startsWith("| `")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const routes = [...cells[1]!.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
    const ids = [...(cells[2] ?? "").matchAll(/\bS\d+\b/g)].map((m) => m[0]);
    if (ids.length === 0) continue;
    for (const route of routes) rows.set(route, ids);
  }
  return rows;
}

/**
 * The index's spelling of an enumerated route: the fixture values the
 * enumerator substitutes, put back as the `{param}` the documents write.
 * Read off `SEGMENT_FIXTURES`' own values rather than restated, so a changed
 * fixture cannot quietly stop matching.
 */
function routeInIndex(enumerated: string): string {
  return enumerated
    .replace("/scan/example.com", "/scan/{domain}")
    .replace("/veto/layout-sweep-fixture", "/veto/{token}")
    .replace("/opt-out/layout-sweep-fixture", "/opt-out/{token}")
    .replace("/app/draft/draft-2026-09-15", "/app/draft/{draftId}")
    .replace("/hosted-page/best-onboarding-tools", "/hosted-page/{...slug}");
}

describe("issue #358 — every route names its approved screen, once", () => {
  const routes = enumerateRoutes(APP_DIR).map((r) => r.path);

  it("every enumerated route has a REFERENCE row", () => {
    const missing = routes.filter((p) => ROUTE_REFERENCE[p] === undefined).sort();
    expect(
      missing,
      `no REFERENCE: S<id> row in tests/ui/layout/routes.ts for: ${missing.join(", ")}`
    ).toEqual([]);
  });

  it("no REFERENCE row names a route the tree no longer serves", () => {
    // The other direction, and the one that rots silently: a deleted route
    // leaves its row behind, and the next reader takes the row for a screen.
    const stale = Object.keys(ROUTE_REFERENCE)
      .filter((p) => !routes.includes(p))
      .sort();
    expect(stale, `REFERENCE rows for routes that do not exist: ${stale.join(", ")}`).toEqual([]);
  });

  it("every REFERENCE names a screen UI-SPEC.md actually has", () => {
    const screens = specScreens();
    const unknown = Object.entries(ROUTE_REFERENCE)
      .filter(([, id]) => !screens.has(id))
      .map(([route, id]) => `${route} → ${id}`);
    expect(unknown, `no such section in UI-SPEC.md: ${unknown.join(", ")}`).toEqual([]);
  });

  it("the index and the route table agree on every route's screen", () => {
    // `docs/design-reference.md` is what a person reads and this map is what
    // the suite reads. Two sources for one fact is the drift this file
    // exists to catch, so they are compared rather than trusted.
    const rows = indexRows();
    const disagree: string[] = [];
    for (const [route, id] of Object.entries(ROUTE_REFERENCE)) {
      const written = routeInIndex(route);
      const ids = rows.get(written);
      if (ids === undefined) {
        disagree.push(`${written}: no row in docs/design-reference.md`);
        continue;
      }
      // The index names a screen and, where the set draws them, its states
      // (S2 · states S3). The route's reference is the screen itself, which
      // is the first id in the cell.
      if (ids[0] !== id) disagree.push(`${written}: index says ${ids.join("/")}, routes.ts says ${id}`);
    }
    expect(disagree, disagree.join("\n")).toEqual([]);
  });

  it("the index accounts for all twenty screens, and for the two that are not routes", () => {
    // Rule 5.5: the count is stated. Sixteen routes render fifteen screens —
    // the three legal routes share S5 — and S8 (not found) and S20 (the
    // mails) are surfaces no route enumerates, so the index carries them in
    // its own table. Twenty is the set the owner approved.
    const screens = specScreens();
    expect(screens.size).toBe(20);
    const referenced = new Set(Object.values(ROUTE_REFERENCE));
    expect(referenced.size).toBe(14);
    for (const id of ["S8", "S20"] as const) {
      expect(referenced.has(id), `${id} should not be a route's reference`).toBe(false);
      expect(index, `${id} is missing from docs/design-reference.md`).toContain(`| ${id} |`);
    }
    // Every screen the set draws is named somewhere in the index — the
    // state screens (S3, S13, S15, S17) included, which no route references
    // on its own because they are arms of the screen above them.
    const unnamed = [...screens].filter((id) => !new RegExp(`\\b${id}\\b`).test(index)).sort();
    expect(unnamed, `screens in UI-SPEC.md that the index never names: ${unnamed.join(" ")}`).toEqual(
      []
    );
  });

  it("mutation: a route with no row, and a row with no route, are both caught", () => {
    const withoutRow = ["/", "/a-screen-nobody-referenced"].filter(
      (p) => ROUTE_REFERENCE[p] === undefined
    );
    expect(withoutRow).toEqual(["/a-screen-nobody-referenced"]);
    const known = new Set(routes);
    expect(["/app", "/gone"].filter((p) => !known.has(p))).toEqual(["/gone"]);
  });
});
