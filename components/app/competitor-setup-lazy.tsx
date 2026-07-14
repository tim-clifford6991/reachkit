"use client";

/**
 * Client lazy boundary for the CompetitorSetup picker. It's the heavy
 * interactive body of /app/competitors — the leanest app page, which sits at
 * exactly the 275 KB app-group budget with zero headroom. A static import kept
 * it on the razor edge, so any shared-chunk growth (a new layout-level
 * component, a lib addition) tipped it over. Deferring the picker (dynamic
 * ssr:false) splits its chunk out of first-load, giving the page real headroom.
 */

import dynamic from "next/dynamic";

export const CompetitorSetupLazy = dynamic(
  () => import("@/components/app/intel/competitor-setup").then((m) => m.CompetitorSetup),
  {
    ssr: false,
    loading: () => (
      <div aria-hidden="true" style={{ minHeight: 320 }} />
    ),
  },
);
