// SPEC §6 (owner ruling 2026-09-17, issue 837) — what the thin-market choice's
// client component and its Server Function share: the field's wire name and
// the answer a press gets.
//
// **No server import, ever** (issue 853). `CategoryChoice.tsx` is a client
// component; importing these from `./remeasure`, which reads the session,
// pulled `next/headers` into the browser bundle and failed `next build`.
/** The wire name of the category a press sends — a suggestion's button and
 *  the founder's own field both carry it. */
export const REMEASURE_CATEGORY_FIELD = "category";

export type RemeasureState =
  | { answer: "idle" }
  /** The pass is queued; the revalidated shell shows its steps. */
  | { answer: "started" }
  /** Nothing was started, and the line says why. */
  | { answer: "refused"; line: string };

export const REMEASURE_INITIAL: RemeasureState = { answer: "idle" };
