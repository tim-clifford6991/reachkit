/**
 * In-memory sliding-window rate limiter for auth endpoints (magic-link).
 *
 * A first layer atop Supabase's own per-email OTP limit: it blunts email-bombing
 * (many sends to one address) and per-IP enumeration (one IP hitting many
 * addresses) without a DB round-trip. State is per serverless instance and
 * resets on cold start — acceptable because (a) Vercel Fluid Compute reuses
 * instances across many requests, and (b) Supabase enforces its own per-email
 * ceiling underneath. NOT a substitute for a distributed limiter at scale.
 *
 * PURE-ish: `now` is injectable for tests; the bucket map is module state.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
/** Hard cap on distinct buckets so a flood of keys can't grow memory unbounded. */
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, number[]>();

/**
 * Record an attempt for `key` and return whether it is ALLOWED (under `limit`
 * within the rolling window). A denied attempt is NOT recorded (so the window
 * can drain). Prunes expired timestamps on each call.
 */
export function rateLimitAllow(key: string, limit: number, now: number = Date.now()): boolean {
  const cutoff = now - WINDOW_MS;
  const recent = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= limit) {
    buckets.set(key, recent); // persist the pruned list; do not count the denied hit
    return false;
  }

  recent.push(now);
  buckets.set(key, recent);

  // Opportunistic memory bound: if we've accumulated too many buckets, drop the
  // ones that are now fully expired.
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, ts] of buckets) {
      if (ts.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }
  return true;
}

/** Test helper — clear all buckets. */
export function __resetRateLimits(): void {
  buckets.clear();
}

/** Per-IP-hash and per-email magic-link ceilings (per rolling hour). */
export const MAGIC_LINK_PER_IP = 10;
export const MAGIC_LINK_PER_EMAIL = 5;

/**
 * Per-IP-hash cap on Stripe Checkout Session creation (per rolling hour). The
 * public checkout routes previously borrowed `assertRateLimit`, which counts
 * `scans` rows the checkout routes never write — a dead limiter that let an IP
 * create unlimited sessions (card-testing / Stripe-API exhaustion). This real
 * counter closes it. Generous: a genuine buyer rarely opens >8 checkouts/hour.
 */
export const CHECKOUT_PER_IP = 8;
