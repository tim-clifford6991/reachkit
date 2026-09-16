// §4, §5 — where a finished founder waits for their site's time zone (#753).
//
// The app draws every date in the site's own zone and never in the server's
// (REQ-073 c1), so a site with no zone cannot open it. Sending that founder
// to `/setup` trapped them: `/setup` sends a finished founder to `/app`, and
// `/app` sent them straight back. This screen is where they land instead,
// and it says why rather than redirecting again.
//
// **It leaves on one fact only: the zone is stated.** That is the opposite
// of the fact that sends a founder here, so no pair of redirects can bounce
// between this screen and `/app`. The zone itself arrives from the browser
// — `BrowserZone`, mounted by the `(account)` layout around this page,
// reports it and refreshes the screen, and this read then finds it.
//
// Outside the `/app` shell, like the other setup screens: the shell states
// dates, and there is no zone to state them in yet.
import type React from "react";
import { redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { Surface } from "@/ui/layout";
import { copy } from "@/lib/presentation/copy";
import { requireAppAccount } from "../../app/_session/account";
import { APP_PATH } from "../gate";

export default async function ZonePage(): Promise<React.JSX.Element> {
  const account = await requireAppAccount();
  if (account.timeZone !== null) redirect(APP_PATH);

  return (
    <Surface
      arms={{
        compact: { kind: "columns", count: 1 },
        medium: { kind: "same-as-below" },
        wide: { kind: "same-as-below" },
      }}
    >
      <main className="grid content-start gap-4 p-4">
        <h1>{copy("setup.zone.head")}</h1>
        <div role="status" className="alert" data-testid={ZONE_TEST_ID}>
          <Globe aria-hidden size={20} strokeWidth={1.75} />
          <p>{copy("setup.zone.line")}</p>
        </div>
      </main>
    </Surface>
  );
}

/** Bound to a name before it reaches JSX — the copy sweep's rule. A test
 *  hook, not a word anyone reads. */
const ZONE_TEST_ID = "setup-zone";
