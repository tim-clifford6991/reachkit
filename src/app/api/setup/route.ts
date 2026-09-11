// src/app/api/setup/route.ts — BUILD §4.3
//
// The one write path into setup completion (REQ-025 c2: "one action starts
// the product"). A transport adapter and nothing else (`ARCHITECTURE.md`
// rule 1): it parses the body to the closed `SetupSubmission` shape, calls
// `completeSetup()`, and maps `SetupResult` to a response. It holds no
// engine logic, no SQL and no sentence.
//
// **`siteId` is never read from the request body.** It comes from the
// account behind the session, through the store — a founder cannot name
// another founder's site by editing a payload.
//
// **The account is the session's, since #133.** `currentSession()`
// (BP-061, #35, on Supabase Auth since #468) is the whole of it: Supabase
// verifies the session and the account's tombstone is checked there, and
// this file adds no claim of its own. `src/middleware.ts` has already
// refused a request that carries no cookie at all, so the `null` arm below
// is the forged, expired or ended one — answered the way every other
// account endpoint answers it, with a status and no sentence.
import { adapter } from "../_adapter";
import { completeSetup, type SetupResult, type SetupSubmission } from "@/app/(account)/setup/submit";
import { setupStore } from "@/app/(account)/setup/_setup/provider";
import { currentSession } from "@/lib/account/identity";

const BAD_REQUEST = 400;
const UNAUTHENTICATED = 401;
const REFUSED = 422;

/** Narrows an unknown body to `SetupSubmission` without widening it: a
 *  member absent from the type cannot be sent, which is REQ-025 c1's "and
 *  for nothing else" enforced at the wire rather than reviewed. Unknown
 *  members are dropped, never forwarded. */
function parseSubmission(body: unknown): SetupSubmission | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.domain !== "string") return null;
  if (typeof b.category !== "string") return null;
  if (!Array.isArray(b.competitors) || b.competitors.some((c) => typeof c !== "string")) return null;
  if (b.mode !== "autopilot" && b.mode !== "copilot") return null;

  const destination = b.destination;
  if (typeof destination !== "object" || destination === null) return null;
  const kind = (destination as Record<string, unknown>).kind;
  if (kind !== "hosted" && kind !== "wordpress") return null;

  return {
    domain: b.domain,
    category: b.category,
    competitors: b.competitors as string[],
    mode: b.mode,
    destination: kind === "hosted" ? { kind: "hosted" } : { kind: "wordpress", connectLater: true },
  };
}

export const POST = adapter("POST /api/setup", async (request: Request): Promise<Response> => {
  const session = await currentSession();
  if (session === null) {
    return Response.json({ error: "unauthenticated" }, { status: UNAUTHENTICATED });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
  }

  const submission = parseSubmission(body);
  if (submission === null) {
    return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
  }

  const result: SetupResult = await completeSetup(setupStore(), {
    userId: session.userId,
    submission,
  });

  return Response.json(result, { status: result.ok ? 200 : REFUSED });
});
