import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

export function ageYearsFromCdx(rows: string[][], now: Date): number | null {
  const first = rows[1]?.[0];                 // rows[0] is the CDX header
  if (!first) return null;
  const y = Number(first.slice(0, 4)), m = Number(first.slice(4, 6)) - 1, d = Number(first.slice(6, 8));
  const ms = now.getTime() - Date.UTC(y, m, d);
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

export async function fetchDomainAgeYears(domain: string): Promise<number | null> {
  const url = `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&limit=1&sort=ascending&fl=timestamp`;
  try {
    // 4s (was the 8s default): archive.org CDX routinely takes 5–8s+ and was
    // gating get-listing (and thus the whole collect step) on every web scan.
    // Domain age is a garnish signal — degrading it to null beats paying ~4–8s
    // of scan wall-clock for it.
    const res = await fetchWithTimeout(url, {}, 4_000);
    if (!res.ok) return null;                  // garnish source — degrade gracefully
    const rows = (await res.json()) as string[][];
    return ageYearsFromCdx(rows, new Date());
  } catch { return null; }
}
