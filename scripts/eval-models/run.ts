// The harness's own checks and its drivers: a probe call per repeat through the product's `llm()`, the writer group
// over a folder of cases, and the isolation proof. Each run shares one ledger and one transport.
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { llm, type LlmCallSite } from "@/lib/llm";
import type { Tier } from "@/lib/llm/tiers";
import { passThrough } from "./context";
import { blocked, EvalIsolation, isolate, socketsOpened } from "./isolate";
import { HARD_CAP_CENTS, Ledger } from "./ledger";
import { rescorePass } from "./pass-site";
import { report } from "./report";
import { configure, type Mode, type Run } from "./transport";
import { fetchSet, runResearch } from "./research";
import { runSetup } from "./setup";
import { readCases, runWriter } from "./writer";

export interface Options {
  mode: Mode | "report" | "prove-isolation" | "rescore" | "fetch";
  ledgerFile: string;
  capCents: number;
  site: LlmCallSite;
  tier: Tier;
  model: string | null;
  repeat: number;
  driver: "probe" | "writer" | "setup" | "research";
  /** The writer's case folder, and the file its scored lines are appended to; both outside the repository. */
  cases: string;
  results: string;
  /** Where every answer is kept (the writer's and the probe's), or with `--rescore` the kept file to score again. */
  answers: string;
  root: string;
}

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
  // An IP literal with no lookup: only the socket wall stands in its way (a documentation address, never reached).
  const ipLiteral = await import("node:https").then(
    (https) =>
      new Promise<string>((resolve) => {
        try {
          const request = https.request({ host: "192.0.2.1", headers: { host: "api.dataforseo.com" }, path: "/v3/appendix/user_data" });
          request.on("error", (e) => resolve(e.name));
          request.end(() => resolve("sent"));
        } catch (e) {
          resolve((e as Error).name);
        }
      })
  );
  const dnsBlocked = await import("node:dns").then((dns) => dns.promises.lookup("api.dataforseo.com").then(() => "resolved", (e: Error) => e.name));
  console.log(JSON.stringify({ readAccount: reading, directFetch: direct, dnsLookup: dnsBlocked, ipLiteral, blocked, socketsOpened: socketsOpened() }));
  return reading === null && direct === "EvalIsolation" && dnsBlocked === "EvalIsolation" && ipLiteral === "EvalIsolation" && socketsOpened() === 0 ? 0 : 1;
}

const WRITER_SITES = ["generate.write", "generate.write_free", "generate.fix"];

export async function main(o: Options): Promise<number> {
  if (o.mode === "report") return console.log(report(o.ledgerFile)), 0;
  if (o.mode === "prove-isolation") return proveIsolation();
  if (o.mode === "rescore") return rescorePass(o.answers), 0;
  // The research set's one polite read of public pages: no model call, no key, no ledger.
  if (o.mode === "fetch") return fetchSet();
  isolate(o.mode === "live");
  const run: Run = {
    mode: o.mode,
    ledger: o.mode === "plan" ? null : new Ledger(o.ledgerFile, o.capCents, o.mode === "live"),
    // The writer's model writes and fixes the page; the claim check stays on today's model.
    swap: o.model === null ? {} : o.driver === "writer" ? Object.fromEntries(WRITER_SITES.map((site) => [site, o.model as string])) : { [o.site]: o.model },
    sends: 0,
    plan: { calls: 0, cents: 0, unpriced: 0 },
    halted: null,
    answers: o.mode === "plan" ? undefined : o.answers,
  };
  configure(run);
  const outcomes: string[] = [];
  const emit = (line: object, outcome: string) => {
    outcomes.push(outcome);
    console.log(JSON.stringify(line));
    if (o.mode !== "plan") appendFileSync(o.results, `${JSON.stringify({ at: new Date().toISOString(), mode: o.mode, ...line })}\n`);
  };
  if (o.driver !== "probe") mkdirSync(path.dirname(o.results), { recursive: true });
  if (o.driver === "writer") await runWriter(run, readCases(o.cases, o.root), o.repeat, (line) => emit(line, (line as { outcome: string }).outcome));
  if (o.driver === "research") await runResearch(run, o.model, o.repeat, (line) => emit(line, (line as { parsed: boolean }).parsed ? "answered" : "unparsed"));
  if (o.driver === "setup") await runSetup(run, o.root, o.model, o.repeat, (line) => emit(line, (line as { answered: boolean }).answered ? "answered" : "unmeasured"));
  for (let i = 0; o.driver === "probe" && i < o.repeat && run.halted === null; i++) {
    const answer = await llm(passThrough(), { site: o.site, tier: o.tier, schema: z.object({ ok: z.boolean() }), input: { probe: "eval harness self-check", i } });
    outcomes.push(answer.kind === "unmeasured" ? answer.reason : answer.kind);
  }
  const spent = run.ledger?.spent() ?? null;
  console.log(JSON.stringify({ mode: o.mode, driver: o.driver, site: o.site, outcomes, sends: run.sends, plan: o.mode === "plan" ? run.plan : undefined, ledger: run.ledger?.file, spentCents: spent, limitCents: run.ledger?.limitCents ?? HARD_CAP_CENTS, halted: run.halted }));
  return 0;
}
