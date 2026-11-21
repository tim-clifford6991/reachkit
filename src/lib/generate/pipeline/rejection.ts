// The cause a rejected day may carry: the page the near-duplicate gate said it duplicated, as stored values, never a sentence.
export interface NearDuplicateCause {
  kind: "near_duplicate";
  duplicateOf: { ref: string; title: string };
}
