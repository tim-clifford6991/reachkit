// src/lib/account/identity/auth.ts — BUILD §13 (#468)
//
// Supabase Auth, behind one port. Owner ruling 2026-09-10: "this should be
// wrapped into the Supabase auth system" — so nothing in this directory
// mints, stores or verifies a sign-in secret any more. Supabase does all
// three; this file is the only place that talks to it.
//
// **Supabase's mailer is never used.** `generateLink` is the admin call
// that mints a token server-side and hands back its hash *without sending
// anything*; the link built from that hash goes out through the product's
// own mail shell (`../provisioning/sign-in-mail.ts`, `./email-change.ts`),
// which is the reason BP-061 gave for a home-made token in the first place
// and the reason that survives the switch.
//
// **Two clients, two keys.** The admin half (`createUser`, `generateLink`,
// `signOut`, `deleteUser`, `getUserById`) rides `dbAdmin()`'s service-role
// client — the one server-only credential this product already has. The
// session half (`verifyOtp`, `getUser`, a local `signOut`) is an
// `@supabase/ssr` server client on the anon key, built per request over a
// cookie reader and writer the caller supplies, because that is where the
// session lives. `getUser()` and never `getSession()` alone decides who is
// asking: the first asks Supabase to verify the token, the second believes
// the cookie.
//
// **Nothing here throws.** Every method answers what it did or that it
// could not, on the same footing as `./store.ts`; a vendor that is down is
// a refusal the caller can speak, never an exception on a sign-in path.
//
// The port is swappable (`setIdentityAuth`) exactly as the store is, so
// the suites stand a double in front of Supabase rather than a network.
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/config/env";
import { dbAdmin } from "@/lib/db";
import { CONFIRM_PATH, isAuthCookieName, type ConfirmType } from "./addresses";

/** A cookie the session client wants written, as `@supabase/ssr` hands it
 *  over. The options are its own and are passed through untouched, save
 *  the three this product pins (`sessionCookieOptions`). */
export interface CookieToSet {
  readonly name: string;
  readonly value: string;
  readonly options: Record<string, unknown>;
}

/** The request's cookies, read and written. A Route Handler, a Server
 *  Function and the middleware each build one over their own jar. */
export interface CookieIO {
  getAll(): { name: string; value: string }[];
  setAll(cookies: CookieToSet[]): void;
}

export type GeneratedLink =
  | { ok: true; userId: string; tokenHash: string; type: ConfirmType }
  | { ok: false };

export type VerifiedLink =
  | { ok: true; userId: string; email: string | null; accessToken: string }
  | { ok: false; reason: "expired" | "unknown" };

export interface IdentityAuth {
  /** The account's `auth.users` row, created confirmed and never mailed;
   *  where the address already has one, that row's id. */
  ensureUser(email: string): Promise<{ ok: true; userId: string } | { ok: false }>;

  /** Erasure's last step. A user that is already gone is `ok`, so a purge
   *  interrupted after this step completes on its next run. */
  deleteUser(userId: string): Promise<{ ok: boolean }>;

  /** Mints a one-time token and returns its hash. Sends nothing. */
  generateLink(
    a: { kind: "sign_in"; email: string } | { kind: "email_change"; email: string; newEmail: string }
  ): Promise<GeneratedLink>;

  /** Redeems a token hash and writes the session through `io`. */
  verifyLink(io: CookieIO, a: { tokenHash: string; type: ConfirmType }): Promise<VerifiedLink>;

  /** Who the request's session belongs to, verified with Supabase. Writes
   *  a refreshed session through `io` where one was due. */
  sessionUser(io: CookieIO): Promise<{ userId: string; accessToken: string } | null>;

  /** Ends this browser's session and clears its cookies. */
  endSession(io: CookieIO): Promise<void>;

  /** Ends every session the token's user holds (`global`), or every one but
   *  the token's own (`others`). */
  signOutEverywhere(accessToken: string, scope: "global" | "others"): Promise<{ ok: boolean }>;

  /** `auth.users.last_sign_in_at`, or `null` where they never have. */
  lastSignInAt(userId: string): Promise<Date | null>;
}

/** The three cookie attributes this product pins on Supabase's session
 *  cookie. `httpOnly`, because there is no browser-side Supabase client
 *  (#468 "Not in scope") and so no script has any business reading it;
 *  `lax`, because the link arrives from a mail client and a `strict` cookie
 *  set on that navigation would not be sent on the redirect that follows;
 *  `secure` following the deployment's own origin, so a local http server
 *  gets a cookie a browser will store. */
export function sessionCookieOptions(): { httpOnly: true; sameSite: "lax"; secure: boolean; path: "/" } {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
    path: "/",
  };
}

function sessionClient(io: CookieIO) {
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => io.getAll(),
      setAll: (cookies) => {
        io.setAll(
          cookies.map((c) => ({
            name: c.name,
            value: c.value,
            options: { ...(c.options as Record<string, unknown>), ...sessionCookieOptions() },
          }))
        );
      },
    },
  });
}

/** GoTrue's code for a token that is past its window or already used —
 *  one code for both, which is why "spent" cannot be told apart here. */
const OTP_EXPIRED = "otp_expired";
const EMAIL_EXISTS = ["email_exists", "user_already_exists"];
const USER_NOT_FOUND = "user_not_found";

export function supabaseIdentityAuth(): IdentityAuth {
  return {
    async ensureUser(email) {
      const admin = dbAdmin().auth.admin;
      const created = await admin.createUser({ email, email_confirm: true });
      if (created.error === null && created.data.user !== null) {
        return { ok: true, userId: created.data.user.id };
      }
      if (!EMAIL_EXISTS.includes(created.error?.code ?? "")) return { ok: false };
      // The address already has a user. The admin API has no read by
      // address, and `generateLink` answers with the user it minted for —
      // sending nothing, and superseded by the sign-in link provisioning
      // issues next — so it is the lookup.
      const found = await admin.generateLink({ type: "magiclink", email });
      if (found.error !== null || found.data.user === null) return { ok: false };
      return { ok: true, userId: found.data.user.id };
    },

    async deleteUser(userId) {
      const { error } = await dbAdmin().auth.admin.deleteUser(userId);
      return { ok: error === null || error.code === USER_NOT_FOUND || error.status === 404 };
    },

    async generateLink(a) {
      const admin = dbAdmin().auth.admin;
      const redirectTo = new URL(CONFIRM_PATH, env.NEXT_PUBLIC_APP_URL).toString();
      const answer =
        a.kind === "sign_in"
          ? await admin.generateLink({ type: "magiclink", email: a.email, options: { redirectTo } })
          : await admin.generateLink({
              type: "email_change_new",
              email: a.email,
              newEmail: a.newEmail,
              options: { redirectTo },
            });
      if (answer.error !== null || answer.data.user === null) return { ok: false };
      const tokenHash = answer.data.properties.hashed_token;
      if (typeof tokenHash !== "string" || tokenHash.length === 0) return { ok: false };
      return {
        ok: true,
        userId: answer.data.user.id,
        tokenHash,
        type: a.kind === "sign_in" ? "magiclink" : "email_change",
      };
    },

    async verifyLink(io, a) {
      const { data, error } = await sessionClient(io).auth.verifyOtp({
        token_hash: a.tokenHash,
        type: a.type,
      });
      if (error !== null) return { ok: false, reason: error.code === OTP_EXPIRED ? "expired" : "unknown" };
      if (data.user === null || data.session === null) return { ok: false, reason: "unknown" };
      return {
        ok: true,
        userId: data.user.id,
        email: data.user.email ?? null,
        accessToken: data.session.access_token,
      };
    },

    async sessionUser(io) {
      const client = sessionClient(io);
      const { data, error } = await client.auth.getUser();
      if (error !== null || data.user === null) return null;
      // The token `getUser()` just had verified — read back from the same
      // client, so it is the one Supabase answered for, not a second claim.
      const session = await client.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (accessToken === undefined) return null;
      return { userId: data.user.id, accessToken };
    },

    async endSession(io) {
      await sessionClient(io).auth.signOut({ scope: "local" });
      // A revocation Supabase refused still leaves this browser signed
      // out: `signOut` keeps the cookie on some errors, and REQ-077 c5's
      // promise is about this browser, so the cookies go regardless.
      io.setAll(
        io
          .getAll()
          .filter((c) => isAuthCookieName(c.name))
          .map((c) => ({ name: c.name, value: "", options: { ...sessionCookieOptions(), maxAge: 0 } }))
      );
    },

    async signOutEverywhere(accessToken, scope) {
      const { error } = await dbAdmin().auth.admin.signOut(accessToken, scope);
      return { ok: error === null };
    },

    async lastSignInAt(userId) {
      const { data, error } = await dbAdmin().auth.admin.getUserById(userId);
      const stamp = error === null ? data.user?.last_sign_in_at : undefined;
      if (stamp === undefined || stamp === null) return null;
      const at = new Date(stamp);
      return Number.isNaN(at.getTime()) ? null : at;
    },
  };
}

let auth: IdentityAuth | null = null;

/** The port every entry point reads. Lazily constructed, so importing this
 *  module builds no client. */
export function identityAuth(): IdentityAuth {
  if (auth === null) auth = supabaseIdentityAuth();
  return auth;
}

/** Swaps the port. The suites' one door in; `null` restores the real one. */
export function setIdentityAuth(next: IdentityAuth | null): void {
  auth = next;
}
