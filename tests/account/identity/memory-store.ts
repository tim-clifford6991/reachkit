// tests/account/identity/memory-store.ts
//
// The identity store in memory: the `users` columns identity reads and
// writes, and the account's one site. Links and sessions are Supabase
// Auth's since #468 — their double is `./fake-auth.ts`.
import type {
  IdentityAccountRow,
  IdentityStore,
  LinkPurpose,
} from "../../../src/lib/account/identity/store";

export interface MemoryIdentity {
  users: IdentityAccountRow[];
  sites: { id: string; user_id: string }[];
  failAccountRead: boolean;
  failPendingRead: boolean;
  failCompleteChange: boolean;
  nextId: number;
}

export function newMemoryIdentity(): MemoryIdentity {
  return {
    users: [],
    sites: [],
    failAccountRead: false,
    failPendingRead: false,
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

    async accountByPendingHash(tokenHash) {
      if (state.failPendingRead) return { ok: false };
      return {
        ok: true,
        account: state.users.find((u) => u.pending_email_token_hash === tokenHash) ?? null,
      };
    },

    async addressTaken(addressValue) {
      if (state.failAccountRead) return { ok: false };
      const wanted = lower(addressValue);
      const taken = state.users.some(
        (u) =>
          lower(u.email) === wanted ||
          (u.pending_email !== null && lower(u.pending_email) === wanted)
      );
      return { ok: true, taken };
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
      if (state.users.some((u) => u.id !== a.userId && lower(u.email) === wanted)) {
        return { ok: false, conflict: true };
      }
      return patchUser(state, a.userId, {
        email: wanted,
        pending_email: null,
        pending_email_token_hash: null,
        pending_email_sent_at: null,
      })
        ? { ok: true }
        : { ok: false };
    },

    async siteForAccount(userId) {
      return { ok: true, siteId: state.sites.find((s) => s.user_id === userId)?.id ?? null };
    },
  };
}

export type { LinkPurpose };
