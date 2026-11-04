// The morning re-check over stored stopped drafts: each dogfood draft the rules stopped, and a panel page of a local
// service and of a seller, goes through `recheckRow` at 0¢ under today's rules, and what comes out is the golden. A
// changed rule or mend is a reviewed diff there. Every model call throws.
import "../env";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../../publish/harness";
import { opportunity } from "../fixtures";
import october from "../fixtures/dogfood-drafts-2026-10.min.json";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));
vi.mock("@/lib/llm", () => ({ llm: async () => Promise.reject(new Error("the re-check asks no model")) }));

import type { ContextPack } from "@/lib/generate/pipeline/pack";
import { repairable } from "@/lib/generate/pipeline/repair";
import { recheckRow, type RecheckFixes, type RecheckWorld } from "@/lib/generate/recheck";
import type { DraftRow } from "@/lib/generate/store";

const DOGFOOD = ["abe42ff7", "a6d24b00", "f1ec6a58"];
/** A local service and a seller, each with the template slots its H2s were laid out in. */
const PANEL: Record<string, string[]> = {
  "baeckerei-hinkel.de": ["what_it_is", "how_it_works", "options_and_limits", "example", "asked", "related"],
  "wesbos.com": ["what_you_need", "steps", "check", "mistakes", "asked", "asked", "next_step"],
};
const NOW = new Date("2026-11-05T08:00:00.000Z");

/** A stored dogfood row, and the site as its pack records it; each passage stands for the page it was read off. */
function dogfood(id: string): { row: DraftRow; world: RecheckWorld } {
  const row = { site_id: "s-dogfood", ...october.drafts.find((each) => each.id.startsWith(id))! } as unknown as DraftRow;
  const p = (row.meta as { pack: ContextPack }).pack;
  const facts = [row.grounded_fact as Row, ...(p.facts as unknown as Row[])].map((fact) => ({ fact: { ...fact, readAt: new Date(fact.readAt as string) }, sourceText: fact.passage as string }));
  const site = { businessName: p.business.name ?? null, domain: "reachkit.app", doNotClaim: [], rivals: p.business.rivals ?? [] };
  return { row, world: { site, facts, opportunity: opportunity({ type: "comparison_page", targetQuery: p.target.searches[0]!, pageType: null }), now: new Date(Date.parse(p.builtAt) + 86_400_000) } as unknown as RecheckWorld };
}

/** A panel page the pipeline wrote (`docs/walk/prose-gate/`), stored as a page the rules stopped after its fix call. */
function panel(domain: string): { row: DraftRow; world: RecheckWorld } {
  const stored = new URL(`../../../docs/walk/prose-gate/${domain}`, import.meta.url);
  const [heading, ...body] = readFileSync(`${stored.pathname}.md`, "utf8").trimEnd().split("\n");
  const p = JSON.parse(readFileSync(`${stored.pathname}.pack.json`, "utf8")) as ContextPack;
  const grounded = p.facts[0]!;
  const headings = body.flatMap((line) => (line.startsWith("## ") ? [line.slice(3)] : []));
  const sections = PANEL[domain]!.map((key, index) => ({ key, heading: headings[index] }));
  const row = {
    id: `panel-${domain}`,
    site_id: `s-${domain}`,
    state: "needs_attention",
    title: heading!.replace(/^#\s+/, ""),
    body_md: body.join("\n").trim(),
    hard_rule_attempts: 2,
    rule_failures: [],
    grounded_fact: grounded,
    meta: { pack: p, description: "", sections, faq: [], checks: { asked: ["fit_claim"], fixed: [] } },
    transitions: [{ from: "generating", to: "needs_attention", at: p.builtAt, reason: "rules:title" }],
  } as unknown as DraftRow;
  const rivals = [...new Set(p.claims.flatMap((claim) => (claim.product === undefined ? [] : [claim.product])))];
  const site = { businessName: p.business.name ?? null, domain, doNotClaim: [...p.neverClaim], rivals };
  const facts = p.facts.map((fact) => ({ fact: { ...fact, readAt: new Date(fact.readAt) }, sourceText: fact.passage }));
  return { row, world: { site, facts, opportunity: opportunity({ type: "keyword_page", targetQuery: p.target.question, pageType: null }), now: new Date(Date.parse(p.builtAt) + 86_400_000) } as unknown as RecheckWorld };
}

async function replay(name: string, { row, world }: { row: DraftRow; world: RecheckWorld }): Promise<string> {
  const p = (row.meta as { pack: ContextPack }).pack;
  const stopped = ((row.rule_failures ?? []) as { rule: string }[]).map((each) => each.rule);
  const outcome = await recheckRow(row, world);
  const head = [`## ${name}: ${p.type}, "${p.target.searches[0]}"`, "", `- Stopped on: ${stopped.join(", ") || "nothing recorded"}`];
  if (outcome.kind !== "checked") return [...head, `- Today: ${outcome.kind} (${"figures" in outcome ? `${outcome.reason} ${outcome.figures.join(", ")}` : outcome.reason})`, ""].join("\n");
  const fixes = ((outcome.patch.meta as { recheck?: RecheckFixes }).recheck ?? {}) as RecheckFixes;
  const rules = [...new Set(outcome.failed.map((failure) => failure.rule))];
  const mended = repairable(outcome.failed);
  const verdict = outcome.passed ? "passes" : rules.length === 1 && rules[0] === "fit_claim" ? "fails only on fit_claim" : `fails on ${rules.join(", ") || (outcome.close ? "elsewhere" : `fit ${outcome.fit}`)}`;
  return [
    ...head,
    `- Today: ${verdict}, ${outcome.spentCents}¢`,
    ...(fixes.title === undefined ? [] : [`- Title: "${fixes.titleBefore}" → "${fixes.title}"`]),
    ...outcome.failed.map((failure) => `- Fails ${failure.rule}: ${JSON.stringify({ ...failure.detail, rule: undefined })}${mended.includes(failure.rule) ? " (a 0¢ repair in code)" : ""}`),
    "",
  ].join("\n");
}

describe("the morning re-check over stored stopped drafts gives the stored outcome, at 0¢", () => {
  it("each row's outcome and failing rules", async () => {
    const rows = [...DOGFOOD.map((id) => [id, dogfood(id)] as const), ...Object.keys(PANEL).map((domain) => [domain, panel(domain)] as const)];
    const out = ["# Stopped drafts through the morning re-check", ""];
    for (const [name, each] of rows) out.push(await replay(name, each));
    await expect(out.join("\n")).toMatchFileSnapshot("../../golden/recheck/stopped.md");
  });
});
