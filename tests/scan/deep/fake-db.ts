// tests/scan/deep/fake-db.ts — a small in-memory stand-in for the two
// PostgREST calls this issue's modules make.
//
// It is deliberately not a mock of `dbAdmin()` shaped by what the code
// happens to call: it holds rows, applies the filters it is given and
// answers with what matched, so a query that filters wrongly fails here
// the way it would fail against Postgres. `update` returns the rows it
// actually changed, which is what makes the release latch's "zero rows
// means somebody else won" testable at all.
export type Row = Record<string, unknown>;

export interface FakeDb {
  tables: Record<string, Row[]>;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>;
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  client: { from: (table: string) => unknown; rpc: FakeDb["rpc"] };
}

type Filter = (row: Row) => boolean;

export function fakeDb(tables: Record<string, Row[]> = {}): FakeDb {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];

  const db: FakeDb = {
    tables,
    rpcCalls,
    rpc: async (fn, args) => {
      rpcCalls.push({ fn, args });
      if (fn === "apply_setup_choice") {
        const siteId = String(args.p_site_id);
        const site = (tables.sites ?? []).find((row) => row.id === siteId);
        if (site === undefined) return { data: null, error: null };
        site.mode = args.p_mode;
        const id = `dest-${(tables.destinations ?? []).length + 1}`;
        (tables.destinations ??= []).push({
          id,
          site_id: siteId,
          kind: args.p_kind,
          config: null,
          health: "expired",
        });
        return { data: id, error: null };
      }
      return { data: null, error: null };
    },
    client: {
      rpc: (fn, args) => db.rpc(fn, args),
      from(table: string) {
        const filters: Filter[] = [];
        let updates: Row | null = null;

        const rows = (): Row[] => (tables[table] ??= []);
        const matched = (): Row[] => rows().filter((row) => filters.every((f) => f(row)));

        const self = {
          select() {
            return self;
          },
          update(values: Row) {
            updates = values;
            return self;
          },
          eq(column: string, value: unknown) {
            filters.push((row) => row[column] === value);
            return self;
          },
          is(column: string, value: unknown) {
            filters.push((row) => (row[column] ?? null) === value);
            return self;
          },
          lt(column: string, value: unknown) {
            filters.push((row) => String(row[column]) < String(value));
            return self;
          },
          limit() {
            return self;
          },
          then(resolve: (v: { data: Row[]; error: null }) => unknown) {
            const hit = matched();
            if (updates !== null) for (const row of hit) Object.assign(row, updates);
            return Promise.resolve({ data: hit, error: null }).then(resolve);
          },
        };
        return self;
      },
    },
  };

  return db;
}
