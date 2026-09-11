// tests/account/columns.test.ts
//
// WO-272 `## Test plan` — acceptance quoted from BP-017, BP-002, BP-059,
// REQ-073 and `structure.md` (this node carries no requirement of its own
// and cites, never inherits — BP-017 `satisfies: []`).
//
// **Substrate note (owner ruling, 2026-09-03; Docker unavailable on this
// host, carried from `tests/db/baseline.test.ts`):** `supabase db reset`
// cannot run. In its place this file resets and re-applies
// `00000000000001_baseline.sql`, `00000000000003_users_notify_column.sql`
// and `00000000000004_sites_timezone_column.sql` against native PostgreSQL
// 18 at `127.0.0.1:5432`, database `reachkit_scratch`, via `psql` spawned
// from `child_process` — the same mechanism, same database,
// `tests/db/baseline.test.ts` and `tests/db/rls.test.ts` use. RLS is not
// under test here (BP-017's delta, not BP-002's policies), so
// `00000000000002_rls.sql` is not applied.
//
// **Run this file with `--no-file-parallelism`** alongside `tests/db/*`
// (see `tests/db/baseline.test.ts`'s header for why): all reset and
// rebuild the same physical `public` schema on the one scratch database.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { topicOf } from "../../src/lib/db/topics";
import {
  psql,
  psqlRows,
} from "../db/substrate";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const BASELINE_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/00000000000001_baseline.sql"
);
const USERS_NOTIFY_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/00000000000003_users_notify_column.sql"
);
const SITES_TIMEZONE_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/00000000000004_sites_timezone_column.sql"
);
// BUILD §13 (issue #33) — the three payment migrations this file also
// applies and asserts. They land here rather than in a file of their own
// because `vitest.config.ts`'s `LIVE_SCHEMA_TESTS` list is the owner's and
// already names this path: a fourth db-project file would have to be added
// there to run at all, and would reset the same physical schema besides.
const USERS_BILLING_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/20260906090000_users_billing_columns.sql"
);
const USERS_PROVISIONING_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/20260906090100_users_provisioning_keys.sql"
);
const SITES_PROVISIONING_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/20260906090200_sites_provisioning_columns.sql"
);
// BUILD §13 · §4.7 (issue #35) — the two identity migrations. They land in
// this file for the reason the three payment ones do: `vitest.config.ts`'s
// `LIVE_SCHEMA_TESTS` list is the owner's and already names this path, so a
// db-project file of their own would not run at all, and would reset the
// same physical schema besides.
//
// `00000000000002_rls.sql` is applied before them, and only for its first
// line — it is where `users.deleted_at` is added, and the in-use check
// REQ-077 c2 needs reads that column (ADR-051 point 5). Its policies are
// BP-002's and are not under test here.
const RLS_MIGRATION = path.join(REPO_ROOT, "supabase/migrations/00000000000002_rls.sql");
const USERS_IDENTITY_COLUMNS_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/20260906100000_users_identity_columns.sql"
);
const USERS_IDENTITY_LINKS_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/20260906100100_users_identity_links.sql"
);
// Issue #468 — identity moves onto Supabase Auth: `auth_links` and
// `users.sessions_valid_from` go, and `users.id` becomes `auth.users.id`
// (a foreign key added only where `auth.users` exists — not on this
// substrate, which has no GoTrue).
const USERS_IDENTITY_SUPABASE_AUTH_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/20260910120000_users_identity_supabase_auth.sql"
);
// BUILD §13 (issue #34) — the two subscription and hosting migrations, on
// the same footing and for the same reason: `LIVE_SCHEMA_TESTS` is the
// owner's list and already names this path.
const USERS_SUBSCRIPTION_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/20260906120000_users_subscription_columns.sql"
);
const SITES_HOSTING_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/20260906120100_sites_hosting_columns.sql"
);

/** One tuple-only row per line, `|`-separated columns — easy to split. */
/** Runs `sql` and returns whether it raised (never throws itself). */
function raises(sql: string): boolean {
  try {
    psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
    return false;
  } catch {
    return true;
  }
}

beforeAll(() => {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", BASELINE_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", USERS_NOTIFY_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", SITES_TIMEZONE_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", USERS_BILLING_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", USERS_PROVISIONING_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", SITES_PROVISIONING_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", RLS_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", USERS_IDENTITY_COLUMNS_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", USERS_IDENTITY_LINKS_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", USERS_SUBSCRIPTION_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", SITES_HOSTING_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", USERS_IDENTITY_SUPABASE_AUTH_MIGRATION]);
});

afterAll(() => {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
});

function freshUserId(): string {
  const rows = psqlRows(
    `insert into users (email, plan_status) values ('acct-${Math.random().toString(36).slice(2)}@example.com', 'active') returning id;`
  );
  const [row] = rows;
  const [id] = row ?? [];
  if (!id) throw new Error("insert into users returned no id");
  return id;
}

function freshSiteId(userId: string): string {
  const rows = psqlRows(
    `insert into sites (user_id, domain) values ('${userId}', 'example.com') returning id;`
  );
  const [row] = rows;
  const [id] = row ?? [];
  if (!id) throw new Error("insert into sites returned no id");
  return id;
}

describe(
  'BP-017 `## Data model delta`: "`users` — as `SPEC.md` §10, plus `notify jsonb`, …"',
  () => {
    it("users.notify exists as jsonb, not null, default {}", () => {
      const rows = psqlRows(
        `select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'notify';`
      );
      expect(rows).toEqual([["jsonb", "NO", "'{}'::jsonb"]]);
    });

    it("an insert omitting the column reads {}", () => {
      const userId = freshUserId();
      const rows = psqlRows(`select notify from users where id = '${userId}';`);
      expect(rows).toEqual([["{}"]]);
    });
  }
);

describe(
  'BP-017 `## Data model delta`: "`sites` — as §10, plus `timezone`, `publishing_enabled`."',
  () => {
    it("sites.timezone exists as text and is nullable with no default", () => {
      const rows = psqlRows(
        `select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'sites' and column_name = 'timezone';`
      );
      expect(rows).toEqual([["text", "YES", ""]]);
    });

    it("an insert omitting it succeeds and reads null", () => {
      const userId = freshUserId();
      const siteId = freshSiteId(userId);
      const rows = psqlRows(`select coalesce(timezone, '<null>') from sites where id = '${siteId}';`);
      expect(rows).toEqual([["<null>"]]);
    });
  }
);

describe(
  'BP-059 `## Data model delta`: "The value is a sparse object over `NotifyKind`, default `{}`."',
  () => {
    it("a non-object notify value is refused", () => {
      const userId = freshUserId();
      expect(raises(`update users set notify = '[]'::jsonb where id = '${userId}';`)).toBe(true);
      expect(raises(`update users set notify = '"x"'::jsonb where id = '${userId}';`)).toBe(true);
      expect(raises(`update users set notify = 'null'::jsonb where id = '${userId}';`)).toBe(true);
    });

    it("{} and a populated object are accepted", () => {
      const userId = freshUserId();
      expect(raises(`update users set notify = '{}'::jsonb where id = '${userId}';`)).toBe(false);
      expect(
        raises(`update users set notify = '{"weekly": false}'::jsonb where id = '${userId}';`)
      ).toBe(false);
      const rows = psqlRows(`select notify from users where id = '${userId}';`);
      expect(rows).toEqual([['{"weekly": false}']]);
    });
  }
);

describe(
  'BP-002 `## Data model delta`: "`users.notify jsonb` … `users` · BP-017 (leaf: BP-059)" and "`sites.timezone` … `sites` · BP-017 (leaf: BP-057)"',
  () => {
    it("both migration names resolve to BP-017 and to no other node", () => {
      expect(topicOf("00000000000003_users_notify_column.sql")).toEqual({
        token: "users",
        owner: "BP-017",
      });
      expect(topicOf("00000000000004_sites_timezone_column.sql")).toEqual({
        token: "sites",
        owner: "BP-017",
      });
    });
  }
);

describe(
  '`structure.md` rule 3a: "A column added to `users`, `sites` or any other baseline table after the baseline is a migration under that table\'s token or a sub-token of it — never \'part of the baseline\'"',
  () => {
    it("the baseline file is unmodified", () => {
      const baselineText = readFileSync(BASELINE_MIGRATION, "utf8");
      expect(baselineText).not.toMatch(/\bnotify\b/);
      expect(baselineText).not.toMatch(/\btimezone\b/);
    });

    it("the two columns arrive in the two migrations above and nowhere else", () => {
      const usersNotifyText = readFileSync(USERS_NOTIFY_MIGRATION, "utf8");
      const sitesTimezoneText = readFileSync(SITES_TIMEZONE_MIGRATION, "utf8");
      expect(usersNotifyText).toMatch(/add column notify/);
      expect(sitesTimezoneText).toMatch(/add column timezone/);
    });
  }
);

describe(
  'REQ-073 criterion 1: "where they have set nothing, … the time zone is the one their browser reported at first sign-in"',
  () => {
    it("no fallback zone is written by the schema", () => {
      const userId = freshUserId();
      const siteId = freshSiteId(userId);
      const rows = psqlRows(`select coalesce(timezone, '<null>') from sites where id = '${siteId}';`);
      expect(rows).toEqual([["<null>"]]);
      expect(rows[0]?.[0]).not.toBe("UTC");
    });
  }
);

// ── BUILD §13 (issue #33) — the payment columns and the two idempotency keys

describe(
  '§13, quoted: "collect the buyer\'s country (Stripe does automatically) and VAT ID field on, so the records exist when registration is set up"',
  () => {
    it("users.billing_country, users.vat_number and users.checkout_session_id are text, nullable, with no default", () => {
      const rows = psqlRows(
        `select column_name, data_type, is_nullable, coalesce(column_default, '') from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name in ('billing_country', 'vat_number', 'checkout_session_id') order by column_name;`
      );
      expect(rows).toEqual([
        ["billing_country", "text", "YES", ""],
        ["checkout_session_id", "text", "YES", ""],
        ["vat_number", "text", "YES", ""],
      ]);
    });

    it("a users row inserts with all three absent — the row exists before checkout fills them", () => {
      const userId = freshUserId();
      const rows = psqlRows(
        `select coalesce(billing_country, '<null>'), coalesce(vat_number, '<null>'), coalesce(checkout_session_id, '<null>') from users where id = '${userId}';`
      );
      expect(rows).toEqual([["<null>", "<null>", "<null>"]]);
    });
  }
);

describe(
  'REQ-022 c7, quoted: "the purchase completes whatever any registry would say about that number — no check against VIES or any other registry stands between them and their purchase" (the schema half)',
  () => {
    it("vat_number carries no check constraint, no trigger and no normalising default", () => {
      const checks = psqlRows(
        `select count(*)::text from information_schema.constraint_column_usage u join information_schema.table_constraints c on c.constraint_name = u.constraint_name where u.table_name = 'users' and u.column_name = 'vat_number' and c.constraint_type = 'CHECK';`
      );
      expect(checks).toEqual([["0"]]);
      const triggers = psqlRows(
        `select count(*)::text from information_schema.triggers where event_object_table = 'users';`
      );
      expect(triggers).toEqual([["0"]]);
    });

    it("an obviously invalid VAT number, and one with internal spaces and mixed case, both store byte-identical", () => {
      const userId = freshUserId();
      expect(
        raises(`update users set vat_number = 'not a vat number at all' where id = '${userId}';`)
      ).toBe(false);
      psql(["-v", "ON_ERROR_STOP=1", "-c", `update users set vat_number = 'ie 1234 567 Xy' where id = '${userId}';`]);
      expect(psqlRows(`select vat_number from users where id = '${userId}';`)).toEqual([
        ["ie 1234 567 Xy"],
      ]);
    });

    it("a lowercase country is stored lowercase — the schema maps nothing", () => {
      const userId = freshUserId();
      psql(["-v", "ON_ERROR_STOP=1", "-c", `update users set billing_country = 'ie' where id = '${userId}';`]);
      expect(psqlRows(`select billing_country from users where id = '${userId}';`)).toEqual([["ie"]]);
    });
  }
);

describe(
  'REQ-024 c3, quoted: "once that processing ends the address still has exactly one account, one site and one running subscription" — the two idempotency keys, at the database level',
  () => {
    it("a second users row carrying an already-used checkout_session_id is refused", () => {
      const first = freshUserId();
      const second = freshUserId();
      psql(["-v", "ON_ERROR_STOP=1", "-c", `update users set checkout_session_id = 'cs_test_replay' where id = '${first}';`]);
      expect(
        raises(`update users set checkout_session_id = 'cs_test_replay' where id = '${second}';`)
      ).toBe(true);
    });

    it("a second users row for the same address in a different case is refused — the baseline's case-sensitive unique would have let it through", () => {
      psql(["-v", "ON_ERROR_STOP=1", "-c", `insert into users (email, plan_status) values ('Second.Purchase@Example.com', 'active');`]);
      expect(
        raises(`insert into users (email, plan_status) values ('second.purchase@example.com', 'active');`)
      ).toBe(true);
    });

    it("a second stripe_customer_id is refused", () => {
      const first = freshUserId();
      const second = freshUserId();
      psql(["-v", "ON_ERROR_STOP=1", "-c", `update users set stripe_customer_id = 'cus_test_one' where id = '${first}';`]);
      expect(raises(`update users set stripe_customer_id = 'cus_test_one' where id = '${second}';`)).toBe(true);
    });

    it("a second sites row for one account is refused — §13's \"one site\", as an index", () => {
      const userId = freshUserId();
      freshSiteId(userId);
      expect(raises(`insert into sites (user_id, domain) values ('${userId}', 'second.example');`)).toBe(true);
    });
  }
);

describe(
  'REQ-024 c5, quoted: "when 15 minutes have passed since the charge and no one has signed in at the address that paid" — what the chase reads',
  () => {
    it("users.first_signed_in_at exists, is timestamptz and is nullable with no default", () => {
      const rows = psqlRows(
        `select data_type, is_nullable, coalesce(column_default, '') from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'first_signed_in_at';`
      );
      expect(rows).toEqual([["timestamp with time zone", "YES", ""]]);
    });

    it("the awaiting-sign-in read has a partial index over exactly the rows it selects", () => {
      const rows = psqlRows(
        `select indexdef from pg_indexes where tablename = 'users' and indexname = 'users_awaiting_sign_in_idx';`
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.[0]).toContain("checkout_session_id");
      expect(rows[0]?.[0]).toContain("first_signed_in_at IS NULL");
      expect(rows[0]?.[0]).toContain("sign_in_chased_at IS NULL");
    });

    it("users.sign_in_chased_at exists and is nullable — a tick that runs twice sends one mail", () => {
      const rows = psqlRows(
        `select data_type, is_nullable, coalesce(column_default, '') from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'sign_in_chased_at';`
      );
      expect(rows).toEqual([["timestamp with time zone", "YES", ""]]);
    });
  }
);

describe(
  '§13, quoted: "upsert user, create site (domain null if scanless — asked at setup)"',
  () => {
    it("sites.domain is nullable and has no default — nothing fabricates an address for a scanless purchase", () => {
      const rows = psqlRows(
        `select is_nullable, coalesce(column_default, '') from information_schema.columns where table_schema = 'public' and table_name = 'sites' and column_name = 'domain';`
      );
      expect(rows).toEqual([["YES", ""]]);
    });

    it("a site inserts with no domain at all", () => {
      const userId = freshUserId();
      expect(raises(`insert into sites (user_id) values ('${userId}');`)).toBe(false);
      expect(psqlRows(`select coalesce(domain, '<null>') from sites where user_id = '${userId}';`)).toEqual([
        ["<null>"],
      ]);
    });

    it("sites.provisioned_from_scan_id references scans and carries no cascade (ADR-051 point 2)", () => {
      const rows = psqlRows(
        `select c.confdeltype from pg_constraint c join pg_class t on t.oid = c.conrelid where t.relname = 'sites' and c.conname = 'sites_provisioned_from_scan_id_fkey';`
      );
      expect(rows).toEqual([["a"]]); // 'a' = NO ACTION; 'c' would be CASCADE
    });
  }
);

describe(
  '`structure.md` rule 3a — each payment migration carries exactly one sub-token, and resolves to the leaf that owns those columns',
  () => {
    it("the three filenames resolve to users_billing, users_provisioning and sites_provisioning", () => {
      expect(topicOf("20260906090000_users_billing_columns.sql")).toEqual({
        token: "users_billing",
        owner: "BP-030",
      });
      expect(topicOf("20260906090100_users_provisioning_keys.sql")).toEqual({
        token: "users_provisioning",
        owner: "BP-032",
      });
      expect(topicOf("20260906090200_sites_provisioning_columns.sql")).toEqual({
        token: "sites_provisioning",
        owner: "BP-031",
      });
    });

    it("the baseline file is unmodified — no payment column arrives in it", () => {
      const baselineText = readFileSync(BASELINE_MIGRATION, "utf8");
      expect(baselineText).not.toMatch(/\bvat_number\b/);
      expect(baselineText).not.toMatch(/\bcheckout_session_id\b/);
      expect(baselineText).not.toMatch(/\bfirst_signed_in_at\b/);
      expect(baselineText).not.toMatch(/\bprovisioned_from_scan_id\b/);
    });
  }
);

// ── BUILD §13 · §4.7 (issue #35, #468) — the identity columns, and `auth_links` gone

describe(
  'REQ-077 c2, quoted: "a sign-in link is sent to it and the old address keeps working until that link is used" — the pending state is three columns beside an untouched `users.email`',
  () => {
    it("the three pending columns exist, are nullable and have no default", () => {
      const rows = psqlRows(
        `select column_name, data_type, is_nullable, coalesce(column_default, '') from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name in ('pending_email', 'pending_email_token_hash', 'pending_email_sent_at') order by column_name;`
      );
      expect(rows).toEqual([
        ["pending_email", "text", "YES", ""],
        ["pending_email_sent_at", "timestamp with time zone", "YES", ""],
        ["pending_email_token_hash", "text", "YES", ""],
      ]);
    });

    it("users.email is untouched by them — writing a pending address changes no sign-in address", () => {
      const userId = freshUserId();
      const before = psqlRows(`select email from users where id = '${userId}';`);
      psql([
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `update users set pending_email = 'pending-one@example.com', pending_email_token_hash = 'deadbeef', pending_email_sent_at = now() where id = '${userId}';`,
      ]);
      expect(psqlRows(`select email from users where id = '${userId}';`)).toEqual(before);
    });

    it("two rows cannot hold the same pending address, in any case", () => {
      const first = freshUserId();
      const second = freshUserId();
      psql([
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `update users set pending_email = 'Wanted@Example.com' where id = '${first}';`,
      ]);
      expect(
        raises(`update users set pending_email = 'wanted@example.com' where id = '${second}';`)
      ).toBe(true);
    });

    it("but many rows may hold no pending address at once — the index is partial", () => {
      freshUserId();
      freshUserId();
      const rows = psqlRows(
        `select indexdef from pg_indexes where tablename = 'users' and indexname = 'users_pending_email_lower_key';`
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.[0]).toContain("WHERE (pending_email IS NOT NULL)");
    });
  }
);

describe(
  'REQ-077 c1, quoted: "their name and the address they sign in with are shown" (the storage half)',
  () => {
    it("users.name exists as text and is nullable — nothing fabricates a name", () => {
      const rows = psqlRows(
        `select data_type, is_nullable, coalesce(column_default, '') from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'name';`
      );
      expect(rows).toEqual([["text", "YES", ""]]);
      const userId = freshUserId();
      expect(psqlRows(`select coalesce(name, '<null>') from users where id = '${userId}';`)).toEqual([
        ["<null>"],
      ]);
    });
  }
);

describe(
  'BP-061 decision 4, quoted: "A completed email change ends the account\'s other sessions" — since #468 that is `auth.admin.signOut(token, "others")`, not a column',
  () => {
    it("users.sessions_valid_from is gone — no session stamp lives in this schema any more", () => {
      const rows = psqlRows(
        `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'sessions_valid_from';`
      );
      expect(rows).toEqual([]);
    });
  }
);

describe(
  'Owner ruling 2026-09-10 (#468), quoted: "I don\'t buy or like that we have `auth_links` — this should be wrapped into the Supabase auth system"',
  () => {
    it("auth_links is gone — Supabase Auth holds the one-time token", () => {
      expect(psqlRows(`select coalesce(to_regclass('public.auth_links')::text, '<none>');`)).toEqual([
        ["<none>"],
      ]);
    });

    it("no public column could hold a plaintext token — the mutation this catches is a token table brought back", () => {
      const rows = psqlRows(
        `select table_name || '.' || column_name from information_schema.columns where table_schema = 'public' and column_name ~ '(^|_)(token|secret|plaintext)$';`
      );
      expect(rows).toEqual([]);
    });

    it("its one-live index went with it", () => {
      expect(
        psqlRows(`select indexname from pg_indexes where indexname = 'auth_links_one_live_idx';`)
      ).toEqual([]);
    });

    it("users.id is tied to auth.users.id by a constraint guarded on auth.users existing, not valid, with no on-delete action", () => {
      const sql = readFileSync(USERS_IDENTITY_SUPABASE_AUTH_MIGRATION, "utf8").replace(/^\s*--.*$/gm, "");
      expect(sql).toMatch(/to_regclass\('auth\.users'\)\s+is\s+not\s+null/i);
      expect(sql).toMatch(
        /add\s+constraint\s+users_id_auth_users_fkey\s+foreign\s+key\s+\(id\)\s+references\s+auth\.users\s+\(id\)\s+not\s+valid/i
      );
      // ADR-051 point 2: the purge deletes `users` and then the auth user;
      // a cascade nobody wrote must never do it instead.
      expect(sql).not.toMatch(/on\s+delete/i);
    });

    it("where auth.users does not exist — this substrate — the guard skips the constraint and the migration still applies", () => {
      expect(psqlRows(`select coalesce(to_regclass('auth.users')::text, '<none>');`)).toEqual([["<none>"]]);
      expect(
        psqlRows(`select conname from pg_constraint where conname = 'users_id_auth_users_fkey';`)
      ).toEqual([]);
    });

    it("users.id says whose id it is", () => {
      const rows = psqlRows(
        `select col_description('public.users'::regclass, (select attnum from pg_attribute where attrelid = 'public.users'::regclass and attname = 'id'));`
      );
      expect(rows[0]?.[0]).toMatch(/auth\.users\.id/);
    });

    it("applying it twice is a no-op — every statement is guarded", () => {
      expect(raises(readFileSync(USERS_IDENTITY_SUPABASE_AUTH_MIGRATION, "utf8"))).toBe(false);
    });
  }
);

describe(
  'REQ-024 c4 — "never to a dead end": the newest link is the working one, and since #468 Supabase is what keeps it so',
  () => {
    const LATER = readdirSync(path.join(REPO_ROOT, "supabase/migrations"))
      .filter((name) => name.endsWith(".sql") && name > path.basename(USERS_IDENTITY_SUPABASE_AUTH_MIGRATION))
      // Comments stripped: a rollback note may *name* the old statement.
      .map((name) =>
        readFileSync(path.join(REPO_ROOT, "supabase/migrations", name), "utf8").replace(/^\s*--.*$/gm, "")
      );

    it("no later migration re-creates a table of one-time links", () => {
      for (const sql of LATER) expect(sql).not.toMatch(/create\s+table\s+(public\.)?auth_links/i);
    });

    it("the drop is `if exists`, so a replay on a database that never had the table is safe", () => {
      const sql = readFileSync(USERS_IDENTITY_SUPABASE_AUTH_MIGRATION, "utf8");
      expect(sql).toMatch(/drop\s+table\s+if\s+exists\s+auth_links/i);
      expect(sql).toMatch(/drop\s+column\s+if\s+exists\s+sessions_valid_from/i);
    });

    it("the pending change still names its one link — pending_email_token_hash stays, now holding Supabase's hashed_token", () => {
      const userId = freshUserId();
      psql([
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `update users set pending_email = 'next-${userId}@example.com', pending_email_token_hash = 'supabase-hash', pending_email_sent_at = now() where id = '${userId}';`,
      ]);
      expect(
        psqlRows(`select id from users where pending_email_token_hash = 'supabase-hash' and id = '${userId}';`)
      ).toEqual([[userId]]);
    });
  }
);

describe(
  '`structure.md` rule 3a — each identity migration carries exactly one sub-token, and resolves to the leaf that owns those columns',
  () => {
    it("every identity filename resolves to users_identity", () => {
      expect(topicOf("20260906100000_users_identity_columns.sql")).toEqual({
        token: "users_identity",
        owner: "BP-061",
      });
      expect(topicOf("20260906100100_users_identity_links.sql")).toEqual({
        token: "users_identity",
        owner: "BP-061",
      });
      expect(topicOf("20260910120000_users_identity_supabase_auth.sql")).toEqual({
        token: "users_identity",
        owner: "BP-061",
      });
    });

    it("the baseline file is unmodified — no identity column arrives in it", () => {
      const baselineText = readFileSync(BASELINE_MIGRATION, "utf8");
      expect(baselineText).not.toMatch(/\bpending_email\b/);
      expect(baselineText).not.toMatch(/\bauth_links\b/);
      expect(baselineText).not.toMatch(/\bsessions_valid_from\b/);
    });

    it("neither identity migration introduces an on-delete cascade", () => {
      for (const file of [
        USERS_IDENTITY_COLUMNS_MIGRATION,
        USERS_IDENTITY_LINKS_MIGRATION,
        USERS_IDENTITY_SUPABASE_AUTH_MIGRATION,
      ]) {
        // Comments stripped: both files *name* ADR-051 point 2 in prose, and
        // a promise stated in a header must not fail the test that checks
        // the promise is kept — the same footing the TypeScript suites in
        // `tests/account/**` strip their own sources on.
        const sql = readFileSync(file, "utf8").replace(/^\s*--.*$/gm, "");
        expect(sql).not.toMatch(/on delete cascade/i);
      }
    });
  }
);
// ── BUILD §13, issue #34 — the subscription gate and the hosting clock

describe("ADR-050 — users.paid_through is the gate, and plan_status carries the landmine", () => {
  it("paid_through is timestamptz, NOT NULL, and defaults to now()", () => {
    // Not null because the gate has no third answer: a null would have to
    // mean either "no access" or "access we have not heard about yet", and
    // every caller would pick for itself. The default is what keeps
    // provisioning's own insert legal in the seconds before the first
    // subscription event lands.
    const rows = psqlRows(
      `select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'paid_through';`
    );
    expect(rows).toEqual([["timestamp with time zone", "NO", "now()"]]);
  });

  it("an insert naming neither paid_through nor a subscription still opens an account", () => {
    // `src/lib/account/store.ts`'s `insertAccount` names neither column.
    // Dropping the default would turn a paid customer's provisioning into a
    // constraint violation.
    const userId = freshUserId();
    const rows = psqlRows(`select paid_through is not null from users where id = '${userId}';`);
    expect(rows).toEqual([["t"]]);
  });

  it("cancelled_at exists, is nullable, and is a different column from paid_through", () => {
    // REQ-076 c3: the cancellation stamp and the date access ends are two
    // facts. A cancelled account keeps access until the date passes.
    const rows = psqlRows(
      `select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name in ('cancelled_at', 'stripe_subscription_id', 'last_subscription_event_id') order by column_name;`
    );
    expect(rows).toEqual([
      ["cancelled_at", "timestamp with time zone", "YES"],
      ["last_subscription_event_id", "text", "YES"],
      ["stripe_subscription_id", "text", "YES"],
    ]);
  });

  it("paid_through is indexed — the gate is read three times per unit of scheduled work", () => {
    const rows = psqlRows(
      `select indexname from pg_indexes where schemaname = 'public' and tablename = 'users' and indexdef like '%paid_through%';`
    );
    expect(rows).toEqual([["users_paid_through_idx"]]);
  });

  it("plan_status carries the comment recording that no gate reads it", () => {
    // The one place the schema itself carries ADR-050's warning, so a
    // reader meets the landmine where they meet the column.
    const rows = psqlRows(
      `select col_description('public.users'::regclass, (select ordinal_position from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'plan_status')::int);`
    );
    const [[comment]] = rows as [[string]];
    expect(comment).toContain("read by no gate");
    expect(comment).toContain("ADR-050");
    expect(comment).toContain("paid_through");
  });
});

describe("REQ-076 c10, c11 — the hosted-retention clock and the two notice stamps", () => {
  it("the three sites columns exist, are timestamptz and are nullable", () => {
    const rows = psqlRows(
      `select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'sites' and column_name in ('hosted_serving_ends_at', 'hosting_end_notice_at', 'hosting_end_reminder_at') order by column_name;`
    );
    expect(rows).toEqual([
      ["hosted_serving_ends_at", "timestamp with time zone", "YES"],
      ["hosting_end_notice_at", "timestamp with time zone", "YES"],
      ["hosting_end_reminder_at", "timestamp with time zone", "YES"],
    ]);
  });

  it("the two notices are two columns, so which one is missing is visible", () => {
    // BP-060 decision 3: `sitesDueHostingStop` refuses a site missing
    // either, and an operator needs to know which. A count could not say.
    const userId = freshUserId();
    const siteId = freshSiteId(userId);
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `update sites set hosting_end_notice_at = now() where id = '${siteId}';`,
    ]);
    const rows = psqlRows(
      `select hosting_end_notice_at is not null, hosting_end_reminder_at is null from sites where id = '${siteId}';`
    );
    expect(rows).toEqual([["t", "t"]]);
  });

  it("hosted_serving_ends_at is indexed — the due-work queries read it every tick", () => {
    const rows = psqlRows(
      `select indexname from pg_indexes where schemaname = 'public' and tablename = 'sites' and indexdef like '%hosted_serving_ends_at%';`
    );
    expect(rows).toEqual([["sites_hosted_serving_ends_at_idx"]]);
  });

  it("ADR-051 point 2 — nothing added by these two migrations cascades", () => {
    const rows = psqlRows(
      `select conname from pg_constraint where contype = 'f' and confdeltype <> 'a' and conrelid in ('public.users'::regclass, 'public.sites'::regclass);`
    );
    expect(rows).toEqual([]);
  });
});

describe("structure.md rule 3a — the two sub-tokens", () => {
  it("each migration file carries its own sub-token and no other", () => {
    const subscription = readFileSync(USERS_SUBSCRIPTION_MIGRATION, "utf8");
    const hosting = readFileSync(SITES_HOSTING_MIGRATION, "utf8");
    expect(subscription).toContain("users_subscription");
    expect(hosting).toContain("sites_hosting");
    // The subscription file touches `users` alone; the hosting file `sites`
    // alone. A file that altered both would own two topics.
    expect(subscription).not.toMatch(/alter table sites/);
    expect(hosting).not.toMatch(/alter table users/);
  });

  it("both topics resolve through the one topic map", () => {
    expect(topicOf(path.basename(USERS_SUBSCRIPTION_MIGRATION))).toBeTruthy();
    expect(topicOf(path.basename(SITES_HOSTING_MIGRATION))).toBeTruthy();
  });
});
