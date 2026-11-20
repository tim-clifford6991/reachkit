// Stands in for `@anthropic-ai/sdk` wherever `src/` imports it, for the evaluation run only, so the product's own
// `llm()`, prompts, schemas, retries and parsing run unchanged; only the model, its temperature and thinking fields, and the
// ledger move.
import Anthropic from "@anthropic-ai/sdk";
import { INFERENCE_MAX_OUTPUT_TOKENS } from "@/lib/config/constants";
import { appendSpend } from "../spend-log.mjs";
import config from "./models.json";
import { throughTransport } from "./isolate";
import { priceCents, type Ledger, type ModelPrice } from "./ledger";

export type Mode = "live" | "fake" | "plan";
export interface Run {
  mode: Mode;
  ledger: Ledger | null;
  /** Call site (or `*`) to the candidate model id; any other site keeps the product's own model. */
  swap: Record<string, string>;
  /** Requests that reached `messages.create` on the real client. */
  sends: number;
  plan: { calls: number; cents: number; unpriced: number };
  halted: string | null;
  /** Fake and plan runs only: each call site's canned tool answer, from the case; `{}` where it gives none. */
  fakeAnswers?: Record<string, unknown>;
}

type Spec = ModelPrice & { drop: string[]; set: Record<string, unknown> };
type Params = Record<string, unknown> & { model: string; max_tokens: number; tools?: { name: string }[] };

const RUN = Symbol.for("reachkit.eval-models.run");
export function configure(run: Run): void {
  (globalThis as Record<symbol, unknown>)[RUN] = run;
}
function current(): Run {
  const run = (globalThis as Record<symbol, unknown>)[RUN] as Run | undefined;
  if (run === undefined) throw new Error("eval transport used before configure()");
  return run;
}

export class EvalRefused extends Error {
  constructor(readonly why: string) {
    super(`eval ledger refused the call: ${why}`);
    this.name = "EvalRefused";
  }
}

const SITE_OF_TOOL = new Map(Object.keys(INFERENCE_MAX_OUTPUT_TOKENS).map((site) => [site.replace(/[^a-zA-Z0-9_-]/g, "_"), site]));
const MODELS = config.models as Record<string, Spec>;

/** The product's request, re-aimed at the run's model for this site and shaped the way that model accepts. */
export function requestFor(params: Params, site: string, swap: Record<string, string>): { request: Params; spec: Spec | undefined } {
  const model = swap[site] ?? swap["*"] ?? params.model;
  const spec = MODELS[model];
  const request: Params = { ...params, model };
  for (const key of spec?.drop ?? []) delete request[key];
  Object.assign(request, spec?.set ?? {});
  return { request, spec };
}

const estimateTokens = (request: Params): number =>
  Math.ceil(JSON.stringify([request.system, request.messages, request.tools]).length / 2);

function fakeMessage(request: Params, tokensIn: number, answer: unknown = {}): Anthropic.Message {
  const tool = request.tools?.[0];
  return {
    id: "msg_eval_fake",
    type: "message",
    role: "assistant",
    model: request.model,
    content: [tool === undefined ? { type: "text", text: "{}", citations: null } : { type: "tool_use", id: "toolu_eval_fake", name: tool.name, input: answer }],
    stop_reason: tool === undefined ? "end_turn" : "tool_use",
    stop_sequence: null,
    usage: { input_tokens: tokensIn, output_tokens: request.max_tokens },
  } as unknown as Anthropic.Message;
}

async function evalCreate(client: Anthropic, send: (p: Params, o: unknown) => Promise<Anthropic.Message>, params: Params, options: unknown): Promise<Anthropic.Message> {
  const run = current();
  const site = SITE_OF_TOOL.get(params.tools?.[0]?.name ?? "") ?? "unknown";
  if (run.halted !== null) throw new EvalRefused(run.halted);
  const { request, spec } = requestFor(params, site, run.swap);
  let tokensIn = estimateTokens(request);
  if (run.mode === "live") {
    const countable: Record<string, unknown> = { ...request };
    delete countable.max_tokens;
    delete countable.temperature;
    tokensIn = await throughTransport(() => client.messages.countTokens(countable as never)).then((counted) => counted.input_tokens, () => tokensIn);
  }
  const reserved = spec === undefined ? null : priceCents(spec, tokensIn, request.max_tokens);
  if (run.mode === "plan") {
    run.plan.calls += 1;
    if (reserved === null) run.plan.unpriced += 1;
    else run.plan.cents += reserved;
    return fakeMessage(request, tokensIn, run.fakeAnswers?.[site]);
  }
  const ledger = run.ledger as Ledger;
  const held = ledger.reserve(request.model, site, reserved);
  if ("refused" in held) {
    run.halted = held.refused;
    throw new EvalRefused(held.refused);
  }
  const started = Date.now();
  const book = (cents: number, row: { tokensIn: number | null; tokensOut: number | null; stop: string | null; outcome: string }) => {
    ledger.settle({ id: held.id, model: request.model, site, cents, ms: Date.now() - started, ...row });
    if (run.mode === "live") appendSpend({ script: "eval-models", issue: "3028", source: `${site}:${request.model}`, cents });
  };
  let message: Anthropic.Message;
  try {
    if (run.mode === "fake") message = fakeMessage(request, tokensIn, run.fakeAnswers?.[site]);
    else {
      run.sends += 1;
      message = await throughTransport(() => send(request, options));
    }
  } catch (error) {
    const status = (error as { status?: unknown }).status;
    // A refused request is not billed; anything else may have been, so it keeps its reservation.
    const unbilled = typeof status === "number" && status >= 400 && status < 500;
    book(unbilled ? 0 : (reserved as number), { tokensIn: null, tokensOut: null, stop: null, outcome: typeof status === "number" ? `http_${status}` : String((error as Error).name) });
    throw error;
  }
  const { input_tokens, output_tokens } = message.usage;
  book(priceCents(spec as Spec, input_tokens, output_tokens) ?? (reserved as number), { tokensIn: input_tokens, tokensOut: output_tokens, stop: message.stop_reason, outcome: "answered" });
  return message;
}

export default class EvalAnthropic extends Anthropic {
  constructor(options?: ConstructorParameters<typeof Anthropic>[0]) {
    super(options);
    const send = this.messages.create.bind(this.messages) as unknown as (p: Params, o: unknown) => Promise<Anthropic.Message>;
    (this.messages as unknown as { create: unknown }).create = (params: Params, opts: unknown) => evalCreate(this, send, params, opts);
  }
}
