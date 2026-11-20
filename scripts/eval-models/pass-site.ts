// The derive group: one stored pass replayed (`npm run pass -- --replay`) with only the named call sites missing the
// store, so each goes to the candidate model through the eval transport. Every other model and vendor row is served
// as stored and any other miss is refused, so the rest of the pass is the stored pass. Scored against the stored answer.
import { appendFileSync, chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadCaseFile } from "./cases";
import { isolate } from "./isolate";
import { Ledger } from "./ledger";
import { configure, type Mode, type Run } from "./transport";

export interface PassEval {
  scan: string;
  sites: readonly string[];
  model: string | null;
  mode: Mode;
  ledgerFile: string;
  capCents: number;
  results: string;
  /** The replay's own database origin, the one host besides Anthropic the run may reach. */
  local: string;
}

interface Call {
  site: string;
  key: string;
  faithful: "faithful" | "rebuilt";
  stored: unknown;
  answers: { value: unknown; stop: string | null }[];
}

/** An exported pass (E3, through the shared loader) staged where the replay reads its snapshots: a private folder under
 *  `under`, outside the repository, holding the one pass `scan` names. Returns the folder. */
export function stagePassCase(file: string, scan: string, repoRoot: string, under: string): string {
  const pass = loadCaseFile(file, repoRoot).find((doc) => String((doc as { scan?: { id?: unknown } }).scan?.id ?? "").startsWith(scan));
  if (pass === undefined) throw new Error(`${file} holds no pass ${scan}.`);
  mkdirSync(under, { recursive: true, mode: 0o700 });
  const dir = mkdtempSync(path.join(under, "pass-"));
  chmodSync(dir, 0o700);
  writeFileSync(path.join(dir, `${scan.slice(0, 8)}.json`), JSON.stringify(pass), { mode: 0o600 });
  return dir;
}

const STATE = Symbol.for("reachkit.eval-models.pass");
type State = { e: PassEval; run: Run; calls: Call[] };
const state = (): State | undefined => (globalThis as Record<symbol, State | undefined>)[STATE];

export function startPassEval(e: PassEval): void {
  const s: State = {
    e,
    calls: [],
    run: {
      mode: e.mode,
      ledger: e.mode === "plan" ? null : new Ledger(e.ledgerFile, e.capCents, e.mode === "live"),
      swap: e.model === null ? {} : Object.fromEntries(e.sites.map((site) => [site, e.model as string])),
      sends: 0,
      plan: { calls: 0, cents: 0, unpriced: 0 },
      halted: null,
      fakeAnswers: {},
      only: new Set(e.sites),
      onAnswer: (site, value, stop) => [...s.calls].reverse().find((call) => call.site === site)?.answers.push({ value, stop }),
    },
  };
  (globalThis as Record<symbol, State>)[STATE] = s;
  configure(s.run);
  isolate(e.mode === "live", e.local);
}

/** The replay's store lookup, asked first: an evaluated site always misses, so its call goes to the model. Fake and
 *  plan runs answer it with the stored answer, which makes their agreement 1 and the rest of the pass unchanged. */
export function evalMiss(source: string, key: string, stored: readonly { source: string; cache_key: string; payload: unknown }[]): boolean {
  const s = state();
  if (s === undefined || !s.e.sites.includes(source)) return false;
  const same = stored.filter((row) => row.source === source);
  const exact = same.find((row) => row.cache_key === key);
  const value = ((exact ?? (same.length === 1 ? same[0] : undefined))?.payload as { value?: unknown } | undefined)?.value;
  s.calls.push({ site: source, key, faithful: exact === undefined ? "rebuilt" : "faithful", stored: value ?? null, answers: [] });
  (s.run.fakeAnswers as Record<string, unknown>)[source] = value ?? {};
  return true;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const norm = (v: unknown): unknown => (typeof v === "string" ? v.trim().toLowerCase() : v);

/** Item agreement, 0 to 1: equal leaves; a list of plain values as a set (Jaccard); a list of objects item by item;
 *  an object as the mean over every field either side has. */
export function agreement(a: unknown, b: unknown): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === 0 && b.length === 0) return 1;
    if ([...a, ...b].every((v) => !isObject(v) && !Array.isArray(v))) {
      const x = new Set(a.map((v) => JSON.stringify(norm(v))));
      const y = new Set(b.map((v) => JSON.stringify(norm(v))));
      return [...x].filter((v) => y.has(v)).length / new Set([...x, ...y]).size;
    }
    return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (i < a.length && i < b.length ? agreement(a[i], b[i]) : 0)).reduce((t, v) => t + v, 0) / Math.max(a.length, b.length);
  }
  if (isObject(a) && isObject(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.length === 0 ? 1 : keys.reduce((t, k) => t + agreement(a[k], b[k]), 0) / keys.length;
  }
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b)) ? 1 : 0;
}

/** One scored line per evaluated call, and the run's money; `exit` is the replay's own acceptance result. Written to
 *  stdout directly, since the replay silences `console.log`. */
export function finishPassEval(exit: number): void {
  const say = (line: object) => process.stdout.write(`${JSON.stringify(line)}\n`);
  const s = state();
  if (s === undefined) return;
  const { e, run } = s;
  if (e.mode !== "plan") mkdirSync(path.dirname(e.results), { recursive: true });
  for (const call of s.calls) {
    const last = call.answers.at(-1);
    const line = {
      scan: e.scan.slice(0, 8),
      site: call.site,
      model: e.model ?? "today",
      key: call.key.slice(0, 12),
      faithful: call.faithful,
      attempts: call.answers.length,
      stop: last?.stop ?? null,
      agreement: call.stored === null || last === undefined || last.value === null ? "not measured" : Math.round(agreement(last.value, call.stored) * 1000) / 1000,
    };
    say(line);
    if (e.mode !== "plan") appendFileSync(e.results, `${JSON.stringify({ at: new Date().toISOString(), mode: e.mode, ...line })}\n`);
  }
  say({ eval: e.mode, scan: e.scan.slice(0, 8), sites: e.sites, model: e.model ?? "today", calls: s.calls.length, sends: run.sends, plan: e.mode === "plan" ? run.plan : undefined, spentCents: run.ledger?.spent() ?? null, halted: run.halted, acceptance: exit === 0 ? "holds" : "fails" });
}
