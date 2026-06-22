/**
 * Action board — groups an app's actions by their persisted verify lifecycle
 * (open / verifying / done / retry) and computes the genuine actual Δ for done
 * actions from the score_snapshots marker (the verification snapshot vs the one
 * before it). The open queue still comes from assembleWeeklyPlan; this surfaces
 * the in-flight + completed actions the queue deliberately drops.
 */

import { serverDb } from "@/lib/db/client";

export type VerifyGroup = "open" | "verifying" | "done" | "retry";

export function groupForVerifyState(verifyState: string): VerifyGroup {
  switch (verifyState) {
    case "verifying":
      return "verifying";
    case "verified":
      return "done";
    case "failed":
      return "retry";
    default:
      return "open";
  }
}

export interface SnapshotPoint {
  actionId: string | null;
  total: number;
  takenAt: string;
}

/** Measured movement when this action was verified: its snapshot minus the prior one. */
export function actualDeltaForAction(snapshots: SnapshotPoint[], actionId: string): number | null {
  const idx = snapshots.findIndex((s) => s.actionId === actionId);
  if (idx <= 0) return null;
  const cur = snapshots[idx];
  const prev = snapshots[idx - 1];
  if (!cur || !prev) return null;
  return cur.total - prev.total;
}

export interface BoardAction {
  id: string;
  title: string;
  category: string;
  why: string | null;
  predictedDelta: number | null;
  actualDelta: number | null;
}

export interface ActionBoard {
  verifying: BoardAction[];
  done: BoardAction[];
  retry: BoardAction[];
}

export async function actionBoard(appId: string): Promise<ActionBoard> {
  const db = serverDb();
  const [{ data: actions }, { data: snaps }] = await Promise.all([
    db
      .from("actions")
      .select("id, title, category, why, verify_state, expected_outcome")
      .eq("app_id", appId)
      .in("verify_state", ["verifying", "verified", "failed"]),
    db
      .from("score_snapshots")
      .select("action_id, total, taken_at")
      .eq("app_id", appId)
      .order("taken_at", { ascending: true, nullsFirst: false }),
  ]);

  const snapshots: SnapshotPoint[] = (snaps ?? []).map((s) => ({
    actionId: s.action_id ?? null,
    total: s.total,
    takenAt: s.taken_at ?? "",
  }));

  const board: ActionBoard = { verifying: [], done: [], retry: [] };
  for (const a of actions ?? []) {
    const group = groupForVerifyState(a.verify_state ?? "");
    if (group === "open") continue;
    const eo = a.expected_outcome as { delta?: number } | null;
    board[group].push({
      id: a.id as string,
      title: a.title as string,
      category: a.category as string,
      why: (a.why as string | null) ?? null,
      predictedDelta: eo?.delta ?? null,
      actualDelta: group === "done" ? actualDeltaForAction(snapshots, a.id as string) : null,
    });
  }
  return board;
}
