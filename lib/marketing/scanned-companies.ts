/**
 * Companies-analyzed ticker source (landing-page social proof).
 *
 * Merges the recognizable brands we've published teardowns for with the real
 * completed scans in the DB, deduped by domain. Acts as social proof "until we
 * have real testimonials" — and grows automatically as scan volume builds.
 */

import { listPublicScans } from "@/lib/scan/public-scans";
import { brandFromUrl } from "@/lib/brand/logo";

export interface TickerCompany {
  /** Display name (curated brand name, or the bare domain for live scans). */
  name: string;
  /** Bare domain, used for the favicon + dedupe key. */
  domain: string;
  /** ~128px favicon. */
  logoUrl: string;
}

/**
 * Recognizable brands we've analyzed (published teardowns + a few well-known
 * peers). Seed social proof while real scan volume is still building; real
 * scans are merged in and win when a domain overlaps.
 */
const CURATED: ReadonlyArray<{ name: string; domain: string }> = [
  { name: "Raycast", domain: "raycast.com" },
  { name: "Cal.com", domain: "cal.com" },
  { name: "Plausible", domain: "plausible.io" },
  { name: "Reflect", domain: "reflect.app" },
  { name: "Linear", domain: "linear.app" },
  { name: "Resend", domain: "resend.com" },
  { name: "Bearable", domain: "bearable.app" },
  { name: "CardPointers", domain: "cardpointers.com" },
  { name: "Sofa", domain: "sofa.so" },
  { name: "Opal", domain: "opal.so" },
];

/** The deduped ticker set: curated brands first, then any other real scans. */
export async function listScannedCompanies(): Promise<TickerCompany[]> {
  const seen = new Set<string>();
  const out: TickerCompany[] = [];

  const add = (name: string, domain: string) => {
    const key = domain.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    const logoUrl = brandFromUrl(`https://${key}`)?.logoUrl;
    if (!logoUrl) return;
    seen.add(key);
    out.push({ name, domain: key, logoUrl });
  };

  // Curated brands first (nicer display names win over a bare domain).
  for (const c of CURATED) add(c.name, c.domain);

  // Then every real completed web scan, filling the ticker as volume grows.
  try {
    for (const s of await listPublicScans({ limit: 200 })) add(s.host, s.host);
  } catch {
    // Best-effort: the curated set alone is a valid ticker if the DB read fails.
  }

  return out;
}
