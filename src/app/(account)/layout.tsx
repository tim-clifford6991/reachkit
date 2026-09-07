// BUILD §4.3 — the account container, and the incomplete-setup gate's one
// enforcement point.
//
// BP-001 decision "three route groups ... with the authorisation rule
// attached to the group rather than to the route" (see the numbering note
// in `(public)/layout.tsx`). `src/app/(account)/**` requires a session
// (`## NFR budget`: "Authorisation: default-deny"), and that check is
// still `src/middleware.ts`'s: a signed-out request never reaches this
// file. It holds no shell chrome of its own — BP-037 owns
// `src/app/(account)/app/layout.tsx`.
//
// **What it does hold, since #133, is the setup gate** — "a founder who
// has paid and has not answered the three questions belongs on `/setup`,
// and a founder who has answered them is never asked again" (REQ-025 c4
// and c5). The policy is `setup/gate.ts`'s and the read is
// `setup/gate-state.ts`'s; this file contributes the place they meet and
// no setup knowledge of its own, which is why there is no per-route branch
// here to keep in step with the allow-list there.
//
// **Why here and not in `src/middleware.ts`, where it used to be:** the
// gate has to name the asking account, and `currentSession()` needs
// `next/headers`, `node:crypto` and a database read — none of them
// reachable from a file bundled for the Edge runtime, which
// `src/middleware.ts` still is. `setup/gate.ts`'s header states the three
// candidate answers and why this is the one. The consequence for this file
// is that it is a **server component**, so it runs on Node and can read
// both facts as written.
//
// Next does not tell a layout its own path, so the path arrives as
// `GATE_PATH_HEADER`, which the authorisation boundary sets on the
// forwarded request. It is read before the account is: a request that
// carries no path costs no session read and no database round trip.
import type React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_PATH_HEADER, setupRedirectFor } from "./setup/gate";
import { readSetupGateState } from "./setup/gate-state";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const path = (await headers()).get(GATE_PATH_HEADER);

  if (path !== null) {
    const destination = setupRedirectFor({
      setup: await readSetupGateState(),
      path,
    });
    // The second half is a loop guard and not a second policy: a
    // destination equal to the path being served would redirect a screen
    // to itself forever, and no arm of `setupRedirectFor` returns one
    // today.
    if (destination !== null && destination !== path) redirect(destination);
  }

  return <>{children}</>;
}
