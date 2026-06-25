/**
 * Funnel layout — the scan + results pages (/scan/[id], /scan/[id]/results).
 *
 * These share the SAME chrome as the rest of the site (auth-aware nav + footer
 * via SiteChrome), so the results report reads as a first-class page — one nav,
 * one footer, one content width. Earlier the funnel was deliberately
 * chrome-minimal; we aligned it with the whole project.
 */

import type { ReactNode } from "react";
import { SiteChrome } from "@/components/sections/site-chrome";

export default function FunnelLayout({ children }: { children: ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
