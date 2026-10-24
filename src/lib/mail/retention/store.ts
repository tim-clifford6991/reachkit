// SPEC §8, Retention — the rows the sequence reads and the stamps it writes, as a port with a suites' door.
// Due reads narrow by cheap indexed conditions; the rest of each rule is `rules.ts`'s, re-asked against a fresh read.
import { dbAdmin } from "@/lib/db";
import { seenIsStale, type RetentionAccount } from "./rules";

export type AccountStamp =
  | "payment_failed_mailed_at"
  | "cancellation_mailed_at"
  | "winback_sent_at";

export interface RetentionSite {
  readonly siteId: string;
  readonly timezone: string | null;
}

export interface RetentionStore {
  pastDueAccounts(): Promise<readonly RetentionAccount[]>;
  cancelledAccounts(): Promise<readonly RetentionAccount[]>;
  account(userId: string): Promise<RetentionAccount | null>;
  siteOf(userId: string): Promise<RetentionSite | null>;
  /** Whether a first-14-days refund was made to this account at or after `since`. */
  refundedSince(userId: string, since: Date): Promise<boolean>;
  stampAccount(userId: string, column: AccountStamp, at: Date): Promise<void>;
  /** A sign-in or an /app visit. Writes only when the stored value is stale. */
  recordSeen(userId: string, at: Date): Promise<void>;
}

interface Result<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface Query<T> extends PromiseLike<Result<T>> {
  select(columns: string): Query<T>;
  update(values: Record<string, unknown>): Query<T>;
  eq(column: string, value: unknown): Query<T>;
  gte(column: string, value: unknown): Query<T>;
  is(column: string, value: null): Query<T>;
  not(column: string, operator: string, value: unknown): Query<T>;
  limit(n: number): Query<T>;
}
interface Client {
  from<T>(table: string): Query<T>;
}

function untyped(): Client {
  return dbAdmin() as unknown as Client;
}

interface UserRow {
  id: string;
  email: string;
  plan_status: string;
  paid_through: string;
  cancelled_at: string | null;
  deleted_at: string | null;
  payment_failed_mailed_at: string | null;
  cancellation_mailed_at: string | null;
  winback_sent_at: string | null;
}

const USER_COLUMNS =
  "id, email, plan_status, paid_through, cancelled_at, deleted_at, " +
  "payment_failed_mailed_at, cancellation_mailed_at, winback_sent_at";

function date(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function toAccount(row: UserRow): RetentionAccount {
  return {
    id: row.id,
    email: row.email,
    planStatus: row.plan_status,
    paidThrough: new Date(row.paid_through),
    cancelledAt: date(row.cancelled_at),
    deletedAt: date(row.deleted_at),
    paymentFailedMailedAt: date(row.payment_failed_mailed_at),
    cancellationMailedAt: date(row.cancellation_mailed_at),
    winbackSentAt: date(row.winback_sent_at),
  };
}

async function rows<T>(query: Query<T>, what: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`retention store: ${what}: ${error.message}`);
  return data ?? [];
}

export function supabaseRetentionStore(): RetentionStore {
  const users = () => untyped().from<UserRow>("users");
  return {
    async pastDueAccounts() {
      const found = await rows(
        users().select(USER_COLUMNS).is("deleted_at", null).eq("plan_status", "past_due").is("payment_failed_mailed_at", null),
        "past-due accounts"
      );
      return found.map(toAccount);
    },

    async cancelledAccounts() {
      const found = await rows(
        users().select(USER_COLUMNS).is("deleted_at", null).not("cancelled_at", "is", null),
        "cancelled accounts"
      );
      return found.map(toAccount);
    },

    async account(userId) {
      const found = await rows(users().select(USER_COLUMNS).eq("id", userId).limit(1), "account");
      return found[0] === undefined ? null : toAccount(found[0]);
    },

    async siteOf(userId) {
      const found = await rows(
        untyped().from<{ id: string; timezone: string | null }>("sites").select("id, timezone").eq("user_id", userId).limit(1),
        "site"
      );
      return found[0] === undefined ? null : { siteId: found[0].id, timezone: found[0].timezone };
    },

    async refundedSince(userId, since) {
      const found = await rows(
        untyped().from<{ invoice_id: string }>("refunds").select("invoice_id").eq("user_id", userId).gte("refunded_at", since.toISOString()).limit(1),
        "refund"
      );
      return found.length > 0;
    },

    async stampAccount(userId, column, at) {
      await rows(users().update({ [column]: at.toISOString() }).eq("id", userId), `stamp ${column}`);
    },

    async recordSeen(userId, at) {
      const found = await rows(
        untyped().from<{ last_seen_at: string | null }>("users").select("last_seen_at").eq("id", userId).limit(1),
        "seen"
      );
      if (found[0] === undefined) return;
      if (!seenIsStale({ seenAt: date(found[0].last_seen_at), now: at })) return;
      await rows(users().update({ last_seen_at: at.toISOString() }).eq("id", userId), "record seen");
    },
  };
}

let store: RetentionStore | null = null;

export function retentionStore(): RetentionStore {
  store ??= supabaseRetentionStore();
  return store;
}

/** The suites' door. `null` restores the Supabase store. */
export function setRetentionStore(next: RetentionStore | null): void {
  store = next;
}
