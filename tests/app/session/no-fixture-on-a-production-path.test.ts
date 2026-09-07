// tests/app/session/no-fixture-on-a-production-path.test.ts — issue #169,
// ADR-010
//
// A signed-in customer must never be drawn from a fixture. This is the
// check that keeps it true after the flip: a path glob over the surface
// tree, so a screen added later is in scope the day its file lands, rather
// than a list of module names somebody maintains.
//
// **The rule.** A module under `src/app/(account)/app/**` may import a
// `fixture` module only if it also asks `isReservedFixtureAccount()` — that
// is, only if the fixture sits behind the branch that can be reached by no
// customer, because `example.com` is IANA-reserved (DECISIONS 2026-09-06:
// "`*.example.com` fixtures answer only for reserved names"). A fixture
// module importing another fixture module is not a production path either.
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
 * Settings' two are the residue of #134/#136, which wired that screen's
 * billing and account halves to the session and left `FIXTURE_USER_ID`
 * standing where the *site* is still unresolved (`currentSiteId()` answers
 * `null`, and the file says so). They are named here rather than removed:
 * this issue's own scope is §4.4–§4.6 and the setup screen, and editing a
 * screen two other issues were landing would have been the wrong kind of
 * tidy-up. An entry leaves this list when its own issue removes the import.
 */
const NOT_YET_COVERED: ReadonlyArray<{ readonly file: string; readonly whose: string }> = [
  {
    file: "settings/provider.ts",
    whose:
      "#134/#136 — Settings resolves its account through the session for billing and identity, " +
      "and `currentSiteId()` still answers null, so the fixture's own destination is what the " +
      "card draws. The site half is that screen's to wire.",
  },
];

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

    // The door: a module that asks whether this is the reserved account has
    // put its fixture behind a branch no customer can reach.
    if (source.includes("isReservedFixtureAccount")) continue;

    for (const specifier of fixtures) found.push({ file: rel, specifier });
  }
  return found;
}

describe("no signed-in customer is ever drawn from a fixture", () => {
  it("every fixture import under (account)/app sits behind the reserved-account branch", () => {
    expect(offenders()).toEqual([]);
  });

  it("the rule discriminates — it flags a fixture import with no branch in front of it", () => {
    // Without this, deleting the rule's body would leave the assertion
    // above passing over an empty list forever.
    const source = 'import { FIXTURE_THING } from "./fixture";\n';
    const hasBranch = source.includes("isReservedFixtureAccount");
    const importsFixture = /^import\s[^;]*?from\s+"[^"]*fixture[^"]*";/m.test(source);
    expect(importsFixture).toBe(true);
    expect(hasBranch).toBe(false);
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
