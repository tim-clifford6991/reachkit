/**
 * Onboarding activation checklist — "scan → start a fix → verify it → watch the
 * score move". Steps are DERIVED from real data (scans / actions / snapshots),
 * not a stored flag, so they self-complete as the user acts. The dashboard hides
 * the checklist once every step is done.
 */

import { serverDb } from "@/lib/db/client";

export interface ChecklistFacts {
  hasScan: boolean;
  hasStartedAction: boolean;
  hasVerifiedAction: boolean;
  scoreMoved: boolean;
}

export interface ChecklistStep {
  key: "scan" | "start" | "verify" | "move";
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

export function checklistSteps(f: ChecklistFacts): ChecklistStep[] {
  return [
    { key: "scan", label: "Run your first scan", hint: "See how findable you are today.", href: "/scan", done: f.hasScan },
    { key: "start", label: "Start a fix", hint: "Mark one play in progress from your action plan.", href: "/app/plays", done: f.hasStartedAction },
    { key: "verify", label: "Verify a fix", hint: "We re-check your live page and confirm the change.", href: "/app/plays", done: f.hasVerifiedAction },
    { key: "move", label: "Watch your score move", hint: "Your Discoverability Score updates as fixes land.", href: "/app", done: f.scoreMoved },
  ];
}

export function checklistComplete(steps: ChecklistStep[]): boolean {
  return steps.every((s) => s.done);
}

export async function onboardingChecklist(appId: string): Promise<ChecklistStep[]> {
  const db = serverDb();
  const [scan, started, verified, snaps] = await Promise.all([
    db.from("scans").select("id").eq("app_id", appId).eq("status", "done").limit(1),
    db.from("actions").select("id").eq("app_id", appId).in("verify_state", ["verifying", "verified", "failed"]).limit(1),
    db.from("actions").select("id").eq("app_id", appId).eq("verify_state", "verified").limit(1),
    db.from("score_snapshots").select("total").eq("app_id", appId).order("taken_at", { ascending: true }),
  ]);

  const totals = (snaps.data ?? []).map((s) => s.total as number);
  const scoreMoved = totals.length >= 2 && Math.max(...totals) > Math.min(...totals);

  return checklistSteps({
    hasScan: (scan.data?.length ?? 0) > 0,
    hasStartedAction: (started.data?.length ?? 0) > 0,
    hasVerifiedAction: (verified.data?.length ?? 0) > 0,
    scoreMoved,
  });
}
