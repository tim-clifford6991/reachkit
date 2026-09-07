// BUILD §12 · §4.7 — the three notification switches, on the user's row.
//
// Keyed by **user**, reaching exactly the three recurring mails. This
// store never reads and never writes the address-wide suppression store
// (ADR-042): merging the two is the cleanup that takes a magic-link
// customer's sign-in mail away, silently.
//
// The column is `users.notify jsonb`, default `{}` (migration
// `00000000000003_users_notify_column.sql`). A **sparse** object: a key
// that is absent reads as *on*. Never toggled is not the same fact as
// switched off, and the customer bought a product that mails them.
//
// A read that fails is its own outcome and never `{}` — an absent object
// and an unreachable store are different facts, and collapsing them would
// mail a customer who had switched a mail off.
//
// **`dbAdmin()`, not `db()`** (#228). `db()` is the anon key and carries no
// user JWT, so `auth.uid()` is null and `users_select_own` — `to
// authenticated using (id = auth.uid())` — matches no row: every read
// through it answered `absent`, for every user, on every path. Both callers
// are server-side and neither has a session to present. `readNotifyPrefs`
// runs in a Server Component render (§4.7), and `stoppedByPreference` runs
// in the send seam, inside a job, where there is no request at all. The
// `userId` is the caller's own, authenticated before it got here. Reaching
// this column through the request-scoped client was a read that could never
// succeed — `/app/settings` rendered its failure arm for a real account
// under the live sweep, which is how it was found. Every neighbouring
// server reader (`identity/store.ts`, `market/changes/declared.ts`,
// `publish/db.ts`) reaches its table the same way.
//
// **Schema-typing gap, flagged once (same class as `costs/ledger.ts`):**
// `users.notify` exists in the applied schema but not in
// `src/lib/db/types.generated.ts`, which is stale and is BP-002's artifact
// to regenerate, not this module's file to widen. The column is reached
// through a narrow, explicitly cast query-builder subset rather than by
// losing typing everywhere else `db()` reaches.
import { dbAdmin } from "@/lib/db";
import type { NotifyKind, NotifyPrefs } from "./index";

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  limit(count: number): MinimalQueryBuilder<T>;
  update<R extends object>(patch: R): MinimalQueryBuilder<T>;
}

interface MinimalClient {
  from<T>(table: string): MinimalQueryBuilder<T>;
}

interface UsersNotifyRow {
  notify: Record<string, unknown> | null;
}

/** The one cast boundary in this module. */
function untypedUsers(client: ReturnType<typeof dbAdmin>): MinimalClient {
  return client as unknown as MinimalClient;
}

/** What a read of `users.notify` produced. `'unreadable'` covers a query
 *  error and a user row that is not there to read — in both cases this
 *  store cannot say what the customer chose, which is not the same as
 *  the customer having chosen nothing. */
export type StoredPrefs =
  | { readable: true; stored: Readonly<Record<string, unknown>> }
  | { readable: false; reason: "error" | "absent" };

export async function readStored(userId: string): Promise<StoredPrefs> {
  const { data, error } = await untypedUsers(dbAdmin())
    .from<UsersNotifyRow>("users")
    .select("notify")
    .eq("id", userId)
    .limit(1);

  if (error) return { readable: false, reason: "error" };
  const row = data?.[0];
  if (row === undefined) return { readable: false, reason: "absent" };
  const stored = row.notify;
  if (stored === null || typeof stored !== "object") return { readable: true, stored: {} };
  return { readable: true, stored };
}

/** Writes one key, leaving the other two exactly as they were. The whole
 *  object is written back because `jsonb` has no partial update through
 *  this client — the read immediately above it is what makes that safe
 *  for a single customer editing their own settings, and RLS is what
 *  makes it their row and no one else's. */
export async function writeStoredKey(a: {
  userId: string;
  kind: NotifyKind;
  on: boolean;
  stored: Readonly<Record<string, unknown>>;
}): Promise<{ written: true } | { written: false }> {
  const next = { ...a.stored, [a.kind]: a.on };
  const { error } = await untypedUsers(dbAdmin())
    .from<UsersNotifyRow>("users")
    .update({ notify: next })
    .eq("id", a.userId);
  return error ? { written: false } : { written: true };
}

/** The sparse object, read as the total one every caller wants: a key that
 *  is absent is on. There is no other place this defaulting happens. */
export function prefsFrom(
  stored: Readonly<Record<string, unknown>>,
  kinds: readonly NotifyKind[]
): NotifyPrefs {
  const out = {} as Record<NotifyKind, boolean>;
  for (const kind of kinds) {
    out[kind] = stored[kind] === false ? false : true;
  }
  return Object.freeze(out);
}
