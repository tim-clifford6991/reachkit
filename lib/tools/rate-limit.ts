/**
 * Light in-memory per-IP rate limit for the free /tools checkers (W3).
 *
 * The paid-path /api/scan limit is DB-backed (lib/scan/abuse.ts, 10 scans/hr)
 * because scans cost real vendor money. The tools only cost an outbound fetch,
 * so a best-effort in-memory sliding window is proportionate: it stops loops
 * and scripted hammering from a single instance, and resets on redeploy —
 * acceptable for a free, unauthenticated checker.
 */

const WINDOW_MS = 60 * 60 * 1000;

/** Max tool checks per IP per rolling hour (vs 10/hr for full scans). */
export const TOOL_RATE_LIMIT = 30;

/** Prune the whole table once it holds this many IPs (bounds memory). */
const PRUNE_THRESHOLD = 5_000;

const hits = new Map<string, number[]>();

/**
 * Record a hit for `ip` and report whether it is still within the limit.
 * The "unknown" fallback IP is never limited — behind a header-stripping
 * proxy it would collapse all users into one bucket (same policy as abuse.ts).
 */
export function checkToolRateLimit(ip: string, now: number = Date.now()): boolean {
  if (!ip || ip === "unknown") return true;

  const cutoff = now - WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= TOOL_RATE_LIMIT) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);

  if (hits.size > PRUNE_THRESHOLD) {
    for (const [key, times] of hits) {
      const kept = times.filter((t) => t > cutoff);
      if (kept.length === 0) hits.delete(key);
      else hits.set(key, kept);
    }
  }
  return true;
}

/** Test hook — clears all recorded hits. */
export function resetToolRateLimit(): void {
  hits.clear();
}

/**
 * Best-effort client IP from a headers store (next/headers `headers()` result
 * or any Headers-like). Mirrors `ipFromRequest` in lib/scan/abuse.ts.
 */
export function ipFromHeaderStore(h: { get(name: string): string | null }): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
