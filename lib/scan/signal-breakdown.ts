/**
 * Reader for the 18-signal explainability panel — merges persisted scan_signals
 * rows with the registry metadata (label/why/how-to-fix), grouped by pillar.
 * Returns [] when no rows exist (pre-migration scans) so the panel degrades.
 */

import { serverDb } from "@/lib/db/client";
import { SIGNAL_REGISTRY, type Pillar, type SignalState } from "./signals";

export interface BreakdownSignal {
  key: string;
  label: string;
  why: string;
  howToFix: string;
  state: SignalState | "unmeasured";
  normalised: number | null;
  weight: number;
  contribution: number | null;
}

export interface BreakdownGroup {
  pillar: Pillar;
  signals: BreakdownSignal[];
}

const PILLAR_ORDER: Pillar[] = ["seo", "content", "outreach"];

export async function readSignalBreakdown(scanId: string): Promise<BreakdownGroup[]> {
  const { data } = await serverDb()
    .from("scan_signals")
    .select("signal_key, state, normalised, weight, contribution")
    .eq("scan_id", scanId);

  if (!data || data.length === 0) return [];

  const byKey = new Map(data.map((r) => [r.signal_key, r]));

  return PILLAR_ORDER.map((pillar) => ({
    pillar,
    signals: SIGNAL_REGISTRY.filter((s) => s.pillar === pillar).map((s) => {
      const row = byKey.get(s.key);
      return {
        key: s.key,
        label: s.label,
        why: s.why,
        howToFix: s.howToFix,
        state: (row?.state as SignalState | "unmeasured" | undefined) ?? "unmeasured",
        normalised: row?.normalised ?? null,
        weight: s.weight,
        contribution: row?.contribution ?? null,
      };
    }),
  }));
}
