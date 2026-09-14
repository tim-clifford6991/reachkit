// SPEC §8, Retention (issue #569) — the rows the sequence reads and the
// stamps it writes. A port with one Supabase implementation and a door for
// suites, the shape `account/billing/store.ts` uses.
//
// Each due read narrows by the indexed, cheap conditions; the rest of each
// rule is `rules.ts`'s, re-asked by the sender against a fresh read.
import { RETENTION_MAIL } from "@/lib/config/constants";
import { dbAdmin } from "@/lib/db";
import { seenIsStale, type RetentionAccount, type RetentionDraft } from "./rules";

export type AccountStamp =
  | "inactivity_nudged_at"
  | "payment_failed_mailed_at"
  | "cancellation_mailed_at"
  | "winback_sent_at";

export interface RetentionSite {
  readonly siteId: string;
  readonly timezone: string | null;
}

export interface RetentionStore {
  /** Accounts idle since before `seenBefore`. */
  idleAccounts(seenBefore: Date): Promise<readonly RetentionAccount[]>;
  pastDueAccounts(): Promise<readonly RetentionAccount[]>;
  cancelledAccounts(): Promise<readonly RetentionAccount[]>;
  account(userId: string): Promise<RetentionAccount | null>;
  siteOf(userId: string): Promise<RetentionSite | null>;
  lastPublishedAt(siteId: string): Promise<Date | null>;
  /** Drafts in review, unopened and unreminded, whose window closes by `until`. */
  draftsClosingBy(until: Date, now: Date): Promise<readonly RetentionDraft[]>;
  draft(draftId: string): Promise<(RetentionDraft & { ownerId: string; timezone: string | null }) | null>;
  stampAccount(userId: string, column: AccountStamp, at: Date): Promise<void>;
  stampVetoReminded(draftId: string, at: Date): Promise<void>;
  /** A sign-in or an /app visit. Writes only when the stored value is stale. */
  recordSeen(userId: string, at: Date): Promise<void>;
  /** The owner opened the draft view. Stamped once. */
  recordDraftOpened(draftId: string, at: Date): Promise<void>;
}

interface Result<T> {
  data: T[] | null;
  error: { message: string } | null;
}
interface Query<T> extends PromiseLike<Result<T>> {
  select(columns: string): Query<T>;
  update(values: Record<string, unknown>): Query<T>;
  eq(column: string, value: unknown): Query<T>;
  is(column: string, value: null): Query<T>;
  not(column: string, operator: string, value: unknown): Query<T>;
  lt(column: string, value: unknown): Query<T>;
  lte(column: string, value: unknown): Query<T>;
  gt(column: string, value: unknown): Query<T>;
  order(column: string, options: { ascending: boolean }): Query<T>;
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
  first_signed_in_at: string | null;
  last_seen_at: string | null;
  inactivity_nudged_at: string | null;
  payment_failed_mailed_at: string | null;
  cancellation_mailed_at: string | null;
  winback_sent_at: string | null;
}

const USER_COLUMNS =
  "id, email, plan_status, paid_through, cancelled_at, deleted_at, first_signed_in_at, last_seen_at, " +
  "inactivity_nudged_at, payment_failed_mailed_at, cancellation_mailed_at, winback_sent_at";

interface DraftRow {
  id: string;
  site_id: string;
  state: string;
  title: string;
  veto_deadline: string | null;
  opened_at: string | null;
  veto_reminded_at: string | null;
}

const DRAFT_COLUMNS = "id, site_id, state, title, veto_deadline, opened_at, veto_reminded_at";

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
    seenAt: date(row.last_seen_at ?? row.first_signed_in_at),
    inactivityNudgedAt: date(row.inactivity_nudged_at),
    paymentFailedMailedAt: date(row.payment_failed_mailed_at),
    cancellationMailedAt: date(row.cancellation_mailed_at),
    winbackSentAt: date(row.winback_sent_at),
  };
}

function toDraft(row: DraftRow): RetentionDraft {
  return {
    id: row.id,
    state: row.state,
    title: row.title,
    vetoDeadline: date(row.veto_deadline),
    openedAt: date(row.opened_at),
    vetoRemindedAt: date(row.veto_reminded_at),
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
    async idleAccounts(seenBefore) {
      const found = await rows(
        users().select(USER_COLUMNS).is("deleted_at", null).is("cancelled_at", null).lt("last_seen_at", seenBefore.toISOString()),
        "idle accounts"
      );
      return found.map(toAccount);
    },

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

    async lastPublishedAt(siteId) {
      const found = await rows(
        untyped()
          .from<{ published_at: string | null }>("publications")
          .select("published_at")
          .eq("site_id", siteId)
          .not("published_at", "is", null)
          .order("published_at", { ascending: false })
          .limit(1),
        "last publication"
      );
      return date(found[0]?.published_at ?? null);
    },

    async draftsClosingBy(until, now) {
      const found = await rows(
        untyped()
          .from<DraftRow>("drafts")
          .select(DRAFT_COLUMNS)
          .eq("state", "in_review")
          .is("opened_at", null)
          .is("veto_reminded_at", null)
          .gt("veto_deadline", now.toISOString())
          .lte("veto_deadline", until.toISOString()),
        "drafts closing"
      );
      return found.map(toDraft);
    },

    async draft(draftId) {
      const found = await rows(untyped().from<DraftRow>("drafts").select(DRAFT_COLUMNS).eq("id", draftId).limit(1), "draft");
      const row = found[0];
      if (row === undefined) return null;
      const sites = await rows(
        untyped().from<{ user_id: string; timezone: string | null }>("sites").select("user_id, timezone").eq("id", row.site_id).limit(1),
        "draft site"
      );
      const site = sites[0];
      return site === undefined ? null : { ...toDraft(row), ownerId: site.user_id, timezone: site.timezone };
    },

    async stampAccount(userId, column, at) {
      await rows(users().update({ [column]: at.toISOString() }).eq("id", userId), `stamp ${column}`);
    },

    async stampVetoReminded(draftId, at) {
      await rows(
        untyped().from<DraftRow>("drafts").update({ veto_reminded_at: at.toISOString() }).eq("id", draftId),
        "stamp veto reminder"
      );
    },

    async recordSeen(userId, at) {
      const found = await rows(users().select("last_seen_at").eq("id", userId).limit(1), "seen");
      if (found[0] === undefined) return;
      if (!seenIsStale({ seenAt: date(found[0].last_seen_at), now: at })) return;
      await rows(users().update({ last_seen_at: at.toISOString() }).eq("id", userId), "record seen");
    },

    async recordDraftOpened(draftId, at) {
      await rows(
        untyped().from<DraftRow>("drafts").update({ opened_at: at.toISOString() }).eq("id", draftId).is("opened_at", null),
        "record draft opened"
      );
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

/** How far back "idle" reaches, for the idle read. */
export function idleCutoff(now: Date): Date {
  return new Date(now.getTime() - RETENTION_MAIL.inactivityIdleDays * 24 * 3_600_000);
}
