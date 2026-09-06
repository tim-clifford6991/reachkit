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
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { topicOf } from "../../src/lib/db/topics";

const DB_HOST = "127.0.0.1";
const DB_PORT = "5432";
const DB_USER = "reachkit";
const DB_PASSWORD = "reachkit";
const DB_NAME = "reachkit_scratch";
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

function psql(args: string[]): string {
  return execFileSync("psql", ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME, "-q", ...args], {
    env: { ...process.env, PGPASSWORD: DB_PASSWORD },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

/** One tuple-only row per line, `|`-separated columns — easy to split. */
function psqlRows(sql: string): string[][] {
  const out = psql(["-v", "ON_ERROR_STOP=1", "-Atc", sql]);
  return out
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("|"));
}

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
  'BP-017 `## Data model delta`: "`users` — as `BUILD.md` §10, plus `notify jsonb`, …"',
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
