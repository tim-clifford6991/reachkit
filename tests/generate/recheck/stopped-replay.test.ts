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
  const fails = outcome.failed.map((failure) => `- Fails ${failure.rule}: ${JSON.stringify({ ...failure.detail, rule: undefined })}${mended.includes(failure.rule) ? " (a 0¢ repair in code)" : ""}`);
  // Issue 2375: what the mend dropped, and whether a rule catches a price linked to the site's own page.
  const dropped = (fixes.sentenceDropped ?? []).map((sentence) => `- Dropped: "${sentence}"`);
  const body = String(outcome.patch.body_md ?? "");
  const read = (url: string) => world.facts.filter((sourced) => sourced.fact.url === url).map((sourced) => sourced.fact.passage).join(" ");
  const unread = [...body.matchAll(/\[[$€£]\s?(\d[\d.,]*)[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)].filter((link) => new URL(link[2]!).hostname.replace(/^www\./, "") === world.site.domain && !read(link[2]!).includes(link[1]!));
  const priced = [...new Set(unread.map((link) => link[0]))].map((link) => {
    const url = unread.find((each) => each[0] === link)![2]!;
    const caught = outcome.failed.filter((failure) => JSON.stringify(failure.detail ?? {}).includes(url)).map((failure) => failure.rule);
    return `- A price linked to the site's own page, which no passage read there states, ${link}: ${caught.length === 0 ? "caught by no rule" : `caught by ${caught.join(", ")}`}`;
  });
  return [...head, `- Today: ${verdict}, ${outcome.spentCents}¢`, ...(fixes.title === undefined ? [] : [`- Title: "${fixes.titleBefore}" → "${fixes.title}"`]), ...dropped, ...fails, ...priced, ""].join("\n");
}

it("the morning re-check over stored stopped drafts gives each row's stored outcome and failing rules, at 0¢", async () => {
  const rows = [...["abe42ff7", "a6d24b00", "f1ec6a58", "ecf4f99d", "0f95686d"].map((id) => [id, dogfood(id)] as const), ...Object.keys(PANEL).map((domain) => [domain, panel(domain)] as const)];
  const out = ["# Stopped drafts through the morning re-check", ""];
  for (const [name, each] of rows) out.push(await replay(name, each));
  await expect(out.join("\n")).toMatchFileSnapshot("../../golden/recheck/stopped.md");
});
