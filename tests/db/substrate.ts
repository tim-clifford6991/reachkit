// tests/db/substrate.ts — where the live-schema suites get the substrate
// from (issue #224).
//
// Nineteen files each carried their own copy of these facts: the host, the
// port, the role, the password, `REACHKIT_DB_NAME ?? "reachkit_scratch"`,
// `SUPABASE_URL ?? "http://127.0.0.1:3001"`, a hand-rolled HS256 signer and
// a `psql` wrapper differing only in whether it took stdin. Nineteen copies
// of one fact is nineteen chances for a run to talk to the wrong database —
// which is exactly what #220 had just finished making possible, by giving
// each run its own.
//
// **Read once, at import.** `scripts/db-substrate/up.sh --run` exports
// `REACHKIT_DB_NAME` and `SUPABASE_URL` for the run that owns them; a
// process started without those exports falls back to the shared scratch
// database, which is what every one of the nineteen already did and is why
// the fallbacks are here rather than being an error. A suite that reads
// `process.env` itself after this module loaded would be reading a value
// this module has already decided, so nothing here re-reads.
//
// **No behaviour change.** Every value below is the value the nineteen
// already computed, and every helper does what theirs did — including
// `psql`'s optional `input`, which one of them needed and the rest omitted.
// `tests/db/no-local-substrate.test.ts` is the sweep that keeps it one
// home.
//
// **Repo paths are deliberately not here.** Where each suite finds
// `supabase/migrations` is the same in every checkout and does not vary by
// run; it was never the duplication that could send a run to the wrong
// database, and the suites spell it four different ways. This module holds
// the facts that change with the run, and nothing else.
//
// Not a live-schema suite itself: this file is imported by them, runs no
// test and touches no database at import.
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";

/** Where the substrate listens. Fixed rather than read: `up.sh` gives each
 *  run its own *database* on one server, not its own server. */
export const DB_HOST = "127.0.0.1";
export const DB_PORT = "5432";
export const DB_USER = "reachkit";
export const DB_PASSWORD = "reachkit";

/** This run's database. `up.sh --run` names it after the worktree so two
 *  runs cannot wipe each other (#220); without that export a process gets
 *  the shared scratch database, as every suite did before it existed. */
export const DB_NAME = process.env.REACHKIT_DB_NAME ?? "reachkit_scratch";

/** The REST façade in front of it — what a Supabase client is pointed at. */
export const REST_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:3001";

/** The same connection string `env.ts` would be given for this run. */
export const DATABASE_URL = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

/**
 * `psql` against this run's database.
 *
 * `input` is optional because one caller pipes a migration in on stdin and
 * the other eighteen do not — one helper covering both rather than two that
 * drift.
 */
export function psql(args: string[], input?: string): string {
  return execFileSync("psql", ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME, "-q", ...args], {
    env: { ...process.env, PGPASSWORD: DB_PASSWORD },
    encoding: "utf8",
    ...(input === undefined ? {} : { input }),
    maxBuffer: 10 * 1024 * 1024,
  });
}

/** One query, as rows of unquoted columns — `psql -Atc`, split. */
export function psqlRows(sql: string): string[][] {
  return psql(["-v", "ON_ERROR_STOP=1", "-Atc", sql])
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("|"));
}

// ── The keys PostgREST accepts ───────────────────────────────────────────
//
// HS256, hand-rolled with `node:crypto` — no dependency beyond the repo's
// existing manifest, which is the note every copy of this carried.

/** The secret the substrate's PostgREST verifies against. */
export const JWT_SECRET = "reachkit-scratch-jwt-secret-at-least-32-chars-long";

/** An hour from now, in seconds — every key these suites mint is short-lived
 *  and minted at import. */
function anHourFromNow(): number {
  return Math.floor(Date.now() / 1000) + 3600;
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function signJwt(claims: Record<string, unknown>): string {
  const header = base64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(Buffer.from(JSON.stringify(claims)));
  const signingInput = `${header}.${payload}`;
  const signature = base64url(createHmac("sha256", JWT_SECRET).update(signingInput).digest());
  return `${signingInput}.${signature}`;
}

export const ANON_KEY = signJwt({ role: "anon", iss: "supabase", exp: anHourFromNow() });
export const SERVICE_ROLE_KEY = signJwt({
  role: "service_role",
  iss: "supabase",
  exp: anHourFromNow(),
});

/** A signed-in customer's own key — RLS reads `sub`. */
export function userJwt(userId: string): string {
  return signJwt({ role: "authenticated", sub: userId, iss: "supabase", exp: anHourFromNow() });
}
