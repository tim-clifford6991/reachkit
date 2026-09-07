// BUILD §2.5 — one sentence, resolved from its key.
// src/lib/presentation/copy/copy.ts — BP-020 Decisions 2 (runtime half), WO-041
//
// One property read plus named-slot substitution. No interpolation engine
// (BP-019 `## NFR budget`, BP-020 `## NFR budget`): a slot placeholder is the
// literal text `{slotName}` inside the sentence, and substitution is a
// string replace, not a template compiler. The placeholder syntax itself is
// an internal convention chosen under constitution rule 1.1 — it is not a
// customer-visible promise, only a marker the owner's own sentences use when
// they declare a slot; reversing it (a different bracket, a different
// delimiter) costs one `.replace` call here and no consumer change, because
// no caller ever sees the marker.
//
// Implementation order, fixed by WO-041 step 6: (a) OWNER_OWED — throw
// naming the key; (b) a 'measured' slot in COPY_META[key].slots — throw
// naming the key (the type half, ExplainKey, is WO-042's); (c) substitute.
// A slot named in COPY_META[key].slots and absent from vars throws naming
// the slot, so a half-substituted sentence never reaches a screen.
//
// No network, no catalogue load, no clock, no session/reader/persona
// parameter, and no module-level mutable state: `copy.length === 2` and
// every read is a plain property lookup on the frozen COPY/COPY_META
// literals.
import { COPY, COPY_META, OWNER_OWED, type CopyKey, type CopyMeta } from "./registry.ts";

export function copy(key: CopyKey, vars?: Record<string, string | number>): string {
  if (OWNER_OWED.includes(key)) {
    throw new Error(`copy(): "${key}" is owner-owed — no sentence has been written for it yet.`);
  }

  // Widened to the declared CopyMeta shape: COPY_META[key]'s inferred type
  // keeps each key's own literal slot-kind union (no seeded key here
  // declares a 'measured' slot yet), which would make the check below a
  // compile error ("no overlap") until a future partition adds one. The
  // widening is exactly BP-020 Decisions 2 — copy() must refuse a
  // 'measured' slot on every key, including ones that do not exist yet.
  const meta: CopyMeta = COPY_META[key];
  for (const slotKind of Object.values(meta.slots)) {
    if (slotKind === "measured") {
      throw new Error(
        `copy(): "${key}" declares a 'measured' slot; copy() refuses it — use explain() instead.`
      );
    }
  }

  let text: string = COPY[key];
  for (const slotName of Object.keys(meta.slots)) {
    if (!vars || !Object.prototype.hasOwnProperty.call(vars, slotName)) {
      throw new Error(`copy(): "${key}" requires slot "${slotName}", which was not supplied.`);
    }
    text = text.split(`{${slotName}}`).join(String(vars[slotName]));
  }

  return text;
}
