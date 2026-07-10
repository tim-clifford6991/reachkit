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

import { SIGNAL_REGISTRY, PILLAR_WEIGHTS, type Pillar } from "./signals";
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

const CATEGORY_FOR_PILLAR: Record<Pillar, ActionCard["category"]> = {
  content: "content",
  outreach: "outreach",
  seo: "seo_aso",
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
 * Score points (0–100 total-score scale) that the signals a card LINKS TO are
 * currently leaving on the table: Σ pillarWeight × signalWeight × shortfall over
 * the card's linked signals that are actually weak (fail/warn) and measured. This
 * is the SAME formula the deterministic floor uses (`fallback-actions.ts`), so a
 * generated card and a floor card that address the same signal claim the same
 * modelled points. Healthy or unmeasured linked signals contribute 0 — a card that
 * addresses nothing the score model can see scores 0, never a fabricated number.
 */
export function modelledImpact(signalKeys: string[] | undefined | null, rows: ScanSignalRow[]): number {
  if (!signalKeys || signalKeys.length === 0) return 0;
  const defByKey = new Map(SIGNAL_REGISTRY.map((d) => [d.key, d]));
  const rowByKey = new Map(rows.map((r) => [r.signalKey, r]));
  let sum = 0;
  for (const key of signalKeys) {
    const def = defByKey.get(key);
    const row = rowByKey.get(key);
    if (!def || !row || row.normalised === null) continue;
    if (row.state !== "fail" && row.state !== "warn") continue;
    sum += PILLAR_WEIGHTS[def.pillar] * def.weight * (100 - row.normalised);
  }
  return sum;
}

/**
 * Replace every card's `expectedOutcome.delta` with the model-computed impact of
 * the signals it links to (§6 #4 / invariant: the "+N pts" a user sees must equal
 * what completing the action would actually move the registry/headline score —
 * never an LLM guess). `generateActions` asks the model for a free-choice integer;
 * this pass overwrites that with the deterministic modelled shortfall, so the
 * generated cards and the deterministic floor cards speak the same, honest unit.
 * A card whose linked signals are all healthy/unmeasured gets `delta: 0`.
 *
 * MUST run AFTER `linkSignalKeys` (so every card carries `signalKeys`). Pure —
 * never mutates the input.
 */
export function recomputeActionImpacts(cards: ActionCard[], rows: ScanSignalRow[]): ActionCard[] {
  return cards.map((c) => {
    const impact = modelledImpact(c.signalKeys, rows);
    const delta = impact > 0 ? Math.max(1, Math.round(impact)) : 0;
    return { ...c, expectedOutcome: { ...c.expectedOutcome, delta } };
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

/** Cap `cards` to `max` while keeping the first card of every category present —
 *  so a category is never emptied by the cap. Drops the lowest-`delta` *unprotected*
 *  cards first; preserves original order among survivors. */
function capKeepingCategories(cards: ActionCard[], max: number): ActionCard[] {
  if (cards.length <= max) return cards;
  const protectedIdx = new Set<number>();
  const seen = new Set<string>();
  cards.forEach((c, i) => {
    if (!seen.has(c.category)) { seen.add(c.category); protectedIdx.add(i); }
  });
  const keep = new Set(protectedIdx);
  const slots = max - keep.size;
  if (slots > 0) {
    cards
      .map((c, i) => ({ c, i }))
      .filter((x) => !protectedIdx.has(x.i))
      .sort((a, b) => (b.c.expectedOutcome?.delta ?? 0) - (a.c.expectedOutcome?.delta ?? 0))
      .slice(0, slots)
      .forEach((x) => keep.add(x.i));
  }
  return cards.filter((_, i) => keep.has(i));
}

/**
 * Invariant #5 (per-category floor) enforced in PRODUCTION, not just the golden-set
 * eval (§6 #5). Every pillar with a weak (fail/warn) MEASURED signal — i.e. a
 * category that has recoverable score points — must keep ≥1 action. If the gated +
 * floored plan dropped such a category, inject that pillar's highest-impact
 * deterministic fix (deduped by title), then cap category-aware so the injection
 * never overflows MAX_ACTIONS or empties another category. Pure; never mutates.
 */
export function ensurePerCategoryFloor(
  cards: ActionCard[],
  rows: ScanSignalRow[],
  now: Date = new Date(),
): ActionCard[] {
  const activeCategories = new Set<ActionCard["category"]>();
  const defByKey = new Map(SIGNAL_REGISTRY.map((d) => [d.key, d]));
  for (const r of rows) {
    if (r.normalised === null || (r.state !== "fail" && r.state !== "warn")) continue;
    const def = defByKey.get(r.signalKey);
    if (def) activeCategories.add(CATEGORY_FOR_PILLAR[def.pillar]);
  }

  const present = new Set(cards.map((c) => c.category));
  const titles = new Set(cards.map((c) => c.title.trim().toLowerCase()));
  const missing = [...activeCategories].filter((cat) => !present.has(cat));
  if (missing.length === 0) return cards.slice(0, MAX_ACTIONS);

  const floor = fallbackActionsFromSignals(rows, now); // ranked by impact, spans pillars
  const injected: ActionCard[] = [];
  for (const cat of missing) {
    const fix = floor.find((f) => f.category === cat && !titles.has(f.title.trim().toLowerCase()));
    if (!fix) continue;
    injected.push(fix);
    titles.add(fix.title.trim().toLowerCase());
  }
  return capKeepingCategories([...cards, ...injected], MAX_ACTIONS);
}
