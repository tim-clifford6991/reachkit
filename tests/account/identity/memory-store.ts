// tests/account/identity/memory-store.ts — the store the identity suites drive.
//
// `tests/setup.ts` refuses a real network call and the `node` project has
// no database, so `IdentityStore` is filled in memory rather than by
// mocking a query builder — the same shape, and for the same reason, as
// `tests/account/memory-store.ts`.
//
// **It mirrors the constraints the two migrations declare**, because every
// branch under test is a branch a constraint decides:
//   · `auth_links` primary key on `token_hash` — one row per token.
//   · `auth_links_one_live_idx` — at most one unspent link per
//     `(user_id, purpose)`. A fake without it would pass a
//     "issuing supersedes" test that Postgres refuses to let happen at all.
//   · `users_pending_email_lower_key` — two customers cannot hold one
//     pending address, case-insensitively.
// `tests/account/columns.test.ts` asserts each against the real schema, so
// the mirror and the database cannot drift apart unnoticed.
import type {
  AuthLinkRow,
  IdentityAccountRow,
  IdentityStore,
  LinkPurpose,
} from "../../../src/lib/account/identity/store";

export interface MemoryIdentity {
  users: IdentityAccountRow[];
  links: AuthLinkRow[];
  sites: { id: string; user_id: string }[];
  failAccountRead: boolean;
  failLinkRead: boolean;
  failInsertLink: boolean;
  failSpendLive: boolean;
  failCompleteChange: boolean;
  nextId: number;
}

export function newMemoryIdentity(): MemoryIdentity {
  return {
    users: [],
    links: [],
    sites: [],
    failAccountRead: false,
    failLinkRead: false,
    failInsertLink: false,
    failSpendLive: false,
    failCompleteChange: false,
    nextId: 1,
  };
}

const lower = (s: string): string => s.trim().toLowerCase();

export function addAccount(
  state: MemoryIdentity,
  patch: Partial<IdentityAccountRow> & { email: string }
): IdentityAccountRow {
  const row: IdentityAccountRow = {
    id: `user-${state.nextId++}`,
    name: null,
    pending_email: null,
    pending_email_token_hash: null,
    pending_email_sent_at: null,
    sessions_valid_from: null,
    first_signed_in_at: null,
    deleted_at: null,
    ...patch,
    email: lower(patch.email),
  };
  state.users.push(row);
  state.sites.push({ id: `site-${state.nextId++}`, user_id: row.id });
  return row;
}

function patchUser(
  state: MemoryIdentity,
  userId: string,
  patch: Partial<IdentityAccountRow>
): boolean {
  const index = state.users.findIndex((u) => u.id === userId);
  if (index < 0) return false;
  const existing = state.users[index];
  if (existing === undefined) return false;
  state.users[index] = { ...existing, ...patch };
  return true;
}

export function memoryIdentityStore(state: MemoryIdentity): IdentityStore {
  return {
    async account(userId) {
      if (state.failAccountRead) return { ok: false };
      return { ok: true, account: state.users.find((u) => u.id === userId) ?? null };
    },

    async addressTaken(addressValue) {
      if (state.failAccountRead) return { ok: false };
      const wanted = lower(addressValue);
      // Both columns, and tombstoned rows included: `dbAdmin()` sees them
      // and ADR-051 point 5 leaves them present but hidden.
      const taken = state.users.some(
        (u) =>
          lower(u.email) === wanted ||
          (u.pending_email !== null && lower(u.pending_email) === wanted)
      );
      return { ok: true, taken };
    },

    async link(tokenHash) {
      if (state.failLinkRead) return { ok: false };
      return { ok: true, link: state.links.find((l) => l.token_hash === tokenHash) ?? null };
    },

    async insertLink(a) {
      if (state.failInsertLink) return { ok: false };
      // The primary key.
      if (state.links.some((l) => l.token_hash === a.tokenHash)) return { ok: false };
      // `auth_links_one_live_idx`, which is what makes "issuing supersedes
      // the previous" a precondition rather than a tidy-up.
      const live = state.links.some(
        (l) => l.user_id === a.userId && l.purpose === a.purpose && l.spent_at === null
      );
      if (live) return { ok: false };
      state.links.push({
        token_hash: a.tokenHash,
        user_id: a.userId,
        purpose: a.purpose,
        sent_to: lower(a.sentTo),
        expires_at: a.expiresAt.toISOString(),
        spent_at: null,
      });
      return { ok: true };
    },

    async spendLive(userId, purpose, at) {
      if (state.failSpendLive) return { ok: false };
      spend(state, (l) => l.user_id === userId && l.purpose === purpose, at);
      return { ok: true };
    },

    async spendAll(userId, at) {
      spend(state, (l) => l.user_id === userId, at);
      return { ok: true };
    },

    async spendLink(tokenHash, at) {
      if (state.failLinkRead) return { ok: false };
      const index = state.links.findIndex(
        (l) => l.token_hash === tokenHash && l.spent_at === null
      );
      if (index < 0) return { ok: true, spent: false };
      const existing = state.links[index];
      if (existing === undefined) return { ok: true, spent: false };
      state.links[index] = { ...existing, spent_at: at.toISOString() };
      return { ok: true, spent: true };
    },

    async stampFirstSignedIn(userId, at) {
      const user = state.users.find((u) => u.id === userId);
      if (user === undefined) return { ok: false };
      if (user.first_signed_in_at !== null) return { ok: true, stamped: false };
      patchUser(state, userId, { first_signed_in_at: at.toISOString() });
      return { ok: true, stamped: true };
    },

    async writePending(a) {
      const wanted = lower(a.pendingEmail);
      // `users_pending_email_lower_key`.
      const clash = state.users.some(
        (u) => u.id !== a.userId && u.pending_email !== null && lower(u.pending_email) === wanted
      );
      if (clash) return { ok: false, conflict: true };
      return patchUser(state, a.userId, {
        pending_email: wanted,
        pending_email_token_hash: a.tokenHash,
        pending_email_sent_at: a.sentAt.toISOString(),
      })
        ? { ok: true }
        : { ok: false };
    },

    async clearPending(userId) {
      return patchUser(state, userId, {
        pending_email: null,
        pending_email_token_hash: null,
        pending_email_sent_at: null,
      })
        ? { ok: true }
        : { ok: false };
    },

    async completeChange(a) {
      if (state.failCompleteChange) return { ok: false };
      const wanted = lower(a.newEmail);
      // `users_email_lower_key`.
      if (state.users.some((u) => u.id !== a.userId && lower(u.email) === wanted)) {
        return { ok: false, conflict: true };
      }
      return patchUser(state, a.userId, {
        email: wanted,
        pending_email: null,
        pending_email_token_hash: null,
        pending_email_sent_at: null,
        sessions_valid_from: a.at.toISOString(),
      })
        ? { ok: true }
        : { ok: false };
    },

    async siteForAccount(userId) {
      return { ok: true, siteId: state.sites.find((s) => s.user_id === userId)?.id ?? null };
    },
  };
}

function spend(
  state: MemoryIdentity,
  matches: (l: AuthLinkRow) => boolean,
  at: Date
): void {
  state.links = state.links.map((l) =>
    matches(l) && l.spent_at === null ? { ...l, spent_at: at.toISOString() } : l
  );
}

export type { LinkPurpose };
