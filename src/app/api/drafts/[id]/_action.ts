// src/app/api/drafts/[id]/_action.ts — BUILD §9
//
// The one shared body of the three actions a customer takes on a draft:
// read the session, refuse a draft that is not theirs, call `transition()`
// once, map the two arms. Each route file is three lines over it.
//
// It is **transport only**. It holds no guard, no state name of its own
// beyond the target it is passed, and reads no veto window, no mode and no
// publish time — a route that read the publishable predicate itself would
// be the second decision point REQ-057 criterion 2's "under this rule and
// no other" forbids. What may follow an approval, a veto or a skip is the
// state machine's answer, never a route's.
//
// Three sibling files calling one local helper is not logic in an adapter;
// three copies of the same twelve lines would be.
//
// The archived plan is WO-245.
import { adapter } from "../../_adapter";
import { currentSession } from "@/lib/account/session";
import { publishDb } from "@/lib/publish/db";
import { transition } from "@/lib/publish/machine";
import type { State } from "@/lib/publish/types";
import type { CopyKey } from "@/lib/presentation/copy";

const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const CONFLICT = 409;

export interface ActionRefusal {
  refused: "not_a_transition" | "guard";
  failedGuard?: string;
  /** The state the page still holds. REQ-056 c2: an attempted change is
   *  refused with the page's state unchanged, and this is the transport not
   *  hiding it. */
  state: State;
  copy: CopyKey;
}

export interface ActionAccepted {
  state: State;
}

/** Builds the `POST` handler for one action. `to` is the target state and
 *  `reason` is what the record carries — the only two things the three
 *  routes differ in. Veto and skip land on one state (§9's diagram has no
 *  eleventh), and the reason is what keeps the customer's two distinct
 *  actions distinguishable in history without adding one. */
export function draftAction(routeId: string, to: State, reason: string) {
  return adapter(routeId, async (_request: Request, context: { params: Promise<{ id: string }> }) => {
    const session = await currentSession();
    if (session === null) return Response.json({ error: "unauthenticated" }, { status: UNAUTHORIZED });

    const { id } = await context.params;
    const owned = await ownsDraft(session.siteId, id);
    // A draft that is not this session's site's is answered exactly as one
    // that does not exist: a distinct response would tell a stranger which
    // draft ids are real.
    if (!owned) return Response.json({ error: "not_found" }, { status: NOT_FOUND });

    const moved = await transition(id, to, { kind: "customer", userId: session.userId }, { reason });
    if (moved.ok) {
      return Response.json({ state: moved.state } satisfies ActionAccepted);
    }

    const body: ActionRefusal = {
      refused: moved.refused,
      ...(moved.failedGuard === undefined ? {} : { failedGuard: moved.failedGuard }),
      state: moved.state,
      copy:
        moved.refused === "guard"
          ? "publish.action.refused.guard"
          : "publish.action.refused.notATransition",
    };
    return Response.json(body, { status: CONFLICT });
  });
}

/** The same check `PATCH /api/drafts/{id}` makes. No blueprint declares a
 *  shared `assertOwnsDraft`, and minting one inside a route directory would
 *  be engine logic in the application container; it is one filtered read
 *  and it is reported rather than generalised. */
async function ownsDraft(siteId: string, draftId: string): Promise<boolean> {
  const { data, error } = await publishDb()
    .from<{ id: string }>("drafts")
    .select("id, site_id")
    .eq("id", draftId)
    .eq("site_id", siteId)
    .limit(1);
  if (error !== null || data === null) return false;
  return data.length > 0;
}
