// tests/publish/harness.ts — the database double the publishing suites
// share. Not a suite of its own: vitest collects `*.test.ts`.
//
// A PostgREST-shaped fake that actually *stores* rows and actually applies
// the filters, because the properties BUILD §9 asks for are properties of
// what the database does: the unique index that refuses a second post, the
// conflict clause that refuses only a delivered row, the ordering a resume
// drains in. A mock that answered from a fixed list would pass whether or
// not any of them held.

export type Row = Record<string, unknown>;

export interface RecordedQuery {
  table: string;
  verb: "select" | "insert" | "update";
  columns?: string;
  values?: Row;
  filters: { op: string; column: string; value: unknown }[];
}

export interface UniqueIndex {
  table: string;
  columns: string[];
}

export interface FakeDb {
  tables: Map<string, Row[]>;
  uniqueIndexes: UniqueIndex[];
  rpcs: Map<string, (args: Row) => unknown>;
  queries: RecordedQuery[];
  rpcCalls: { fn: string; args: Row }[];
  client: unknown;
  seed(table: string, rows: Row[]): void;
  rows(table: string): Row[];
  reset(): void;
}

const UNIQUE_VIOLATION = "23505";

function matches(row: Row, filters: RecordedQuery["filters"]): boolean {
  return filters.every((f) => {
    const value = row[f.column];
    switch (f.op) {
      case "eq":
        return value === f.value;
      case "neq":
        return value !== f.value;
      case "in":
        return (f.value as unknown[]).includes(value);
      case "gte":
        return value !== null && value !== undefined && String(value) >= String(f.value);
      case "not-is-null":
        return value !== null && value !== undefined;
      default:
        return true;
    }
  });
}

/** The one embedding convention the module's own selects use:
 *  `sites(mode, veto_hours)` and `opportunities(proposed_slug)`. */
function embed(db: FakeDb, table: string, columns: string, row: Row): Row {
  const out = { ...row };
  if (columns.includes("sites(")) {
    out.sites = db.rows("sites").find((s) => s.id === row.site_id) ?? null;
  }
  if (columns.includes("opportunities(")) {
    out.opportunities =
      db.rows("opportunities").find((o) => o.id === row.opportunity_id) ?? null;
  }
  return out;
}

export function fakeDb(): FakeDb {
  let nextId = 1;

  const db: FakeDb = {
    tables: new Map(),
    uniqueIndexes: [{ table: "publications", columns: ["draft_id", "destination"] }],
    rpcs: new Map(),
    queries: [],
    rpcCalls: [],
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
      db.queries.length = 0;
      db.rpcCalls.length = 0;
    },
  };

  function builder(table: string) {
    const query: RecordedQuery = { table, verb: "select", filters: [] };
    db.queries.push(query);
    let ordering: { column: string; ascending: boolean }[] = [];
    let cap: number | null = null;
    let inserted: Row[] | null = null;
    let insertError: { message: string; code?: string } | null = null;

    function selected(): Row[] {
      if (inserted !== null) return inserted;
      let out = db.rows(table).filter((row) => matches(row, query.filters));
      for (const order of [...ordering].reverse()) {
        out = [...out].sort((a, b) => {
          const av = String(a[order.column] ?? "");
          const bv = String(b[order.column] ?? "");
          return (av < bv ? -1 : av > bv ? 1 : 0) * (order.ascending ? 1 : -1);
        });
      }
      if (cap !== null) out = out.slice(0, cap);
      return out.map((row) => embed(db, table, query.columns ?? "", row));
    }

    function run(): { data: Row[] | null; error: { message: string; code?: string } | null } {
      if (insertError !== null) return { data: null, error: insertError };
      if (query.verb === "update") {
        const hits = db.rows(table).filter((row) => matches(row, query.filters));
        for (const row of hits) Object.assign(row, query.values);
        return { data: hits, error: null };
      }
      return { data: selected(), error: null };
    }

    const self = {
      select(columns: string) {
        query.columns = columns;
        return self;
      },
      eq(column: string, value: unknown) {
        query.filters.push({ op: "eq", column, value });
        return self;
      },
      neq(column: string, value: unknown) {
        query.filters.push({ op: "neq", column, value });
        return self;
      },
      in(column: string, value: unknown) {
        query.filters.push({ op: "in", column, value });
        return self;
      },
      gte(column: string, value: unknown) {
        query.filters.push({ op: "gte", column, value });
        return self;
      },
      not(column: string, operator: string, value: unknown) {
        query.filters.push({ op: `not-${operator}-${String(value)}`, column, value });
        return self;
      },
      order(column: string, opts: { ascending: boolean }) {
        ordering = [...ordering, { column, ascending: opts.ascending }];
        return self;
      },
      limit(count: number) {
        cap = count;
        return self;
      },
      insert(values: Row) {
        query.verb = "insert";
        query.values = values;
        const index = db.uniqueIndexes.find((i) => i.table === table);
        if (
          index !== undefined &&
          db.rows(table).some((row) => index.columns.every((c) => row[c] === values[c]))
        ) {
          insertError = { message: "duplicate key value violates unique constraint", code: UNIQUE_VIOLATION };
          return self;
        }
        const row = { id: `${table}-${nextId++}`, ...values };
        db.rows(table).push(row);
        inserted = [row];
        return self;
      },
      update(values: Row) {
        query.verb = "update";
        query.values = values;
        return self;
      },
      single() {
        const { data, error } = run();
        if (error !== null) return Promise.resolve({ data: null, error });
        const [first] = data ?? [];
        return Promise.resolve(
          first === undefined
            ? { data: null, error: { message: "no rows" } }
            : { data: first, error: null }
        );
      },
      then(resolve: (value: { data: Row[] | null; error: unknown }) => unknown) {
        return Promise.resolve(run()).then(resolve);
      },
    };
    return self;
  }

  db.client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args: Row) => {
      db.rpcCalls.push({ fn, args });
      const impl = db.rpcs.get(fn);
      return Promise.resolve(
        impl === undefined
          ? { data: null, error: { message: `no such function: ${fn}` } }
          : { data: impl(args), error: null }
      );
    },
  };

  return db;
}

/**
 * `publish_transition`, as the migration writes it: one statement that sets
 * the state, appends the record, and maintains `publishable_since` — guarded
 * by `where … and state = p_from`, the optimistic lock two concurrent movers
 * race on.
 */
export function installTransitionRpc(db: FakeDb): void {
  db.rpcs.set("publish_transition", (args: Row) => {
    const draftId = args.p_draft_id as string;
    const from = args.p_from as string;
    const to = args.p_to as string;
    const row = db.rows("drafts").find((d) => d.id === draftId && d.state === from);
    if (row === undefined) return false;
    row.state = to;
    row.transitions = [...((row.transitions as unknown[]) ?? []), args.p_record];
    if (["in_review", "approved", "failed"].includes(to)) {
      row.publishable_since = row.publishable_since ?? new Date().toISOString();
    } else if (["published", "skipped", "unpublished"].includes(to)) {
      row.publishable_since = null;
    }
    return true;
  });
}
