// BUILD §4.6 — the one read the draft view makes.
//
// The screen calls `readDraft` and nothing else; what it reads behind the
// type is this issue's fixture (`fixture.ts`) and, when §8's generation
// (#43) and §9's publishing (#45) land, the query against §10's `drafts`
// row — one request-cached read, no second caller, no second shape.
//
// `React.cache` is what makes it one read per request even though the page
// and its siblings each ask.
//
// **An id this store does not hold resolves to `null`, never to a throw.**
// The archived BP-044 fixes the behaviour: "a draft the customer does not
// own, or an id that does not exist, resolves to one written line, never a
// stack trace or a vendor payload." Ownership itself is §13's (#35) and is
// not decided here; when it lands, a draft belonging to someone else takes
// the same `null` arm as an id that does not exist, which is why this
// returns one nullable value rather than two distinguishable failures the
// screen would have to word separately.
import { cache } from "react";
import { assembleDraft, type DraftView } from "./model";
import { FIXTURE_DRAFTS } from "./fixture";

export const readDraft = cache(async function readDraft(
  draftId: string
): Promise<DraftView | null> {
  const facts = FIXTURE_DRAFTS[draftId];
  return facts === undefined ? null : assembleDraft(facts);
});
