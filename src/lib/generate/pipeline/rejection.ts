// BUILD §8 hard rule 5 — the cause a rejected day may carry.
//
// A candidate the near-duplicate gate stopped is a day with no page, and a
// day with no page carries a line. This function is the engine's half of
// that line: a handle plus stored values — the page the candidate
// duplicated, by its ref and its title. **No sentence is composed here.**
// Every sentence the product speaks is a copy key, and the calendar's own
// module owns the words.
//
// It reads the last battery's `rule_failures`, which is why that column
// exists: the cause has to survive the run that produced it. The reader is
// `record.ts`'s, because the draft view reads the same column for the
// Checks list and one blob may not have two spellings (issue #424).
import { generateStore } from "../store";
import { readRecordedRules } from "../record";

export interface NearDuplicateCause {
  kind: "near_duplicate";
  duplicateOf: { ref: string; title: string };
}

export async function rejectionCause(draftId: string): Promise<NearDuplicateCause | null> {
  const draft = await generateStore().draftById(draftId);
  if (draft === null) return null;
  for (const failure of readRecordedRules(draft.rule_failures) ?? []) {
    if (failure.rule !== "near_duplicate") continue;
    const detail = failure.detail;
    if (detail === undefined || detail.rule !== "near_duplicate") continue;
    return {
      kind: "near_duplicate",
      duplicateOf: { ref: detail.duplicateOf.ref, title: detail.duplicateOf.title },
    };
  }
  return null;
}
