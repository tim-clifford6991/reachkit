/**
 * Per-metric narrative (ChannelIntel Phase 4) — a one-line "what this means + do
 * this" beside each headline metric, so a number never sits without a takeaway.
 *
 * Deterministic + PURE (no LLM call → no added cost, fully testable). The richer
 * Sonnet competitor narrative lives in the synth stage; this covers the numeric
 * report metrics.
 */

import type { ShareOfVoice, KeywordGapRow } from "./types";
import type { TrafficMix } from "@/lib/scan/profile/traffic-mix";

/** Share-of-voice takeaway. */
export function narrateShareOfVoice(sov: ShareOfVoice): string {
  const pct = Math.round(sov.selfPct * 100);
  if (pct < 10) return `You're nearly invisible in community talk (${pct}%). Show up consistently where the conversation already happens.`;
  if (pct < 34) return `You hold ${pct}% of the conversation — there's clear room to be mentioned more. Seed and join relevant threads weekly.`;
  return `You own ${pct}% of community mentions — defend it and turn that attention into signups.`;
}

/** You-vs-rival-median benchmark takeaway. */
export function narrateBenchmark(label: string, you: number, rivalMedian: number): string {
  if (rivalMedian === 0) return `No rival ${label.toLowerCase()} data to compare against yet.`;
  if (you >= rivalMedian) return `You're ahead of the rival median on ${label.toLowerCase()} — keep the lead.`;
  const ratio = you / rivalMedian;
  const gapPct = Math.round((1 - ratio) * 100);
  return `You trail the rival median on ${label.toLowerCase()} by ${gapPct}%. Closing this is a concrete growth lever.`;
}

/** Keyword-gap takeaway. */
export function narrateKeywordGap(rows: KeywordGapRow[]): string {
  if (rows.length === 0) return "";
  const top = rows[0]!;
  return `Rivals capture ${rows.length} keyword${rows.length === 1 ? "" : "s"} you don't — start with "${top.keyword}" (${top.volume.toLocaleString()}/mo).`;
}

/** Traffic-mix takeaway (which channel dominates the estimate). */
export function narrateTrafficMix(mix: TrafficMix): string {
  const entries: Array<[string, number]> = [
    ["organic search", mix.organic],
    ["referrals", mix.referral],
    ["social/community", mix.social],
    ["direct", mix.direct],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  const [topLabel, topVal] = entries[0]!;
  return `Estimated traffic leans on ${topLabel} (~${Math.round(topVal * 100)}%). Diversify away from a single channel to de-risk growth.`;
}
