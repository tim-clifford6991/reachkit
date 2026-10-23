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
import { requireAppAccount } from "../../app/_session/account";
import { APP_PATH } from "../gate";
import { ZoneScreen } from "./ZoneScreen";

export default async function ZonePage(): Promise<React.JSX.Element> {
  const account = await requireAppAccount();
  if (account.timeZone !== null) redirect(APP_PATH);
  return <ZoneScreen />;
}
