// The morning re-check over stored stopped drafts: each dogfood draft the rules stopped, and a panel page of a local
// service and of a seller, goes through `recheckRow` at 0¢ under today's rules, and what comes out is the golden. A
// changed rule or mend is a reviewed diff there. Every model call throws.
import "../env";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { fakeDb } from "../../publish/harness";
import { opportunity } from "../fixtures";
import october from "../fixtures/dogfood-drafts-2026-10.min.json";
import ecf4f99d from "../fixtures/q4-ecf4f99d-2026-11.json";
import f0f95686d from "../fixtures/q4-0f95686d-2026-11.json";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/llm", () => ({ llm: async () => Promise.reject(new Error("the re-check asks no model")) }));

import type { ContextPack } from "@/lib/generate/pipeline/pack";
import { repairable } from "@/lib/generate/pipeline/repair";
import { recheckRow, type RecheckFixes, type RecheckWorld } from "@/lib/generate/recheck";
import { specificOnly } from "@/lib/generate/rules/title";
import type { RuleFailure } from "@/lib/generate/rules/types";
import type { DraftRow } from "@/lib/generate/store";

type Fact = { passage: string; url: string; readAt: string };
/** A local service and a seller, each with the template slots its H2s were laid out in. */
const PANEL: Record<string, string[]> = {
  "baeckerei-hinkel.de": ["what_it_is", "how_it_works", "options_and_limits", "example", "asked", "related"],
  "wesbos.com": ["what_you_need", "steps", "check", "mistakes", "asked", "asked", "next_step"],
};

/** The site as the row's pack records it, a day after the pack was built; each passage stands for its page. */
function replayed(row: DraftRow, site: Omit<RecheckWorld["site"], "businessName">, facts: readonly Fact[], type: "comparison_page" | "keyword_page"): [DraftRow, RecheckWorld] {
  const p = (row.meta as { pack: ContextPack }).pack;
  const world = { site: { businessName: p.business.name ?? null, ...site }, facts: facts.map((fact) => ({ fact: { ...fact, readAt: new Date(fact.readAt) }, sourceText: fact.passage })), opportunity: opportunity({ type, targetQuery: p.target.searches[0]!, pageType: null }), now: new Date(Date.parse(p.builtAt) + 86_400_000) };
  return [row, world as unknown as RecheckWorld];
}

// The 11-04 export holds no state or moves: each is stopped as `rest()` stops it.
const STORED: { id: string }[] = [...october.drafts, ...[ecf4f99d, f0f95686d].map((row) => ({ state: "needs_attention", transitions: [{ from: "generating", to: "needs_attention", at: row.meta.pack.builtAt, reason: `rules:${row.rule_failures.map((each) => each.rule).join(",")}` }], ...row }))];

function dogfood(id: string): [DraftRow, RecheckWorld] {
  const row = { site_id: "s-dogfood", ...STORED.find((each) => each.id.startsWith(id))! } as unknown as DraftRow;
  const p = (row.meta as { pack: ContextPack }).pack;
  return replayed(row, { domain: "reachkit.app", doNotClaim: [], rivals: p.business.rivals ?? [] }, [row.grounded_fact as Fact, ...p.facts], "comparison_page");
}

/** A panel page the pipeline wrote (`docs/walk/prose-gate/`), stored as a page the rules stopped after its fix call. */
function panel(domain: string): [DraftRow, RecheckWorld] {
  const stored = new URL(`../../../docs/walk/prose-gate/${domain}`, import.meta.url).pathname;
  const [heading, ...body] = readFileSync(`${stored}.md`, "utf8").trimEnd().split("\n");
  const p = JSON.parse(readFileSync(`${stored}.pack.json`, "utf8")) as ContextPack;
  const headings = body.flatMap((line) => (line.startsWith("## ") ? [line.slice(3)] : []));
  const meta = { pack: p, description: "", sections: PANEL[domain]!.map((key, index) => ({ key, heading: headings[index] })), faq: [], checks: { asked: ["fit_claim"], fixed: [] } };
  const transitions = [{ from: "generating", to: "needs_attention", at: p.builtAt, reason: "rules:title" }];
  const row = { id: `panel-${domain}`, site_id: `s-${domain}`, state: "needs_attention", title: heading!.replace(/^#\s+/, ""), body_md: body.join("\n").trim(), hard_rule_attempts: 2, rule_failures: [], grounded_fact: p.facts[0], meta, transitions } as unknown as DraftRow;
  const rivals = [...new Set(p.claims.flatMap((claim) => (claim.product === undefined ? [] : [claim.product])))];
  return replayed(row, { domain, doNotClaim: [...p.neverClaim], rivals }, p.facts, "keyword_page");
}

async function replay(name: string, [row, world]: [DraftRow, RecheckWorld]): Promise<string> {
  const p = (row.meta as { pack: ContextPack }).pack;
  const stopped = ((row.rule_failures ?? []) as { rule: string }[]).map((each) => each.rule);
  const outcome = await recheckRow(row, world);
  const head = [`## ${name}: ${p.type}, "${p.target.searches[0]}"`, "", `- Stopped on: ${stopped.join(", ") || "nothing recorded"}`];
  if (outcome.kind !== "checked") return [...head, `- Today: ${outcome.kind} (${"figures" in outcome ? `${outcome.reason} ${outcome.figures.join(", ")}` : outcome.reason})`, ""].join("\n");
  const fixes = ((outcome.patch.meta as { recheck?: RecheckFixes }).recheck ?? {}) as RecheckFixes;
  const rules = [...new Set(outcome.failed.map((failure) => failure.rule))];
  const verdict = outcome.passed ? "passes" : rules.length === 1 && rules[0] === "fit_claim" ? "fails only on fit_claim" : `fails on ${rules.join(", ") || (outcome.close ? "elsewhere" : `fit ${outcome.fit}`)}`;
  const mended = repairable(outcome.failed);
  // A title short only of its specific goes on once nothing else fails (ruling 2026-10-11, `lacksSpecificOnly`).
  const unmet = (failure: RuleFailure) => failure.detail?.rule === "title" && "faults" in failure.detail && specificOnly(failure.detail.faults);
  const fails = outcome.failed.map((failure) => `- Fails ${failure.rule}: ${JSON.stringify({ ...failure.detail, rule: undefined })}${mended.includes(failure.rule) ? " (a 0¢ repair in code)" : unmet(failure) ? " (goes on at 0¢ once it is the only failure)" : ""}`);
  return [...head, `- Today: ${verdict}, ${outcome.spentCents}¢`, ...(fixes.title === undefined ? [] : [`- Title: "${fixes.titleBefore}" → "${fixes.title}"`]), ...fails, ""].join("\n");
}

it("the morning re-check over stored stopped drafts gives each row's stored outcome and failing rules, at 0¢", async () => {
  const rows = [...["abe42ff7", "a6d24b00", "f1ec6a58", "ecf4f99d", "0f95686d"].map((id) => [id, dogfood(id)] as const), ...Object.keys(PANEL).map((domain) => [domain, panel(domain)] as const)];
  const out = ["# Stopped drafts through the morning re-check", ""];
  for (const [name, each] of rows) out.push(await replay(name, each));
  await expect(out.join("\n")).toMatchFileSnapshot("../../golden/recheck/stopped.md");
});


it("0f95686d with its fit_claim sentences dropped, as #2375 drops them, passes at 0¢ on the floor title, its want of a specific let go", async () => {
  const [row, world] = dogfood("0f95686d");
  const fit = (row.rule_failures as { rule: string; detail: { sentences?: string[] } }[]).find((each) => each.rule === "fit_claim")!.detail.sentences!;
  expect(fit.every((sentence) => row.body_md!.includes(sentence))).toBe(true);
  const outcome = await recheckRow({ ...row, body_md: fit.reduce((body, sentence) => body.replace(sentence, ""), row.body_md!) }, world);
  expect(outcome).toMatchObject({ kind: "checked", passed: true, failed: [], spentCents: 0, patch: { title: "Best AI search visibility tools (2026)" } });
});
