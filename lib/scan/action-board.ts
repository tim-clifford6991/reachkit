/**
 * Action board — groups an app's actions by their persisted verify lifecycle
 * (open / verifying / done / retry) and computes the genuine actual Δ for done
 * actions from the score_snapshots marker (the verification snapshot vs the one
 * before it). Carries the full plan: the open queue (predicted-Δ ordered), the
 * in-flight verifying set, verified wins (newest first), and failed verifies
 * (retry — still open work in practice: verify.ts leaves their status untouched).
 */

import { serverDb } from "@/lib/db/client";
import type { ActionTarget } from "@/lib/llm/types";

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

/** When this action's verification snapshot was taken (null if no snapshot / no timestamp). */
export function verifiedAtForAction(snapshots: SnapshotPoint[], actionId: string): string | null {
  const snap = snapshots.find((s) => s.actionId === actionId);
  return snap?.takenAt ? snap.takenAt : null;
}

export interface BoardAction {
  id: string;
  title: string;
  category: string;
  why: string | null;
  predictedDelta: number | null;
  actualDelta: number | null;
  createdAt: string;
  /** Verification-snapshot timestamp — only set for `done` actions with a snapshot. */
  verifiedAt: string | null;
  /** Execution payload (from the plan views): review-required draft, the venue
   *  to post/submit at, and the effort estimate. Null when the action was
   *  queued without them. */
  draft: string | null;
  verifyUrl: string | null;
  effortMin: number | null;
  /** Structured execution target (venue/recipient), null for legacy/on-site actions. */
  target: ActionTarget | null;
}

/** Open-queue order: biggest predicted Δ first; actions without a prediction sink last. */
export function byPredictedDeltaDesc(
  a: Pick<BoardAction, "predictedDelta">,
  b: Pick<BoardAction, "predictedDelta">,
): number {
  const av = a.predictedDelta ?? Number.MIN_SAFE_INTEGER;
  const bv = b.predictedDelta ?? Number.MIN_SAFE_INTEGER;
  return bv - av;
}

/** Verified order: most recently verified first (createdAt as the fallback key). */
export function byVerifiedAtDesc(
  a: Pick<BoardAction, "verifiedAt" | "createdAt">,
  b: Pick<BoardAction, "verifiedAt" | "createdAt">,
): number {
  const ak = a.verifiedAt ?? a.createdAt;
  const bk = b.verifiedAt ?? b.createdAt;
  return ak < bk ? 1 : ak > bk ? -1 : 0;
}

export interface ActionBoard {
  open: BoardAction[];
  verifying: BoardAction[];
  done: BoardAction[];
  retry: BoardAction[];
}

export async function actionBoard(appId: string): Promise<ActionBoard> {
  const db = serverDb();
  const [{ data: actions }, { data: snaps }] = await Promise.all([
    db
      .from("actions")
      .select("id, title, category, why, status, verify_state, expected_outcome, created_at, draft, verify_url, effort_min, target")
      .eq("app_id", appId),
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

  const board: ActionBoard = { open: [], verifying: [], done: [], retry: [] };
  for (const a of actions ?? []) {
    const group = groupForVerifyState(a.verify_state ?? "");
    // Defensive: a status="done" row whose verify_state never left "pending"
    // (shouldn't occur in the flow) must not resurface as open work.
    if (group === "open" && a.status === "done") continue;
    const eo = a.expected_outcome as { delta?: number } | null;
    board[group].push({
      id: a.id as string,
      title: a.title as string,
      category: a.category as string,
      why: (a.why as string | null) ?? null,
      predictedDelta: eo?.delta ?? null,
      actualDelta: group === "done" ? actualDeltaForAction(snapshots, a.id as string) : null,
      createdAt: (a.created_at as string | null) ?? "",
      verifiedAt: group === "done" ? verifiedAtForAction(snapshots, a.id as string) : null,
      draft: (a.draft as string | null) ?? null,
      verifyUrl: (a.verify_url as string | null) ?? null,
      effortMin: (a.effort_min as number | null) ?? null,
      target: (a.target as ActionTarget | null) ?? null,
    });
  }
  board.open.sort(byPredictedDeltaDesc);
  board.retry.sort(byPredictedDeltaDesc);
  board.done.sort(byVerifiedAtDesc);
  return board;
}
