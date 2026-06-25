/**
 * Brand mark for a scanned site — personalisation for the report.
 *
 * We derive the client's favicon from their domain at render time (Google's
 * public favicon service), so it works for every existing scan with no pipeline
 * change and no stored asset. The service always resolves to *something* (the
 * site's real favicon, or a neutral globe), so a plain <img> never breaks.
 */

import { hostname } from "@/lib/scan/url";

export interface BrandMark {
  /** Bare host, e.g. "nudgi.ai". */
  host: string;
  /** A ~128px favicon URL for the host. */
  logoUrl: string;
}

export function brandFromUrl(storeUrl?: string | null): BrandMark | null {
  if (!storeUrl) return null;
  const host = hostname(storeUrl);
  if (!host) return null;
  return {
    host,
    logoUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
  };
}
