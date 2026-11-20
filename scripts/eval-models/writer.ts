// The writer group: each case through the product's own `generateDraft` (write, checks, fix, claim check) against the
// page script's in-memory store, scored only by what the product recorded on the row. No model judges another.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { generateDraft, type GenerateInputs, type GenerateOutcome } from "@/lib/generate/pipeline";
import { readRecordedRules } from "@/lib/generate/record";
import { HARD_RULES } from "@/lib/generate/rules/types";
import { setGenerateStore } from "@/lib/generate/store";
import { servePages } from "../page/measured-text";
import { memoryStore, type PageSnapshot } from "../page/run";
import { loadCaseFile } from "./cases";
import { passThrough, type Seen } from "./context";
import type { Run } from "./transport";

/** One case file: the inputs the product would hand `generateDraft`, as JSON; the stored write call's cache key
 *  where the case was exported with one; and, for fake runs only, each call site's canned answer. */
export interface WriterCase {
  id: string;
  origin: string;
  inputs: GenerateInputs;
  written?: { title: string; url: string; markdown: string }[];
  /** The site's own page text as the latest scan read it. */
  ownText?: { url: string; text: string; readAt: string }[];
  stored?: { writeKey?: string };
  fake?: Record<string, unknown>;
}

/** The dates JSON turned to text, back to dates where the pipeline reads them as dates. */
function revive(inputs: GenerateInputs): GenerateInputs {
  const o = inputs.opportunity as GenerateInputs["opportunity"] & { restUntil?: unknown };
  const date = (value: unknown) => new Date(value as string);
  return {
    ...inputs,
    opportunity: { ...o, createdAt: date(o.createdAt), volume: o.volume === null ? null : ({ ...o.volume, at: date(o.volume.at) } as typeof o.volume), ...(o.restUntil == null ? {} : { restUntil: date(o.restUntil) }) },
    facts: inputs.facts.map((each) => ({ ...each, fact: { ...each.fact, readAt: date(each.fact.readAt) } })),
    links: inputs.links.map((link) => ("publishedAt" in link && link.publishedAt !== undefined ? { ...link, publishedAt: date(link.publishedAt) } : link)),
  };
}

/** Every case in the folder, each file through the shared loader, which refuses it whole on any one rule. */
export function readCases(dir: string, repoRoot: string): WriterCase[] {
  if (!existsSync(dir)) throw new Error(`No writer cases at ${dir}.`);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json") || name.endsWith(".csv"))
    .sort()
    .flatMap((name) => loadCaseFile(path.join(dir, name), repoRoot) as WriterCase[]);
}

const outcomeOf = (o: GenerateOutcome): string => (o.ok ? "ok" : o.reason === "rules" ? "rules" : `step_failed:${o.step}`);

/** One page per case and repeat, each scored as one JSON line. */
export async function runWriter(run: Run, cases: readonly WriterCase[], repeat: number, emit: (line: object) => void): Promise<void> {
  for (const each of cases) {
    for (let r = 1; r <= repeat && run.halted === null; r++) {
      const seen: Seen[] = [];
      const snapshot = { domain: each.inputs.site.domain, pages: [], written: each.written ?? [] } as unknown as PageSnapshot;
      const store = memoryStore(snapshot, null as never);
      setGenerateStore(store);
      servePages({ siteId: each.inputs.siteId, domain: each.inputs.site.domain, pages: (each.ownText ?? []).map((page) => ({ url: page.url, text: page.text, measuredAt: new Date(page.readAt) })) });
      run.fakeAnswers = each.fake ?? {};
      const sendsBefore = run.sends;
      try {
        const outcome = await generateDraft(passThrough(seen), { ...revive(each.inputs), startedAt: Date.now() });
        const row = outcome.draftId === null ? null : await store.draftById(outcome.draftId);
        const failed = readRecordedRules(row?.rule_failures ?? null) ?? [];
        const meta = row?.meta as { standard?: { parts: unknown; met: boolean }; length?: { words: number } } | null;
        const standard = meta?.standard ?? null;
        const writeKey = seen.find((call) => call.source.startsWith("generate.write"))?.cacheKey ?? null;
        emit({
          case: each.id,
          origin: each.origin,
          repeat: r,
          model: run.swap["generate.write"] ?? run.swap["*"] ?? "today",
          // A page the ledger cut short is the ledger's refusal, never the model's failure.
          outcome: run.halted === null ? outcomeOf(outcome) : `refused:${run.halted}`,
          standard: standard === null ? "not measured" : { met: standard.met, parts: standard.parts },
          words: meta?.length?.words ?? "not measured",
          hardFailures: failed.filter((f) => (HARD_RULES as readonly string[]).includes(f.rule)).map((f) => f.rule),
          styleFailures: failed.filter((f) => !(HARD_RULES as readonly string[]).includes(f.rule)).map((f) => f.rule),
          fixUsed: seen.some((call) => call.source === "generate.fix"),
          calls: seen.map((call) => call.source),
          sends: run.sends - sendsBefore,
          faithful: each.stored?.writeKey === undefined || writeKey === null ? "rebuilt" : writeKey === each.stored.writeKey ? "faithful" : "rebuilt",
          writeKey,
        });
      } finally {
        setGenerateStore(null);
        servePages(null);
      }
    }
  }
}
