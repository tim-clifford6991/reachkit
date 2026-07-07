/**
 * Action ↔ signal linkage + the action floor (launch-readiness A1).
 *
 * Two pure, deterministic helpers applied to the critic-passed action plan:
 *
 * 1. `linkSignalKeys` — attach `signalKeys` to LLM-generated cards (which carry
 *    none from generation) so every persisted action links to the 18-signal
 *    registry it addresses. Powers score-delta attribution + the floor dedupe.
 *    A card links to the weakest (fail/warn) signals in its pillar; if the pillar
 *    has no weak signal it links to the pillar's highest-weight signal, so a card
 *    is never left with an empty linkage.
 *
 * 2. `topUpActions` — guarantee a substantive plan. The generator+critic can
 *    legitimately survive only 1–2 cards; a paid report with a 2-item plan reads
 *    as thin and gives the upgrade wall nothing to hold back. When the plan is
 *    below {@link MIN_ACTIONS} we append signal-derived baseline fixes (the same
 *    tactical fixes the free floor uses), deduped against what's already there,
 *    up to {@link MAX_ACTIONS}. Honest: if a strong site genuinely has few weak
 *    signals we surface what exists rather than fabricating fixes.
 *
 * PURE + deterministic (`now` injectable); unit-tested in action-linking.test.ts.
 */

import { SIGNAL_REGISTRY, type Pillar } from "./signals";
import type { ScanSignalRow } from "./compute-signals";
import type { ActionCard } from "@/lib/llm/types";
import { fallbackActionsFromSignals } from "./fallback-actions";

/** A paid plan below this many cards is topped up from signal-derived fixes. */
export const MIN_ACTIONS = 5;
/** Hard ceiling on the plan after top-up. */
export const MAX_ACTIONS = 8;

const PILLAR_FOR_CATEGORY: Record<ActionCard["category"], Pillar> = {
  content: "content",
  outreach: "outreach",
  seo_aso: "seo",
};

/** Signals in a pillar, weak (fail/warn) ones first (by pillar-impact), then the
 *  rest by weight — so a pillar with no weak signal still yields a fallback key. */
function pillarSignalKeys(pillar: Pillar, rows: ScanSignalRow[]): string[] {
  const stateByKey = new Map(rows.map((r) => [r.signalKey, r]));
  return SIGNAL_REGISTRY.filter((d) => d.pillar === pillar)
    .map((d) => {
      const row = stateByKey.get(d.key);
      const weak = row?.state === "fail" || row?.state === "warn";
      const shortfall = row?.normalised == null ? 0 : 100 - row.normalised;
      return { key: d.key, weak, rank: weak ? d.weight * shortfall : -d.weight };
    })
    .sort((a, b) => b.rank - a.rank)
    .map((x) => x.key);
}

/**
 * Attach `signalKeys` to any card that lacks them. Links each card to up to
 * `maxKeys` signals in its pillar (weak ones preferred). Cards that already
 * carry non-empty `signalKeys` (e.g. the fallback floor's 1:1 links) pass through
 * unchanged. Never mutates the input.
 */
export function linkSignalKeys(
  cards: ActionCard[],
  rows: ScanSignalRow[],
  maxKeys = 2,
): ActionCard[] {
  return cards.map((c) => {
    if (c.signalKeys && c.signalKeys.length > 0) return c;
    const pillar = PILLAR_FOR_CATEGORY[c.category];
    const keys = pillar ? pillarSignalKeys(pillar, rows).slice(0, maxKeys) : [];
    return { ...c, signalKeys: keys };
  });
}

/**
 * Ensure the plan has at least {@link MIN_ACTIONS} cards by appending
 * signal-derived baseline fixes, deduped against existing cards (by title and by
 * already-covered signal key), capped at {@link MAX_ACTIONS}. Returns the input
 * unchanged when it already meets the floor. Never mutates the input.
 */
export function topUpActions(
  cards: ActionCard[],
  rows: ScanSignalRow[],
  now: Date = new Date(),
): ActionCard[] {
  if (cards.length >= MIN_ACTIONS) return cards.slice(0, MAX_ACTIONS);

  // Dedupe fallbacks by title against existing cards, and by signal key among the
  // fallbacks themselves — but NOT against the generated cards' broad pillar
  // attributions (a strategic "comparison pages" card must not suppress the
  // concrete "add JSON-LD" tactical fix; that over-restriction starves the floor).
  const titles = new Set(cards.map((c) => c.title.trim().toLowerCase()));
  const addedKeys = new Set<string>();
  const out = [...cards];

  for (const fix of fallbackActionsFromSignals(rows, now)) {
    if (out.length >= MIN_ACTIONS || out.length >= MAX_ACTIONS) break;
    const title = fix.title.trim().toLowerCase();
    if (titles.has(title)) continue;
    if ((fix.signalKeys ?? []).some((k) => addedKeys.has(k))) continue;
    out.push(fix);
    titles.add(title);
    (fix.signalKeys ?? []).forEach((k) => addedKeys.add(k));
  }
  return out.slice(0, MAX_ACTIONS);
}
