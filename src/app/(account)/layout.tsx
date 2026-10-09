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
//
// **It also declares the group's fallback `<title>` (#945).** Every route
// under here had none at all — axe's `document-title`, serious, on eight
// screens — because nothing in the group exported `metadata` and the root
// layout declares no default either. Each screen names itself in its own
// `page.tsx`; this is the floor beneath them, so a route added later
// without a title of its own still announces the product rather than
// nothing. It is the wordmark's own key, not a second spelling of it.
//
// A layout's plain-string `title` is Next's documented default for child
// segments that declare none (`generate-metadata.md`: "`title` (string) and
// `title.default` define the default title for child segments"). No
// `title.template` is set: a template would rewrite every screen's own
// title, and the eight `meta.app.*` rows are already the whole sentence a
// reader sees.
import type React from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { copy } from "@/lib/presentation/copy";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { GATE_PATH_HEADER, setupRedirectFor } from "./setup/gate";
import { readSetupGateState } from "./setup/gate-state";
import { BrowserZone } from "./_zone/BrowserZone";

export const metadata: Metadata = { title: copy("chrome.wordmark") };

/** Every screen under this layout is rendered for its own request, so it
 *  carries that request's nonce (issue #331). The reason is the root
 *  layout's, and so was this declaration until issue 1242: Next applies a
 *  layout's `force-dynamic` to every route under it, and one `(hosted)`
 *  route is cached. */
export const dynamic = "force-dynamic";

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
    // today. It cannot see a loop through a second gate — `/setup` ⇄ `/app`
    // was one (#753) — so that is kept out by `zoneRedirectFor` sending no
    // finished founder to `/setup`, and proved by
    // `tests/app/setup/gate-loop.test.ts`, which follows every redirect the
    // account gates can give.
    if (destination !== null && destination !== path) redirect(destination);
  }

  // REQ-073 c1's first sign-in write has its caller here, on every account
  // screen: the zone is the browser's to report, and only script can.
  //
  // **`NuqsAdapter` is mounted here and not on the document** (#988). Every
  // `useQueryState` in this product is under this group — the calendar's
  // month and day, the Rivals and Search tables' filters, setup's step —
  // and none is outside it. On the root layout the adapter shipped to every
  // public route as well, which is 17.8 kB of script a stranger reading the
  // landing page downloaded for URL state that page does not have. It still
  // wraps every screen that reads one, which is what the adapter is for.
  return (
    <NuqsAdapter>
      <BrowserZone />
      {children}
    </NuqsAdapter>
  );
}
