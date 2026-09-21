// SPEC §4 (2026-09-20, #908) — the Rivals tab's address.
//
// "Rivals tab: who is on the first page for the twelve searches, who the
// three answer engines name, how far ahead each rival's footprint is over
// twelve weeks, and the searches rivals win that the site does not." That
// screen is #917. This file is its address, so the tab bar and the
// Overview's third tile both have somewhere to go from the day they land.
import type React from "react";
import type { Metadata } from "next";
import { TabPlaceholder } from "../../_overview/TabPlaceholder";
import { copy } from "@/lib/presentation/copy";

/** /app/rivals's own `<title>` (#945). Without it this screen announced
 *  nothing at all — the `(account)` layout's fallback is the floor, not
 *  the name of this screen. */
export const metadata: Metadata = { title: copy("meta.app.rivals.title") };

export default function RivalsTabPage(): React.JSX.Element {
  return <TabPlaceholder tab="rivals" />;
}
