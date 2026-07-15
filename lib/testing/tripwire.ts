/**
 * Shared source-tripwire helper.
 *
 * ReachKit enforces several invariants with "source tripwires" — tests that
 * read a source file and assert it calls a required symbol, rather than
 * exercising behaviour (see app/api/costed-routes.test.ts,
 * app/api/entitlement-gates.test.ts, app/api/no-scan-ejection.test.ts,
 * app/api/add-product-policy.test.ts). Hand-rolling that check produced a real
 * defect on this branch: `app/api/add-product-policy.test.ts` asserted
 * "lib/app/add-product.ts uses resolveProductScan" with a whole-file substring
 * match — vacuous by construction, because that file also DEFINES
 * `resolveProductScan`, so the assertion is true no matter what the caller
 * (`addTrackedProduct`) actually does. Mutation-proved: deleting the real call
 * from `app/api/scan/route.ts`'s POST handler and leaving only the import
 * still passed the old check 3/3.
 *
 * `expectCallsSymbol` makes that vacuum structurally impossible rather than
 * merely discouraged:
 *  - comments and string/template-literal contents are blanked before any
 *    matching, so a mention in prose or a string literal can never satisfy it;
 *  - if the target file DEFINES the symbol and no `within` is given, it
 *    THROWS instead of silently checking the whole file (a whole-file check
 *    against a file that defines the symbol is true by construction — the
 *    definition line alone would match);
 *  - `within: "fnName"` scopes the assertion to that one function's own body
 *    (brace-matched), which by construction excludes any definition sitting
 *    elsewhere in the file, so the vacuous case cannot recur;
 *  - the assertion itself requires a real CALL (`symbol(` with optional
 *    whitespace) — an `import { symbol }` line has no call parens after
 *    blanking, so it can never satisfy this on its own.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ExpectCallsSymbolOptions {
  /**
   * Restrict the assertion to this function's own body (top-level
   * `function fnName(...) { ... }`, brace-matched — tolerant of a
   * `export`/`async` prefix and of a return-type annotation containing its
   * own balanced braces, e.g. `Promise<{ appId: string }>`).
   *
   * Required whenever `relPath` itself DEFINES `symbol` — otherwise the
   * definition line would satisfy a whole-file check on its own, which is
   * exactly the vacuum this helper exists to refuse.
   */
  within?: string;
}

/**
 * Assert that `relPath` really CALLS `symbol(...)` — not merely imports it,
 * mentions it in a comment/string, or (absent `within`) defines it.
 *
 * Call this directly inside a `describe`/`it` block: it throws (with a
 * message naming the file, the symbol, and what to do) when the assertion
 * fails, which fails the enclosing test the same way `expect(...).toMatch(...)`
 * would.
 */
export function expectCallsSymbol(relPath: string, symbol: string, opts: ExpectCallsSymbolOptions = {}): void {
  const src = readFileSync(resolve(process.cwd(), relPath), "utf8");
  const clean = stripNoise(src);

  let scope: string;
  let scopeDescription: string;
  if (opts.within) {
    scope = extractFunctionBody(clean, opts.within, relPath);
    scopeDescription = `${opts.within}'s body (in ${relPath})`;
  } else {
    if (definesSymbol(clean, symbol)) {
      throw new Error(
        `expectCallsSymbol("${relPath}", "${symbol}"): this file DEFINES ${symbol}, so a whole-file ` +
          `check is vacuous by construction — the definition line alone would satisfy it regardless of ` +
          `what any caller actually does. Scope the assertion to the real caller with ` +
          `{ within: "callerFnName" } instead.`,
      );
    }
    scope = clean;
    scopeDescription = relPath;
  }

  const callPattern = new RegExp(`\\b${escapeRegExp(symbol)}\\s*\\(`);
  if (!callPattern.test(scope)) {
    throw new Error(
      `expectCallsSymbol("${relPath}", "${symbol}"): expected ${scopeDescription} to CALL ${symbol}(...) ` +
        `— found no such call. An import, a comment, or a string mentioning "${symbol}" does not count.`,
    );
  }
}

// --- internals -----------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True if `clean` (already noise-stripped) DEFINES `symbol` in one of the
 * forms this codebase actually uses: `function S(`, `async function S(`,
 * `export function S(`, `export async function S(` (all covered by the same
 * `function\s+S\s*\(` pattern — `async`/`export` are just prefixes before the
 * `function` keyword), `const S =`, `let S =`, `class S`.
 */
function definesSymbol(clean: string, symbol: string): boolean {
  const s = escapeRegExp(symbol);
  const patterns = [
    new RegExp(`\\bfunction\\s+${s}\\s*\\(`),
    new RegExp(`\\b(?:export\\s+)?const\\s+${s}\\s*=`),
    new RegExp(`\\b(?:export\\s+)?let\\s+${s}\\s*=`),
    new RegExp(`\\b(?:export\\s+)?class\\s+${s}\\b`),
  ];
  return patterns.some((p) => p.test(clean));
}

/**
 * Blank out comments and string/template-literal contents (preserving length
 * and newlines, so indices from the original source still line up), so a
 * brace counter only ever sees real code — and a comment or string mentioning
 * a function/symbol name can never masquerade as a call site.
 */
export function stripNoise(src: string): string {
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
 * file — it only cares about this one function's own braces. `src` must
 * already be noise-stripped (see `stripNoise`).
 */
export function extractFunctionBody(src: string, functionName: string, relPathForErrors = "<source>"): string {
  const sigMatch = new RegExp(`function\\s+${escapeRegExp(functionName)}\\s*\\(`).exec(src);
  if (!sigMatch) {
    throw new Error(
      `expectCallsSymbol: could not find "function ${functionName}(" in ${relPathForErrors} — ` +
        `\`within\` only matches a top-level "function <name>(...) { ... }" declaration ` +
        `(export/async prefixes are fine).`,
    );
  }

  // Walk past the parameter list (parens only — object-typed params like
  // `opts: { paid: boolean }` don't confuse this since braces are ignored here).
  let i = sigMatch.index + sigMatch[0].length;
  let parenDepth = 1;
  while (i < src.length && parenDepth > 0) {
    if (src[i] === "(") parenDepth++;
    else if (src[i] === ")") parenDepth--;
    i++;
  }

  // Walk past an optional return-type annotation to the body's opening brace.
  // Track angle-bracket depth so a brace inside `Promise<{ ... }>` isn't
  // mistaken for the body start.
  let angleDepth = 0;
  let bodyStart = -1;
  while (i < src.length) {
    if (src[i] === "<") angleDepth++;
    else if (src[i] === ">") angleDepth = Math.max(0, angleDepth - 1);
    else if (src[i] === "{" && angleDepth === 0) { bodyStart = i; break; }
    i++;
  }
  if (bodyStart === -1) {
    throw new Error(`expectCallsSymbol: could not find the body of ${functionName} in ${relPathForErrors}`);
  }

  let depth = 0;
  let j = bodyStart;
  for (; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) { j++; break; }
    }
  }
  return src.slice(bodyStart, j);
}
