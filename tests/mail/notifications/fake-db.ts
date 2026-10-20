// tests/mail/notifications/fake-db.ts — the seam `users.notify` is read at.
//
// `tests/setup.ts` refuses a real network call, so the database client is
// mocked at its own module boundary (`@/lib/db`) rather than reached. This
// is the narrowest stand-in that still exercises the real query chain the
// store writes: `.select().eq().limit()` and `.update().eq()`. Any other
// table answers empty: no site has had a Monday mail.
export interface FakeDbState {
  rows: Record<string, { notify: Record<string, unknown> | null } | undefined>;
  failRead?: boolean;
  failWrite?: boolean;
  reads: string[];
  writes: { id: string; notify: Record<string, unknown> }[];
}

export function newState(rows: FakeDbState["rows"] = {}): FakeDbState {
  return { rows, reads: [], writes: [] };
}

export function fakeDb(state: FakeDbState) {
  return () => ({
    from(table = "users") {
      let id = "";
      let patch: { notify: Record<string, unknown> } | null = null;
      const builder = {
        select() {
          return builder;
        },
        eq(_column: string, value: string) {
          id = value;
          return builder;
        },
        limit() {
          return builder;
        },
        in() {
          return builder;
        },
        not() {
          return builder;
        },
        update(next: { notify: Record<string, unknown> }) {
          patch = next;
          return builder;
        },
        then(resolve: (r: { data: unknown[] | null; error: { message: string } | null }) => void) {
          if (patch !== null) {
            if (state.failWrite) return resolve({ data: null, error: { message: "write failed" } });
            state.writes.push({ id, notify: patch.notify });
            state.rows[id] = { notify: patch.notify };
            return resolve({ data: [], error: null });
          }
          if (table !== "users") return resolve({ data: [], error: null });
          state.reads.push(id);
          if (state.failRead) return resolve({ data: null, error: { message: "read failed" } });
          const row = state.rows[id];
          return resolve({ data: row === undefined ? [] : [row], error: null });
        },
      };
      return builder;
    },
  });
}
