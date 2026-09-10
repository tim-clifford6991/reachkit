// src/lib/llm/index.ts — WO-026, BP-009's `llm()` seam.
//
// **Risk: high — money, and the customer's own page text leaving the
// process here.** Every model call the product ever makes goes through
// this one function. Three things are non-negotiable and mutation-tested
// (doctrine 0.13.2):
//   1. Every call is ledgered through `CostContext.recordFetch` — no path
//      calls the vendor without going through the cap/reserve/settle/
//      ledger seam BP-007 already owns.
//   2. A tier's model id comes from exactly one place — `tierBinding()`
//      (`tiers.ts`) — and nothing on the caller's `call` object can
//      substitute for it: only `call.tier`, `call.input` and
//      `call.schema` are ever read, by name, never spread.
//   3. `call.input` — the customer's own page text, in whatever shape a
//      caller supplies — reaches the model and nothing else: it is never
//      logged, and neither is the model's response text. The credential
//      (`tierBinding().apiKey`) is read in exactly one place below and
//      handed to the vendor SDK's constructor; it is never interpolated
//      into a log line, a thrown value, or any string this module builds
//      by hand — including an *encoded* form of it (WO-023's sibling
//      order shipped a credential test that only searched for the
//      plaintext secret and missed the header's own base64 encoding;
//      `tests/llm/seam.test.ts` searches for both forms of the fixture
//      key).
//
// **Two gaps this file inherits, flagged once here (rule 4.2) rather than
// blocking a WO-071-blocking, critical-path order:**
//
// - **`call.site` is `LlmCallSite`, the key set of
//   `INFERENCE_MAX_OUTPUT_TOKENS` (issue #462).** It was typed `string`
//   while BP-009's union waited on a WO-027 file that never landed; the
//   per-site output budget is what closed it, since a site with no
//   budget pinned now does not compile.
// - **The `unparseable` reason BP-009's `## Error & edge behavior` names
//   does not exist on the shipped `Measured<T>`.** `UnmeasuredReason`
//   (`src/lib/measure/measured.ts`, BP-024, WO-277 — outside this file
//   plan) is a closed `'undeterminable' | 'not_attempted'`, with
//   `undeterminable` defined as "nothing returned, unreadable, or a data
//   source did not answer" (BP-024 `## Data model delta`) — language that
//   already covers an unparsed model response without inventing a third
//   member of a type this WO does not own (rule 7.1: one owner per
//   capability). Both a schema-parse failure and model unavailability
//   below resolve to `undeterminable`; `not_attempted` is reserved for
//   the one case BP-024 defines it for — the caller's own cost ceiling
//   stopping the call before it was ever attempted (`recordFetch`'s
//   `{ skipped: "cap" }`). Recorded as an open `rests-on` row on WO-026.
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import type { ZodType } from "zod";
import { INFERENCE_MAX_OUTPUT_TOKENS, INFERENCE_MAX_RETRIES } from "@/lib/config/constants";
import type { CostContext } from "@/lib/costs";
import { measured, unmeasured, type Measured } from "@/lib/measure/measured";
import { costCentsFor, tierBinding, type Tier, type TierBinding } from "./tiers";

/** BP-009 `## Error & edge behavior`: "retried at most once" — one retry,
 *  two attempts total. Both attempts spend the *same* budget
 *  (`binding.timeoutMs`), which is why `runAttempts` below carries a
 *  deadline rather than handing each attempt a fresh clock: the pin is a
 *  bound on the call, and a retry that could double it would make the
 *  pass's own arithmetic (`tests/llm/budget.test.ts`) untrue. */
const MAX_ATTEMPTS = 2;

/** BP-009's closed call-site list: every site that has an output budget
 *  pinned (`INFERENCE_MAX_OUTPUT_TOKENS`), and nothing else. That budget
 *  bounds both the request's own `max_tokens` and the cost reservation
 *  below — one seam-wide 4 096 let a seven-field profile spend its whole
 *  15 s generating one answer (issue #462). */
export type LlmCallSite = keyof typeof INFERENCE_MAX_OUTPUT_TOKENS;

type ParseOutcome = "success" | "unparseable" | "unavailable" | "not_attempted";

/** Why a call did not come back with a conforming answer, in one word a
 *  live run can be grepped for (issue #452). `parseOutcome` alone said
 *  only `unavailable`, which is every transport failure there is — a
 *  timeout, a 429, a 529, a bad credential and a DNS failure all read the
 *  same, so the M3 live run of 2026-09-10 could say the profile never
 *  arrived and not say why. Four classes, closed: the vendor's own HTTP
 *  status where it gave one, `timeout` where the budget below ran out,
 *  `parse` where responses came back and none conformed to the caller's
 *  schema, and `vendor` for a transport failure of no other shape.
 *
 *  **Read off the error's *shape*, never its text.** A vendor SDK's error
 *  object routinely echoes the request that produced it, credential
 *  headers included (`tests/llm/seam.test.ts`'s third mutation probe is
 *  exactly that scenario), so nothing here reads `message` and nothing
 *  here reaches a log but the class word itself. */
type FailureClass = "timeout" | "parse" | "vendor" | `http_${number}`;

/** Why an answer that came back did not parse (issue #462): `json` — the
 *  text was not JSON at all (a code fence, prose, or an answer cut off at
 *  `max_tokens`); `schema` — JSON that the caller's schema refused. */
type ParseFailureKind = "json" | "schema";

/** Why a `parse` failure got no further attempt: `attempts` — both were
 *  spent; `budget` — an answer came back, did not parse, and the call's
 *  time budget had nothing left to spend on the retry (issue #462: M3 run
 *  4b logged exactly this as `timeout`, which it was not). */
type RetryExhausted = "attempts" | "budget";

/** The last unparseable answer's diagnosis. `schemaIssues` is where the
 *  schema refused the answer and how — `path:code`, e.g.
 *  `vocabulary[]:invalid_type` — built only from the schema's own field
 *  names, array positions collapsed to `[]`, and Zod's closed issue codes.
 *  Never a value, and never an unrecognised key's name (the model wrote
 *  that): an extra field reads `(root):unrecognized_keys`. */
interface ParseDiagnosis {
  parseFailure: ParseFailureKind;
  schemaIssues?: string[];
}

interface AttemptOutcome {
  parseOutcome: ParseOutcome;
  value: unknown;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  /** Absent on a success — BP-009's `## NFR budget` names six log fields
   *  and a call that answered adds none of its own. */
  failure?: FailureClass;
  /** Present only with `failure: "parse"`. */
  retryExhausted?: RetryExhausted;
  diagnosis?: ParseDiagnosis;
}

/** Every error shape whose *name* says the request ran out of time —
 *  `@anthropic-ai/sdk`'s own class, the two undici raises under it, and
 *  the `AbortError` a fired `AbortSignal` produces. */
const TIMEOUT_ERROR_NAMES: ReadonlySet<string> = new Set([
  "APIConnectionTimeoutError",
  "ConnectTimeoutError",
  "HeadersTimeoutError",
  "BodyTimeoutError",
  "TimeoutError",
  "AbortError",
]);

/** Classified by the error's **shape**, deliberately not by `instanceof`
 *  against the SDK's exported classes. Nine test suites replace
 *  `@anthropic-ai/sdk` with a mock of their own (the seam is the one door
 *  to a vendor, so anything exercising a pipeline has to), and an
 *  identity check against a named export would make this function's
 *  answer depend on whether a given suite happened to re-export that
 *  class. A status and a name are shapes every one of them can produce.
 *
 *  Order matters: `APIError` carries the response `status` and is the
 *  most specific thing there is to say, so it is read first; the SDK's
 *  own timeout class carries no status and reports `name` as the base
 *  `Error`, so it is recognised by its constructor and, failing that, by
 *  the one sentence it is constructed with ("Request timed out."). The
 *  message is *read* and discarded — the class word is the only thing
 *  that ever reaches a log (see `logCall`). */
function failureClassOf(error: unknown): FailureClass {
  const shape = error as
    | { status?: unknown; name?: unknown; message?: unknown; constructor?: { name?: unknown } }
    | null
    | undefined;

  const status = shape?.status;
  if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599) {
    return `http_${status}`;
  }

  for (const candidate of [shape?.name, shape?.constructor?.name]) {
    if (typeof candidate === "string" && TIMEOUT_ERROR_NAMES.has(candidate)) return "timeout";
  }
  if (typeof shape?.message === "string" && /timed out|timeout/i.test(shape.message)) return "timeout";

  return "vendor";
}

/** `~4 chars/token` — a standard, widely-used estimate (not vendor data,
 *  never asserted as measured), used only to size the up-front
 *  **reservation** `recordFetch`'s cap is checked against; the ledgered
 *  figure `settleCents` writes always comes from the vendor's own
 *  reported `usage.input_tokens`. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function extractText(message: Anthropic.Message): string {
  const block = message.content.find(
    (candidate): candidate is Anthropic.TextBlock => candidate.type === "text"
  );
  return block?.text ?? "";
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** One Zod issue as `path:code` — see `ParseDiagnosis`. Every path segment
 *  a string is a key the schema itself declared (Zod descends only into
 *  known keys, and no call site's schema is a `z.record`); numbers are
 *  array positions and collapse to `[]`, so twelve bad entries in one list
 *  read as one line. */
function issueLabel(issue: { path: PropertyKey[]; code: string }): string {
  let path = "";
  for (const segment of issue.path) {
    if (typeof segment === "number") path += "[]";
    else if (typeof segment === "string") path += path === "" ? segment : `.${segment}`;
  }
  return `${path === "" ? "(root)" : path}:${issue.code}`;
}

/** The one place a vendor request is built and issued — `binding.apiKey`
 *  and `binding.modelId` are read here and nowhere else in this module.
 *  Anthropic's own SDK is the transport (`eslint.config.mjs`'s
 *  `no-fetch-outside-egress` carves out `src/lib/vendors/**` and
 *  `src/lib/egress/**` only; this file calls neither `fetch` nor either
 *  boundary — the SDK is the sanctioned path for a vendor client that is
 *  not itself a raw `fetch` call in this tree). */
async function callModel(
  binding: TierBinding,
  inputText: string,
  /** The call site's pinned `INFERENCE_MAX_OUTPUT_TOKENS`, sent as the
   *  request's own `max_tokens`. */
  maxOutputTokens: number,
  /** What is left of `binding.timeoutMs` when this attempt starts, carried
   *  as the request's own bound. The client is still constructed with the
   *  tier's whole pin — that is the budget, and the first attempt has all
   *  of it — but a retry is handed the remainder, never a second full
   *  one, so no `llm()` call can outlive the number `INFERENCE_TIMEOUT_MS`
   *  states however many attempts it takes inside. */
  remainingMs: number
): Promise<{ text: string; tokensIn: number; tokensOut: number }> {
  const client = new Anthropic({
    apiKey: binding.apiKey,
    timeout: binding.timeoutMs,
    // `INFERENCE_MAX_RETRIES`, passed rather than defaulted (issue #452):
    // the SDK's own default is 2, which made every attempt three requests
    // and the tier's timeout three times the wall clock it reads as.
    maxRetries: INFERENCE_MAX_RETRIES,
  });
  const message = await client.messages.create(
    {
      model: binding.modelId,
      max_tokens: maxOutputTokens,
      system: "Respond with JSON only. No prose, no markdown fences, no commentary.",
      messages: [{ role: "user", content: inputText }],
    },
    { timeout: remainingMs }
  );
  return {
    text: extractText(message),
    tokensIn: message.usage.input_tokens,
    tokensOut: message.usage.output_tokens,
  };
}

/** Up to `MAX_ATTEMPTS` calls against one schema. A transport failure on
 *  any attempt returns `unavailable` immediately — BP-009's "Model
 *  unavailability degrades the caller" is distinct from, and does not
 *  extend, the schema-parse retry allowance. A response that comes back
 *  but does not parse against `schema` is retried once; a second failure
 *  returns `unparseable`, and the raw payload is never coerced or
 *  returned in its place (the mutation this WO's `## Steps` names:
 *  falling back to the raw string here is exactly the bug the "never
 *  silently coerced" test exists to kill).
 *
 *  An answer that came back unparseable with no budget left for the retry
 *  is still `unparseable` / `parse` — with `retryExhausted: "budget"` —
 *  never `timeout`: the vendor answered in time, the answer was wrong
 *  (issue #462). */
async function runAttempts<T>(
  binding: TierBinding,
  schema: ZodType<T>,
  inputText: string,
  maxOutputTokens: number
): Promise<AttemptOutcome> {
  const startedAt = Date.now();
  const deadline = startedAt + binding.timeoutMs;
  let tokensIn = 0;
  let tokensOut = 0;
  let lastMiss: ParseDiagnosis | undefined;

  const unparseable = (retryExhausted: RetryExhausted, diagnosis: ParseDiagnosis): AttemptOutcome => ({
    parseOutcome: "unparseable",
    value: undefined,
    tokensIn,
    tokensOut,
    durationMs: Date.now() - startedAt,
    failure: "parse",
    retryExhausted,
    diagnosis,
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remainingMs = deadline - Date.now();
    // The budget, not the attempt, is what `binding.timeoutMs` bounds
    // (`INFERENCE_TIMEOUT_MS`, issue #452): a retry that would start with
    // nothing left is not started. If an answer already came back and
    // missed, that miss is the failure (#462); only a call that never got
    // an answer at all reads as a timeout.
    if (remainingMs <= 0) {
      if (lastMiss !== undefined) return unparseable("budget", lastMiss);
      return {
        parseOutcome: "unavailable",
        value: undefined,
        tokensIn,
        tokensOut,
        durationMs: Date.now() - startedAt,
        failure: "timeout",
      };
    }
    let response: { text: string; tokensIn: number; tokensOut: number };
    try {
      response = await callModel(binding, inputText, maxOutputTokens, remainingMs);
    } catch (error: unknown) {
      return {
        parseOutcome: "unavailable",
        value: undefined,
        tokensIn,
        tokensOut,
        durationMs: Date.now() - startedAt,
        failure: failureClassOf(error),
      };
    }
    tokensIn += response.tokensIn;
    tokensOut += response.tokensOut;

    const asJson = parseJson(response.text);
    if (!asJson.ok) {
      lastMiss = { parseFailure: "json" };
      continue;
    }
    const parsed = schema.safeParse(asJson.value);
    if (parsed.success) {
      return {
        parseOutcome: "success",
        value: parsed.data,
        tokensIn,
        tokensOut,
        durationMs: Date.now() - startedAt,
      };
    }
    lastMiss = {
      parseFailure: "schema",
      schemaIssues: [...new Set(parsed.error.issues.map(issueLabel))],
    };
    // Falls through to the next attempt (if any is left) — never
    // returns `response.text` itself as the value.
  }

  // Every attempt returned (a transport failure returns above), so the
  // last one's miss is always recorded here.
  return unparseable("attempts", lastMiss ?? { parseFailure: "json" });
}

interface LogRecord {
  site: LlmCallSite;
  tier: Tier;
  tokensIn: number;
  tokensOut: number;
  costCents: number;
  durationMs: number;
  parseOutcome: ParseOutcome;
  /** Present only where the call failed (issue #452) — a successful call
   *  logs exactly BP-009's six named fields and nothing else, so the
   *  observability record it specifies is unchanged for every line a
   *  healthy run writes. */
  failure?: FailureClass;
  /** Present only with `failure: "parse"` (issue #462) — see
   *  `RetryExhausted` and `ParseDiagnosis`. */
  retryExhausted?: RetryExhausted;
  parseFailure?: ParseFailureKind;
  schemaIssues?: string[];
}

/** BP-009 `## NFR budget`, verbatim: "call site, tier, tokens in and out,
 *  cost, duration, parse outcome; never the prompt or the completion in a
 *  log." This is the one place `llm()` writes to a log, and `LogRecord`
 *  is the whole field set — there is no path from `call.input` or a
 *  model's response text into this function, and none from
 *  `binding.apiKey` either.
 *
 *  A seventh field, `failure`, is written only where the call failed
 *  (issue #452): `parseOutcome: "unavailable"` is every transport failure
 *  there is, so a live run could read that the profile never arrived and
 *  not read why. It is one of `FailureClass`'s closed words — a class,
 *  never a message — so the "never the prompt or the completion" half of
 *  the clause is untouched, and a successful line still carries exactly
 *  the six fields BP-009 names. A `parse` failure adds three more (issue
 *  #462): whether a retry was still possible, whether the answer was not
 *  JSON or not the schema, and — for a schema miss — the schema's own
 *  field paths and Zod's issue codes. None of the three is ever a value. */
function logCall(record: LogRecord): void {
  console.log(JSON.stringify(record));
}

/** BP-009 `## Public interface`, verbatim signature (`site`'s type is the
 *  one declared deviation — see file header). Runs inside the caller's
 *  `CostContext` via `recordFetch`, with the call site as the ledger
 *  row's `source` (BP-009 `## Data model delta`). Never throws — a
 *  transport failure, an exhausted parse retry, and the caller's own cost
 *  ceiling all resolve to `unmeasured`, not a rejection. */
export async function llm<T>(
  c: CostContext,
  call: {
    site: LlmCallSite;
    input: unknown;
    schema: ZodType<T>;
    tier: Tier;
  }
): Promise<Measured<T>> {
  const at = new Date();
  const binding = tierBinding(call.tier);
  const inputText = JSON.stringify(call.input);
  const maxOutputTokens = INFERENCE_MAX_OUTPUT_TOKENS[call.site];
  const cacheKey = createHash("sha256").update(`${call.site}:${call.tier}:${inputText}`).digest("hex");
  const reservedCents = costCentsFor(
    call.tier,
    estimateTokens(inputText) * MAX_ATTEMPTS,
    maxOutputTokens * MAX_ATTEMPTS
  );

  const result = await c.recordFetch<AttemptOutcome>({
    source: call.site,
    cacheKey,
    // BP-009 states no caching policy for this seam (unlike BP-008's own
    // per-vendor `CACHE_WINDOWS_D`). `freshnessDays: 0` keeps
    // `recordFetch`'s cache-first/ledger-always shape (BP-007) while
    // never actually serving a stale model response back (rule 1.1 —
    // parameter, reversal cost one number, this file only).
    freshnessDays: 0,
    costCents: reservedCents,
    settleCents: (outcome) => costCentsFor(call.tier, outcome.tokensIn, outcome.tokensOut),
    run: () => runAttempts(binding, call.schema, inputText, maxOutputTokens),
  });

  if ("skipped" in result) {
    logCall({
      site: call.site,
      tier: call.tier,
      tokensIn: 0,
      tokensOut: 0,
      costCents: 0,
      durationMs: 0,
      parseOutcome: "not_attempted",
    });
    return unmeasured("not_attempted", at);
  }

  const outcome = result.payload;
  logCall({
    site: call.site,
    tier: call.tier,
    tokensIn: outcome.tokensIn,
    tokensOut: outcome.tokensOut,
    costCents: result.costCents,
    durationMs: outcome.durationMs,
    parseOutcome: outcome.parseOutcome,
    // Spread, not a written `failure: outcome.failure` — an explicit
    // `undefined` survives into the record's key set, and a successful
    // call's line carries BP-009's six fields exactly.
    ...(outcome.failure === undefined ? {} : { failure: outcome.failure }),
    ...(outcome.retryExhausted === undefined ? {} : { retryExhausted: outcome.retryExhausted }),
    ...(outcome.diagnosis === undefined ? {} : outcome.diagnosis),
  });

  if (outcome.parseOutcome === "success") {
    return measured(outcome.value as T, at);
  }
  // "unparseable" and "unavailable" both degrade the caller into the
  // same `UnmeasuredReason` — see file header for why this is
  // `undeterminable`, not the `unparseable` BP-009's prose names.
  return unmeasured("undeterminable", at);
}
