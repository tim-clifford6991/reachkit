// BUILD §4.3 — the incomplete-setup gate: one allow-list, and the way out
// is never gated.
//
// "Setup `/setup` — post-payment, once." A founder who has paid and has
// not answered the three questions belongs on `/setup`, and a founder who
// has answered them is never asked again. Both halves are this file, and
// this file is the only place either is decided: `setupRedirectFor` holds
// no per-route branch, and `src/middleware.ts` — the one place a route
// policy is enforced in this product — holds no setup knowledge beyond
// calling it.
//
// **The exception is data, not an `if` repeated in every route.** A
// customer who has paid is never required to finish setup in order to
// leave: cancelling, resuming, exporting, reaching invoices, signing out
// and deleting the account all stay reachable with setup unfinished, and
// cancelling there runs the identical path a finished customer's does —
// there is no setup-aware branch in it to add later, because the gate
// never runs on those paths at all.
//
// Pure: no clock, no database, no request object. Which account is asking
// is `readSetupGateState`'s (below), and today nothing can answer it.
import type { SetupProgressState } from "./submit";

/** Where an unfinished founder is sent, and where a finished one is taken
 *  when they return to setup. Internal route names, not customer-visible
 *  strings. */
export const SETUP_PATH = "/setup";
export const APP_PATH = "/app";

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
 * `readSetupGateState`'s default answer until §13's session lands. It lets
 * the request through: a gate that redirected on an unknown account would
 * send every signed-in customer to setup.
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

/**
 * Reads which account is asking and how far through setup it is.
 *
 * **Declared, and honestly unanswerable today.** The session cookie
 * `src/middleware.ts` checks carries presence and nothing else — "the
 * check is a cookie's presence, nothing about its contents" — and the
 * function that turns a session into an account, `currentSession()`, is
 * issue #35. `sites.setup_completed_at` exists (this issue's own
 * migration), so the *state* is readable the moment the *account* is; the
 * missing half is identity, not storage.
 *
 * So this returns `null`, the gate lets every request through, and the
 * wiring above is exercised end to end by `setSetupGateReader` rather than
 * by a fixture that would claim an account this process cannot name. When
 * #35 lands, this body becomes the one read it describes and nothing else
 * in this file or in `src/middleware.ts` changes.
 */
export type SetupGateReader = (request: {
  readonly cookies: { get(name: string): { value: string } | undefined };
}) => Promise<SetupProgressState | null>;

const identityIsIssue35: SetupGateReader = async () => null;

let reader: SetupGateReader = identityIsIssue35;

/** The seam #35 fills, and the one tests drive the gate through. */
export function setSetupGateReader(next: SetupGateReader): void {
  reader = next;
}

export function resetSetupGateReader(): void {
  reader = identityIsIssue35;
}

export async function readSetupGateState(
  request: Parameters<SetupGateReader>[0]
): Promise<SetupProgressState | null> {
  return reader(request);
}
