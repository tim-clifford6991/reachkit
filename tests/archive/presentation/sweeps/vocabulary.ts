// tests/presentation/sweeps/vocabulary.ts — REQ-092 c8
//
// The internal-cause vocabulary criterion 8 forbids, as a declared,
// reviewable list: one entry, one reason. Nothing is matched that is not on
// this list, and nothing on this list is matched loosely — a rule that
// flagged any three-digit number would fail on a search volume and teach
// the next reader to switch the suite off.
//
// **Two scopes, on purpose.** Criterion 8 governs the statement ("wherever
// it renders … no cap or spend amount, no error text and no system status
// detail appears anywhere in **it**"), and ADR-010 point 3's sweep renders
// the whole screen. So an entry says which it belongs to:
//
//   · `statement` — inside the stopped-work statement only. A price the
//     product legitimately charges (`/pricing` states €49) is not a leak,
//     and a currency rule over the whole screen would say it was.
//   · `everywhere` — a leak wherever it appears under a stop: a vendor's
//     name, an error text, a stack frame, an HTTP status. None of these is
//     ever a sentence the product means to say.
export interface VocabularyEntry {
  /** What this entry is, for the failure message and for review. */
  name: string;
  pattern: RegExp;
  scope: "statement" | "everywhere";
  /** Why it is forbidden — the clause, not a hunch. */
  reason: string;
}

export const INTERNAL_CAUSE_VOCABULARY: readonly VocabularyEntry[] = Object.freeze([
  {
    name: "a spend cap or ceiling",
    pattern: /\b(spend|spending|cost|budget|daily)\s+(cap|ceiling|limit)\b/i,
    scope: "everywhere",
    reason:
      "c8's 'no cap … amount'. §6.5's caps are the product's own arrangement " +
      "with its vendors; a customer told about one is being handed an internal.",
  },
  {
    name: "the kill switch",
    pattern: /\bkill[- ]switch\b/i,
    scope: "everywhere",
    reason: "§11's kill switch is a system status detail — c8's third category, by name.",
  },
  {
    name: "a scan's internal status word",
    pattern: /\b(degraded|not_attempted|undeterminable|capHit|scanId)\b/,
    scope: "everywhere",
    reason:
      "c8's 'no system status detail'. These are the engine's own vocabulary " +
      "(BP-012's scan status, BP-024's unmeasured reasons); none is a sentence.",
  },
  {
    name: "a vendor or model name",
    pattern: /\b(dataforseo|anthropic|claude|openai|serpapi|supabase|postgrest|inngest|stripe|vercel)\b/i,
    scope: "everywhere",
    reason:
      "Naming who did not answer is naming the internal cause. §6.3's vendor " +
      "list is the product's arrangement, not the customer's account of itself.",
  },
  {
    name: "an HTTP status or error code",
    pattern: /\b(http\s*\d{3}|status\s*code|error\s*code|\d{3}\s*(bad request|unauthorized|forbidden|not found|internal server error|service unavailable|too many requests))\b/i,
    scope: "everywhere",
    reason: "c8's 'no error text and no system status detail'.",
  },
  {
    name: "error text",
    pattern: /\b(exception|stack ?trace|traceback|econnrefused|etimedout|enotfound|enotdir|eacces|typeerror|referenceerror)\b/i,
    scope: "everywhere",
    reason: "c8's 'no error text'. An error message is the product's internals in the customer's hands.",
  },
  {
    name: "a stack frame",
    pattern: /\bat [\w$.]+ \([^)]*:\d+:\d+\)/,
    scope: "everywhere",
    reason: "c8's 'no error text' at its most literal — a frame from this process's own stack.",
  },
  {
    name: "a rate limit or quota",
    pattern: /\b(rate[- ]limit(ed|ing)?|quota|throttl(ed|ing))\b/i,
    scope: "everywhere",
    reason:
      "c8's 'no system status detail'. A rate limit is a fact about the " +
      "product's vendors; what the customer is owed is c4's 'when the work is expected back'.",
  },
  {
    name: "a currency amount",
    pattern: /([€$£]\s?\d|(?<!\/)\b\d+(\.\d+)?\s?(cents?|¢)\b)/i,
    scope: "statement",
    reason:
      "c8's 'no cap or spend amount'. Scoped to the statement, because the " +
      "product states its own price on `/pricing` and in the report's offer, " +
      "and that is a sentence it means to say (REQ-022 c1).",
  },
]);
