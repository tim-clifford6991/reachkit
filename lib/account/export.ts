/**
 * Account data EXPORT (launch P3b) — self-serve GDPR portability.
 *
 * Returns every row this user owns as one JSON document. Scoping is provable:
 * everything is filtered by the user's `app_ids` (a set unique to them), and
 * scans additionally include rows claimed by their email — the same two links
 * the delete routine (`./delete.ts`) acts on, so export and delete cover exactly
 * the same footprint. Global shared caches are cross-user data and excluded.
 *
 * Guard: tests/integration/account-export.test.ts.
 */

import { serverDb } from "@/lib/db/client";
import { AccountNotFoundError } from "@/lib/account/delete";
import type { Database } from "@/lib/db/types";

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export interface AccountExport {
  exportedAt: string;
  user: Row<"users">;
  apps: Row<"apps">[];
  scans: Row<"scans">[];
  actions: Row<"actions">[];
  competitors: Row<"competitors">[];
  monitors: Row<"monitors">[];
  outcomes: Row<"outcomes">[];
  scoreSnapshots: Row<"score_snapshots">[];
  marketSnapshots: Row<"market_snapshots">[];
}

/** Assemble the full JSON export of everything `userId` owns. */
export async function exportAccount(userId: string): Promise<AccountExport> {
  const db = serverDb();

  const { data: user, error: userErr } = await db
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (userErr) throw new Error(`exportAccount: failed to load user: ${userErr.message}`);
  if (!user) throw new AccountNotFoundError(userId);

  const appIds = user.app_ids ?? [];

  // Scans: owned via app_ids OR claimed by this user's email (matches delete).
  const scanFilter = appIds.length > 0
    ? `app_id.in.(${appIds.join(",")}),claim_email.eq.${user.email}`
    : `claim_email.eq.${user.email}`;

  const [apps, scans, actions, competitors, monitors, outcomes, scoreSnapshots, marketSnapshots] =
    await Promise.all([
      appIds.length > 0
        ? db.from("apps").select("*").in("id", appIds)
        : Promise.resolve({ data: [] as Row<"apps">[] }),
      db.from("scans").select("*").or(scanFilter),
      appIds.length > 0 ? db.from("actions").select("*").in("app_id", appIds) : emptyRows<"actions">(),
      appIds.length > 0 ? db.from("competitors").select("*").in("app_id", appIds) : emptyRows<"competitors">(),
      appIds.length > 0 ? db.from("monitors").select("*").in("app_id", appIds) : emptyRows<"monitors">(),
      appIds.length > 0 ? db.from("outcomes").select("*").in("app_id", appIds) : emptyRows<"outcomes">(),
      appIds.length > 0 ? db.from("score_snapshots").select("*").in("app_id", appIds) : emptyRows<"score_snapshots">(),
      appIds.length > 0 ? db.from("market_snapshots").select("*").in("app_id", appIds) : emptyRows<"market_snapshots">(),
    ]);

  return {
    // eslint-disable-next-line react-hooks/purity -- server route: one value per request
    exportedAt: new Date().toISOString(),
    user,
    apps: apps.data ?? [],
    scans: scans.data ?? [],
    actions: actions.data ?? [],
    competitors: competitors.data ?? [],
    monitors: monitors.data ?? [],
    outcomes: outcomes.data ?? [],
    scoreSnapshots: scoreSnapshots.data ?? [],
    marketSnapshots: marketSnapshots.data ?? [],
  };
}

function emptyRows<T extends keyof Database["public"]["Tables"]>(): Promise<{ data: Row<T>[] }> {
  return Promise.resolve({ data: [] });
}
