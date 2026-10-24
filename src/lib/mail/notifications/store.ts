// BUILD §12 · §4.7 — the three notification switches on `users.notify jsonb` (default `{}`), keyed by user, never the suppression store (ADR-042).
// Sparse: an absent key reads as on, since never toggled is not switched off. `draft-ready` is on until the first Monday mail, then off
// (SPEC §8, decision 2026-10-19-1593). A failed read is its own outcome, never `{}`, or a customer who switched a mail off would be mailed.
// `dbAdmin()`, not `db()`: the anon client carries no JWT, so `users_select_own` matches nothing. Both callers are server-side with the
// user already authenticated, one inside a job with no request.
// `users.notify` is missing from the stale `src/lib/db/types.generated.ts`, so the column is reached through one narrow cast.
import { dbAdmin } from "@/lib/db";
import type { NotifyKind, NotifyPrefs } from "./index";

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

interface MinimalQueryBuilder<T> extends PromiseLike<QueryResult<T>> {
  select(columns: string): MinimalQueryBuilder<T>;
  eq(column: string, value: string): MinimalQueryBuilder<T>;
  in(column: string, values: readonly string[]): MinimalQueryBuilder<T>;
  not(column: string, operator: string, value: null): MinimalQueryBuilder<T>;
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

/** `'unreadable'` covers a query error and a missing user row: the choice is unknown, which is not "chose nothing". */
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

/** Writes one key back in the whole object (no partial `jsonb` update here), safe after the read above for a customer editing their own row. */
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

/** Whether any of the user's sites has had its Monday mail (`scans.digest_sent_at`). A failed read is `false`: one extra mail costs less than a guess. */
export async function firstMondayMailSent(userId: string): Promise<boolean> {
  try {
    const client = untypedUsers(dbAdmin());
    const sites = await client.from<{ id: string }>("sites").select("id").eq("user_id", userId);
    const ids = (sites.data ?? []).map((site) => site.id);
    if (sites.error || ids.length === 0) return false;
    const weeks = await client
      .from<{ id: string }>("scans")
      .select("id")
      .in("site_id", ids)
      .not("digest_sent_at", "is", null)
      .limit(1);
    return !weeks.error && (weeks.data ?? []).length > 0;
  } catch {
    return false;
  }
}

/** The sparse object as the total one callers want, and the only place this defaulting happens. */
export function prefsFrom(
  stored: Readonly<Record<string, unknown>>,
  kinds: readonly NotifyKind[],
  mondayMailSent = false
): NotifyPrefs {
  const out = {} as Record<NotifyKind, boolean>;
  for (const kind of kinds) {
    const chosen = stored[kind];
    out[kind] = typeof chosen === "boolean" ? chosen : !(kind === "draft-ready" && mondayMailSent);
  }
  return Object.freeze(out);
}
