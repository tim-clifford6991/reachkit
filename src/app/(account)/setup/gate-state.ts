// BUILD §4.3 — which account is asking the incomplete-setup gate, and how
// far through setup it is.
//
// The half of the gate that reads. `gate.ts` decides — purely, with no
// clock, no database and no session — and this file is the one place the
// two facts that decision needs are fetched: who is asking, and whether
// their `sites.setup_completed_at` is set.
//
// **This file is Node-only, and that is the point of it being a separate
// file.** `currentSession()` pulls `next/headers` and a `node:crypto`
// HMAC, and the store below pulls `dbAdmin()`. `src/middleware.ts` is
// bundled for the Edge runtime and imports `gate.ts` for one header name;
// keeping the reads here means that import can never drag any of them into
// the Edge bundle. The enforcement point that does import this file is
// `src/app/(account)/layout.tsx`, a server component on Node.
//
// **One read, and it is `liveSetupStore`'s.** `readProgress` already turns
// a user id into `SetupProgressState` off `sites.setup_completed_at`;
// asking it rather than writing a second query is what keeps "the one
// predicate every account route consults" true — the gate, the setup
// screen and `completeSetup` cannot disagree about whether setup is done,
// because there is one query.
//
// **Unreadable is `null`, not "incomplete".** A session that names nobody,
// a site row provisioning has not written, a database that will not answer
// — none of those is a statement about how far through setup a founder is,
// and `setupRedirectFor` lets a `null` through. Failing the other way
// would put every signed-in customer on `/setup` the moment a read failed,
// including the ones who finished months ago, and `/setup`'s own reads
// would be failing too. It is the same fail-open convention
// `src/middleware.ts` uses for the one read it makes.
//
// **And unreadable includes "did not answer at all".** This read sits in
// front of every account screen, so a database that is slow or unreachable
// must cost a screen that renders, not a page that hangs — and a `catch`
// alone does not do that, because a request that never settles never
// rejects. The bound below is the same shape as `src/middleware.ts`'s
// `withDeadline` around its one read, and exists for the same reason: the
// layout conformance sweep renders every account route against a database
// that is not there, and a hang would be indistinguishable from a broken
// screen.
import { currentSession } from "@/lib/account/identity";
import { liveSetupStore } from "./_setup/store";
import type { SetupProgressState } from "./submit";

/** The seam the layout reads through, and the one tests drive the gate
 *  with — a whole database and a signed cookie are not what a redirect
 *  matrix is about. It takes no request: `currentSession()` reads the
 *  cookie jar of the request it is already inside. */
export type SetupGateReader = () => Promise<SetupProgressState | null>;

/**
 * How long the whole read may take before the screen renders anyway.
 * Chosen here rather than pinned in `constants.ts` on the same grounds
 * `src/middleware.ts` states for its own: it is a property of this one
 * request-path read, not a product bound anything else reads, and it lives
 * in exactly one file. Generous against two indexed lookups on a healthy
 * database, short against a founder waiting for a screen.
 */
const GATE_READ_DEADLINE_MS = 800;

/** Rejects when `work` has not settled inside the deadline, so the caller's
 *  own `catch` covers a hang the same way it covers a failure. */
function withDeadline<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_resolve, reject) =>
      setTimeout(() => reject(new Error("setup gate read timed out")), GATE_READ_DEADLINE_MS)
    ),
  ]);
}

const sessionBacked: SetupGateReader = async () => {
  let session: Awaited<ReturnType<typeof currentSession>>;
  try {
    session = await withDeadline(currentSession());
  } catch {
    // `currentSession()` reads the `users` row behind a verified cookie,
    // so it is a database read too, and it fails the same way.
    return null;
  }
  if (session === null) return null;

  try {
    return await withDeadline(liveSetupStore().readProgress(session.userId));
  } catch {
    // `readProgress` throws where no site row exists — a founder whose
    // payment has not provisioned one yet (§13) — and now also where it
    // did not answer inside the deadline. Both are "not knowable", not
    // "unfinished": sending them to `/setup`, whose own read would fail on
    // the same row, would be a screen that cannot render instead of one
    // that can.
    return null;
  }
};

let reader: SetupGateReader = sessionBacked;

export function setSetupGateReader(next: SetupGateReader): void {
  reader = next;
}

export function resetSetupGateReader(): void {
  reader = sessionBacked;
}

export async function readSetupGateState(): Promise<SetupProgressState | null> {
  return reader();
}
