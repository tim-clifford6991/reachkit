"use client";

/**
 * Client-side lazy boundary for SetupOverlay. The overlay (plus the embedded
 * CompetitorSetup picker) only renders for un-onboarded users, but a static
 * import from the app layout puts its chunk in the first load of EVERY /app
 * route — that alone tips the (app) bundle budget. Dynamic import inside a
 * client component truly code-splits it.
 *
 * While the chunk loads, the fallback paints the same full-screen backdrop the
 * overlay opens with, so the locked app never flashes interactable-looking.
 */

import dynamic from "next/dynamic";

export const SetupOverlayLazy = dynamic(
  () => import("./setup-overlay").then((m) => m.SetupOverlay),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2000,
          background: "color-mix(in oklab, var(--c-bg2) 88%, transparent)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      />
    ),
  },
);
