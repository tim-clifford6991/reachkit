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
// **One run, one database** (#220). `applyMigrations` below drops and
// rebuilds `public`, so two runs sharing a database delete each other's rows
// mid-flight: this file's seeded account vanishes and every `/app` address
// redirects to `/signin`, which reads exactly like a broken screen rather
// than like contention. Locally, start the substrate with
// `eval "$(scripts/db-substrate/up.sh --run)"` — it gives this worktree its
// own database and its own ports, and the constants below read them out of
// the environment. No lock is needed. CI passes no `--run` and needs none:
// one job, one runner, one `postgres:18` service container.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { LIVE_ACCOUNT, RESERVED_ACCOUNT } from "../../app/accounts";
import type { AppAccount } from "@/app/(account)/app/_session/account";

const ROOT = path.resolve(__dirname, "../../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");

const DB_HOST = "127.0.0.1";
const DB_PORT = "5432";
const DB_USER = "reachkit";
const DB_PASSWORD = "reachkit";
const DB_NAME = process.env.REACHKIT_DB_NAME ?? "reachkit_scratch";

/** Each account's own address. Never mailed: `issueLink` writes the row and
 *  this file redeems the token straight out of the returned URL. */
const EMAIL_OF: Readonly<Record<string, string>> = {
  [RESERVED_ACCOUNT.userId]: "layout-sweep@example.com",
  [LIVE_ACCOUNT.userId]: "layout-sweep-live@example.com",
};

/** Kept for the callers that named it before there were two accounts. */
const SEEDED_EMAIL = EMAIL_OF[RESERVED_ACCOUNT.userId] as string;

/** The draft row the seeded site owns. The sweep's `[draftId]` fixture is
 *  **not** this id and must not become it: `readDraft` answers the reserved
 *  account from `FIXTURE_DRAFTS`, whose `in_review` draft is the densest
 *  arm that address can render (`routes.ts` says why). This row exists so
 *  the seeded site is a whole site — an account with a scan, an
 *  opportunity and a page — rather than a shell with a session on it. */
const SEEDED_DRAFT_ID = "00000000-0000-0000-0000-0000000000d1";

/**
 * The live account's drafts, one per state the `/app` screens draw
 * differently (#206).
 *
 * Three states because that is what the shell, the overview and the
 * calendar each read for: a page in review is what the draft address
 * renders and what the veto window counts, a published one is what the
 * overview's "live" reads, and a planned one is what the calendar draws on
 * a future date. One state would leave two of the three live reads
 * rendering an empty arm, which is not the layout this sweep is here to
 * measure.
 */
const LIVE_DRAFTS: readonly { id: string; state: string; title: string }[] = Object.freeze([
  { id: "00000000-0000-0000-0000-0000000000e1", state: "in_review", title: "How teams pick an onboarding tool" },
  { id: "00000000-0000-0000-0000-0000000000e2", state: "published", title: "Onboarding checklists that survive week one" },
  { id: "00000000-0000-0000-0000-0000000000e3", state: "planned", title: "What to measure after a rollout" },
]);

/** The live account's draft address — the one the live sweep renders. */
export const LIVE_DRAFT_ID = LIVE_DRAFTS[0]?.id as string;

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
  seedSite(RESERVED_ACCOUNT, { drafts: [{ id: SEEDED_DRAFT_ID, state: "in_review", title: "Best onboarding tools" }] });
}

/**
 * The second account, and the one the live branch is measured as (#206).
 *
 * `LIVE_ACCOUNT`'s domain is one no fixture answers for, so every `/app`
 * provider takes its database read rather than its fixture — which is the
 * whole point: until now no provider's live read was ever rendered under a
 * browser at any width. It gets drafts in three states, a publication and
 * a destination so each of those reads returns rows rather than an empty
 * arm.
 */
export function seedLiveAccount(): void {
  seedSite(LIVE_ACCOUNT, { drafts: LIVE_DRAFTS, publish: true });
}

/**
 * One account with a whole site under it: a measured scan, an opportunity
 * off it, and the drafts the caller asked for.
 *
 * §4.3's requirements are the same for both accounts — a **stated** zone
 * (REQ-073 c1 forbids one the customer never chose), setup completed so
 * the gate lets every `/app` address through, and access that has not
 * ended so `hasActiveAccess()` is true.
 */
function seedSite(
  account: AppAccount,
  opts: { drafts: readonly { id: string; state: string; title: string }[]; publish?: boolean }
): void {
  const { userId, siteId, domain, timeZone } = account;
  const email = EMAIL_OF[userId];
  if (email === undefined) {
    throw new Error(`tests/ui/layout/seed.ts: no address is declared for the account ${userId}.`);
  }

  sql(
    `insert into users (id, email, plan_status, paid_through) values ` +
      `('${userId}', '${email}', 'active', now() + interval '365 days');`
  );
  sql(
    `insert into sites (id, user_id, domain, timezone, setup_completed_at) values ` +
      `('${siteId}', '${userId}', '${domain}', '${timeZone}', now());`
  );

  const [scanId] = rows(
    `insert into scans (site_id, domain, tier, status) values ('${siteId}', '${domain}', 'deep', 'done') returning id;`
  );

  for (const [index, draft] of opts.drafts.entries()) {
    const [opportunityId] = rows(
      `insert into opportunities (site_id, scan_id, type, family, target_query, target_ref, proposed_slug, title, fit_band, effort, evidence, acceptance) values ` +
        // A Write row carries a search and a band; only a Fix row has neither
        // (`opportunities_fit_band_iff_not_fix`). One opportunity per draft,
        // because `opportunities_open_target_uniq` refuses a second open row
        // on the same target.
        `('${siteId}', '${scanId}', 'answer_page', 'write', 'onboarding tools ${index}', 'target-${index}', 'slug-${index}', 'Onboarding tools ${index}', 'winnable', 0.50, '{"family":"write"}'::jsonb, '{"check":"the page answers the question"}'::jsonb) returning id;`
    );
    sql(
      `insert into drafts (id, opportunity_id, site_id, state, title, body_md) values ` +
        `('${draft.id}', '${opportunityId}', '${siteId}', '${draft.state}', '${draft.title}', ` +
        `'A paragraph of body copy, so the draft view renders a page rather than an empty one.');`
    );
  }

  if (opts.publish !== true) return;

  // The destination §4.7's card draws, and the publication the overview
  // counts as live. Both are reads that answered nothing before #206.
  sql(
    `insert into destinations (site_id, kind, config, health) values ('${siteId}', 'hosted', null, 'ok');`
  );
  const published = opts.drafts.find((draft) => draft.state === "published");
  if (published !== undefined) {
    sql(
      `insert into publications (draft_id, site_id, destination, mode, live_url, published_at, delivery_state) values ` +
        `('${published.id}', '${siteId}', 'hosted', 'autopilot', 'https://content.${domain}/${published.id}', now(), 'delivered');`
    );
  }
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
export async function seededSessionCookie(
  account: AppAccount = RESERVED_ACCOUNT
): Promise<string> {
  const { issueLink, redeemLink, sessionCookie, SESSION_COOKIE_NAME } = await import(
    "@/lib/account/identity"
  );

  const issued = await issueLink({
    userId: account.userId,
    to: EMAIL_OF[account.userId] ?? SEEDED_EMAIL,
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

export { LIVE_ACCOUNT, LIVE_DRAFTS, RESERVED_ACCOUNT, SEEDED_DRAFT_ID, SEEDED_EMAIL };
