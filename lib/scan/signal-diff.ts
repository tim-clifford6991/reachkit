/**
 * signalChanges — signal-level diff between an app's two most recent COMPLETED
 * scans, explaining WHY the Discoverability Score moved (e.g. "Meta
 * descriptions fail → pass, +2.1 pts") for the Progress view's "Why it moved"
 * panel. Reads the persisted `scan_signals` rows (lib/scan/persist-signals.ts)
 * for each scan and joins on `signal_key`.
 *
 * Same server DB client pattern as lib/scan/engagement.ts.
 */

import { serverDb } from "@/lib/db/client";
import { SIGNAL_REGISTRY } from "./signals";

/** A signal is reported even with an unchanged state once its contribution moves at least this many points. */
const CONTRIBUTION_DELTA_THRESHOLD = 0.5;

export interface SignalChange {
  key: string;
  label: string;
  pillar: string;
  fromState: string;
  toState: string;
  contributionDelta: number;
}

interface SignalRow {
  signal_key: string;
  pillar: string;
  state: string;
  contribution: number | null;
}

const LABELS = new Map(SIGNAL_REGISTRY.map((s) => [s.key, s.label]));

/** Registry-label lookup, falling back to a humanized key: "meta_description" -> "Meta description". */
function labelFor(key: string): string {
  const known = LABELS.get(key);
  if (known) return known;
  const words = key.split("_").filter(Boolean);
  if (words.length === 0) return key;
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

/**
 * Signal-level diff between an app's two most recent completed scans (status
 * "done", `score_total` set). Returns signals whose `state` changed OR whose
 * `contribution` moved by >= CONTRIBUTION_DELTA_THRESHOLD pts, sorted by
 * |contributionDelta| descending. `[]` when fewer than 2 completed scans exist.
 */
export async function signalChanges(appId: string): Promise<SignalChange[]> {
  const db = serverDb();

  const { data: scans, error: scansError } = await db
    .from("scans")
    .select("id")
    .eq("app_id", appId)
    .eq("status", "done")
    .not("score_total", "is", null)
    .order("created_at", { ascending: false })
    .limit(2);
  if (scansError) throw scansError;
  if (!scans || scans.length < 2) return [];

  const [latestScan, priorScan] = scans as [{ id: string }, { id: string }];

  const [latestSignals, priorSignals] = await Promise.all([
    db.from("scan_signals").select("signal_key, pillar, state, contribution").eq("scan_id", latestScan.id),
    db.from("scan_signals").select("signal_key, pillar, state, contribution").eq("scan_id", priorScan.id),
  ]);
  if (latestSignals.error) throw latestSignals.error;
  if (priorSignals.error) throw priorSignals.error;

  const priorByKey = new Map<string, SignalRow>(
    (priorSignals.data ?? []).map((row) => [row.signal_key, row as SignalRow]),
  );

  const changes: SignalChange[] = [];
  for (const row of (latestSignals.data ?? []) as SignalRow[]) {
    const before = priorByKey.get(row.signal_key);
    if (!before) continue; // no baseline in the prior scan to diff against

    const contributionDelta = (row.contribution ?? 0) - (before.contribution ?? 0);
    const stateChanged = row.state !== before.state;
    if (!stateChanged && Math.abs(contributionDelta) < CONTRIBUTION_DELTA_THRESHOLD) continue;

    changes.push({
      key: row.signal_key,
      label: labelFor(row.signal_key),
      pillar: row.pillar,
      fromState: before.state,
      toState: row.state,
      contributionDelta,
    });
  }

  changes.sort((a, b) => Math.abs(b.contributionDelta) - Math.abs(a.contributionDelta));
  return changes;
}
