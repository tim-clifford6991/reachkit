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
// another founder's site by editing a payload. The session itself is
// #35's; until it lands, `currentUserId()` below is the one honest stand-in
// and says so.
import { adapter } from "../_adapter";
import { completeSetup, type SetupResult, type SetupSubmission } from "@/app/(account)/setup/submit";
import { setupStore } from "@/app/(account)/setup/_setup/provider";
import { FIXTURE_USER_ID } from "@/app/(account)/setup/_setup/fixture";

const BAD_REQUEST = 400;
const REFUSED = 422;

/** The signed-in account. `src/middleware.ts` has already refused this
 *  request unless it carried a session cookie, so a caller reaching here
 *  is signed in; **which** account it is, is BP-061's `currentSession()`
 *  (#35), which does not exist yet. Until it does this returns the fixture
 *  account, which is the same account `_setup/provider.ts` reads — one
 *  stand-in, named once, not a second guess. */
function currentUserId(): string {
  return FIXTURE_USER_ID;
}

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
    userId: currentUserId(),
    submission,
  });

  return Response.json(result, { status: result.ok ? 200 : REFUSED });
});
