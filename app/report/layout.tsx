/**
 * Public report layout — the shared /report/[slug] page gets the same site
 * chrome (auth-aware nav + footer) as the rest of the project, so a shared
 * report reads as a first-class page and offers a clear path to scan your own.
 */

import type { ReactNode } from "react";
import { SiteChrome } from "@/components/sections/site-chrome";

export default function ReportLayout({ children }: { children: ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
