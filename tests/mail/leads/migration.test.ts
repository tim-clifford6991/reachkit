// BUILD §4.2 — the two migrations, asserted against the schema they build.
//
// **Promoted to a live-schema suite (issue #78, via #6).** This file used
// to assert the migrations' *text*, because `vitest.config.ts`'s
// `LIVE_SCHEMA_TESTS` — both the `db` project's `include` and the `node`
// project's `exclude` — is an owner file a feature PR could not add a row
// to. Issue #6 owns that file and adds the row, so the columns, the three
// indexes and the suppression table are now queried out of
// `information_schema` / `pg_indexes` / `pg_policies` on a scratch database
// with the baseline plus `*_leads_sequence*.sql` and
// `*_suppressions_email*.sql` applied.
//
// **The predicate is the point.** `where sequence_state is not null` *is*
// REQ-010 criterion 13 (ADR-041). A full unique index would forbid the
// second `leads` row the criterion requires to exist; no index at all would
// make the cap a running total maintained by application code, which is the
// alternative BP-029 decision 1 rejected in so many words. That is now
// asserted as behaviour — the second row inserts, the second *sequenced*
// row does not — rather than as a substring.
//
// **Run this file with `--no-file-parallelism`** alongside the rest of the
// `db` project — every file in it resets and rebuilds the same physical
// `public` schema.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { topicOf } from "../../../src/lib/db/topics";

const DB_HOST = "127.0.0.1";
const DB_PORT = "5432";
const DB_USER = "reachkit";
const DB_PASSWORD = "reachkit";
const DB_NAME = process.env.REACHKIT_DB_NAME ?? "reachkit_scratch";
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const MIGRATIONS = path.join(REPO_ROOT, "supabase/migrations");
const BASELINE_MIGRATION = path.join(MIGRATIONS, "00000000000001_baseline.sql");

function migrationName(token: string): string {
  const name = readdirSync(MIGRATIONS).find((file) => file.includes(token));
  if (name === undefined) throw new Error(`no migration carrying "${token}" on disk`);
  return name;
}

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

function resetSchema(): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
}

/** `leads.scan_id` is not null and references `scans`, so every lead below
 *  hangs off one scan row created here. */
let SCAN_ID = "";

beforeAll(() => {
  resetSchema();
  psql(["-v", "ON_ERROR_STOP=1", "-f", BASELINE_MIGRATION]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, migrationName("leads_sequence"))]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, migrationName("suppressions_email"))]);
  const [row] = psqlRows(
    `insert into scans (domain, tier, status) values ('leads-fixture.example.com', 'free', 'done') returning id;`
  );
  SCAN_ID = row?.[0] ?? "";
  if (!SCAN_ID) throw new Error("fixture scan insert returned no id");
});

afterAll(() => {
  resetSchema();
});

/** Inserts a lead, returning whether the insert was refused. */
function insertLead(opts: { email: string; domain: string; sequenceState?: string | null }): boolean {
  const { email, domain, sequenceState = null } = opts;
  return raises(
    `insert into leads (scan_id, email, domain, sequence_state) values ` +
      `('${SCAN_ID}', '${email}', '${domain}', ${sequenceState === null ? "null" : `'${sequenceState}'`});`
  );
}

function columnOf(table: string, column: string): string[] {
  const [row] = psqlRows(
    `select data_type, is_nullable, coalesce(column_default, '') from information_schema.columns ` +
      `where table_schema = 'public' and table_name = '${table}' and column_name = '${column}';`
  );
  return row ?? [];
}

function indexdef(name: string): string {
  const [row] = psqlRows(`select indexdef from pg_indexes where schemaname = 'public' and indexname = '${name}';`);
  return row?.[0] ?? "";
}

describe("REQ-010 c13 — the criterion is a unique index, not a branch", () => {
  it("the unique index is over (lower(email), domain) and partial on sequence_state", () => {
    expect(indexdef("idx_leads_one_sequence_per_address_domain")).toMatch(
      /CREATE UNIQUE INDEX idx_leads_one_sequence_per_address_domain ON public\.leads USING btree \(lower\(email\), domain\) WHERE \(sequence_state IS NOT NULL\)/
    );
  });

  it("one address cannot hold two live sequences for one domain", () => {
    expect(insertLead({ email: "c13@example.com", domain: "c13.example.com", sequenceState: "running" })).toBe(false);
    expect(insertLead({ email: "C13@example.com", domain: "c13.example.com", sequenceState: "waiting" })).toBe(true);
  });

  it("the predicate is what lets the second leads row exist at all — a full unique index would forbid it", () => {
    // The mutation this guards: drop `where sequence_state is not null` and
    // a re-scan by the same address for the same domain can no longer be
    // captured, which is criterion 13's own premise ("when that domain's
    // page is delivered to that address again"). With the predicate, the
    // unsequenced re-capture inserts freely.
    expect(insertLead({ email: "recapture@example.com", domain: "recapture.example.com" })).toBe(false);
    expect(insertLead({ email: "recapture@example.com", domain: "recapture.example.com" })).toBe(false);
    expect(
      psqlRows(`select count(*) from leads where domain = 'recapture.example.com';`)
    ).toEqual([["2"]]);
  });
});

describe("REQ-010 c12 — the storage half of one sequence at a time, in delivery order", () => {
  it("page_delivered_at is a column — the anchor the 7-day deadline is measured from", () => {
    expect(columnOf("leads", "page_delivered_at")).toEqual(["timestamp with time zone", "YES", ""]);
  });

  it("the due-work index and the release-ordering index both exist", () => {
    expect(indexdef("idx_leads_due_touches")).toMatch(
      /CREATE INDEX idx_leads_due_touches ON public\.leads USING btree \(sequence_state, next_touch_at\)/
    );
    expect(indexdef("idx_leads_release_order")).toMatch(
      /CREATE INDEX idx_leads_release_order ON public\.leads USING btree \(lower\(email\), page_delivered_at\)/
    );
  });

  it("sequence_state is constrained to the five lifetimes and nothing else", () => {
    for (const state of ["waiting", "running", "finished", "dropped", "stopped"]) {
      expect(insertLead({ email: `state-${state}@example.com`, domain: "states.example.com", sequenceState: state })).toBe(
        false
      );
    }
    expect(insertLead({ email: "state-bogus@example.com", domain: "states.example.com", sequenceState: "paused" })).toBe(
      true
    );
  });
});

describe("REQ-010 c8 — the retry window is measured from a stored fact", () => {
  it("first_page_state carries the two things owed, the written stage and the terminal one", () => {
    expect(columnOf("leads", "first_page_state")).toEqual(["text", "NO", "'pending'::text"]);
    for (const state of ["pending", "written", "sent", "notice_sent", "abandoned"]) {
      expect(
        raises(
          `insert into leads (scan_id, email, domain, first_page_state) values ` +
            `('${SCAN_ID}', 'fps-${state}@example.com', 'fps.example.com', '${state}');`
        )
      ).toBe(false);
    }
    expect(
      raises(
        `insert into leads (scan_id, email, domain, first_page_state) values ` +
          `('${SCAN_ID}', 'fps-bogus@example.com', 'fps.example.com', 'queued');`
      )
    ).toBe(true);
  });

  it("the first attempt's time and the attempt count are columns, not an in-memory counter", () => {
    expect(columnOf("leads", "first_page_first_attempt_at")).toEqual(["timestamp with time zone", "YES", ""]);
    expect(columnOf("leads", "first_page_attempts")).toEqual(["integer", "NO", "0"]);
  });

  it("the written page is stored against the lead, so a retry re-sends it and never re-writes it", () => {
    expect(columnOf("leads", "first_page_title")).toEqual(["text", "YES", ""]);
    expect(columnOf("leads", "first_page_markdown")).toEqual(["text", "YES", ""]);
  });
});

describe("BP-029 decision 1 — the sequence's natural key needs a domain column on leads", () => {
  it("domain is not null, and the default that makes the add safe is dropped again", () => {
    expect(columnOf("leads", "domain")).toEqual(["text", "NO", ""]);
    expect(
      raises(`insert into leads (scan_id, email) values ('${SCAN_ID}', 'no-domain@example.com');`)
    ).toBe(true);
  });
});

describe("ADR-042 — two stores, and this is the address-keyed one", () => {
  it("email_suppressions is keyed by a lowercased address, with the two causes closed", () => {
    const [pk] = psqlRows(
      `select kcu.column_name from information_schema.table_constraints tc ` +
        `join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name ` +
        `where tc.table_schema = 'public' and tc.table_name = 'email_suppressions' and tc.constraint_type = 'PRIMARY KEY';`
    );
    expect(pk).toEqual(["email"]);

    expect(raises(`insert into email_suppressions (email, cause) values ('Sup@Example.com', 'opt_out');`)).toBe(true);
    expect(raises(`insert into email_suppressions (email, cause) values ('sup@example.com', 'opt_out');`)).toBe(false);
    expect(raises(`insert into email_suppressions (email, cause) values ('sup@example.com', 'opt_out');`)).toBe(true);
    expect(raises(`insert into email_suppressions (email, cause) values ('sub@example.com', 'subscribed');`)).toBe(false);
    expect(raises(`insert into email_suppressions (email, cause) values ('bounce@example.com', 'bounced');`)).toBe(true);
  });

  it("it names no user and no notification kind — the other mechanism is reachable from nowhere here", () => {
    const columns = psqlRows(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'email_suppressions' order by column_name;`
    ).map(([name]) => name);
    expect(columns).toEqual(["at", "cause", "email"]);
  });

  it("RLS is enabled, so the table is default-deny before any policy exists", () => {
    expect(psqlRows(`select relrowsecurity from pg_class where oid = 'public.email_suppressions'::regclass;`)).toEqual([
      ["t"],
    ]);
  });

  it("no policy is granted: every entry point is server-side through dbAdmin()", () => {
    expect(
      psqlRows(`select policyname from pg_policies where schemaname = 'public' and tablename = 'email_suppressions';`)
    ).toEqual([]);
    // Default-deny is observable, not just declared: the grants let `anon`
    // reach the table, and RLS with no policy still returns nothing.
    expect(psqlRows(`set role anon; select count(*) from email_suppressions;`)).toEqual([["0"]]);
  });
});

describe("`structure.md` rule 3 — each migration carries exactly one assigned topic token", () => {
  it("the leads migration resolves to the leads topic and its owner", () => {
    expect(topicOf(migrationName("leads_sequence"))).toEqual({ token: "leads", owner: "BP-029" });
  });

  it("the suppressions migration resolves to the suppressions topic and its owner", () => {
    expect(topicOf(migrationName("suppressions_email"))).toEqual({
      token: "suppressions",
      owner: "BP-029",
    });
  });
});
