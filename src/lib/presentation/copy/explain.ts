// BUILD §2.5 — a measured value's sentence, with its provenance.
// src/lib/presentation/copy/explain.ts — WO-042, WO-278, BP-020
//
// explain(): REQ-093 criterion 4. The only way a number reaches a
// sentence. Each slot is a `Measured<T>` — never a raw number — so a
// value that was estimated, recomputed for display or produced by a model
// is not of the argument's type, and the scan date travels with it.
// There is no reader, session or persona parameter, so the words cannot
// change with who is reading.
import type { Measured } from "@/lib/measure/measured";
import { COPY, COPY_META, OWNER_OWED, type CopyKey, type CopyMeta } from "./registry.ts";
import { renderMeasured } from "../measured.ts";

/** Every slot name of `K` whose declared kind is 'measured' — computed
 *  from `COPY_META`'s literal types (WO-041 step 1 declares `COPY_META`
 *  with `satisfies`, which is what makes this computable). */
export type MeasuredSlotOf<K extends CopyKey> = {
  [S in keyof (typeof COPY_META)[K]["slots"]]: (typeof COPY_META)[K]["slots"][S] extends "measured"
    ? S
    : never;
}[keyof (typeof COPY_META)[K]["slots"]];

type HasMeasuredSlot<K extends CopyKey> = [MeasuredSlotOf<K>] extends [never] ? false : true;

/** The subset of `CopyKey` that declares at least one 'measured' slot —
 *  the only keys `explain()` accepts. `copy()` refuses these keys at run
 *  time; this is their complement, enforced at the type level. */
export type ExplainKey = { [K in CopyKey]: HasMeasuredSlot<K> extends true ? K : never }[CopyKey];

/** REQ-093 criterion 4. Renders each 'measured' slot through BP-019's
 *  `renderMeasured` — REQ-004's trichotomy is not re-implemented here
 *  (BP-020 `## Error & edge behavior`, fifth bullet) — and substitutes the
 *  non-measured slots from `vars`, the same contract `copy()` uses. */
export function explain<K extends ExplainKey>(
  key: K,
  slots: { [S in MeasuredSlotOf<K>]: { value: Measured<unknown>; format: (v: never) => string } },
  vars?: Record<string, string>
): {
  text: string;
  /** Every scan date behind the values in this sentence. Empty is
   *  impossible: `ExplainKey` has at least one measured slot. */
  measuredAt: readonly Date[];
  /** True when any slot rendered as "—". The sentence still renders. */
  hasUnmeasured: boolean;
} {
  // Deviation from WO-278 Step 21 (rule 4.2, recorded in the WO's `## Log`):
  // Step 21 asks for one guard, living in copy.ts and imported here, so
  // this check is not written twice. copy.ts is not in this WO's file
  // plan (§'## File plan' lists no Modify row for it), and rule 2 holds
  // touching an unlisted file to be paused and referred back rather than
  // done on this implementer's own authority. This three-line check is
  // therefore duplicated from copy.ts's own guard rather than extracted
  // and shared; no acceptance criterion in `## Test plan` asserts a single
  // shared guard. Residual risk recorded as a `rests-on` row.
  if (OWNER_OWED.includes(key)) {
    throw new Error(`explain(): "${key}" is owner-owed — no sentence has been written for it yet.`);
  }

  // Widened to the declared CopyMeta shape, the same move copy.ts makes on
  // its own COPY_META[key] read: K's own literal slot-kind union would
  // otherwise keep `meta` typed as `(typeof COPY_META)[K]`, an indexed
  // access over a generic key that does not statically expose `.slots`.
  const meta: CopyMeta = COPY_META[key];
  const slotMap = slots as Record<string, { value: Measured<unknown>; format: (v: never) => string }>;
  const measuredAt: Date[] = [];
  let hasUnmeasured = false;
  let text: string = COPY[key];

  for (const [slotName, slotKind] of Object.entries(meta.slots)) {
    if (slotKind === "measured") {
      const slot = slotMap[slotName];
      if (!slot) {
        throw new Error(`explain(): "${key}" requires measured slot "${slotName}", which was not supplied.`);
      }
      // The reason chooses which of BP-019 decision 6's two owner-owed
      // lines applies; REQ-004's trichotomy itself (which arm renders
      // what) is renderMeasured's alone.
      const unmeasuredLine: CopyKey =
        slot.value.kind === "unmeasured" && slot.value.reason === "undeterminable"
          ? "unmeasured.undeterminable"
          : "unmeasured.not-attempted";
      // `slot.format: (v: never) => string` unifies `renderMeasured<T>`'s
      // `T` to `never` by contravariant inference (the same trick that
      // lets a caller's concrete `(v: SpecificT) => string` satisfy this
      // slot's declared `(v: never) => string` in the first place); the
      // explicit `Measured<never>` cast below matches that inference so
      // `m` and `format` agree on `T`. Sound because `slot.value` and
      // `slot.format` were constructed together, per slot, by the same
      // caller that supplied this object — `explain()` is the trusted
      // boundary translating the per-slot-`T` public shape into
      // `renderMeasured`'s single-`T` call, which TypeScript cannot see
      // across two independently-typed fields of one object literal.
      // `what` (WO-287): the subject unmeasuredLine's own {what} slot
      // names. explain() carries no per-slot label beyond the slot's own
      // name in `meta.slots`, and producing a friendlier subject is the
      // caller's, on WO-282/WO-286 (out of scope here) — so this passes
      // the slot name itself, the one subject already in scope.
      const rendered = renderMeasured(slot.value as Measured<never>, {
        format: slot.format,
        unmeasuredLine,
        what: slotName,
      });
      measuredAt.push(slot.value.at);
      if (rendered.isDash) hasUnmeasured = true;
      text = text.split(`{${slotName}}`).join(rendered.text);
      continue;
    }
    if (!vars || !Object.prototype.hasOwnProperty.call(vars, slotName)) {
      throw new Error(`explain(): "${key}" requires slot "${slotName}", which was not supplied.`);
    }
    text = text.split(`{${slotName}}`).join(vars[slotName]);
  }

  return { text, measuredAt, hasUnmeasured };
}
