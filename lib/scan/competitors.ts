import type { Competitor } from "@/lib/scan/types";
import { serverDb } from "@/lib/db/client";
import { hostname } from "@/lib/scan/url";

export function rankCompetitors(
  all: Competitor[],
  opts: { selfHost?: string; cap?: number } = {},
): Competitor[] {
  const cap = opts.cap ?? 5;
  const self = opts.selfHost ? hostname(opts.selfHost) : null;
  const best = new Map<string, Competitor>();
  for (const c of all) {
    const k = hostname(c.url);
    if (self && k === self) continue;                 // drop the product's own domain (web mode)
    const cur = best.get(k);
    if (!cur || c.rank < cur.rank) best.set(k, c);
  }
  return [...best.values()]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, cap)
    .map((c, i) => ({ ...c, rank: i + 1 }));
}

export async function persistCompetitors(
  appId: string,
  competitors: Competitor[],
): Promise<void> {
  if (competitors.length === 0) return;
  const db = serverDb();
  const { error } = await db.from("competitors").insert(
    competitors.map((c) => ({
      app_id: appId,
      competitor_store_url: c.url,
      name: c.name,
      source: c.source,
      confirmed: false,
    })),
  );
  if (error) throw error;
}
