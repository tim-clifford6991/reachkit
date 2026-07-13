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

// Reddit requires a descriptive UA or it 429s the default agent.
const UA = "ReachKit/1.0 (+https://reachkit.app)";

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}

async function reddit(url: string): Promise<ThreadActivity | null> {
  const jsonUrl = url.replace(/\/?(\?.*)?$/, "") + ".json";
  const res = await fetchWithTimeout(jsonUrl, { headers: { "user-agent": UA, accept: "application/json" } }, 6000);
  if (!res.ok) return null;
  const body = (await res.json()) as Array<{ data?: { children?: Array<{ data?: { score?: number; num_comments?: number } }> } }>;
  const d = body?.[0]?.data?.children?.[0]?.data;
  if (!d || typeof d.score !== "number") return null;
  return { score: d.score, comments: typeof d.num_comments === "number" ? d.num_comments : 0 };
}

async function hackerNews(url: string): Promise<ThreadActivity | null> {
  const id = new URL(url).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) return null;
  const res = await fetchWithTimeout(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { headers: { accept: "application/json" } }, 6000);
  if (!res.ok) return null;
  const d = (await res.json()) as { score?: number; descendants?: number } | null;
  if (!d || typeof d.score !== "number") return null;
  return { score: d.score, comments: typeof d.descendants === "number" ? d.descendants : 0 };
}

export async function fetchThreadActivity(url: string): Promise<ThreadActivity | null> {
  try {
    const h = hostOf(url);
    if (h === "reddit.com" || h.endsWith(".reddit.com")) return await reddit(url);
    if (h === "news.ycombinator.com") return await hackerNews(url);
    return null;
  } catch {
    return null;
  }
}
