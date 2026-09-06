// tests/account/lifecycle/schema.test.ts — REQ-079 c2, c5, c7; ADR-051
//
// The migration text, read from disk. The live-schema assertions belong to
// the `db` project, which needs the local Postgres substrate and the
// owner's config; what is asserted here is what a feature PR can assert
// without one — that the SQL says what the requirement needs it to say, and
// that nothing in this repository's migrations adds a cascade that could
// delete a customer's rows without the purge.
//
// **The no-cascade sweep is a whole-repository invariant**, not a check on
// this issue's two files: it is the one an unrelated migration will break.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { topicOf } from "@/lib/db/topics";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");

const FILES = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql"));
const SOURCES = new Map(FILES.map((name) => [name, readFileSync(path.join(MIGRATIONS, name), "utf8")]));

function source(name: string): string {
  const text = SOURCES.get(name);
  if (text === undefined) throw new Error(`${name} is not in supabase/migrations/`);
  return text;
}

const USERS_ERASURE = "20260906150000_users_erasure_columns.sql";
const TICKETS = "20260906150100_users_erasure_tickets.sql";

describe("`structure.md` rule 3a — the two files carry the users_erasure sub-token", () => {
  it("both resolve to BP-063, the erasure leaf, and not to the users topic's owner", () => {
    for (const file of [USERS_ERASURE, TICKETS]) {
      expect(topicOf(file)).toEqual({ token: "users_erasure", owner: "BP-063" });
    }
  });
});

describe("REQ-079 c7 — the promised purge date is stored, and the tombstone is not re-created", () => {
  it("users.purge_due_at is added, nullable and timestamped", () => {
    expect(source(USERS_ERASURE)).toMatch(/add column purge_due_at timestamptz null/);
  });

  it("it is indexed, so the due-work query is one scan", () => {
    expect(source(USERS_ERASURE)).toMatch(/create index users_purge_due_idx\s+on users \(purge_due_at\)/);
  });

  it("users.deleted_at is not created here — it is the RLS baseline's, and a second add column would fail the apply", () => {
    expect(source(USERS_ERASURE)).not.toMatch(/add column deleted_at/);
    expect(source("00000000000002_rls.sql")).toMatch(/add column deleted_at timestamptz/);
  });

  it("the tombstone carries ADR-051's ruling as a comment on the column it governs", () => {
    const comment = source(USERS_ERASURE).match(/comment on column users\.deleted_at is\s+'([^']*(?:''[^']*)*)'/);
    expect(comment?.[1] ?? "").not.toBe("");
    expect(comment?.[1]).toMatch(/tombstone/i);
    expect(comment?.[1]).toMatch(/cascade/i);
  });

  it("the promised date's comment says it is never recomputed", () => {
    expect(source(USERS_ERASURE)).toMatch(/comment on column users\.purge_due_at is/);
    expect(source(USERS_ERASURE)).toMatch(/never recomputed/);
  });
});

describe("REQ-079 c2 — a ticket is a row with taken_at, spent_at and an expiry", () => {
  it("danger_tickets carries taken_at, spent_at and expires_at", () => {
    const sql = source(TICKETS);
    expect(sql).toMatch(/create table danger_tickets/);
    expect(sql).toMatch(/taken_at timestamptz null/);
    expect(sql).toMatch(/spent_at timestamptz null/);
    expect(sql).toMatch(/expires_at timestamptz not null/);
  });

  it("its action column admits exactly the two REQ-079 c1 closes the offer at", () => {
    expect(source(TICKETS)).toMatch(
      /check \(action in \('unpublish_all', 'delete_account'\)\)/
    );
  });

  it("RLS is on and it carries a policy, so the table cannot leak by omission", () => {
    expect(source(TICKETS)).toMatch(/alter table danger_tickets enable row level security/);
    expect(source(TICKETS)).toMatch(/create policy danger_tickets_no_access/);
  });

  it("its foreign key carries no cascade — the purge removes the row with the account", () => {
    expect(source(TICKETS)).toMatch(/site_id uuid not null references sites \(id\)(?!\s+on delete)/);
  });
});

describe("REQ-079 c5 — the publishing switch already exists and is not re-added", () => {
  it("sites.publishing_enabled is declared once, not null, defaulting true", () => {
    const declaring = FILES.filter((file) =>
      /add column publishing_enabled|publishing_enabled boolean/.test(source(file))
    );
    expect(declaring).toEqual(["20260906120200_sites_publishing.sql"]);
    expect(source("20260906120200_sites_publishing.sql")).toMatch(
      /publishing_enabled boolean not null default true/
    );
  });
});

describe("ADR-051 point 7 — no foreign key anywhere carries a cascade", () => {
  it("no migration in this repository declares on delete cascade", () => {
    for (const [file, sql] of SOURCES) {
      expect(
        sql.replace(/--.*$/gm, ""),
        `${file} adds a cascade — ADR-051: the purge is the only deleter, and a cascade is a delete nobody asked for`
      ).not.toMatch(/on\s+delete\s+cascade/i);
    }
  });

  it("watch it fail first: the sweep flags a fixture that does", () => {
    expect("references users (id) on delete cascade").toMatch(/on\s+delete\s+cascade/i);
  });

  it("the sweep actually read the migrations — an empty sweep passes vacuously", () => {
    expect(SOURCES.size).toBeGreaterThan(20);
  });
});
