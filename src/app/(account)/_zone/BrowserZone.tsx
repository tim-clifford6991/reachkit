// §4 — the browser reports its zone, once per account page load (#753).
//
// Mounted by the `(account)` layout, so it runs on the first screen a signed-in
// browser renders — `/setup`, straight after checkout — and on every hard
// load after, which is where a founder who signed in before this existed is
// caught. A layout survives client navigation, so this is one call per load,
// not one per screen. It draws nothing.
//
// Once a zone is adopted the screen is refreshed, so a screen that could not
// be drawn without one (`/setup/zone`) moves on by itself.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { reportBrowserZone } from "./actions";

export function BrowserZone(): null {
  const router = useRouter();

  useEffect(() => {
    const reported = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let live = true;
    reportBrowserZone(reported).then(
      (result) => {
        if (live && result?.adopted === true) router.refresh();
      },
      () => {
        // Nothing to show: a screen that needs the zone already says so.
      }
    );
    return () => {
      live = false;
    };
  }, [router]);

  return null;
}
