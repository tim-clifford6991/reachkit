"use client";

/**
 * Client-side lazy boundary for SetupOverlay. The overlay (plus the embedded
 * CompetitorSetup picker) only renders for un-onboarded users, but a static
 * import from the app layout puts its chunk in the first load of EVERY /app
 * route — that alone tips the (app) bundle budget. Dynamic import inside a
 * client component truly code-splits it.
 *
 * This wrapper also owns the SURFACE EXEMPTION: the overlay never renders on
 * /app/settings or /app/add (the escape + the onboarding surface itself), so
 * neither the loading backdrop nor the overlay flashes there — the blocking is
 * enforced on every OTHER page (owner rule 2026-07-27).
 *
 * While the chunk loads (on a blocking page), the fallback paints the same
 * full-screen backdrop the overlay opens with, so the locked app never flashes
 * interactable-looking.
 */

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import type { SetupOverlay } from "./setup-overlay";

const LazyOverlay = dynamic(
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

const EXEMPT = new Set(["/app/settings", "/app/add"]);

export function SetupOverlayLazy(props: ComponentProps<typeof SetupOverlay>) {
  const pathname = usePathname();
  if (EXEMPT.has(pathname)) return null;
  return <LazyOverlay {...props} />;
}
