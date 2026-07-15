/**
 * ONE product-resolution policy (spec 2026-07-15). `/api/scan` and the in-app add
 * MUST both ask `resolveProductScan`. They disagreed before — /api/scan
 * find-or-created while addFirstTrackedProduct always inserted — and that
 * disagreement produced nudgi.ai's incoherent state (paid dashboard over an
 * anonymous free scan). Source tripwire, same idiom as costed-routes.test.ts.
 *
 * NOTE on scope: the plan (docs/superpowers/plans/2026-07-15-add-product-onboarding.md)
 * also pins "addFirstTrackedProduct is gone" here, but that retirement is Task 6's
 * job (it deletes lib/app/add-first-product.ts and rewires
 * app/(app)/app/settings/actions.ts onto addTrackedProduct — neither is in this
 * task's file list). Asserting that now would fail for a reason outside this
 * task's scope, not because the shared-policy convergence regressed. Once Task 6
 * lands, add:
 *   it("addFirstTrackedProduct is gone (its always-insert contradicted the policy)", () => {
 *     expect(() => readFileSync(resolve(process.cwd(), "lib/app/add-first-product.ts"), "utf8")).toThrow();
 *   });
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_FILE = "app/api/scan/route.ts";
const ADD_PRODUCT_FILE = "lib/app/add-product.ts";

describe("single product-resolution policy (ratchet)", () => {
  it(`${ROUTE_FILE} resolves products through resolveProductScan`, () => {
    const src = readFileSync(resolve(process.cwd(), ROUTE_FILE), "utf8");
    expect(src, `${ROUTE_FILE} must use resolveProductScan — never its own dedupe/staleness logic`).toMatch(/resolveProductScan/);
  });

  // `lib/app/add-product.ts` is where resolveProductScan is DEFINED
  // (`export async function resolveProductScan(...)`), so a whole-file substring
  // check is vacuous by construction — the file matches /resolveProductScan/ no
  // matter what addTrackedProduct actually does; it could never detect
  // addTrackedProduct drifting back to its own inline dedupe/insert logic (the
  // exact bug this policy replaces) while resolveProductScan sits unused a few
  // lines above it.
  //
  // So this isolates addTrackedProduct's OWN function body — brace-matched, with
  // comments/strings blanked out so a stray mention can't fake a hit — and
  // asserts THAT text calls resolveProductScan(...). The definition line
  // (`export async function resolveProductScan(...)`) lives before
  // addTrackedProduct in the file and is never part of the extracted range, so
  // it cannot satisfy this on its own; nor can an import or a comment.
  it(`${ADD_PRODUCT_FILE}: addTrackedProduct's body calls resolveProductScan(...)`, () => {
    const src = readFileSync(resolve(process.cwd(), ADD_PRODUCT_FILE), "utf8");
    const body = extractFunctionBody(src, "addTrackedProduct");
    expect(
      body,
      "addTrackedProduct must call resolveProductScan(...) itself — never re-implement dedupe/staleness inline",
    ).toMatch(/resolveProductScan\s*\(/);
  });
});

// --- helpers -----------------------------------------------------------

/**
 * Blank out comments and string/template-literal contents (preserving length
 * and newlines, so indices from the original source still line up), so a
 * brace counter only ever sees real code — and a comment or string mentioning
 * a function name can never masquerade as a call site.
 */
function stripNoise(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") { out += " "; i++; }
      continue;
    }
    if (ch === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += "  ";
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += " ";
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") { out += "  "; i += 2; continue; }
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      out += " ";
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * Extract the body of a top-level `function <name>(...) { ... }` declaration
 * by brace-matching (tolerant of a return-type annotation that itself
 * contains a balanced `{...}`, e.g. `Promise<{ appId: string }>`), so the
 * result survives reordering, comments, and reformatting elsewhere in the
 * file — it only cares about this one function's own braces.
 */
function extractFunctionBody(src: string, functionName: string): string {
  const clean = stripNoise(src);
  const sigMatch = new RegExp(`function\\s+${functionName}\\s*\\(`).exec(clean);
  if (!sigMatch) throw new Error(`could not find "function ${functionName}(" in source`);

  // Walk past the parameter list (parens only — object-typed params like
  // `opts: { paid: boolean }` don't confuse this since braces are ignored here).
  let i = sigMatch.index + sigMatch[0].length;
  let parenDepth = 1;
  while (i < clean.length && parenDepth > 0) {
    if (clean[i] === "(") parenDepth++;
    else if (clean[i] === ")") parenDepth--;
    i++;
  }

  // Walk past an optional return-type annotation to the body's opening brace.
  // Track angle-bracket depth so a brace inside `Promise<{ ... }>` isn't
  // mistaken for the body start.
  let angleDepth = 0;
  let bodyStart = -1;
  while (i < clean.length) {
    if (clean[i] === "<") angleDepth++;
    else if (clean[i] === ">") angleDepth = Math.max(0, angleDepth - 1);
    else if (clean[i] === "{" && angleDepth === 0) { bodyStart = i; break; }
    i++;
  }
  if (bodyStart === -1) throw new Error(`could not find body of ${functionName}`);

  let depth = 0;
  let j = bodyStart;
  for (; j < clean.length; j++) {
    if (clean[j] === "{") depth++;
    else if (clean[j] === "}") {
      depth--;
      if (depth === 0) { j++; break; }
    }
  }
  return clean.slice(bodyStart, j);
}
