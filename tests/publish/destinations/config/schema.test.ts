// tests/publish/destinations/config/schema.test.ts — BUILD §9, the
// `destinations` migration.
//
// **Asserted against the migration text, not against a live database.**
// The `db` vitest project runs against a real Postgres and its file list
// lives in `vitest.config.ts`, which is the owner's; a feature PR that
// added a row to it would be editing an owner file. So this suite reads
// the SQL the migration ships and asserts the shape it declares, and the
// live-schema half is the owner's to fold into the `db` project. The
// migration was applied by hand against a scratch database while this was
// written — what that proved is stated in the PR, not here.
//
// The archived plan is WO-223.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { topicOf } from "@/lib/db/topics";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../../supabase/migrations");
const FILE = "20260906140000_destinations_core.sql";
const SQL = readFileSync(path.join(MIGRATIONS, FILE), "utf8");
/** The stamp capability's own migration (issue #160) — the same topic, a
 *  later file, and asserted here for the same reason: `vitest.config.ts`'s
 *  `db` project list is the owner's. */
const STAMP_FILE = "20260907113000_destinations_stamp.sql";
/** SPEC §5's ruling of 2026-09-12 (issue #322): the customer's own host
 *  and what the project's domain list says about it. */
const HOSTNAME_FILE = "20260912120000_destinations_hostname.sql";
const STAMP_SQL = readFileSync(path.join(MIGRATIONS, STAMP_FILE), "utf8");

/** The eight `HealthReason` members, as the type declares them. */
const REASONS = [
  "never_connected",
  "dns_unset",
  "dns_elsewhere",
  "credentials_expired",
  "credentials_invalid",
  "unreachable",
  "destination_rejected",
  "cannot_publish",
] as const;

describe("the migration is on the destinations topic", () => {
  it("its name carries exactly one assigned topic token", () => {
    expect(topicOf(FILE)).toEqual({ token: "destinations", owner: "BP-058" });
    expect(topicOf(STAMP_FILE)).toEqual({ token: "destinations", owner: "BP-058" });
    expect(topicOf(HOSTNAME_FILE)).toEqual({ token: "destinations", owner: "BP-058" });
  });

  it("these are the only migrations on that topic beyond the baseline", () => {
    const onTopic = readdirSync(MIGRATIONS)
      .filter((name) => name.endsWith(".sql"))
      .filter((name) => topicOf(name)?.token === "destinations");
    expect(onTopic).toEqual([FILE, STAMP_FILE, HOSTNAME_FILE]);
  });
});

describe("the state and the last-checked date have somewhere to live", () => {
  it("`health_reason` is nullable and constrained to exactly the eight reasons", () => {
    expect(SQL).toMatch(/add column health_reason text null/);
    const check = /health_reason in \(([\s\S]*?)\)/.exec(SQL)?.[1] ?? "";
    const listed = [...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(listed).toEqual([...REASONS]);
  });

  it("`last_checked_at` is not null — a destination with no date is a date a surface would have to invent", () => {
    expect(SQL).toMatch(/add column last_checked_at timestamptz not null/);
  });

  it("`health` is not widened: §10's three states are untouched by this migration", () => {
    // ADR-086: a credential that cannot publish is a reason, never a
    // fourth state. A migration that altered the `health` check would be
    // the change that decision forbids.
    expect(SQL).not.toMatch(/drop constraint[\s\S]*health/i);
    expect(SQL).not.toMatch(/alter column health/i);
  });
});

describe("the breakage clock and the once-per-breakage guard exist", () => {
  it("`health_changed_at` is not null — the 24 hours are counted from it", () => {
    expect(SQL).toMatch(/add column health_changed_at timestamptz not null/);
  });

  it("`broken_mail_sent_at` is nullable — null is 'not written to about this breakage yet'", () => {
    expect(SQL).toMatch(/add column broken_mail_sent_at timestamptz null/);
  });
});

describe("one live destination per site, enforced by the database", () => {
  it("the unique index is on `(site_id)` and is partial on `deleted_at is null`", () => {
    expect(SQL).toMatch(
      /create unique index destinations_one_live_per_site\s+on destinations \(site_id\)\s+where deleted_at is null/
    );
  });

  it("dropping the `where` clause would stop a disconnect-then-connect from working — the reason it is partial, stated in the file", () => {
    // The discriminating property: a soft-deleted row must be out of the
    // index. Without the predicate the index would be total, and the row
    // a disconnect keeps would block the connection that replaces it.
    const index = /create unique index destinations_one_live_per_site[\s\S]*?;/.exec(SQL)?.[0] ?? "";
    expect(index).toContain("where deleted_at is null");
  });

  it("`deleted_at` is nullable: disconnect keeps the row", () => {
    expect(SQL).toMatch(/add column deleted_at timestamptz null/);
  });
});

describe("no cascade reaches publications (ADR-080)", () => {
  it("the migration declares no `on delete cascade` at all", () => {
    expect(SQL.toLowerCase()).not.toContain("on delete cascade");
  });

  it("it declares no foreign key from destinations toward publications", () => {
    expect(SQL.toLowerCase()).not.toMatch(/references\s+publications/);
  });

  it("the baseline's own `destinations` foreign key carries no cascade either", () => {
    const baseline = readFileSync(path.join(MIGRATIONS, "00000000000001_baseline.sql"), "utf8");
    const table = /create table destinations \(([\s\S]*?)\);/.exec(baseline)?.[1] ?? "";
    expect(table).toContain("references sites (id)");
    expect(table.toLowerCase()).not.toContain("on delete cascade");
  });
});

describe("`publish_capable` is the one probe result that is a health input", () => {
  it("it is nullable — null for a hosted destination and before the first probe", () => {
    expect(SQL).toMatch(/add column publish_capable boolean null/);
  });
});

describe("`stamp_capable` is its sibling and not its second value (issue #160)", () => {
  it("it is nullable with no default — three values, and the third is 'nobody asked'", () => {
    expect(STAMP_SQL).toMatch(/add column stamp_capable boolean null/);
    // A default would erase "not asked" and "could not be asked" into
    // "the answer is no", which is what tells a customer their posts are
    // gathered nowhere when nothing has looked.
    expect(STAMP_SQL).not.toMatch(/stamp_capable boolean[^;]*default/i);
  });

  it("it is one column on one table and touches nothing else", () => {
    const statements = STAMP_SQL.split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(statements).toMatch(/alter table destinations/);
    expect(statements.toLowerCase()).not.toContain("create index");
    expect(statements.toLowerCase()).not.toContain("alter column health");
    // One `add column`, and it is this one: the sibling column is named in
    // the comment and altered nowhere.
    expect(statements.match(/add column/g)).toHaveLength(1);
    expect(statements.toLowerCase()).not.toMatch(/(add|alter|drop) column publish_capable/);
  });

  it("the column says in the database itself that it is not a health input", () => {
    const comment = /comment on column destinations\.stamp_capable is([\s\S]*?);/.exec(STAMP_SQL)?.[1] ?? "";
    expect(comment).toContain("NOT a health input");
  });
});
