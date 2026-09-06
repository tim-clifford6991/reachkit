// src/app/api/drafts/[id]/approve/route.ts — BUILD §9
//
// The customer's explicit approval: `in_review → approved`, and nothing
// else. **Approving is not publishing** — this route calls no publish, no
// destination adapter and no job. Whether an approved page then goes out is
// the machine's five guards on `approved → publishing`, evaluated at the
// moment of the attempt.
import { draftAction } from "../_action";

export const POST = draftAction("POST /api/drafts/{id}/approve", "approved", "approve");
