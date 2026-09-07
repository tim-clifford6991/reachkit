// tests/market/changes/harness.ts — the database double the change suites
// share.
//
// A PostgREST-shaped fake that actually stores rows and actually applies
// the filters, because what these modules promise is a property of what the
// query says: "the current scan and no other", "this site's scans in
// order", "the write lands on one row". A mock answering from a fixed list
// would pass whether or not any of that held.
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

export type Row = Record<string, unknown>;

export interface FakeDb {
  tables: Map<string, Row[]>;
  /** Every update the modules made, in order — so a suite can assert that a
   *  save wrote one column and not four. */
  writes: { table: string; values: Row; where: Row }[];
  client: unknown;
  seed(table: string, rows: Row[]): void;
  rows(table: string): Row[];
  reset(): void;
}

export function fakeDb(): FakeDb {
  const db: FakeDb = {
    tables: new Map(),
    writes: [],
    client: null,
    seed(table, rows) {
      db.tables.set(table, rows.map((row) => ({ ...row })));
    },
    rows(table) {
      let held = db.tables.get(table);
      if (held === undefined) {
        held = [];
        db.tables.set(table, held);
      }
      return held;
    },
    reset() {
      db.tables.clear();
      db.writes.length = 0;
    },
  };

  function builder(table: string) {
    const eq: Row = {};
    const is: Row = {};
    const inList: { column: string; values: readonly string[] }[] = [];
    const gte: Row = {};
    const lte: Row = {};
    let ordering: { column: string; ascending: boolean } | null = null;
    let cap: number | null = null;
    let update: Row | null = null;

    function matched(): Row[] {
      return db.rows(table).filter((row) => {
        for (const [column, value] of Object.entries(eq)) {
          if (row[column] !== value) return false;
        }
        for (const [column, value] of Object.entries(is)) {
          if (value === null ? row[column] != null : row[column] !== value) return false;
        }
        for (const { column, values } of inList) {
          if (!values.includes(String(row[column]))) return false;
        }
        for (const [column, value] of Object.entries(gte)) {
          if (String(row[column]) < String(value)) return false;
        }
        for (const [column, value] of Object.entries(lte)) {
          if (String(row[column]) > String(value)) return false;
        }
        return true;
      });
    }

    function run(): { data: Row[] | null; error: { message: string } | null } {
      if (update !== null) {
        const hits = matched();
        db.writes.push({ table, values: { ...update }, where: { ...eq } });
        for (const row of hits) Object.assign(row, update);
        return { data: hits, error: null };
      }
      let out = matched();
      if (ordering !== null) {
        const order = ordering;
        out = [...out].sort((a, b) => {
          const av = String(a[order.column] ?? "");
          const bv = String(b[order.column] ?? "");
          return (av < bv ? -1 : av > bv ? 1 : 0) * (order.ascending ? 1 : -1);
        });
      }
      if (cap !== null) out = out.slice(0, cap);
      return { data: out, error: null };
    }

    const self = {
      select: () => self,
      update: (values: Row) => {
        update = values;
        return self;
      },
      eq: (column: string, value: unknown) => {
        eq[column] = value;
        return self;
      },
      is: (column: string, value: unknown) => {
        is[column] = value;
        return self;
      },
      in: (column: string, values: readonly string[]) => {
        inList.push({ column, values });
        return self;
      },
      gte: (column: string, value: unknown) => {
        gte[column] = value;
        return self;
      },
      lte: (column: string, value: unknown) => {
        lte[column] = value;
        return self;
      },
      order: (column: string, opts: { ascending: boolean }) => {
        ordering = { column, ascending: opts.ascending };
        return self;
      },
      limit: (n: number) => {
        cap = n;
        return self;
      },
      then: (resolve: (r: unknown) => unknown) => Promise.resolve(resolve(run())),
    };
    return self;
  }

  db.client = { from: (table: string) => builder(table) };
  return db;
}

/** A site row as `sites` stores it. */
export function site(over: Row = {}): Row {
  return {
    id: "site-1",
    domain: "acme.test",
    category: "project management software",
    competitors: ["asana.com", "monday.com"],
    timezone: "America/New_York",
    ...over,
  };
}

/** A completed scan row, with the report blob the readers project from. */
export function scan(over: Row & { measuredAt?: string; category?: string | null } = {}): Row {
  const { measuredAt, category, ...rest } = over;
  return {
    id: "scan-1",
    site_id: "site-1",
    domain: "acme.test",
    status: "done",
    is_current: true,
    created_at: "2026-09-07T06:00:00.000Z",
    report: {
      category: category === undefined ? "project management software" : category,
      verdict: { measuredAt: measuredAt ?? "2026-09-07T06:00:00.000Z" },
      presence: { rivals: [{ domain: "asana.com" }, { domain: "monday.com" }] },
    },
    ...rest,
  };
}
