// SPEC §5 (2026-09-20, #908, #924) — the DNS record as its own step after
// setup, at `/setup/connect`.
//
// "The DNS record is its own step after setup, with *Do this later*; it
// stays reachable from Overview's needs-you and from Settings until the
// host is live. This supersedes 2026-09-16 (#757) that it be completed on
// the setup page."
//
// A server component that reads once and hands the model down. It sits
// under `(account)` and outside the `/app` shell, like `/setup` itself:
// this is still setup's last screen, not the app's first.
//
// **A founder with nothing to connect is sent on, not shown an empty
// screen.** `readConnect()` answers `null` for a site with no hosted
// destination, a host the record would not name exactly, and — the common
// one — a host that is already live. There is no arm of this screen that
// draws a record nobody needs.
//
// `src/middleware.ts` already governs `/setup/*`: a signed-out request is
// redirected to the sign-in prompt and a signed-in one is served.
import type React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { copy } from "@/lib/presentation/copy";
import { readConnect } from "../_setup/connect";
import { ConnectScreen } from "./ConnectScreen";

/** /setup/connect's own `<title>` (#945). Every named screen says which
 *  screen it is; the `(account)` layout's fallback is the floor, not a
 *  name. */
export const metadata: Metadata = { title: copy("meta.app.setup.connect.title") };

export default async function ConnectPage(): Promise<React.JSX.Element> {
  const model = await readConnect();
  // Nothing to connect: the app is where this founder belongs. A blog that
  // is already live is the usual reason, and it is not a refusal.
  if (model === null) redirect("/app");

  return <ConnectScreen hostname={model.hostname} record={model.record} />;
}
