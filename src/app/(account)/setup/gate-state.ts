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
import { currentSession } from "@/lib/account/identity";
import { liveSetupStore } from "./_setup/store";
import type { SetupProgressState } from "./submit";

/** The seam the layout reads through, and the one tests drive the gate
 *  with — a whole database and a signed cookie are not what a redirect
 *  matrix is about. It takes no request: `currentSession()` reads the
 *  cookie jar of the request it is already inside. */
export type SetupGateReader = () => Promise<SetupProgressState | null>;

const sessionBacked: SetupGateReader = async () => {
  const session = await currentSession();
  if (session === null) return null;

  try {
    return await liveSetupStore().readProgress(session.userId);
  } catch {
    // `readProgress` throws where no site row exists — a founder whose
    // payment has not provisioned one yet (§13). That is "not knowable",
    // not "unfinished": sending them to `/setup`, whose own read would
    // throw on the same missing row, would be a screen that cannot render
    // instead of one that can.
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
