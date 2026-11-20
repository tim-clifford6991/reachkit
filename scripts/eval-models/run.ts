// The harness's own checks, through the product's `llm()`: a probe call per repeat, and the isolation proof.
// The drivers that replay stored cases call `configure()` the same way and reuse the ledger and transport.
import { z } from "zod";
import type { CostContext } from "@/lib/costs";
import { llm, type LlmCallSite } from "@/lib/llm";
import type { Tier } from "@/lib/llm/tiers";
import { blocked, EvalIsolation, isolate, socketsOpened } from "./isolate";
import { HARD_CAP_CENTS, Ledger } from "./ledger";
import { report } from "./report";
import { configure, type Mode, type Run } from "./transport";

export interface Options {
  mode: Mode | "report" | "prove-isolation";
  ledgerFile: string;
  capCents: number;
  site: LlmCallSite;
  tier: Tier;
  model: string | null;
  repeat: number;
}

/** Production's cap stays out of the run: the eval ledger is the only ceiling, and nothing is written to a table. */
const passThrough: CostContext = {
  cap: "DRAFT",
  async recordFetch(call) {
    const payload = await call.run();
    return { payload, fresh: true, costCents: call.settleCents?.(payload) ?? call.costCents, storedAt: null };
  },
} as CostContext;

async function proveIsolation(): Promise<number> {
  isolate(false);
  const { readAccount } = await import("@/lib/vendors/dataforseo/account");
  const reading = await readAccount();
  let direct = "answered";
  try {
    await fetch("https://api.dataforseo.com/v3/appendix/user_data");
  } catch (error) {
    direct = error instanceof EvalIsolation ? "EvalIsolation" : String((error as Error).name);
  }
  const dnsBlocked = await import("node:dns").then((dns) => dns.promises.lookup("api.dataforseo.com").then(() => "resolved", (e: Error) => e.name));
  console.log(JSON.stringify({ readAccount: reading, directFetch: direct, dnsLookup: dnsBlocked, blocked, socketsOpened: socketsOpened() }));
  return reading === null && direct === "EvalIsolation" && dnsBlocked === "EvalIsolation" && socketsOpened() === 0 ? 0 : 1;
}

export async function main(o: Options): Promise<number> {
  if (o.mode === "report") return console.log(report(o.ledgerFile)), 0;
  if (o.mode === "prove-isolation") return proveIsolation();
  isolate(o.mode === "live");
  const run: Run = {
    mode: o.mode,
    ledger: o.mode === "plan" ? null : new Ledger(o.ledgerFile, o.capCents, o.mode === "live"),
    swap: o.model === null ? {} : { [o.site]: o.model },
    sends: 0,
    plan: { calls: 0, cents: 0, unpriced: 0 },
    halted: null,
  };
  configure(run);
  const outcomes: string[] = [];
  for (let i = 0; i < o.repeat && run.halted === null; i++) {
    const answer = await llm(passThrough, { site: o.site, tier: o.tier, schema: z.object({ ok: z.boolean() }), input: { probe: "eval harness self-check", i } });
    outcomes.push(answer.kind === "unmeasured" ? answer.reason : answer.kind);
  }
  const spent = run.ledger?.spent() ?? null;
  console.log(JSON.stringify({ mode: o.mode, site: o.site, outcomes, sends: run.sends, plan: o.mode === "plan" ? run.plan : undefined, ledger: run.ledger?.file, spentCents: spent, limitCents: run.ledger?.limitCents ?? HARD_CAP_CENTS, halted: run.halted }));
  return 0;
}
