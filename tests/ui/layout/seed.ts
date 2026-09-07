// tests/ui/layout/seed.ts — BUILD §2, §4.3 (issue #193)
//
// The layout conformance job's database: the migrations, one account, and
// a session cookie a real sign-in would have produced.
//
// **Why this file exists.** Since #192 the four `/app` screens verify the
// session against the `users` row, so a fixture cookie no longer gets the
// sweep past `requireAppAccount()` — every `(account)` address answered
// `/signin` and the sweep measured the sign-in prompt at five widths and
// called it the screen (`tests/app/session/account.test.ts` recorded the
// loss). The substrate #164 put in the repository is what closes it: the
// same `postgres:18` service and `scripts/db-substrate/up.sh` the `db`
// vitest project runs against.
//
// **The account is `RESERVED_ACCOUNT`, and that is the point.** It is the
// same account the presentation sweeps sign in as (`tests/app/accounts.ts`),
// so the two sweeps measure one door rather than two. Every `/app` surface
// asks `isReservedFixtureAccount()` and draws its fixture for it, which is
// what makes the sweep *deterministic*: the screens are the real
// components in their real layout, filled with the densest content each
// can hold, and no provider makes a live read on the render path. A
// non-reserved account would put five widths × four screens behind every
// provider's database read, and a read that hangs is indistinguishable
// from a broken screen (the reason `gate-state.ts` bounds its own).
//
// **The session is minted through identity's own path**, not assembled
// here: `issueLink` writes a row, `redeemLink` spends it and returns the
// claims, and `sessionCookie` turns those claims into the cookie the
// redemption route sets. A cookie this file signed itself would prove the
// sweep can reach the screens and nothing about whether a real sign-in
// can.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { RESERVED_ACCOUNT } from "../../app/accounts";

const ROOT = path.resolve(__dirname, "../../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");

const DB_HOST = "127.0.0.1";
const DB_PORT = "5432";
const DB_USER = "reachkit";
const DB_PASSWORD = "reachkit";
const DB_NAME = "reachkit_scratch";

/** The account's own address. Never mailed: `issueLink` writes the row and
 *  this file redeems the token straight out of the returned URL. */
const SEEDED_EMAIL = "layout-sweep@example.com";

/** The draft row the seeded site owns. The sweep's `[draftId]` fixture is
 *  **not** this id and must not become it: `readDraft` answers the reserved
 *  account from `FIXTURE_DRAFTS`, whose `in_review` draft is the densest
 *  arm that address can render (`routes.ts` says why). This row exists so
 *  the seeded site is a whole site — an account with a scan, an
 *  opportunity and a page — rather than a shell with a session on it. */
const SEEDED_DRAFT_ID = "00000000-0000-0000-0000-0000000000d1";

function psql(args: string[]): string {
  return execFileSync("psql", ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME, "-q", ...args], {
    env: { ...process.env, PGPASSWORD: DB_PASSWORD },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

function sql(statement: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", statement]);
}

/**
 * Every migration, in name order, onto a fresh `public`.
 *
 * The whole set rather than a chosen few: this database is what the built
 * app itself talks to, and a screen reads whatever it reads. `supabase db
 * reset` is not available (owner ruling 2026-09-02, no Docker on the
 * owner's machine), and this is the same `psql` loop `scripts/db-substrate`
 * and every live-schema suite already use.
 */
export function applyMigrations(): void {
  sql("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
  for (const file of readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql")).sort()) {
    psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS_DIR, file)]);
  }
  reloadPostgrestSchemaCache();
}

/**
 * Waits until PostgREST is actually serving the schema that was just
 * applied.
 *
 * `NOTIFY` is asynchronous, so the reload is in flight when it returns and
 * a sleep would be a guess. This asks the one question that distinguishes
 * the old cache from the new — a table only these migrations create — and
 * stops as soon as it is answered.
 */
export async function waitForSchemaCache(timeoutMs = 30_000): Promise<void> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (base === undefined || key === undefined) {
    throw new Error(
      "tests/ui/layout/seed.ts: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must name the substrate " +
        "before the layout sweep runs — the sweep signs in against it. `scripts/db-substrate/up.sh` " +
        "prints both."
    );
  }
  const deadline = Date.now() + timeoutMs;
  const url = `${base}/rest/v1/auth_links?select=token_hash&limit=1`;
  for (;;) {
    const answered = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
      .then((response) => response.ok)
      .catch(() => false);
    if (answered) return;
    if (Date.now() > deadline) {
      throw new Error(
        "tests/ui/layout/seed.ts: PostgREST never picked up the migrated schema. It caches the " +
          "schema at connect and `up.sh` starts it before the migrations run, so a `NOTIFY pgrst, " +
          "'reload schema'` is what refreshes it — if that channel is disabled this will never pass."
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Tells PostgREST the schema changed.
 *
 * It caches the schema at connect, and `up.sh` starts it **before** these
 * migrations run — so without this every table created above is invisible
 * over REST and the first write answers `PGRST205: Could not find the
 * table 'public.auth_links' in the schema cache`. That is not a substrate
 * defect and not something a retry fixes: the vendor documents this
 * `NOTIFY` as the reload signal, and a schema that changed under a running
 * instance is exactly what it is for.
 *
 * Announced through the database rather than by signalling a process,
 * because the process is a container in CI and a native binary on a
 * machine without Docker, and `psql` reaches both the same way.
 */
function reloadPostgrestSchemaCache(): void {
  sql("notify pgrst, 'reload schema';");
}

/**
 * One account, exactly as §4.3 requires the sweep's account to be: a site
 * with a **stated** zone (REQ-073 c1 forbids one the customer never chose),
 * setup completed so the gate lets every `/app` address through, and access
 * that has not ended so `hasActiveAccess()` is true.
 *
 * Ids are `RESERVED_ACCOUNT`'s own, so the row the session names and the
 * account the presentation sweeps render as are the same account.
 */
export function seedAccount(): void {
  const { userId, siteId, domain, timeZone } = RESERVED_ACCOUNT;
  sql(
    `insert into users (id, email, plan_status, paid_through) values ` +
      `('${userId}', '${SEEDED_EMAIL}', 'active', now() + interval '365 days');`
  );
  sql(
    `insert into sites (id, user_id, domain, timezone, setup_completed_at) values ` +
      `('${siteId}', '${userId}', '${domain}', '${timeZone}', now());`
  );

  // A whole site: one measured scan, one opportunity off it, one page.
  const [scanId] = rows(
    `insert into scans (site_id, domain, tier, status) values ('${siteId}', '${domain}', 'deep', 'done') returning id;`
  );
  const [opportunityId] = rows(
    `insert into opportunities (site_id, scan_id, type, family, target_query, target_ref, proposed_slug, title, fit_band, effort, evidence, acceptance) values ` +
      // A Write row carries a search and a band; only a Fix row has neither
      // (`opportunities_fit_band_iff_not_fix`).
      `('${siteId}', '${scanId}', 'answer_page', 'write', 'best onboarding tools', 'best-onboarding-tools', 'best-onboarding-tools', 'Best onboarding tools', 'winnable', 0.50, '{"family":"write"}'::jsonb, '{"check":"the page answers the question"}'::jsonb) returning id;`
  );
  sql(
    `insert into drafts (id, opportunity_id, site_id, state, title) values ` +
      `('${SEEDED_DRAFT_ID}', '${opportunityId}', '${siteId}', 'in_review', 'Best onboarding tools');`
  );
}

function rows(statement: string): string[] {
  return psql(["-v", "ON_ERROR_STOP=1", "-Atc", statement])
    .split("\n")
    .filter((line) => line.length > 0);
}

/**
 * The `Cookie` header the sweep sends, minted through identity's own
 * issue → redeem → `sessionCookie` path against the seeded row.
 *
 * Throws rather than falling back. A sweep that quietly used a fixture
 * cookie would measure the sign-in prompt at four addresses and report a
 * clean run, which is exactly the failure #192 had to leave a marker for.
 */
export async function seededSessionCookie(): Promise<string> {
  const { issueLink, redeemLink, sessionCookie, SESSION_COOKIE_NAME } = await import(
    "@/lib/account/identity"
  );

  const issued = await issueLink({
    userId: RESERVED_ACCOUNT.userId,
    to: SEEDED_EMAIL,
    purpose: "sign_in",
  });
  if (!issued.issued) {
    throw new Error(
      "tests/ui/layout/seed.ts: identity refused to issue a sign-in link against the seeded " +
        "account. The substrate is up (the migrations applied) but `identityStore()` could not " +
        "write — check SUPABASE_URL and the service-role key this process was given."
    );
  }

  // The token is the link's last segment — the only place the plaintext
  // ever exists, which is why `issueLink` hands back a URL and not a token.
  const token = new URL(issued.url).pathname.split("/").filter(Boolean).pop() ?? "";
  const redeemed = await redeemLink(token);
  if (!redeemed.ok) {
    throw new Error(
      `tests/ui/layout/seed.ts: the sign-in link this run issued would not redeem (${redeemed.reason}).`
    );
  }

  const cookie = sessionCookie(redeemed.session);
  return `${SESSION_COOKIE_NAME}=${cookie.value}`;
}

export { RESERVED_ACCOUNT, SEEDED_DRAFT_ID, SEEDED_EMAIL };
