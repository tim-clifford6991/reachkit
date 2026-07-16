/**
 * Self-test for the tripwire helper (lib/testing/tripwire.ts).
 *
 * This is the test that matters most: it proves the helper actually REFUSES
 * the vacuum that shipped on this branch (see app/api/add-product-policy.test.ts's
 * header) rather than just being "cleaner code that happens to work". Every
 * case here is chosen to mirror a concrete failure this helper must catch:
 *  - asserting a symbol against the file that DEFINES it (whole-file, no
 *    `within`) is vacuous by construction — must throw, not silently pass.
 *  - a genuine call scoped by `within` must pass (using a REAL repo file, so
 *    this stays honest rather than testing against a hand-picked fixture).
 *  - the exact false negative that shipped: import present, call removed —
 *    must FAIL, not pass.
 *  - a comment or string mentioning the symbol must never satisfy the check.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expectCallsSymbol } from "./tripwire";

// `expectCallsSymbol` resolves its `relPath` via `resolve(process.cwd(), relPath)`,
// and `path.resolve` returns an absolute second argument unchanged — so an
// absolute temp-file path works as `relPath` without polluting the repo with
// fixture files, while still exercising the real readFileSync code path (not a
// mock).
const dirs: string[] = [];
function fixtureFile(contents: string, name = "fixture.ts"): string {
  const dir = mkdtempSync(join(tmpdir(), "tripwire-test-"));
  dirs.push(dir);
  const path = join(dir, name);
  writeFileSync(path, contents, "utf8");
  return path;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("expectCallsSymbol — refuses the vacuum", () => {
  it('throws a "vacuous"-style error when the target file DEFINES the symbol and no `within` is given', () => {
    // Real repo file: lib/app/add-product.ts DEFINES resolveProductScan
    // (`export async function resolveProductScan(...)`). A whole-file check
    // here would be vacuous by construction — the definition line alone
    // would satisfy a bare `resolveProductScan(` match.
    expect(() => expectCallsSymbol("lib/app/add-product.ts", "resolveProductScan")).toThrowError(/vacuous/i);
  });

  it("passes for a genuine call scoped by `within` (real repo file)", () => {
    // addTrackedProduct's own body really does call resolveProductScan(...).
    expect(() => expectCallsSymbol("lib/app/add-product.ts", "resolveProductScan", { within: "addTrackedProduct" })).not.toThrow();
  });

  it("FAILS when the call is absent but the import remains — the exact false negative that shipped", () => {
    const path = fixtureFile(`
import { resolveProductScan } from "@/lib/app/add-product";

export async function POST(req: Request) {
  // resolveProductScan used to be called here; now it isn't, but the
  // import above is still present. A whole-file substring match on
  // /resolveProductScan/ would wrongly pass this — that's Finding 4.
  const plan = { kind: "fresh" as const };
  return new Response(JSON.stringify(plan));
}
`);
    expect(() => expectCallsSymbol(path, "resolveProductScan", { within: "POST" })).toThrowError(/resolveProductScan/);
  });

  it("a comment or string mentioning the symbol does NOT satisfy the check", () => {
    const path = fixtureFile(`
// This function should call doTheThing() but doesn't, yet.
const note = "doTheThing() is mentioned right here in a string";
const template = \`doTheThing() also mentioned in a template literal\`;

export function handler() {
  return note + template;
}
`);
    expect(() => expectCallsSymbol(path, "doTheThing", { within: "handler" })).toThrowError(/doTheThing/);
  });

  it("a real call inside the scoped function DOES satisfy the check (fixture positive control)", () => {
    const path = fixtureFile(`
import { doTheThing } from "./somewhere";

export function handler() {
  return doTheThing();
}
`);
    expect(() => expectCallsSymbol(path, "doTheThing", { within: "handler" })).not.toThrow();
  });

  it("an import alone (no call anywhere) does not satisfy a whole-file check either", () => {
    const path = fixtureFile(`
import { doTheThing } from "./somewhere";

export function handler() {
  return null;
}
`);
    // No `within` here — doTheThing is not DEFINED in this file (only
    // imported), so this isn't the vacuous case; it should reach the real
    // call-assertion and fail because there's no call, only an import.
    expect(() => expectCallsSymbol(path, "doTheThing")).toThrowError(/doTheThing/);
  });
});
