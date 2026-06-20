/**
 * Weekly refresh digest reader (ChannelIntel UX — "what changed this week" +
 * the signal feed).
 *
 * The weekly cron emits a `refresh` scan_event per app, anchored on its latest
 * scan id, carrying `{ weekOf, noOp, changes, newActions, alerts }`. Nothing read
 * it until now. These readers surface it:
 *   - `latestRefreshDigest(appId)` → the most recent week (the dashboard banner)
 *   - `listRefreshDigests(appId)`  → every week, newest-first (the feed timeline)
 *
 * `parseRefreshDigest` is PURE + defensive (older/malformed payloads → null), so
 * it's unit-testable without a DB.
 */

import { serverDb } from "@/lib/db/client";
import type { RefreshChange } from "@/lib/scan/refresh";
import type { MarketAlert } from "@/lib/scan/market";

export interface RefreshDigest {
  weekOf: string;
  noOp: boolean;
  changes: RefreshChange[];
  alerts: MarketAlert[];
  newActions: number;
  /** scan_events.created_at — the timeline ordering key. */
  createdAt: string;
}

/** PURE: shape a stored `refresh` event payload into a RefreshDigest, or null. */
export function parseRefreshDigest(payload: unknown, createdAt: string): RefreshDigest | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const weekOf = typeof p.weekOf === "string" ? p.weekOf : null;
  if (!weekOf) return null;
  return {
    weekOf,
    noOp: p.noOp === true,
    changes: Array.isArray(p.changes) ? (p.changes as RefreshChange[]) : [],
    alerts: Array.isArray(p.alerts) ? (p.alerts as MarketAlert[]) : [],
    newActions: typeof p.newActions === "number" ? p.newActions : 0,
    createdAt,
  };
}

/** The app's scan ids (refresh events are anchored on these). */
async function appScanIds(appId: string): Promise<string[]> {
  const { data, error } = await serverDb().from("scans").select("id").eq("app_id", appId);
  if (error || !data) return [];
  return data.map((r) => r.id);
}

/** Most recent weekly refresh digest for an app, or null if none yet. */
export async function latestRefreshDigest(appId: string): Promise<RefreshDigest | null> {
  const scanIds = await appScanIds(appId);
  if (scanIds.length === 0) return null;
  const { data, error } = await serverDb()
    .from("scan_events")
    .select("payload, created_at")
    .in("scan_id", scanIds)
    .eq("type", "refresh")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return parseRefreshDigest(data.payload, data.created_at);
}

/** Every weekly refresh digest for an app, newest-first (the feed timeline). */
export async function listRefreshDigests(appId: string, limit = 26): Promise<RefreshDigest[]> {
  const scanIds = await appScanIds(appId);
  if (scanIds.length === 0) return [];
  const { data, error } = await serverDb()
    .from("scan_events")
    .select("payload, created_at")
    .in("scan_id", scanIds)
    .eq("type", "refresh")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data
    .map((r) => parseRefreshDigest(r.payload, r.created_at))
    .filter((d): d is RefreshDigest => d !== null);
}
