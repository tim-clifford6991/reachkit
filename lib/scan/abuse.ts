/**
 * Scan abuse controls (Cycle 5 Task 1, R4 / §12).
 *
 * Two protections for the FREE /api/scan path:
 *   1. Dedupe — one scan per app. `findAppByUrl` + `findExistingScanForApp` let
 *      the route return an existing scan id instead of creating a duplicate, so
 *      re-requesting a store_url just returns the existing report. (Paid
 *      re-scans go through the weekly refresh, a separate path.)
 *   2. Per-IP rate limit — `assertRateLimit` caps scans per IP (across apps) to
 *      stop enumeration abuse. Only a SHA-256 hash of the IP is ever stored.
 */

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { serverDb } from "@/lib/db/client";
import { fixturesEnabled } from "@/lib/dev/fixtures";

/** Max scans permitted per IP within the rolling window (1 hour). */
export const RATE_LIMIT = 10;

/**
 * How long an unfinished scan is considered still "in flight" for dedupe.
 * Past this, a stuck `queued`/`collecting`/`synthesizing` row is treated as
 * dead and no longer poisons re-scans of its url.
 */
const IN_FLIGHT_WINDOW_MS = 15 * 60 * 1000;

/** SHA-256 hash of the literal string `"unknown"` — the fallback IP. */
const UNKNOWN_IP_HASH = hashIp("unknown");

export class AbuseError extends Error {
  constructor(
    public kind: "rate_limit",
    message: string,
  ) {
    super(message);
    this.name = "AbuseError";
  }
}

/** One-way hash of an IP so the raw address is never persisted. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/** Best-effort client IP from proxy headers, else `"unknown"`. */
export function ipFromRequest(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // x-forwarded-for can be a comma-separated chain; the client is first.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** App id for a store_url, or null if no app exists yet. */
export async function findAppByUrl(storeUrl: string): Promise<string | null> {
  const db = serverDb();
  const { data, error } = await db
    .from("apps")
    .select("id")
    .eq("store_url", storeUrl)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * A genuinely *reusable* scan id for an app, or null if a fresh scan is owed.
 *
 * Only two kinds of scan dedupe a new request; anything else (a `failed` row,
 * or a stuck `queued`/`collecting`/`synthesizing` row older than the in-flight
 * window) is dead and must NOT poison re-scans, so we fall through to null:
 *   1. A FINISHED scan (`done`; `complete` accepted defensively) — reuse the
 *      report. Checked first so a finished scan always wins over an in-flight one.
 *   2. Else a still-RUNNING scan (`queued`/`collecting`/`synthesizing`) created
 *      within the last 15 minutes — avoid kicking off a duplicate concurrent run.
 * Most-recent-first within each category.
 */
export async function findExistingScanForApp(appId: string): Promise<string | null> {
  const db = serverDb();

  // 1. A finished scan — reuse its report.
  const finished = await db
    .from("scans")
    .select("id")
    .eq("app_id", appId)
    .in("status", ["done", "complete"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (finished.error) throw finished.error;
  if (finished.data) return finished.data.id;

  // 2. Else a genuinely in-flight scan (running and still recent).
  const since = new Date(Date.now() - IN_FLIGHT_WINDOW_MS).toISOString();
  const inFlight = await db
    .from("scans")
    .select("id")
    .eq("app_id", appId)
    .in("status", ["queued", "collecting", "synthesizing"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (inFlight.error) throw inFlight.error;
  return inFlight.data?.id ?? null;
}

/**
 * Throw `AbuseError("rate_limit")` if this IP hash has >= RATE_LIMIT scans in
 * the last hour. Skipped entirely in fixtures/dev mode and for the "unknown"
 * IP hash (proxies that strip headers in dev would otherwise share one bucket).
 */
export async function assertRateLimit(ipHash: string): Promise<void> {
  // Generous local/dev: never block fixture runs.
  if (fixturesEnabled()) return;
  // Don't collapse everyone behind a header-stripping proxy into one bucket.
  if (ipHash === UNKNOWN_IP_HASH) return;

  const db = serverDb();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await db
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (error) throw error;
  if ((count ?? 0) >= RATE_LIMIT) {
    throw new AbuseError("rate_limit", "scan rate limit reached for this IP");
  }
}
