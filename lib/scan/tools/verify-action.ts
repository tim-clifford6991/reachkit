/**
 * verify_action — D-tool (§9.4): confirm a completed action is actually live.
 *
 * Fail-closed contract (mirrors lib/llm/check-link.ts):
 *   - Fixture mode (no keys)                      → { verified: true,  reason: "fixture" }
 *   - Non-200 / unreachable / empty body          → { verified: false, reason }
 *   - Reachable with content, `expect` given      → verified = body includes `expect` (case-insensitive)
 *   - Reachable with content, no `expect`         → { verified: true,  reason: "page live" }
 *   - Any thrown error                            → { verified: false } (never throws out)
 */

import type { ToolDefinition } from "@/lib/tools/registry";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { fetchSourceText } from "@/lib/llm/check-link";

export interface VerifyActionArgs {
  url: string;
  expect?: string;
}

export interface VerifyActionResult {
  verified: boolean;
  reason: string;
}

export const verifyAction: ToolDefinition<VerifyActionArgs, VerifyActionResult> = {
  name: "verify_action",
  klass: "D",
  async run(args, ctx) {
    // Fixture short-circuit — no fetch, so the keyless verification flow completes.
    if (fixturesEnabled()) {
      return { verified: true, reason: "fixture" };
    }

    ctx.budget.charge({ toolCalls: 1, cents: 0 });

    try {
      // fetchSourceText returns "" on non-200 / unreachable / empty body.
      const body = await fetchSourceText(args.url);
      if (body === "") {
        return { verified: false, reason: "url unreachable/empty" };
      }

      const expect = args.expect;
      if (expect !== undefined && expect !== "") {
        const found = body.toLowerCase().includes(expect.toLowerCase());
        return found
          ? { verified: true, reason: "expected text found" }
          : { verified: false, reason: "expected text not found" };
      }

      return { verified: true, reason: "page live" };
    } catch {
      return { verified: false, reason: "verification failed" };
    }
  },
};
