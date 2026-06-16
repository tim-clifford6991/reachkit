/**
 * Deep domain profiling (M2) — shared profile cache.
 *
 * `distribution_profiles` is domain-keyed and shared across users: a popular
 * competitor is profiled once and reused by every scan that references it — the
 * margin lever that keeps the deep scan cheap. `profileDomainCached` is the
 * front door: serve a fresh cached profile, else compute + persist.
 */

import { serverDb } from "@/lib/db/client";
import type { Json } from "@/lib/db/types";
import { profileDomain } from "./profile-domain";
import { toHost } from "./crawl";
import type { DistributionProfile } from "./types";

/** Default freshness window for a cached profile. */
export const PROFILE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Cache schema version — bump whenever the profile shape or how it's computed
 * changes, so stale-shaped entries are treated as a miss and recomputed (rather
 * than served for the whole TTL). Saves clearing the table on every iteration.
 */
export const PROFILE_CACHE_VERSION = 2;

type Versioned = DistributionProfile & { _v?: number };

/** Return a cached profile if present and newer than `maxAgeMs`, else null. */
export async function getCachedProfile(
  domain: string,
  maxAgeMs: number = PROFILE_TTL_MS,
  nowMs: number = Date.now(),
): Promise<DistributionProfile | null> {
  const host = toHost(domain);
  const { data, error } = await serverDb()
    .from("distribution_profiles")
    .select("profile, crawled_at")
    .eq("domain", host)
    .maybeSingle();
  if (error || !data) return null;
  const cached = data.profile as unknown as Versioned;
  // Shape/computation changed since this was written → recompute.
  if (cached?._v !== PROFILE_CACHE_VERSION) return null;
  const age = nowMs - Date.parse(data.crawled_at);
  if (Number.isNaN(age) || age > maxAgeMs) return null;
  const { _v, ...profile } = cached;
  void _v;
  return profile;
}

/** Upsert a profile into the shared cache (keyed on its host). */
export async function upsertProfile(profile: DistributionProfile): Promise<void> {
  const host = toHost(profile.domain);
  const payload: Versioned = { ...profile, _v: PROFILE_CACHE_VERSION };
  const { error } = await serverDb()
    .from("distribution_profiles")
    .upsert(
      { domain: host, profile: payload as unknown as Json, crawled_at: profile.crawledAt },
      { onConflict: "domain" },
    );
  // A missing table (migration not yet applied) lands here — caching is simply
  // inert until then, so this is best-effort. Log the full error for clarity.
  if (error) console.error(`[profile cache] upsert failed for ${host}:`, error.message ?? error.code ?? error);
}

/**
 * Profile a domain through the shared cache: serve a fresh cached profile, else
 * compute it and persist. Cache read/write failures degrade to a live compute,
 * so the cache is an optimisation, never a hard dependency.
 */
export async function profileDomainCached(
  domain: string,
  opts: { maxAgeMs?: number; nowMs?: number } = {},
): Promise<DistributionProfile> {
  const nowMs = opts.nowMs ?? Date.now();
  const cached = await getCachedProfile(domain, opts.maxAgeMs ?? PROFILE_TTL_MS, nowMs).catch(
    () => null,
  );
  if (cached) return cached;

  const profile = await profileDomain(domain, { nowMs });
  await upsertProfile(profile).catch(() => {});
  return profile;
}
