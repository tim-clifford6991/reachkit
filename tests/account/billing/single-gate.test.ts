// tests/account/billing/single-gate.test.ts — ADR-050 point 3
//
// **One implementation of the gate, made enforceable.**
//
// `eslint.config.mjs`'s `no-billing-internal-import` fence is ADR-050's
// *lintable* half: nothing outside `src/lib/account/billing/**` may import a
// file under it, so `users.paid_through`'s reader is unreachable from
// elsewhere. A fence catches an import. It cannot catch "computes no access
// predicate of its own", which is a behavioural invariant and not a lexical
// one — a job that read `paid_through` through its own query and compared it
// to `Date.now()` would import nothing at all.
//
// So this suite reads the source of every module that consults the gate and
// asserts that none of them names the three columns the gate is made of.
// **It is not replaced by the lint rule.** BP-001's own words: "The test
// stays ADR-050's; the import fence is this file's." Deleting it because
// the rule exists would leave a check that looks like it holds and does not.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "../../../src");

/** Every tree that asks whether a site has access, or could. BP-003's jobs,
 *  BP-012's scan, BP-015's publishing, and the account tree outside billing
 *  itself. */
const CONSULTING_TREES = ["jobs", "lib/scan", "lib/publish", "lib/account"] as const;

/** The three columns the gate is made of. A file outside the billing module
 *  that names one of them is either re-implementing the gate or reading a
 *  column that is not its to read. */
const GATE_COLUMNS = ["paid_through", "plan_status", "cancelled_at"] as const;

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const BILLING = path.join(SRC, "lib/account/billing");

const CONSULTING_FILES = CONSULTING_TREES.flatMap((tree) =>
  filesUnder(path.join(SRC, tree)).filter((file) => !file.startsWith(BILLING))
);

/** Comments are where the invariant is *explained*, and a file explaining it
 *  must not fail the test that enforces it. Only code is read. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

describe("ADR-050 point 3 — no other module computes an access predicate", () => {
  it("the consulting trees exist and are not empty (the test would pass vacuously otherwise)", () => {
    expect(CONSULTING_FILES.length).toBeGreaterThan(10);
  });

  it("no file outside src/lib/account/billing names paid_through, plan_status or cancelled_at", () => {
    const offenders: string[] = [];
    for (const file of CONSULTING_FILES) {
      const source = code(fs.readFileSync(file, "utf8"));
      for (const column of GATE_COLUMNS) {
        if (source.includes(column)) {
          offenders.push(`${path.relative(SRC, file)} names ${column}`);
        }
      }
    }
    // `src/lib/account/store.ts` writes `plan_status` at the insert that
    // opens an account (§13's "upsert user"), which is a write of a record
    // and not a read of a gate. It is the one file allowed to name a gate
    // column, and it is named here so that a second one is a failure.
    expect(offenders).toEqual(["lib/account/store.ts names plan_status"]);
  });

  it("only the billing module implements the gate", () => {
    const implementations = filesUnder(SRC).filter((file) =>
      /export\s+(async\s+)?function\s+hasActiveAccess/.test(fs.readFileSync(file, "utf8"))
    );
    expect(implementations.map((f) => path.relative(SRC, f))).toEqual([
      "lib/account/billing/gate.ts",
    ]);
  });
});

describe("REQ-076 c5 — a lapsed customer can still sign in", () => {
  it("the magic-link module imports no billing symbol", () => {
    // BP-060: "`requestMagicLink` does not consult this node, by design and
    // by test." A customer whose access has ended is still sent a link, and
    // signing in still works — Settings is where they resume from.
    const magicLink = fs.readFileSync(
      path.join(SRC, "lib/account/provisioning/magic-link.ts"),
      "utf8"
    );
    expect(magicLink).not.toMatch(/from\s+"[^"]*account\/billing/);
    expect(magicLink).not.toContain("hasActiveAccess");
  });

  it("nothing on the sign-in path consults the gate", () => {
    const signInFiles = [
      "lib/account/provisioning/magic-link.ts",
      "lib/account/provisioning/sign-in-link.ts",
      "lib/account/provisioning/sign-in-mail.ts",
    ];
    for (const relative of signInFiles) {
      const source = fs.readFileSync(path.join(SRC, relative), "utf8");
      expect(source, relative).not.toContain("hasActiveAccess");
    }
  });
});
