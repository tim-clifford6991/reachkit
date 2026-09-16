// src/app/api/setup/rivals/route.ts — §5
//
// The rivals the card offers, re-sought when the founder gives an address
// or states a market (issue 750). A transport adapter: it names the founder
// from the session, parses the two facts the screen holds, and answers
// what `seekRivals` settled. The report, the claim and the spend are all
// the server's — nothing about a report is taken from the body.
import { adapter } from "../../_adapter";
import { currentSession } from "@/lib/account/identity";
import { seekRivals, type SettledRivals } from "@/app/(account)/setup/_setup/rivals";

const BAD_REQUEST = 400;
const UNAUTHENTICATED = 401;

export interface SeekRivalsResponse {
  /** Candidates to offer — possibly none — or `null` where no market is
   *  known yet and nothing was sought (REQ-026 c10). */
  candidates: SettledRivals;
}

export const POST = adapter("POST /api/setup/rivals", async (request: Request): Promise<Response> => {
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
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof b.domain !== "string") {
    return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
  }
  if (b.category !== null && typeof b.category !== "string") {
    return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
  }

  const answer: SeekRivalsResponse = {
    candidates: await seekRivals({
      userId: session.userId,
      domain: b.domain,
      category: b.category,
      at: new Date(),
    }),
  };
  return Response.json(answer);
});
