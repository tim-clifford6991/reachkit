import { serverDb } from "@/lib/db/client";

export interface ScanChip {
  label: string;
  score?: number;
}

function hostFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Recent completed scans for the "Recent scans" marquee — real social proof.
 *
 * Fully defensive: any failure (no DB, empty table, schema drift, too few rows)
 * returns the provided curated fallback, so the marketing pages never break.
 * Callers should set `export const revalidate` so this is cached, not per-request.
 */
export async function getRecentScanChips(
  fallback: readonly ScanChip[]
): Promise<readonly ScanChip[]> {
  try {
    const db = serverDb();
    const { data, error } = await db
      .from("scans")
      .select("score_total, completed_at, apps(name, store_url)")
      .not("completed_at", "is", null)
      .not("score_total", "is", null)
      .order("completed_at", { ascending: false })
      .limit(12);

    if (error || !data) return fallback;

    const chips: ScanChip[] = [];
    for (const row of data) {
      const score = row.score_total;
      // Supabase may type a to-one join as an object or a single-element array.
      const joined = (row as { apps?: unknown }).apps;
      const app = (Array.isArray(joined) ? joined[0] : joined) as
        | { name: string | null; store_url: string | null }
        | null
        | undefined;
      const name = app?.name?.trim() || hostFrom(app?.store_url);
      if (typeof score !== "number" || !name) continue;
      chips.push({ label: `${name} · ${score} / 100`, score });
    }

    return chips.length >= 4 ? chips : fallback;
  } catch {
    return fallback;
  }
}
