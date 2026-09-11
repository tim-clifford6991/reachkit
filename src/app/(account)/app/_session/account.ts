// BUILD §4.4, §4.5, §4.6, §13 — the one place a `/app` surface learns whose
// account it is.
//
// `currentSession()` (§13, `src/lib/account/identity/session.ts`) has
// existed since #137; the shell, Overview, the calendar and the draft view
// were all written before it and each carried its own stand-in. This
// module is the one seam that replaces all four, so the four surfaces
// cannot come to disagree about which customer they are drawing — and so
// there is one place to read to know how the answer is reached.
//
// **One read per request.** `React.cache` memoises the whole resolution:
// the layout, the screen and the day panel's action each ask, and one
// `users` read and one `sites` read serve all of them.
//
// **Two refusals, and they are different facts.** No session at all is
// §4.3's refusal: back to `/signin`, saying nothing about whether an
// account or a payment exists (REQ-020 c5). A session whose account has no
// site row yet is not signed out — it is a customer who has paid and not
// finished setup — and it belongs at `/setup`, which is where
// `src/middleware.ts`'s setup gate already sends it. Answering `/signin`
// for that would sign a paying customer out of their own account.
//
// **The reserved fixture account is decided here and nowhere else.**
// DECISIONS 2026-09-06: "`*.example.com` fixtures answer only for reserved
// names." `example.com` is IANA-reserved and can never be a customer's
// domain, so "the fixture answers only for the reserved account" is a fact
// about the name rather than a flag somebody has to remember to unset. Each
// surface asks `isReservedFixtureAccount()` and branches once; no surface
// re-derives the rule.
// ── The record for this file ─────────────────────────────────────────────
// Rulings of record for this module, moved out of `DECISIONS.md` on 2026-09-11
// (owner ruling: the record holds product rulings only; an implementation ruling
// belongs where the code is). Verbatim. The whole original record is
// `docs/archive/DECISIONS-full-2026-09-11.md`.
//
// DECISIONS 2026-09-07: Every (account) surface resolves the account through one
//   request-cached seam over currentSession() plus one sites row: no session → /signin, a
//   session with no site → /setup, a site with no stated zone or a foreign user_id is refused,
//   not drawn. The paused-site guard stays in the shell store until a second feeder needs it,
//   then moves into publishingOf. The layout sweep now measures the sign-in prompt at the four
//   /app addresses until the layout job has a substrate and a seeded account (own issue). —
//   #192

import { cache } from "react";
import { redirect } from "next/navigation";
import { FIXTURE_DOMAIN } from "../_shell/fixture";

/** The reserved fixture account's domain. Imported from the shell's own
 *  fixture so that the name has one spelling in the product; this module
 *  is the only production-path reader of it, and it reads the *name*, never
 *  the facts hung on it. */
export const RESERVED_FIXTURE_DOMAIN = FIXTURE_DOMAIN;

/** Everything a `/app` surface may know about who is asking. Five members
 *  and no sixth: there is nowhere on this shape for a credential, an email
 *  address or a billing fact to live. */
export interface AppAccount {
  userId: string;
  siteId: string;
  domain: string;
  /** When the site was created. §4.4 counts "Week n" from here. */
  createdAt: Date;
  /** REQ-073 c1's stated zone, or `null` where the customer has not stated
   *  one. Nullable by design — no read path falls back to the server's. */
  timeZone: string | null;
  mode: "autopilot" | "copilot";
}

/** Why a surface has no account to draw. Two members, because the two are
 *  different facts with different destinations. */
export type NoAccount = "no_session" | "no_site";

export type AppAccountResult =
  | { ok: true; account: AppAccount }
  | { ok: false; because: NoAccount };

/** The seam. Answers who is asking, from Supabase's verified session and one site
 *  read. Replaceable in tests through `setAppAccountReader`, which is the
 *  only door: no surface reads the cookie itself. */
export type AppAccountReader = () => Promise<AppAccountResult>;

const fromSession: AppAccountReader = async () => {
  // Imported at the call and not at the top. `currentSession` reaches
  // `@/lib/db` through the identity store, which parses every environment
  // binding the moment it is evaluated — a static import here would put a
  // database client in the module graph of every screen this seam serves,
  // and take them down anywhere that graph loads without one (the layout
  // conformance build, the presentation sweeps, `next build`'s own
  // page-data collection). The same reason `settings/provider.ts` and
  // `calendar/provider.ts` defer theirs — and `./store` is deferred with
  // it, for the same reason and not a different one: it reaches `@/lib/db`
  // directly, so a static import here would put a database client in the
  // module graph of every screen this seam serves.
  const { currentSession } = await import("@/lib/account/identity");
  const { readAppSite } = await import("./store");
  const session = await currentSession();
  if (session === null) return { ok: false, because: "no_session" };
  if (session.siteId === null) return { ok: false, because: "no_site" };

  const row = await readAppSite(session.siteId);
  // A site id the account does not own is not this account's site. The
  // session names the account and the site beside it, but a row read by id is
  // still read by id.
  if (row === null || row.user_id !== session.userId) {
    return { ok: false, because: "no_site" };
  }

  return {
    ok: true,
    account: {
      userId: session.userId,
      siteId: row.id,
      domain: row.domain,
      createdAt: new Date(row.created_at),
      timeZone: row.timezone,
      mode: row.mode === "copilot" ? "copilot" : "autopilot",
    },
  };
};

let reader: AppAccountReader = fromSession;

/** The one door in, for suites. `null` restores the real reader, which is
 *  what stops a suite that registered an account from leaking one into the
 *  next. */
export function setAppAccountReader(next: AppAccountReader | null): void {
  reader = next ?? fromSession;
}

/** Who is asking, or why not. Request-cached, so every surface on one
 *  render resolves the same account without asking twice. */
export const appAccount = cache(async function appAccount(): Promise<AppAccountResult> {
  return reader();
});

/**
 * The account, or the §4.3 refusal.
 *
 * `redirect()` throws, so this never returns a null-ish account and no
 * caller has to remember to check one. A missing session goes to the
 * sign-in prompt — "asks for an address and says nothing about whether an
 * account or a payment exists" — and a session with no site goes to setup,
 * which is the same destination `src/middleware.ts`'s gate would have sent
 * it to.
 */
export async function requireAppAccount(): Promise<AppAccount> {
  const result = await appAccount();
  if (result.ok) return result.account;
  redirect(result.because === "no_session" ? "/signin" : "/setup");
}

/**
 * The account, with a stated time zone.
 *
 * REQ-073 c1 forbids a zone the customer never stated, and no read path
 * falls back to the server's — so a screen that draws dates asks for this
 * and a site with no zone goes to `/setup`, where the zone is stated,
 * rather than being drawn in one nobody chose. Every date the shell, the
 * calendar and Overview state is site-local, so all three ask this one.
 */
export async function requireSetUpAccount(): Promise<AppAccount & { timeZone: string }> {
  const account = await requireAppAccount();
  if (account.timeZone === null) redirect("/setup");
  return { ...account, timeZone: account.timeZone };
}

/** Whether this account is the reserved fixture account — the one account
 *  whose surfaces are drawn from `fixture.ts`. A customer can never hold
 *  this name (IANA-reserved), so no real site can reach a fixture through
 *  it. */
export function isReservedFixtureAccount(account: AppAccount): boolean {
  return account.domain === RESERVED_FIXTURE_DOMAIN;
}
