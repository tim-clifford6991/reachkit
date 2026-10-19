// tests/setup.ts
//
// Global test setup, in three halves.
//
// **One:** fails the run if a test process would make a real network call,
// so no test in this corpus can silently reach a vendor. A test that needs
// network-shaped behaviour mocks it explicitly (e.g.
// `vi.stubGlobal('fetch', vi.fn(...))`), which runs after this file and so
// overrides it for that test.
//
// **Two (issue #332):** stands in for `next/font/local`, which has no
// runtime. `src/ui/fonts.ts` loads both families through it, and the
// package ships an empty `index.js` on purpose: the call is erased at build
// by Next's own font transform, which emits the `@font-face` CSS and the
// preload links in its place. Imported by anything else — a vitest worker
// rendering `src/app/_root/document.tsx`, say — the export is simply not a
// function. So the loader is stubbed here, once, rather than in each of the
// test files that reach the root layout: the stub is about the *toolchain*,
// not about any one test's subject, and a suite added tomorrow that renders
// a document should not have to rediscover this. What the fonts themselves
// promise is asserted where it can be: `tests/ui/fonts.test.ts` reads the
// declarations out of `fonts.ts` and holds them against the vendor
// stylesheets, and `tests/ui/layout/vitals.test.ts` reads the emitted
// preload links off the built app in a real browser.
//
// **Three (issue 932):** stands in for the two measurement APIs jsdom does
// not implement on `Range`. CodeMirror 6 — the draft editor's field, on
// `docs/DESIGN.md`'s allow-list — measures a line by taking a `Range` over
// its text and asking for its rectangles, and jsdom's `Range` has neither
// `getClientRects` nor `getBoundingClientRect`, so the measure phase throws
// `textRange(...).getClientRects is not a function` from inside a
// `requestAnimationFrame` callback where no test can catch it.
//
// Zero rectangles is the honest answer here rather than a convenient one:
// jsdom has no layout, so every box in it *is* zero — `tests/ui/layout`'s
// own header makes the same point about why the no-overflow checks cannot
// run in this environment and need a real browser. What the stub buys is
// that a component which measures can be mounted and its markup asserted;
// what it is measured at stays the layout suite's business.
//
// Guarded on `Range` existing, because the `node` project has no DOM at all
// until a file asks for one with `@vitest-environment jsdom`.
import { vi } from "vitest";
import { refuseNetwork } from "../src/lib/egress/offline";
import { registerSiteLocaleStore } from "../src/lib/locale/site";

vi.mock("next/font/local", () => ({
  default: () => ({ className: "", style: {}, variable: "" }),
}));

refuseNetwork("tests/setup.ts", "No test in this corpus may reach a vendor — mock the call explicitly.");

if (typeof Range !== "undefined") {
  const zeroRect = (): DOMRect =>
    ({
      x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  Range.prototype.getClientRects ??= function getClientRects(): DOMRectList {
    const list = [] as unknown as DOMRectList;
    return list;
  };
  Range.prototype.getBoundingClientRect ??= zeroRect;
}

// SPEC §6, D66 (issue 1311): a site's country and language are a row of the
// database, and no test in this corpus has one. Every suite starts with a
// store that holds what it was last told for a site and nothing else, so a
// site nobody has read is the United States in English, as before D66. A
// suite about the stored locale writes to it; the `db` project's own put
// the real row back with `registerSiteLocaleStore(null)`.
{
  const held = new Map<string, { country: unknown; language: unknown }>();
  registerSiteLocaleStore({
    read: async (siteId) => held.get(siteId) ?? null,
    write: async (siteId, locale) => {
      held.set(siteId, locale);
    },
  });
}
