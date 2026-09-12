// src/app/api/setup/questions/route.ts — §5, §12 ruling 4
//
// The twelve, re-read for a category the founder corrected. A transport
// adapter over `readQuestionsFor()`: it selects again over the market the
// account's stored report already holds and words the result mechanically,
// so a correction buys no vendor call, no model call and no measurement.
import { adapter } from "../../_adapter";
import { readQuestionsFor } from "@/app/(account)/setup/_setup/provider";
import { registrableDomain } from "@/lib/market/rivals/domains";
import type { SetupQuestion } from "@/lib/market/setup/state";

const BAD_REQUEST = 400;

export interface SetupQuestionsResponse {
  /** The twelve the given category derives, or fewer where the stored
   *  market yields fewer. Empty is a complete answer, never a failure. */
  questions: readonly SetupQuestion[];
}

export const POST = adapter(
  "POST /api/setup/questions",
  async (request: Request): Promise<Response> => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
    }
    const asked = body as { domain?: unknown; category?: unknown } | null;
    if (typeof asked?.domain !== "string" || typeof asked.category !== "string") {
      return Response.json({ error: "malformed_body" }, { status: BAD_REQUEST });
    }

    const domain = registrableDomain(asked.domain);
    const category = asked.category.trim();
    // Neither an address the product cannot name nor an unstated market
    // derives anything; both answer with none rather than a refusal, which
    // is what the screen draws while a founder is still typing.
    const answer: SetupQuestionsResponse =
      domain === null || category === ""
        ? { questions: [] }
        : { questions: await readQuestionsFor(domain, category) };
    return Response.json(answer);
  }
);
