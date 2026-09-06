// src/app/api/drafts/[id]/skip/route.ts — BUILD §9
//
// The customer taking a page off its date: `planned → skipped`,
// `in_review → skipped` or `needs_attention → skipped`, whichever applies.
// One target state, three open edges, and the machine decides which of them
// this page is on.
import { draftAction } from "../_action";

export const POST = draftAction("POST /api/drafts/{id}/skip", "skipped", "skip");
