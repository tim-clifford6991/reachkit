// BUILD §4.7 — a pending change is a computation, not a state.
//
// REQ-071's whole difficulty is a delay: a saved answer is effective only
// at the first weekly re-measurement that *begins after the moment of the
// save* (criteria 7, 8, 9; REQ-065 c1). Between the save and that pass the
// product must show the answer just saved and the date it lands, show every
// number measured under the old answer unchanged and dated, generate no
// page from an opportunity derived under the answer being replaced, and
// never present the difference across the change as movement.
//
// **None of that needs a record** (ADR-030). A pending change is the
// difference between the declared answers on `sites` and the measured
// answers on the current scan. So:
//
//   · it cannot get stuck — there is no state to be stuck in;
//   · it cannot be applied twice — nothing applies it;
//   · it clears itself — the moment a pass completes, its scan is current,
//     measured equals declared, and this returns `[]`, with no transition
//     to run and no row to delete.
//
// **Nothing between the save and the pass moves, and this module freezes
// nothing.** Every number on screen comes from the last completed scan and
// carries its date, so criterion 10 holds with no freeze mechanism — there
// is nothing to freeze.
//
// **Pure over its arguments.** The two answer sets, a `now` and a zone are
// all handed in: no clock is read here and no row. That is what makes the
// DST behaviour testable at a fixed instant, and what keeps the effective
// date the same one the shell, Overview and the weekly mail state.
//
// The archived plan is WO-091.
import { nextDueAfter } from "@/lib/scan/weekly/week";
import type { ChangeKind, DeclaredAnswers, MeasuredAnswers } from "./declared";

/** One answer that differs, with the date the difference stops being
 *  pending. `declared` and `measured` are the two values written out, so a
 *  surface can state both without re-reading either. */
export interface PendingChange {
  kind: ChangeKind;
  declared: string;
  measured: string;
  effectiveOn: Date;
}

/**
 * The first weekly re-measurement that begins after `savedAt`.
 *
 * REQ-065 c1's own clock, in the customer's own stated zone — `nextDueAfter`
 * and not a Monday computed here, because "the date the next measurement is
 * due" is one date this product states in several places and it may not
 * differ between them. Imported by file (`weekly/week`, which imports only
 * `constants.ts`) rather than through `@/lib/scan`'s barrel: `src/lib/scan/`
 * imports `@/lib/market`, so the barrel would close a cycle. ADR-092's
 * idiom, applied to a true dependency rather than deleting it.
 */
export function effectiveOn(a: { savedAt: Date; timezone: string }): Date {
  return nextDueAfter({ at: a.savedAt, zone: a.timezone });
}

/** How a rival set is written out for a surface to state. Order is the
 *  customer's own, and an empty set is the empty string rather than a word
 *  — REQ-071 c16's "no rival comparison until they add one" is a sentence
 *  the screen owns, not a value this module invents. */
function rivalsAsStated(rivals: readonly string[]): string {
  return rivals.join(", ");
}

/**
 * One entry per answer where the declared and the measured differ.
 *
 * **A site with nothing measured yet has nothing pending.** `measured`
 * `null` is a site between setup and its first pass: there is no old answer
 * for the new one to differ from, and reading it as three changes would
 * hold generation on a site that has never been measured (criterion 11's
 * hold is about *replacing* an answer).
 *
 * Every entry carries the same `effectiveOn`, and that is not a
 * simplification: all three land at the same pass, because the pass reads
 * all three at the moment it begins.
 */
export function pendingChanges(a: {
  declared: DeclaredAnswers;
  measured: MeasuredAnswers | null;
  now: Date;
  timezone: string;
}): PendingChange[] {
  if (a.measured === null) return [];
  const on = effectiveOn({ savedAt: a.now, timezone: a.timezone });
  const changes: PendingChange[] = [];

  if (a.declared.domain !== a.measured.domain) {
    changes.push({
      kind: "domain",
      declared: a.declared.domain,
      measured: a.measured.domain,
      effectiveOn: on,
    });
  }

  // A category that has never been named is not a change away from one.
  // `null` on either side means the product has no two answers to differ.
  if (
    a.declared.category !== null &&
    a.measured.category !== null &&
    a.declared.category !== a.measured.category
  ) {
    changes.push({
      kind: "category",
      declared: a.declared.category,
      measured: a.measured.category,
      effectiveOn: on,
    });
  }

  // Order is the customer's own and a reordering is not a change: what is
  // compared is the *set*, because that is what a re-measurement uses.
  const declaredSet = [...a.declared.rivals].sort();
  const measuredSet = [...a.measured.rivals].sort();
  const sameRivals =
    declaredSet.length === measuredSet.length &&
    declaredSet.every((domain, i) => domain === measuredSet[i]);
  if (!sameRivals) {
    changes.push({
      kind: "rivals",
      declared: rivalsAsStated(a.declared.rivals),
      measured: rivalsAsStated(a.measured.rivals),
      effectiveOn: on,
    });
  }

  return changes;
}

export type GenerationHold =
  | { held: false }
  | { held: true; because: "domain" | "category"; resumesOn: Date };

/**
 * REQ-071 c11 — whether a page may be generated today, and why not.
 *
 * **A domain or a category change holds generation; a rival change does
 * not.** The criterion names those two and no third, and the reason is in
 * what an opportunity is derived from: the search set and the twelve
 * questions come from the domain and the category, so an opportunity
 * derived under the answer being replaced would publish a page about a
 * market the customer has just said they are not in. A rival set changes
 * who a page is *compared* against, not what it is about.
 *
 * `because` is the one held answer, and `domain` outranks `category` where
 * both changed: the domain is what the category was inferred for, so
 * naming the category as the reason would name the smaller of two facts.
 * The day's line names one change, never two.
 */
export function generationHold(pending: readonly PendingChange[]): GenerationHold {
  const domain = pending.find((change) => change.kind === "domain");
  if (domain !== undefined) {
    return { held: true, because: "domain", resumesOn: domain.effectiveOn };
  }
  const category = pending.find((change) => change.kind === "category");
  if (category !== undefined) {
    return { held: true, because: "category", resumesOn: category.effectiveOn };
  }
  return { held: false };
}
