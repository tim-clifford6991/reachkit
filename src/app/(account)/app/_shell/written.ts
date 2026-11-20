// BUILD §4.4 — the shell reads the registry, and renders nothing the owner
// has not written.
//
// `copy()` throws on an owner-owed key by design (BP-020: "a key whose
// string the owner has not yet supplied lands here with `''` … `copy()`
// refuses to render it"). That is the right behaviour for a caller which
// can only have reached an unwritten key by mistake. The shell is not that
// caller: it renders on every app screen, in states whose sentences the
// owner has not supplied yet (REQ-040 c4's three unfilled `next-publish.*`
// lines, c6's and c7's domain-block lines), and a screen that throws is
// worse in every way than a screen that omits a line nobody has written.
//
// So this is the shell's one reader: the sentence when there is one, and
// `null` — a state the caller must handle, not a fallback string — when the
// owner still owes it: an empty value is the one way a key is unwritten,
// the same test `copy()` throws on.
//
// It invents nothing and hides nothing: `tests/app/shell/frame.test.tsx`
// reports which of the shell's keys are owed today, so filling one is a
// visible change and forgetting one is not silence.
import { COPY, copy, type CopyKey } from "@/lib/presentation/copy";

export function isUnwritten(key: CopyKey): boolean {
  return COPY[key] === "";
}

/** The written line for `key`, or `null` where the owner has not written it
 *  yet. Never a placeholder, never the key itself. */
export function writtenLine(
  key: CopyKey,
  vars?: Record<string, string | number>
): string | null {
  if (isUnwritten(key)) return null;
  return copy(key, vars);
}
