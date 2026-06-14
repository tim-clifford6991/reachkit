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
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;                  // garnish source — degrade gracefully
    const rows = (await res.json()) as string[][];
    return ageYearsFromCdx(rows, new Date());
  } catch { return null; }
}
