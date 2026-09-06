// src/app/api/drafts/[id]/veto/route.ts — BUILD §9
//
// The customer's veto inside the window: `in_review → skipped`. There is no
// separate vetoed state — §9's diagram sends the veto to `skipped` — and
// the recorded reason is what keeps a veto and a skip distinguishable in
// the page's history without minting an eleventh state.
//
// The veto **link** redeemed from a mail is `redeemVeto`'s path, not this
// route's; both end at the same one transition.
import { draftAction } from "../_action";

export const POST = draftAction("POST /api/drafts/{id}/veto", "skipped", "veto");
