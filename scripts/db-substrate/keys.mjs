// scripts/db-substrate/keys.mjs
//
// Mints the two API keys a Supabase project hands out — `anon` and
// `service_role` — as HS256 JWTs over the substrate's JWT secret, and
// prints them as `NAME=value` lines for `$GITHUB_ENV` or `eval`.
//
// They are generated, never checked in: the substrate is a disposable
// fixture, so its keys are derived from `SUBSTRATE_JWT_SECRET` at start-up
// rather than copied from anywhere. The default secret below is the fixture
// literal `tests/db/rls.test.ts` already carries in its source — it signs
// tokens for a scratch database that exists only for the length of a CI job
// and is never reachable from outside the runner.
//
// Usage: node keys.mjs            → ANON=… / SERVICE_ROLE=… / SECRET=…
import { createHmac } from "node:crypto";

export const DEFAULT_JWT_SECRET = "reachkit-scratch-jwt-secret-at-least-32-chars-long";

/** Claim expiry far enough out that a job never trips over it. */
const TEN_YEARS_SECONDS = 10 * 365 * 24 * 60 * 60;

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** An HS256 JWT with the claim shape Supabase Auth itself issues. */
export function mint(role, secret) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      role,
      iss: "supabase",
      exp: Math.floor(Date.now() / 1000) + TEN_YEARS_SECONDS,
    })
  );
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${header}.${payload}.${signature}`;
}

const secret = process.env.SUBSTRATE_JWT_SECRET || DEFAULT_JWT_SECRET;
process.stdout.write(`ANON=${mint("anon", secret)}\n`);
process.stdout.write(`SERVICE_ROLE=${mint("service_role", secret)}\n`);
process.stdout.write(`SECRET=${secret}\n`);
