"use client";

/**
 * Client-side lazy boundary for DashboardGlimpse. The glimpse composes the
 * whole client intel kit; imported statically (even via next/dynamic in a
 * server component) its chunk lands in the route's entryJSFiles and blows the
 * (marketing) bundle budget. Dynamic import inside a client component is what
 * actually code-splits it — it sits below the fold, so ssr:false is free.
 */

import dynamic from "next/dynamic";

export const DashboardGlimpseLazy = dynamic(
  () => import("./dashboard-glimpse").then((m) => m.DashboardGlimpse),
  {
    ssr: false,
    loading: () => <div style={{ minHeight: 480 }} aria-hidden="true" />,
  },
);
