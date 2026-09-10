// tests/setup.ts
//
// Global test setup, in two halves.
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
// rendering `src/app/layout.tsx`, say — the export is simply not a
// function. So the loader is stubbed here, once, rather than in each of the
// test files that reach the root layout: the stub is about the *toolchain*,
// not about any one test's subject, and a suite added tomorrow that renders
// a document should not have to rediscover this. What the fonts themselves
// promise is asserted where it can be: `tests/ui/fonts.test.ts` reads the
// declarations out of `fonts.ts` and holds them against the vendor
// stylesheets, and `tests/ui/layout/vitals.test.ts` reads the emitted
// preload links off the built app in a real browser.
import http from "node:http";
import https from "node:https";
import { vi } from "vitest";

vi.mock("next/font/local", () => ({
  default: () => ({ className: "", style: {}, variable: "" }),
}));

function refuse(via: string): never {
  throw new Error(
    `tests/setup.ts: a test attempted a real network call via ${via}. ` +
      "No test in this corpus may reach a vendor — mock the call explicitly."
  );
}

globalThis.fetch = (() => refuse("fetch()")) as unknown as typeof fetch;

for (const [mod, name] of [
  [http, "http"],
  [https, "https"],
] as const) {
  mod.request = (() => refuse(`${name}.request()`)) as unknown as typeof mod.request;
  mod.get = (() => refuse(`${name}.get()`)) as unknown as typeof mod.get;
}
