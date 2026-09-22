// tests/publish/reads/schema.test.ts — SPEC §6 (2026-09-20, #908) measure
// (d) · SPEC §7 of the same date, issue #921, against a live database.
//
// The migration's own claims, exercised rather than read:
//
//   · **The table holds counts and nothing else.** No column on it can carry
//     an address, an agent string, an IP or a time finer than a day — §7's
//     "no visitor identity" as a property of the schema rather than a
//     promise about the code above it.
//   · **`engine` and `kind` are closed**, so a writer cannot invent a sixth
//     engine or a reason nobody named.
//   · **The pair must agree**: a site paired with another customer's page
//     files nothing at all.
//   · **The write is its own retention sweep**, and it is narrowed to the
//     site the hit belongs to.
//   · **RLS lets one account read their own counts and nobody else's**, and
//     grants `authenticated` no way to write one.
//
// `tests/db/rls.test.ts` proves the baseline's own policies; this file
// proves the one this migration adds, which that one does not apply. It is
// a `db`-project suite (`vitest.config.ts`'s `LIVE_SCHEMA_TESTS`), so it
// runs against `scripts/db-substrate/` in CI's `schema · RLS` gate.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "../../db/substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const APPLIED = [
  "00000000000001_baseline.sql",
  "00000000000002_rls.sql",
  "20260922120000_publications_reads.sql",
];

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

function one(sql: string): string {
  const [row] = psqlRows(sql);
  const id = row?.[0];
  if (!id) throw new Error(`no id from: ${sql}`);
  return id;
}

function makeUser(email: string): string {
  return one(`insert into users (email, plan_status) values ('${email}', 'active') returning id;`);
}

/** A site with one live hosted page, built through the chain the product
 *  itself builds it through: scan → opportunity → draft → publication. */
function makeSiteWithPage(userId: string, domain: string): { siteId: string; pageId: string } {
  const siteId = one(
    `insert into sites (user_id, domain) values ('${userId}', '${domain}') returning id;`
  );
  const scanId = one(
    `insert into scans (site_id, domain, tier, status) values ('${siteId}', '${domain}', 'deep', 'done') returning id;`
  );
  const opportunityId = one(
    `insert into opportunities (site_id, scan_id, type, family, target_query, proposed_slug, title) ` +
      `values ('${siteId}', '${scanId}', 'answer_page', 'write', 'a query', 'a-slug', 'A title') returning id;`
  );
  const draftId = one(
    `insert into drafts (opportunity_id, site_id, state, title) ` +
      `values ('${opportunityId}', '${siteId}', 'published', 'A page') returning id;`
  );
  const pageId = one(
    `insert into publications (draft_id, site_id, destination, live_url, published_at, mode) ` +
      `values ('${draftId}', '${siteId}', 'hosted', 'https://content.${domain}/a-slug', now(), 'autopilot') returning id;`
  );
  return { siteId, pageId };
}

function asUser(userId: string, sql: string): string[][] {
  return psqlRows(
    `set local role authenticated; ` +
      `set local "request.jwt.claims" = '{"sub":"${userId}","role":"authenticated"}'; ` +
      sql
  );
}

function asUserRaises(userId: string, sql: string): boolean {
  return raises(
    `begin; set local role authenticated; ` +
      `set local "request.jwt.claims" = '{"sub":"${userId}","role":"authenticated"}'; ` +
      sql +
      ` commit;`
  );
}

/** One counted read, through the function the route calls. */
function count(
  siteId: string,
  pageId: string,
  day: string,
  engine = "chatgpt",
  kind = "answer_fetch",
  keepDays = 28
): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `select record_publication_read('${siteId}', '${pageId}', '${day}'::date, '${engine}', '${kind}', ${keepDays});`,
  ]);
}

function hits(pageId: string, day: string, engine = "chatgpt", kind = "answer_fetch"): number {
  const [row] = psqlRows(
    `select hits from publication_reads where publication_id = '${pageId}' and day = '${day}'::date ` +
      `and engine = '${engine}' and kind = '${kind}';`
  );
  return row?.[0] === undefined ? 0 : Number(row[0]);
}

let OWNER_ID = "";
let OTHER_ID = "";
let OWNED = { siteId: "", pageId: "" };
let OTHER = { siteId: "", pageId: "" };

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  OWNER_ID = makeUser("owner-921@example.com");
  OTHER_ID = makeUser("other-921@example.com");
  OWNED = makeSiteWithPage(OWNER_ID, "owned-921.example.com");
  OTHER = makeSiteWithPage(OTHER_ID, "other-921.example.com");
});

afterAll(() => {
  resetSchema();
});

describe("§7 — the table holds counts, and there is nothing else on it to hold", () => {
  it("its columns are exactly the site, the page, the day, the engine, the reason and the count", () => {
    const rows = psqlRows(
      `select column_name from information_schema.columns where table_schema = 'public' ` +
        `and table_name = 'publication_reads' order by column_name;`
    );
    expect(rows.map((row) => row[0])).toEqual([
      "day",
      "engine",
      "hits",
      "kind",
      "publication_id",
      "site_id",
    ]);
  });

  it("the finest time it can record is a day", () => {
    const [row] = psqlRows(
      `select data_type from information_schema.columns where table_schema = 'public' ` +
        `and table_name = 'publication_reads' and column_name = 'day';`
    );
    expect(row?.[0]).toBe("date");
  });

  it("row level security is on", () => {
    const [row] = psqlRows(
      `select relrowsecurity from pg_class where relname = 'publication_reads';`
    );
    expect(row?.[0]).toBe("t");
  });
});

describe("the roll-up: one cell per site, page, day, engine and reason", () => {
  it("the first read makes the cell and the second increments it", () => {
    count(OWNED.siteId, OWNED.pageId, "2026-09-20");
    expect(hits(OWNED.pageId, "2026-09-20")).toBe(1);
    count(OWNED.siteId, OWNED.pageId, "2026-09-20");
    count(OWNED.siteId, OWNED.pageId, "2026-09-20");
    expect(hits(OWNED.pageId, "2026-09-20")).toBe(3);
  });

  it("a different reason is a different cell — a fetch never lands on a visitor", () => {
    count(OWNED.siteId, OWNED.pageId, "2026-09-20", "chatgpt", "referral");
    expect(hits(OWNED.pageId, "2026-09-20", "chatgpt", "answer_fetch")).toBe(3);
    expect(hits(OWNED.pageId, "2026-09-20", "chatgpt", "referral")).toBe(1);
  });

  it("a different engine and a different day are different cells too", () => {
    count(OWNED.siteId, OWNED.pageId, "2026-09-20", "claude");
    count(OWNED.siteId, OWNED.pageId, "2026-09-21");
    expect(hits(OWNED.pageId, "2026-09-20", "claude")).toBe(1);
    expect(hits(OWNED.pageId, "2026-09-21")).toBe(1);
  });
});

describe("the closed sets, refused by the database", () => {
  it("an engine nobody named is refused", () => {
    expect(
      raises(
        `insert into publication_reads (site_id, publication_id, day, engine, kind) values ` +
          `('${OWNED.siteId}', '${OWNED.pageId}', '2026-09-22'::date, 'grok', 'answer_fetch');`
      )
    ).toBe(true);
  });

  it("a reason nobody named is refused — including a sentiment", () => {
    expect(
      raises(
        `insert into publication_reads (site_id, publication_id, day, engine, kind) values ` +
          `('${OWNED.siteId}', '${OWNED.pageId}', '2026-09-22'::date, 'chatgpt', 'sentiment');`
      )
    ).toBe(true);
  });

  it("a zero count is refused — a row exists because something was counted", () => {
    expect(
      raises(
        `insert into publication_reads (site_id, publication_id, day, engine, kind, hits) values ` +
          `('${OWNED.siteId}', '${OWNED.pageId}', '2026-09-22'::date, 'chatgpt', 'answer_fetch', 0);`
      )
    ).toBe(true);
  });
});

describe("the pair must agree — a read is never filed under the wrong blog", () => {
  it("one customer's site with another's page counts nothing at all", () => {
    count(OWNED.siteId, OTHER.pageId, "2026-09-22");
    expect(
      psqlRows(`select 1 from publication_reads where publication_id = '${OTHER.pageId}';`)
    ).toHaveLength(0);
  });

  it("a page that does not exist counts nothing, and does not raise", () => {
    expect(
      raises(
        `select record_publication_read('${OWNED.siteId}', '00000000-0000-0000-0000-000000000000'::uuid, ` +
          `'2026-09-22'::date, 'chatgpt', 'answer_fetch', 28);`
      )
    ).toBe(false);
  });
});

describe("retention is the write's own work", () => {
  it("a read trims that site's rows older than the window it is handed", () => {
    count(OWNED.siteId, OWNED.pageId, "2026-07-01");
    expect(hits(OWNED.pageId, "2026-07-01")).toBe(1);
    // A read in September, with a 28-day window: July is outside it.
    count(OWNED.siteId, OWNED.pageId, "2026-09-22");
    expect(hits(OWNED.pageId, "2026-07-01")).toBe(0);
    expect(hits(OWNED.pageId, "2026-09-22")).toBe(1);
  });

  it("it trims only the site whose page was read", () => {
    count(OTHER.siteId, OTHER.pageId, "2026-07-01");
    expect(hits(OTHER.pageId, "2026-07-01")).toBe(1);
    count(OWNED.siteId, OWNED.pageId, "2026-09-23");
    expect(hits(OTHER.pageId, "2026-07-01")).toBe(1);
  });

  it("a day inside the window survives", () => {
    count(OWNED.siteId, OWNED.pageId, "2026-09-01");
    count(OWNED.siteId, OWNED.pageId, "2026-09-23");
    expect(hits(OWNED.pageId, "2026-09-01")).toBe(1);
  });
});

describe("RLS — a customer reads their own counts and nobody else's", () => {
  it("the owner reads their own site's rows", () => {
    const rows = asUser(OWNER_ID, `select count(*) from publication_reads;`);
    expect(Number(rows[0]?.[0] ?? 0)).toBeGreaterThan(0);
  });

  it("another account reads none of them", () => {
    // `OTHER` has one row of its own from the retention test; what matters
    // is that none of the owner's is among what it can see.
    const rows = asUser(
      OTHER_ID,
      `select count(*) from publication_reads where site_id = '${OWNED.siteId}';`
    );
    expect(Number(rows[0]?.[0] ?? -1)).toBe(0);
  });

  it("no account may write a count — every row here is the server's", () => {
    expect(
      asUserRaises(
        OWNER_ID,
        `insert into publication_reads (site_id, publication_id, day, engine, kind) values ` +
          `('${OWNED.siteId}', '${OWNED.pageId}', '2026-09-24'::date, 'chatgpt', 'answer_fetch');`
      )
    ).toBe(true);
  });

  it("no account may call the writer either", () => {
    expect(
      asUserRaises(
        OWNER_ID,
        `select record_publication_read('${OWNED.siteId}', '${OWNED.pageId}', '2026-09-24'::date, 'chatgpt', 'answer_fetch', 28);`
      )
    ).toBe(true);
  });

  it("a tombstoned owner reads nothing — the same rule every other table follows", () => {
    psql(["-c", `update users set deleted_at = now() where id = '${OWNER_ID}';`]);
    expect(asUser(OWNER_ID, `select count(*) from publication_reads;`)).toEqual([["0"]]);
    psql(["-c", `update users set deleted_at = null where id = '${OWNER_ID}';`]);
  });
});

describe("the account purge clears it, before the pages it points at", () => {
  it("the key carries no cascade, so a page cannot be deleted around its counts", () => {
    // ADR-051 point 7: the purge is the only deleter.
    expect(raises(`delete from publications where id = '${OWNED.pageId}';`)).toBe(true);
  });

  it("the purge names this table, before `publications`", () => {
    const purge = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/lib/account/lifecycle/purge.ts"),
      "utf8"
    );
    const mine = purge.indexOf('table: "publication_reads"');
    const publications = purge.indexOf('table: "publications"');
    expect(mine, "purge.ts does not name publication_reads").toBeGreaterThan(-1);
    expect(publications).toBeGreaterThan(-1);
    expect(mine).toBeLessThan(publications);
  });
});
