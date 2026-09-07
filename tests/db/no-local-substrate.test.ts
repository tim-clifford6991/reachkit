// tests/db/no-local-substrate.test.ts — issue #224
//
// One home for the substrate facts, kept one home.
//
// #221 gave every run its own database and left nineteen suites each
// carrying their own copy of how to reach it — the host, the port, the
// role, the password, `REACHKIT_DB_NAME ?? "reachkit_scratch"`,
// `SUPABASE_URL ?? "http://127.0.0.1:3001"`, a hand-rolled signer and a
// `psql` wrapper. `tests/db/substrate.ts` is that home now, and this file
// is what stops the twentieth copy: a suite that declares its own is how a
// run ends up talking to a database it does not own, which is the whole
// defect #220 had just finished closing.
//
// **Scoped by path glob, not by a list** (ADR-010's idiom): the sweep walks
// `tests/**` and decides from what it finds, so a live-schema suite added
// tomorrow is in scope the day it lands and cannot be forgotten out of an
// enumeration nobody re-reads.
//
// **This runs in the `node` project and touches no database** — it reads
// files. It is deliberately *not* a live-schema suite: a rule about how the
// suites are written should not need the substrate up to be checked.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const TESTS_ROOT = path.resolve(import.meta.dirname, "..");
const SUBSTRATE = path.join(TESTS_ROOT, "db/substrate.ts");

/** Every `.ts` under `tests/`, the one home itself excepted. */
function testFiles(dir = TESTS_ROOT): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...testFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".ts") && full !== SUBSTRATE) out.push(full);
  }
  return out;
}

const FILES = testFiles().map((file) => ({ file, rel: path.relative(TESTS_ROOT, file), source: readFileSync(file, "utf8") }));

/**
 * The declarations that must have exactly one home, as the patterns that
 * find a *declaration* rather than a use. Each is written the way the
 * nineteen wrote it, because a copy is made by copying.
 *
 * `DATABASE_URL` and `SUPABASE_URL` are deliberately absent: several
 * suites that reach no database at all build an `ENV_FIXTURE` naming a
 * plausible connection string only to satisfy `env.ts`'s schema. Those are
 * fakes, not a route to the substrate, and tying them to the run's real
 * database name would make a fixture depend on something it must not.
 */
const FORBIDDEN: readonly { what: string; pattern: RegExp }[] = [
  { what: "the substrate host", pattern: /^const DB_HOST\s*=/m },
  { what: "the substrate port", pattern: /^const DB_PORT\s*=/m },
  { what: "the substrate role", pattern: /^const DB_USER\s*=/m },
  { what: "the substrate password", pattern: /^const DB_PASSWORD\s*=/m },
  { what: "this run's database name", pattern: /^const DB_NAME\s*=/m },
  { what: "the JWT secret PostgREST verifies against", pattern: /^const JWT_SECRET\s*=/m },
  { what: "a `psql` wrapper", pattern: /^function psql\s*\(/m },
  { what: "a `psqlRows` wrapper", pattern: /^function psqlRows\s*\(/m },
  { what: "a JWT signer", pattern: /^function signJwt\s*\(/m },
];

describe("the substrate constants have one home (issue #224)", () => {
  it("no suite declares its own copy of any of them", () => {
    const offenders: string[] = [];
    for (const { rel, source } of FILES) {
      for (const { what, pattern } of FORBIDDEN) {
        if (pattern.test(source)) offenders.push(`${rel} declares ${what}`);
      }
    }
    // Named, not counted: a failure has to say which file and which fact,
    // or the next person has to go and find out.
    expect(offenders).toEqual([]);
  });

  it("no suite re-reads the environment for the run's database or its REST URL", () => {
    // `substrate.ts` reads both once, at import. A suite reading them again
    // would be reading a value that module has already decided — and would
    // quietly disagree with it if the fallbacks ever changed.
    const offenders: string[] = [];
    for (const { rel, source } of FILES) {
      if (/process\.env\.REACHKIT_DB_NAME/.test(source)) offenders.push(`${rel} re-reads REACHKIT_DB_NAME`);
      if (/process\.env\.SUPABASE_URL\s*\?\?/.test(source)) offenders.push(`${rel} re-reads SUPABASE_URL with its own fallback`);
    }
    expect(offenders).toEqual([]);
  });

  it("the sweep actually swept — it walks the tree rather than a list nobody re-reads", () => {
    // Rule 5.5: a green sweep over nothing is a pass that means nothing.
    expect(FILES.length).toBeGreaterThan(100);
    expect(FILES.some(({ rel }) => rel === "db/baseline.test.ts")).toBe(true);
    expect(FILES.some(({ rel }) => rel === "ui/layout/seed.ts")).toBe(true);
    expect(FILES.some(({ rel }) => rel === "db/substrate.ts")).toBe(false);
  });

  it("and it discriminates: the patterns match the shape the nineteen were written in", () => {
    // If `FORBIDDEN` stopped matching what a copy looks like, the first
    // assertion would pass over a tree full of copies. This is that check,
    // against the text the one home itself still carries.
    const home = readFileSync(SUBSTRATE, "utf8");
    for (const { what, pattern } of FORBIDDEN) {
      const asDeclared = pattern.source.replace("^", "^export ");
      expect(new RegExp(asDeclared, "m").test(home), `substrate.ts no longer exports ${what}`).toBe(true);
    }
  });
});

describe("every live-schema suite reaches the substrate through that one home", () => {
  /** A suite that talks to the substrate is one that calls `psql` or points
   *  a client at the REST URL. Decided from the file, not from a list. */
  const reachers = FILES.filter(({ source }) => /\bpsql\(|\bpsqlRows\(|\bREST_URL\b/.test(source));

  it("each of them imports it, and none of them is a copy", () => {
    expect(reachers.length).toBeGreaterThanOrEqual(19);
    const offenders = reachers
      .filter(({ source }) => !/from "(?:[^"]*db\/|\.\/)substrate"/.test(source))
      .map(({ rel }) => rel);
    expect(offenders).toEqual([]);
  });
});
