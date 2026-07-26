/**
 * Real engagement (score + comment count) for a buyer thread, from the surface's
 * OWN free public API — Reddit (`<permalink>.json`) and Hacker News (Firebase
 * `item/<id>.json`). Returns null for any other host, a non-200, malformed JSON,
 * or a timeout. NEVER throws and NEVER invents a number (honest degrade).
 */
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

export interface ThreadActivity {
  score: number;
  comments: number;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

async function hackerNews(url: string): Promise<ThreadActivity | null> {
  const id = new URL(url).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) return null;
  const res = await fetchWithTimeout(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { headers: { accept: "application/json" } }, 6000);
  if (!res.ok) return null;
  const d = (await res.json()) as { score?: number; descendants?: number; dead?: boolean; deleted?: boolean } | null;
  if (!d || typeof d.score !== "number") return null;
  // R3 (2026-07-26): a flagged-dead or deleted HN item is not a live thread —
  // never surface engagement for it (the "dead link" the owner saw). Reddit
  // liveness is unrecoverable server-side (403, no OAuth), so this guard only
  // fires for the surfaces whose own API tells us liveness truthfully.
  if (d.dead === true || d.deleted === true) return null;
  return { score: d.score, comments: typeof d.descendants === "number" ? d.descendants : 0 };
}

export async function fetchThreadActivity(url: string): Promise<ThreadActivity | null> {
  try {
    const h = hostOf(url);
    // Reddit blocks unauthenticated server reads (403, Responsible Builder gate) — needs OAuth
    // (deferred; see memory reachkit-reddit-demand-data-gap). Skip to avoid wasted 403 round-trips.
    if (h === "reddit.com" || h.endsWith(".reddit.com")) return null;
    if (h === "news.ycombinator.com") return await hackerNews(url);
    return null;
  } catch {
    return null;
  }
}
