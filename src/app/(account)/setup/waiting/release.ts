// BUILD §4.3 — when the waiting screen lets go.
//
// "on completion straight to the app with the first draft already in the
// calendar. A degraded pass still releases setup (zero proposals is legal,
// never faked)." (§4.3)
//
// One pure function, so the release rule is decided by a test rather than
// by reading a server component. It is deliberately blind to *why* the
// pass ended: a degraded pass and a complete one release identically, and
// there is no arm in which a founder is held.
import type { PassProgress } from "../_setup/progress";

/** Where the app is. An internal route name (rule 1.1), not a
 *  customer-visible string. */
export const APP_PATH = "/app";

/**
 * The path to redirect to, or `null` to render the waiting frame.
 *
 * A pass that has ended releases into the app whatever state it ended in —
 * `degraded` changes what the app says, never whether the founder gets
 * there. There is no third arm: a founder is never held on this screen by
 * anything the pass reports.
 */
export function destinationFor(progress: PassProgress): string | null {
  return progress.running ? null : APP_PATH;
}
