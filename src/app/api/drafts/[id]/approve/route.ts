// src/app/api/drafts/[id]/approve/route.ts — BUILD §9
//
// The customer's explicit approval: `in_review → approved`. **Approving is
// not publishing** — this route calls no publish and no destination
// adapter. It sends one `publish/execute` for the page's own publish moment
// (issue #790, through the engine's `schedulePublish`); whether the page
// then goes out is the machine's guards on `approved → publishing`,
// evaluated at the moment of the attempt.
import { draftAction } from "../_action";

export const POST = draftAction("POST /api/drafts/{id}/approve", "approved", "approve");
