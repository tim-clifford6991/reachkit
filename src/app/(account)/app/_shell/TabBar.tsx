// BUILD §4.4 — "Mobile: sidebar hidden, top tabs. No other navigation."
//
// WO-155 step 1, verbatim: "Build `TabBar.tsx` as a composition over `Tabs`
// with no custom CSS, or stop and raise it: minting a sixth custom surface
// here is the one thing this step forbids." This is that composition —
// `Tabs` is the registered daisyUI component, and this file adds no class,
// no stylesheet and no markup of its own beyond the element that carries
// the test hook.
//
// It maps over the **same** `DESTINATIONS` tuple the sidebar does, so the
// two breakpoints cannot offer different navigation (REQ-040 c1, c5). The
// tab labels come from the same registry keys for the same reason.
//
// `Tabs` reports a selection rather than navigating, so this composition
// navigates on select. The sidebar's own `<a href>` is the no-JavaScript
// path; a viewport narrow enough for the tab bar is a browser running the
// client runtime, and the same three addresses are reachable either way.
"use client";

import type React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, type TabItem } from "@/ui/components/Tabs";
import { copy } from "@/lib/presentation/copy";
import { DESTINATIONS, DESTINATION_COPY_KEY, DESTINATION_HREF, destinationOf } from "./destinations";

export function TabBar(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const current = destinationOf(pathname);

  const tabs: TabItem[] = DESTINATIONS.map((destination) => ({
    id: destination,
    label: copy(DESTINATION_COPY_KEY[destination]),
  }));

  return (
    <div className="rk-tabbar" data-testid="shell-tabbar">
      <Tabs
        tabs={tabs}
        // `?? DESTINATIONS[0]` until #267: on a route that is on no
        // destination — the draft view — that fallback marked Overview
        // current on a page that is not Overview, while the sidebar, which
        // reads the same `destinationOf`, marked nothing. One reader, one
        // answer, and `null` is the answer where there is none.
        selectedId={current ?? null}
        onSelect={(id) => {
          const destination = DESTINATIONS.find((d) => d === id);
          if (destination) router.push(DESTINATION_HREF[destination]);
        }}
      />
    </div>
  );
}
