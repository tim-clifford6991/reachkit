/**
 * The active-paid-app fan-out set, shared by the scheduled crons (daily-focus,
 * and available to weekly-refresh / score-pulse). Every paid user with an active
 * subscription contributes their tracked app ids.
 */
import { serverDb } from "@/lib/db/client";

const PAID_TIERS = ["solo", "growth"] as const;
const ACTIVE_STATUSES = ["active"] as const;

export async function activePaidAppIds(): Promise<string[]> {
  const { data, error } = await serverDb()
    .from("users")
    .select("app_ids")
    .in("tier", PAID_TIERS as unknown as string[])
    .in("subscription_status", ACTIVE_STATUSES as unknown as string[]);
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of data ?? []) {
    for (const id of (row.app_ids as string[] | null) ?? []) ids.add(id);
  }
  return [...ids];
}
