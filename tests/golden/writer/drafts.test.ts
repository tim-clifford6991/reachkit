// The writer's stage 4 over stored drafts: each customer-panel page the
// pipeline wrote (`docs/walk/prose-gate/<site>.md`, with the pack it was
// written from) is run through the hard rules, the repair code makes and the
// notes the fix call would be told, and what comes out is the golden beside
// this file. A changed rule is a reviewed diff here. 0¢: the cost context
// refuses every vendor, and no fit check is asked.
import "../../generate/env";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ContentType } from "@/lib/opportunities/content-type";
import { builtFromOutside, packStatements, type ContextPack } from "@/lib/generate/pipeline/pack";
import { fixNotes, repairable, repairMechanical } from "@/lib/generate/pipeline/repair";
import { runHardRules, type BatteryOutcome } from "@/lib/generate/rules";
import { renderOf } from "@/lib/generate/rules/text";
import { TEMPLATES } from "@/lib/generate/templates";
import { pageTypeOf } from "@/lib/opportunities/page-type";
import type { OpportunityType } from "@/lib/opportunities/types";
import { fakeCost } from "../../generate/fixtures";

const STORED = new URL("../../../docs/walk/prose-gate/", import.meta.url);

/** SaaS, an agency, a consumer app, and three local businesses (one German). */
const SITES = ["savvycal.com", "clearleft.com", "streaksapp.com", "wesbos.com", "zunicafe.com", "alexander.co.uk", "baeckerei-hinkel.de"];

/** The row a page of each type is written for (`scripts/page/run.ts`). */
const ROW_TYPE: Partial<Record<ContentType, OpportunityType>> = {
  qa: "answer_page",
  how_to: "keyword_page",
  documentation: "keyword_page",
};

/** The pipeline's own count: the most outside sources the template asks. */
const citesMin = (type: ContentType): number =>
  TEMPLATES[type].packMustHold.reduce((most, need) => (need.need === "outside_sources" ? Math.max(most, need.min) : most), 0);

const detail = (outcome: BatteryOutcome, rule: string): string => {
  const failure = outcome.passed ? undefined : outcome.failed.find((f) => f.rule === rule);
  return failure === undefined ? "passed" : `failed ${JSON.stringify({ ...failure.detail, rule: undefined })}`;
};

async function stage4(domain: string): Promise<string> {
  const [heading, ...body] = readFileSync(new URL(`${domain}.md`, STORED), "utf8").trimEnd().split("\n");
  const pack = JSON.parse(readFileSync(new URL(`${domain}.pack.json`, STORED), "utf8")) as ContextPack;
  const title = heading!.replace(/^#\s+/, "");
  const markdown = body.join("\n").trim();
  const site = {
    businessName: pack.business.name ?? null,
    domain,
    doNotClaim: [...pack.neverClaim],
    rivals: [...new Set(pack.claims.flatMap((claim) => (claim.product === undefined ? [] : [claim.product])))],
  };
  const brief = {
    facts: [...pack.facts.map((fact) => fact.passage), ...packStatements(pack)],
    queries: pack.target.searches,
    marketFacts: pack.claims.map((claim) => ({ url: claim.url, passage: claim.passage, kind: claim.kind })),
  };
  const grounded = pack.facts[0]!;
  const battery = (text: string) =>
    runHardRules(fakeCost(), {
      fit: { state: "passed" },
      markdown: text,
      title,
      rendered: renderOf(text),
      pageType: pageTypeOf({ type: ROW_TYPE[pack.type] ?? "keyword_page", targetQuery: pack.target.question }),
      site,
      comparison: { published: [], measured: [], queued: [] },
      grounded: { url: grounded.url, readAt: new Date(grounded.readAt), passage: grounded.passage },
      sourceText: grounded.passage,
      brief,
      factPages: pack.facts.map((fact) => fact.url),
      distinctHeadings: pack.type === "qa",
      // A pack written before outside sources were asked holds none to cite.
      ...(builtFromOutside(pack.type) && pack.claims.length > 0 ? { cites: { claimUrls: pack.claims.map((claim) => claim.url), min: citesMin(pack.type) } } : {}),
      prose: {
        language: pack.locale?.language ?? "en",
        passages: [...pack.facts.map((fact) => fact.passage), ...pack.claims.map((claim) => claim.passage)],
        subjects: [...pack.target.searches, site.businessName ?? "", ...pack.links.map((link) => link.label)].filter((s) => s !== ""),
      },
    });

  const written = await battery(markdown);
  const tried = written.passed ? [] : repairable(written.failed);
  const repaired = tried.length === 0 ? markdown : repairMechanical(markdown, tried, { brief, sources: pack.facts.map((fact) => ({ url: fact.url, text: fact.passage })), rivals: site.rivals });
  const after = repaired === markdown ? null : await battery(repaired);
  const last = after ?? written;
  const notes = last.passed ? [] : fixNotes(repaired, last.failed, brief, site, title);

  return [
    `# ${domain}: ${pack.type}, "${pack.target.question}"`,
    "",
    "| Rule | As written | After the code repair |",
    "|---|---|---|",
    ...written.asked.map((rule) => `| ${rule} | ${detail(written, rule)} | ${after === null ? "—" : detail(after, rule)} |`),
    "",
    "## What the fix call is told",
    "",
    ...(notes.length === 0 ? ["Nothing: the page passes."] : notes.map((note) => `- ${note.rule}: ${note.sentences.join(" / ")}`)),
    "",
  ].join("\n");
}

describe("the writer's checks over stored panel drafts give the stored outcome", () => {
  for (const domain of SITES) {
    it(domain, async () => {
      await expect(await stage4(domain)).toMatchFileSnapshot(`./${domain}.md`);
    });
  }
});
