// src/lib/llm/tiers.ts — WO-026, BP-009's two model tiers.
//
// The closed tier set — `nano` and `haiku`, no third (BP-009 `## Public
// interface`: `tier: 'nano' | 'haiku'`; file plan: "No third tier"). Each
// tier binds three things: the credential it authenticates with, the
// vendor model id it calls, and the per-token price and timeout budget it
// is held to.
//
// **Credential — settled elsewhere, not re-derived here (BP-005 decision
// 6b, shipped by WO-284).** `env.NANO_API_KEY` is already a required
// `string` by the time this module reads it: absent, `env.ts` itself
// resolved it to `env.ANTHROPIC_API_KEY` before either module's caller
// could observe which key it received. This file makes no fallback
// decision of its own — it reads the two already-resolved members and
// nothing else authenticates a call.
//
// **Price and timeout — pinned elsewhere, only read here (rule 2.4).**
// `INFERENCE_PRICE_BOOK` is BP-005's `## Public interface`, except that
// `nano` is priced at Haiku's row since the owner's 2026-09-11 ruling
// (issue #517) — see the note that closes the header below.
// `INFERENCE_TIMEOUT_MS` was BP-009's `## NFR budget` transcribed ("p95
// latency: nano ≤ 3 s, haiku ≤ 20 s") until issue #452 measured that
// budget against the vendor and found `nano`'s 3 s below the latency a
// real call to `claude-haiku-4-5` has: it is now 15 s, and it bounds the
// whole `llm()` call rather than one attempt inside it — the reasoning,
// and the live run it rests on, are on the pin itself. Both live in
// `constants.ts` and nowhere else — this file only reads them.
//
// **Model id — chosen, not transcribed (rule 1.1 — flagged once, here,
// per constitution rule 4.2, and in this WO's return).** No approved
// artifact states a machine-readable model id for either tier: BP-009's
// `## Public interface` declares only the abstract `tier` union, and the
// charter's own stack row (`00-project.md` / `BUILD.md` §1) reads "
// **Anthropic Haiku 4.5** (prose) + a nano-class model (scaffolding)" —
// a *class*, deliberately not a name, for the second tier. `haiku`'s id
// below transcribes the charter's own family name, unversioned (no
// snapshot date is stated anywhere the corpus can cite, so none is
// invented — rule 1.2).
//
// **`nano`'s id — corrected 2026-09-04, coordinator finding, superseding
// this file's first commit.** The first cut of this file picked
// `claude-fable-5` because the *name* read as a small/cheap tier; it is
// real, but its actual catalogue price is $10.00 input / $50.00 output
// per MTok — Anthropic's *most expensive* tier, wired into the cheapest
// lane. Against this file's own `INFERENCE_PRICE_BOOK.nano` pin
// (20/125 ¢/MTok), that is the ledger under-recording every nano call
// 50× on input and 40× on output — silently, since the price book and
// the id agreed with each other and were both wrong together; no test in
// `tests/llm/seam.test.ts` could see it, because none of them know the
// vendor's real price list. `nano` now points at `claude-haiku-4-5` —
// the same id as `haiku` — as the interim: it is the cheapest real model
// in the current catalogue, still 5× the `INFERENCE_PRICE_BOOK.nano` pin
// rather than 50×/40×, and it is not invented (rule 1.2's own
// discipline: pick a *real*, catalogue-verified id, never one chosen
// because its name sounds right). `INFERENCE_PRICE_BOOK.nano` itself is
// left untouched — that pin is BP-005's, transcribed, and a price is the
// owner's to move (decision-rights table, rule 1.2), not this file's.
// **This does not resolve the underlying gap — it is recorded as its own
// open `rests-on` row on WO-026**: no model in the current catalogue
// prices at 20/125 ¢/MTok, so `CAPS.FREE_C`'s ceiling is still computed
// from a price the product cannot actually buy at, at any nano id. That
// is the architect's and the owner's to resolve, not a code change here.
//
// **Resolved 2026-09-11, owner ruling (issue #517).** The owner ruled the
// `nano` row priced at Haiku's rate: `INFERENCE_PRICE_BOOK.nano` is now
// the same frozen object as `.haiku` in `constants.ts`, so a nano call is
// ledgered at what `claude-haiku-4-5` actually costs and `CAPS.FREE_C` is
// checked against a real price. The two tiers still differ in timeout and
// credential; a genuinely cheaper nano model is a new ruling and a new row.
import { env } from "@/lib/config/env";
import { INFERENCE_PRICE_BOOK, INFERENCE_TIMEOUT_MS } from "@/lib/config/constants";

export type Tier = "nano" | "haiku";

/** Not exported — the only way a caller reaches a model id is through
 *  `tierBinding()`, keyed by the closed `Tier` union. There is no second
 *  path into this map, so a caller cannot shadow it with an argument of
 *  its own (BP-009 `## Decisions` 1: "an eighth call site is a
 *  requirement change, not a code change" — the same closedness applied
 *  to model selection).
 *
 *  `nano` and `haiku` deliberately share one id today (see the file
 *  header's 2026-09-04 correction) — there is no cheaper *real* model to
 *  point `nano` at, so the two tiers are priced identically
 *  (`INFERENCE_PRICE_BOOK`, owner ruling of issue #517) and timed
 *  differently (`INFERENCE_TIMEOUT_MS`), and call the same vendor model
 *  until a genuinely cheaper one exists. */
const TIER_MODEL_IDS: Readonly<Record<Tier, string>> = Object.freeze({
  nano: "claude-haiku-4-5",
  haiku: "claude-haiku-4-5",
});

export interface TierBinding {
  tier: Tier;
  modelId: string;
  apiKey: string;
  timeoutMs: number;
  inCentsPerM: number;
  outCentsPerM: number;
}

/** The one place a tier's model id, credential, price and timeout are
 *  assembled. `llm()` (`index.ts`) calls this once per invocation and
 *  reads nothing else to build the request — no caller-supplied field
 *  can substitute for any member this function returns. */
export function tierBinding(tier: Tier): TierBinding {
  const priceBook = INFERENCE_PRICE_BOOK[tier];
  return Object.freeze({
    tier,
    modelId: TIER_MODEL_IDS[tier],
    apiKey: tier === "nano" ? env.NANO_API_KEY : env.ANTHROPIC_API_KEY,
    timeoutMs: INFERENCE_TIMEOUT_MS[tier],
    inCentsPerM: priceBook.inCentsPerM,
    outCentsPerM: priceBook.outCentsPerM,
  });
}

/** BP-005's own stated formula ("computed at the call site … not here"),
 *  applied at BP-009's call site — this file, not `constants.ts` (rule
 *  2.5). */
export function costCentsFor(tier: Tier, tokensIn: number, tokensOut: number): number {
  const { inCentsPerM, outCentsPerM } = INFERENCE_PRICE_BOOK[tier];
  return (tokensIn / 1_000_000) * inCentsPerM + (tokensOut / 1_000_000) * outCentsPerM;
}
