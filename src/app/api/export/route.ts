// src/app/api/export/route.ts — BUILD §4.7, §9, §13
//
// The signed-in download, never withheld on subscription state.
//
// REQ-078 criterion 2: "Given a customer whose subscription is active,
// cancelled, or past its paid-through date, when they sign in and request an
// export, then it downloads to them directly and is never withheld on
// account of subscription state."
//
// **This file names no access gate, and cannot reach one.** It imports the
// export leaf and the session, and nothing else; there is no
// `hasActiveAccess` here, no `paid_through`, no `plan_status`, and the lint
// fence under `src/lib/account/export/**` closes the other end. Adding
// "signed in AND active" to an authorisation helper is the defect no fixture
// finds by accident, because the ordinary customer is active — which is why
// the absence is asserted from the source as well as behaviourally.
//
// `exportEverything` is passed the session's site and nothing else. There is
// no parameter on it that could scope the archive, which is how "every page
// ReachKit wrote for them" stays this route's non-decision.
//
// **On a failure, no body bytes at all.** The response carries the line key
// and no archive: a truncated zip can never be what the customer receives,
// because the archive is fully resolved before its first byte is produced.
//
// A signed-out request says nothing about whether an account or a payment
// exists — `src/middleware.ts` has already refused it, and this arm is what
// the route answers when called directly.
import { adapter } from "../_adapter";
import { exportEverything } from "@/lib/account/export";
import { currentSession } from "@/lib/account/identity";

const SIGN_IN_STATUS = 401;
const FAILED_STATUS = 503;

export const GET = adapter("GET /api/export", async (): Promise<Response> => {
  const session = await currentSession();
  if (session === null || session.siteId === null) {
    return new Response(null, { status: SIGN_IN_STATUS });
  }

  const result = await exportEverything(session.siteId);
  if (!result.ok) {
    return Response.json({ lineKey: result.lineKey }, { status: FAILED_STATUS });
  }

  return new Response(result.archive, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${result.filename}"`,
    },
  });
});
