/**
 * check_link — L-tool (§9.4): fetch a URL, parse body text, call Haiku to judge
 * whether the source text entails a given claim.
 *
 * Fail-closed contract:
 *   - Unreachable / empty source  → { entails: false, reason: "source unreachable/empty" }
 *   - Unparseable model output    → { entails: false, reason: "could not verify" }
 *   - Fixture mode (no keys)      → { entails: true,  reason: "fixtures: assumed entailed" }
 */

import { parse } from "node-html-parser";
import type { ToolDefinition } from "@/lib/tools/registry";
import { callModel } from "@/lib/llm/anthropic";
import { fixturesEnabled } from "@/lib/dev/fixtures";
import { ENTAIL_SYSTEM, buildEntailPrompt } from "@/lib/llm/prompts";
import { fetchWithTimeout } from "@/lib/scan/adapters/fetch-timeout";

const MODEL = "claude-haiku-4-5-20251001" as const;
const SOURCE_CHAR_LIMIT = 6000;

export interface CheckLinkArgs {
  url: string;
  claim: string;
}

export interface CheckLinkResult {
  entails: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// fetchSourceText — GET the URL, parse HTML, return trimmed body text.
// Returns "" on any fetch/parse failure (caller handles the empty case).
// ---------------------------------------------------------------------------
export async function fetchSourceText(url: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "ReachKitBot/1.0" },
    });
    if (!res.ok) return "";
    const html = await res.text();
    const root = parse(html);
    // Remove script/style noise then extract text
    const text = root.querySelector("body")?.structuredText ?? root.structuredText;
    return text.trim().slice(0, SOURCE_CHAR_LIMIT);
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// parseEntailment — defensive parse of model JSON output.
// Returns null on any failure — caller maps null → fail-closed result.
// ---------------------------------------------------------------------------
function parseEntailment(raw: string): CheckLinkResult | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj["entails"] !== "boolean") return null;
    const reason = typeof obj["reason"] === "string" ? obj["reason"] : "no reason provided";
    return { entails: obj["entails"], reason };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// checkLink — the ToolDefinition registered as "check_link" (klass L)
// ---------------------------------------------------------------------------
export const checkLink: ToolDefinition<CheckLinkArgs, CheckLinkResult> = {
  name: "check_link",
  klass: "L",

  async run(args, ctx) {
    // Fixture short-circuit — no fetch, no LLM
    if (fixturesEnabled()) {
      return { entails: true, reason: "fixtures: assumed entailed" };
    }

    ctx.budget.charge({ toolCalls: 1, cents: 0 });

    const text = await fetchSourceText(args.url);
    if (text === "") {
      return { entails: false, reason: "source unreachable/empty" };
    }

    try {
      const result = await callModel({
        model: MODEL,
        system: ENTAIL_SYSTEM,
        prompt: buildEntailPrompt(text, args.claim),
        scanId: ctx.scanId,
        stage: "critic",
        maxTokens: 256,
      });

      const parsed = parseEntailment(result.text);
      if (parsed === null) {
        return { entails: false, reason: "could not verify" };
      }
      return parsed;
    } catch {
      return { entails: false, reason: "could not verify" };
    }
  },
};
