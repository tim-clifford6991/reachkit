// tests/app/session/no-fixture-on-a-production-path.test.ts — issue #169,
// ADR-010
//
// A signed-in customer must never be drawn from a fixture. This is the
// check that keeps it true after the flip: a path glob over the surface
// tree, so a screen added later is in scope the day its file lands, rather
// than a list of module names somebody maintains.
//
// **The rule.** A module under `src/app/(account)/app/**` may import a
// `fixture` module through one of exactly two doors, and no other:
//
//  1. it asks `isReservedFixtureAccount()` — the fixture sits behind a
//     branch no customer can reach, because `example.com` is IANA-reserved
//     (DECISIONS 2026-09-06: "`*.example.com` fixtures answer only for
//     reserved names"); or
//  2. it imports **its own** `./fixture` for facts, and takes its *account*
//     from the session seam (`_session/account`) — the degraded state
//     REQ-097 c5 designs, where a read that could not be made falls to a
//     shape rather than throwing the screen away. Nothing it then states is
//     stale, because nothing it states came from a vendor.
//
// The second door is narrow on purpose: what the first version of this rule
// caught was `settings/provider.ts` importing *setup's* `FIXTURE_USER_ID` —
// another surface's fixture *identity*, which is how a signed-in customer
// got drawn as somebody else. An own-directory fixture supplying only facts
// to a module whose identity comes from the session is a different thing,
// and #42 is where the difference became worth stating.
//
// **A fixture that is merged is not behind either door** (#228). Settings'
// `readSettings` passed door 1 for five months while still opening with
// `{ ...FIXTURE_SETTINGS_FACTS, ...(four live overrides) }`, so the branch
// the rule was reading was real and nine of the facts under it were the
// fixture's — the customer's mode, veto window, publish time, zone,
// publishing switch, voice, do-not-claim list, notification switches and
// page count. An import check cannot see that; a spread check can. So a
// binding imported from a fixture module may be *passed whole* (that is
// what door 1 is for) and may never be spread into another object.
//
// A fixture module importing another fixture module is not a production
// path either.
//
// **The allow-list is data, one entry one reason** — the same idiom
// `tests/presentation/copy/allowlist.ts` uses, and for the same reason: a
// blanket exemption would swallow the next one silently, and an entry
// somebody has to write is one a reviewer can see.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const APP = path.join(ROOT, "src/app/(account)/app");

/**
 * The imports this rule does not yet cover, each naming whose they are.
 *
 * **Empty since #42, and it stays empty.** `settings/provider.ts` was the
 * last entry: it carried a fixture user id because nothing resolved the
 * site under the account, and #42 resolved it through the same
 * `_session/account.ts` seam every other `(account)` surface uses. The
 * list stays — it is the shape a future gap gets named in — and the row
 * below fails on any entry whose file has stopped offending, which is what
 * took both of its members out.
 */
const NOT_YET_COVERED: ReadonlyArray<{ readonly file: string; readonly whose: string }> = [];

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
}

interface Offender {
  file: string;
  specifier: string;
}

interface Spread {
  file: string;
  binding: string;
}

const IMPORTS = /^import\s[^;]*?from\s+"([^"]+)";/gm;

/** The names an `import { a, b as c } from "..."` statement binds. A
 *  default or namespace import binds one name the same way. */
function bindingsOf(statement: string): string[] {
  const braced = /\{([^}]*)\}/.exec(statement);
  if (braced === null) {
    const bare = /^import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s+from/.exec(statement);
    return bare?.[1] !== undefined ? [bare[1]] : [];
  }
  return (braced[1] ?? "")
    .split(",")
    .map((part) => (part.includes(" as ") ? part.split(" as ")[1] : part) ?? "")
    .map((name) => name.trim())
    .filter((name) => name.length > 0 && name !== "type");
}

/**
 * Every binding a non-fixture module imports from a fixture module and then
 * *spreads*.
 *
 * A fixture may be the whole answer behind the reserved-account branch. It
 * may not be the base of an object the live path then overrides part of:
 * that is a screen that reads as wired, whose unoverridden facts are still
 * the fixture's, and it is what #228 was opened for. Local stubs are not in
 * scope — `settings/actions.ts` spreads its own `FIXTURE_ACTIONS`, which is
 * a table of *actions* it declares itself, reaches no store and answers
 * every unwired key with the issue that wires it.
 */
function spreads(): Spread[] {
  const files: string[] = [];
  walk(APP, files);
  const found: Spread[] = [];

  for (const file of files.sort()) {
    const rel = path.relative(APP, file).split(path.sep).join("/");
    if (/(^|\/)fixture\.ts$/.test(rel)) continue;

    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORTS)) {
      if (!/fixture/i.test(match[1] ?? "")) continue;
      for (const binding of bindingsOf(match[0])) {
        if (new RegExp(`\\.\\.\\.\\s*${binding}\\b`).test(source)) {
          found.push({ file: rel, binding });
        }
      }
    }
  }
  return found;
}

/** Every `import ... from "...fixture..."` under the app tree that is not
 *  behind the reserved-account branch. */
function offenders(): Offender[] {
  const files: string[] = [];
  walk(APP, files);
  const exempt = new Set(NOT_YET_COVERED.map((entry) => entry.file));
  const found: Offender[] = [];

  for (const file of files.sort()) {
    const rel = path.relative(APP, file).split(path.sep).join("/");
    // A fixture module is not a production path, and its own imports are
    // not either.
    if (/(^|\/)fixture\.ts$/.test(rel)) continue;
    if (exempt.has(rel)) continue;

    const source = readFileSync(file, "utf8");
    const imports = [...source.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gm)].map((m) => m[1] ?? "");
    const fixtures = imports.filter((specifier) => /fixture/i.test(specifier));
    if (fixtures.length === 0) continue;

    // Door 1: a module that asks whether this is the reserved account has
    // put its fixture behind a branch no customer can reach.
    if (source.includes("isReservedFixtureAccount")) continue;

    // Door 2: its own `./fixture`, for facts, in a module that takes its
    // account from the session seam. An import of any *other* module's
    // fixture is a violation whatever else the file does — that is the
    // identity leak this rule exists for.
    const ownFixtureOnly = fixtures.every((specifier) => specifier === "./fixture");
    if (ownFixtureOnly && source.includes("_session/account")) continue;

    for (const specifier of fixtures) found.push({ file: rel, specifier });
  }
  return found;
}

describe("no signed-in customer is ever drawn from a fixture", () => {
  it("every fixture import under (account)/app sits behind the reserved-account branch", () => {
    expect(offenders()).toEqual([]);
  });

  it("and no module merges one into the facts it states (#228)", () => {
    // The import check above passed on `settings/provider.ts` throughout
    // #134, #136 and #42 while nine of the screen's facts were still the
    // fixture's, because the file did ask `isReservedFixtureAccount` — and
    // then spread the fixture anyway.
    expect(spreads()).toEqual([]);
  });

  it("the spread rule discriminates — it sees a merged fixture, and leaves a local stub alone", () => {
    // Without these two, an empty result above would prove nothing.
    const merged =
      'import { FIXTURE_SETTINGS_FACTS } from "./fixture";\n' +
      "const facts = { ...FIXTURE_SETTINGS_FACTS, billing };\n";
    const imported = [...merged.matchAll(IMPORTS)].filter((m) => /fixture/i.test(m[1] ?? ""));
    expect(imported.length).toBe(1);
    const bindings = bindingsOf(imported[0]![0]);
    expect(bindings).toEqual(["FIXTURE_SETTINGS_FACTS"]);
    expect(new RegExp(`\\.\\.\\.\\s*${bindings[0]}\\b`).test(merged)).toBe(true);

    // A stub the module declares itself is not imported from a fixture
    // module, so it is not this rule's business.
    const local = "const FIXTURE_ACTIONS = {};\nexport const A = { ...FIXTURE_ACTIONS, cancel };\n";
    expect([...local.matchAll(IMPORTS)].length).toBe(0);
  });

  it("the rule discriminates — neither door opens for a bare fixture import", () => {
    // Without this, deleting the rule's body would leave the assertion
    // above passing over an empty list forever.
    const source = 'import { FIXTURE_THING } from "./fixture";\n';
    expect(/^import\s[^;]*?from\s+"[^"]*fixture[^"]*";/m.test(source)).toBe(true);
    expect(source.includes("isReservedFixtureAccount")).toBe(false);
    expect(source.includes("_session/account")).toBe(false);
  });

  it("door 2 does not open for another surface's fixture, however the module resolves its account", () => {
    // The leak the rule was written for: `settings/provider.ts` reading
    // *setup's* `FIXTURE_USER_ID`. Session-resolved identity does not
    // excuse importing somebody else's fixture.
    const source =
      'import { FIXTURE_USER_ID } from "../../setup/_setup/fixture";\n' +
      'import { appAccount } from "../_session/account";\n';
    const specifiers = [...source.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gm)].map(
      (m) => m[1] ?? ""
    );
    const fixtures = specifiers.filter((s) => /fixture/i.test(s));
    expect(fixtures.every((s) => s === "./fixture")).toBe(false);
  });

  it("the app tree is actually walked — a rule over nothing is not a rule", () => {
    const files: string[] = [];
    walk(APP, files);
    expect(files.length).toBeGreaterThan(30);
  });

  it("every entry not yet covered names whose it is, and still actually offends", () => {
    // A stale exemption is worse than none: it reads as a rule with a
    // known gap while the gap has already closed. `settings/billing-actions.ts`
    // left this list when #134 landed, and it left because this row fails
    // on an entry that no longer imports a fixture.
    for (const entry of NOT_YET_COVERED) {
      expect(entry.whose.length, entry.file).toBeGreaterThan(0);
      const full = path.join(APP, entry.file);
      expect(() => statSync(full), entry.file).not.toThrow();
      const source = readFileSync(full, "utf8");
      const importsFixture = [...source.matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gm)].some(
        (m) => /fixture/i.test(m[1] ?? "")
      );
      expect(importsFixture, `${entry.file} no longer imports a fixture — drop its entry`).toBe(
        true
      );
      expect(source.includes("isReservedFixtureAccount"), entry.file).toBe(false);
    }
  });
});

describe("the `#35 stand-in` headers are gone", () => {
  it("no module under (account)/app still says its account is issue #35's", () => {
    const files: string[] = [];
    walk(APP, files);
    const standing = files
      .filter((file) => /#35 stand-in/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(APP, file));
    expect(standing).toEqual([]);
  });

  it("no module under (account)/app still defers naming the account to a later issue", () => {
    const files: string[] = [];
    walk(APP, files);
    const exempt = new Set(NOT_YET_COVERED.map((entry) => entry.file));
    const deferring = files
      .filter((file) => !exempt.has(path.relative(APP, file).split(path.sep).join("/")))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        // The sentence every one of these files carried: which account it
        // is, is #35's, "which does not exist yet".
        return /currentSession\(\)[^.]{0,80}does not exist yet/s.test(source);
      })
      .map((file) => path.relative(APP, file));
    expect(deferring).toEqual([]);
  });
});
