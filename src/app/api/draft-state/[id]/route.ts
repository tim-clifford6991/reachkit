// src/app/api/draft-state/[id]/route.ts — one draft's §9 state, for the
// draft screen to poll while the page is being written again.
//
// The screen re-renders only when this answer changes, so a waiting tab
// reads one column instead of the whole draft. A draft of another site is
// answered as one that does not exist.
import { adapter } from "../../_adapter";
import { currentSession } from "@/lib/account/identity";
import { publishDb } from "@/lib/publish/db";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export const GET = adapter(
  "GET /api/draft-state/[id]",
  async (_request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> => {
    const session = await currentSession();
    if (session === null) return Response.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
    const { id } = await context.params;
    const state = session.siteId === null ? null : await stateOf(session.siteId, id);
    if (state === null) return Response.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
    return Response.json({ state }, { headers: NO_STORE });
  }
);

/** Ownership as a filter: another site's draft never comes back. */
async function stateOf(siteId: string, draftId: string): Promise<string | null> {
  const { data, error } = await publishDb()
    .from<{ state: string }>("drafts")
    .select("state")
    .eq("id", draftId)
    .eq("site_id", siteId)
    .limit(1);
  if (error !== null) throw new Error(error.message);
  return data?.[0]?.state ?? null;
}
