// BUILD §4.3 — the incomplete-setup gate: one allow-list, and the way out
// is never gated.
//
// "Setup `/setup` — post-payment, once." A founder who has paid and has
// not answered the three questions belongs on `/setup`, and a founder who
// has answered them is never asked again. Both halves are this file, and
// this file is the only place either is decided: `setupRedirectFor` holds
// no per-route branch, and the enforcement point holds no setup knowledge
// beyond calling it.
//
// **The runtime question #133 asks, answered: the gate is enforced in
// `src/app/(account)/layout.tsx`, on the Node.js runtime, and no longer in
// `src/middleware.ts`.** The gate has to name the asking account, which is
// `currentSession()` — `next/headers`, a `node:crypto` HMAC and one
// `dbAdmin()` read. `src/middleware.ts` is still bundled for the **Edge**
// runtime in this build (Next 16 gives the *new* `proxy.ts` convention the
// Node default; the deprecated `middleware.ts` convention this repository
// still uses lands in `server/edge/…`, checked in the build's own
// middleware manifest), so none of those three is reachable from there.
// The three ways out, and why this one:
//
//   * *Read the session some other way at the edge* — a second HMAC
//     verifier written against Web Crypto beside the one in
//     `identity/cookie.ts`. Two implementations of one trust boundary, and
//     a database round trip in front of **every** request besides.
//   * *Declare the Node.js runtime for middleware* — reachable only by
//     migrating `middleware.ts` → `proxy.ts`, which `src/middleware.ts`'s
//     own header defers to "a work order that touches BP-001's own `code:`
//     list": an owner file, not a feature PR's.
//   * *Move the gate into the `(account)` layout* — this. It is a server
//     component on Node, so `currentSession()` and the
//     `sites.setup_completed_at` read work as written; it runs once per
//     account **screen**, not once per request; and `(account)/**` is
//     exactly the surface REQ-025 c5 is about.
//
// What that costs, stated rather than hidden: `src/app/api/**` is outside
// the `(account)` layout, so no API route is gated at all now. The
// allow-list's four `/api/*` rows therefore no longer *do* anything — they
// stay because the promise they record is unchanged and is now held more
// simply (nothing to leave is gated, because no endpoint is), and because
// they are what a future enforcement point that does see them must honour.
// Redirecting a `fetch` to a screen was never the useful half of REQ-025
// c5 either; every route handler authenticates on its own.
//
// A layout is not told its own path, so the path arrives as one request
// header the boundary sets — `GATE_PATH_HEADER`, below.
//
// **The exception is data, not an `if` repeated in every route.** A
// customer who has paid is never required to finish setup in order to
// leave: cancelling, resuming, exporting, reaching invoices, signing out
// and deleting the account all stay reachable with setup unfinished, and
// cancelling there runs the identical path a finished customer's does —
// there is no setup-aware branch in it to add later, because the gate
// never runs on those paths at all.
//
// Pure: no clock, no database, no request object, and no import that the
// Edge runtime lacks — `src/middleware.ts` imports `GATE_PATH_HEADER` from
// here, so a runtime import of the session or the store into this file
// would fail the build rather than fail a test. Which account is asking is
// `gate-state.ts`'s, which nothing on the Edge side imports.
import type { SetupProgressState } from "./submit";

/** Where an unfinished founder is sent, and where a finished one is taken
 *  when they return to setup. Internal route names, not customer-visible
 *  strings. */
export const SETUP_PATH = "/setup";
export const APP_PATH = "/app";

/**
 * The header the authorisation boundary writes the request's own path
 * into, so the `(account)` layout — which Next does not tell its path —
 * can ask `setupRedirectFor` about it.
 *
 * **Set by `src/middleware.ts`, never read from the client.** It is
 * written onto a *clone* of the incoming headers with `.set()`, which
 * overwrites whatever the caller sent, so a request that arrives carrying
 * `x-rk-path: /app/settings` for `/app` is gated as `/app`. A request that
 * did not pass through the boundary carries no path, and the layout treats
 * that the way it treats an unnameable account: it lets the request
 * through rather than guessing at one.
 */
export const GATE_PATH_HEADER = "x-rk-path";

/**
 * The one allow-list. Everything a paid customer needs in order to leave,
 * plus setup's own screens and the endpoints that complete it.
 *
 * A trailing `/*` matches that prefix and every path beneath it; every
 * other entry matches exactly. Anything not matched here is gated while
 * setup is unfinished — the default for a route nobody thought about is
 * "sent to setup", never "let through", so a new account route cannot
 * escape the gate by omission the way it cannot escape the session check
 * in `src/middleware.ts`.
 *
 * The four `/api/*` rows name endpoints that do not exist on disk yet
 * (§13, issues #35 and #42). They are declared here rather than added
 * later on purpose: the promise is that leaving never requires finishing
 * setup, and a list that acquires that property one route at a time would
 * have been wrong on the day each route landed.
 */
export const SETUP_INCOMPLETE_ALLOWLIST: readonly string[] = Object.freeze([
  // Setup itself — the screen, the waiting screen, and the three
  // endpoints they call. A gate that redirected the submit to the screen
  // that posts it would be a loop no founder could leave.
  "/setup",
  "/setup/*",
  "/api/setup",
  "/api/setup/*",
  // The way out (REQ-070 c2, REQ-076 c3). Settings is where cancelling,
  // resuming, exporting, invoices, sign-out and deletion all live.
  "/app/settings",
  "/api/settings",
  "/api/export",
  "/api/account/*",
  "/api/stripe/portal",
]);

/** First match over the allow-list. Exact, or a prefix where the entry
 *  ends `/*`. */
export function isAllowedWhileIncomplete(path: string): boolean {
  return SETUP_INCOMPLETE_ALLOWLIST.some((entry) => {
    if (!entry.endsWith("/*")) return entry === path;
    const prefix = entry.slice(0, -1); // keep the trailing slash
    return path.startsWith(prefix);
  });
}

/**
 * Where this request should go instead, or `null` to let it through.
 *
 * Three arms and no fourth:
 *   - setup unfinished, path not allow-listed → `/setup`
 *   - setup finished, path is setup           → `/app`
 *   - anything else                           → `null`
 *
 * `setup: null` means "which account this is, is not knowable here" —
 * `readSetupGateState`'s answer where no session names an account, or
 * where the row that would say cannot be read. It lets the request
 * through: a gate that redirected on an unknown account would send every
 * signed-in customer to setup.
 */
export function setupRedirectFor(a: {
  setup: SetupProgressState | null;
  path: string;
}): string | null {
  if (a.setup === null) return null;

  if (a.setup.complete) {
    // "when they return to it, then they are not asked the three
    // decisions again and are taken onward" (REQ-025 c4). Only `/setup`
    // itself is redirected — `/setup/waiting` is where a founder waits
    // out their own pass, and the release decision there is
    // `waiting/release.ts`'s, not this file's.
    return a.path === SETUP_PATH ? APP_PATH : null;
  }

  return isAllowedWhileIncomplete(a.path) ? null : SETUP_PATH;
}
