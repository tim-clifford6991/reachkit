"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Captures a consent-gated $pageview on every App Router navigation. Mounted
 * once in the root layout; renders nothing. `lib/analytics` is imported
 * DYNAMICALLY inside the effect so this component adds no analytics code to
 * the shared first-load chunk (the P4 bundle lesson — a static import tipped
 * an app page over its pinned budget). capture() itself no-ops until the
 * visitor grants consent, and grantConsent() covers the page the visitor
 * accepts on, so pre-consent navigations are correctly dropped, not queued.
 * Keyed on pathname only (no useSearchParams → no Suspense boundary needed);
 * posthog-js attaches the full $current_url including query at capture time.
 */
export function PageviewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    void import("@/lib/analytics").then((m) => m.trackPageview());
  }, [pathname]);

  return null;
}
