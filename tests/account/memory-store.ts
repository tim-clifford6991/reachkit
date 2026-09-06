// tests/account/memory-store.ts — the store the payment suites drive.
//
// `tests/setup.ts` refuses a real network call and the `node` project has
// no database, so `AccountStore` is filled with an in-memory implementation
// rather than a mocked query builder.
//
// **It mirrors the three constraints the migrations declare**, because
// every branch under test is a branch a constraint decides:
//   · `users_checkout_session_id_key` — the replay key.
//   · `users_email_lower_key` — one account per address, case-insensitively.
//     A fake with a case-sensitive map would pass a second-purchase test
//     that Postgres refuses.
//   · `sites_one_per_user` — §13's "one site".
// `tests/account/columns.test.ts` asserts each of the three against the
// real schema, so the mirror and the database cannot drift apart unnoticed.
import type {
  AccountRow,
  AccountStore,
  BillingFacts,
  ScanStatus,
} from "../../src/lib/account/store";

export interface MemoryAccounts {
  users: AccountRow[];
  sites: { id: string; user_id: string; domain: string | null; provisioned_from_scan_id: string | null }[];
  scans: Map<string, { status: ScanStatus; domain: string }>;
  leads: { email: string; converted_at: string | null }[];
  failScanRead: boolean;
  failAccountRead: boolean;
  failInsert: boolean;
  nextId: number;
}

export function newMemoryAccounts(): MemoryAccounts {
  return {
    users: [],
    sites: [],
    scans: new Map(),
    leads: [],
    failScanRead: false,
    failAccountRead: false,
    failInsert: false,
    nextId: 1,
  };
}

const lower = (s: string) => s.trim().toLowerCase();

export function memoryAccountStore(state: MemoryAccounts): AccountStore {
  const id = (prefix: string) => `${prefix}-${state.nextId++}`;

  return {
    async scan(scanId) {
      if (state.failScanRead) return { ok: false };
      return { ok: true, scan: state.scans.get(scanId) ?? null };
    },

    async accountByCheckoutSession(sessionId) {
      if (state.failAccountRead) return { ok: false };
      return {
        ok: true,
        account: state.users.find((u) => u.checkout_session_id === sessionId) ?? null,
      };
    },

    async accountByEmail(email) {
      if (state.failAccountRead) return { ok: false };
      return {
        ok: true,
        account: state.users.find((u) => lower(u.email) === lower(email)) ?? null,
      };
    },

    async insertAccount(a) {
      if (state.failInsert) return { ok: false };
      if (state.users.some((u) => u.checkout_session_id === a.checkoutSessionId)) {
        return { ok: false, conflict: "checkout_session_id" };
      }
      if (state.users.some((u) => lower(u.email) === lower(a.email))) {
        return { ok: false, conflict: "email" };
      }
      const row: AccountRow = {
        id: id("user"),
        email: a.email,
        checkout_session_id: a.checkoutSessionId,
        first_signed_in_at: null,
        sign_in_chased_at: null,
        stripe_customer_id: a.facts.stripe_customer_id,
        billing_country: a.facts.billing_country,
        vat_number: a.facts.vat_number,
        created_at: new Date(0).toISOString(),
      };
      state.users.push(row);
      return { ok: true, id: row.id };
    },

    async writeBillingFacts(sessionId, facts: BillingFacts) {
      const index = state.users.findIndex((u) => u.checkout_session_id === sessionId);
      if (index === -1) return { ok: true };
      const existing = state.users[index];
      if (existing === undefined) return { ok: true };
      state.users[index] = {
        ...existing,
        stripe_customer_id: facts.stripe_customer_id,
        billing_country: facts.billing_country,
        vat_number: facts.vat_number,
      };
      return { ok: true };
    },

    async insertSite(a) {
      if (state.sites.some((s) => s.user_id === a.userId)) return { ok: false, conflict: true };
      const row = {
        id: id("site"),
        user_id: a.userId,
        domain: a.domain,
        provisioned_from_scan_id: a.provisionedFromScanId,
      };
      state.sites.push(row);
      return { ok: true, id: row.id };
    },

    async siteForAccount(userId) {
      return { ok: true, siteId: state.sites.find((s) => s.user_id === userId)?.id ?? null };
    },

    async accountsAwaitingSignIn(before) {
      if (state.failAccountRead) return { ok: false };
      return {
        ok: true,
        accounts: state.users.filter(
          (u) =>
            u.checkout_session_id !== null &&
            u.first_signed_in_at === null &&
            u.sign_in_chased_at === null &&
            Date.parse(u.created_at) <= before.getTime()
        ),
      };
    },

    async stampSignInChased(userId, at) {
      const index = state.users.findIndex((u) => u.id === userId);
      const existing = index === -1 ? undefined : state.users[index];
      if (existing === undefined) return { ok: true };
      state.users[index] = { ...existing, sign_in_chased_at: at.toISOString() };
      return { ok: true };
    },

    async stampLeadConverted(email, at) {
      let stamped = 0;
      for (const lead of state.leads) {
        if (lower(lead.email) !== lower(email) || lead.converted_at !== null) continue;
        lead.converted_at = at.toISOString();
        stamped += 1;
      }
      return { ok: true, stamped };
    },
  };
}
