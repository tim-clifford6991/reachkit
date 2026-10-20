// SPEC §2 · §8 (issue 787) — the lead's first page, written.
//
// The draft writer port's real implementation. A lead has no site, so §8's
// `generateDraft` — which writes a `drafts` row and compares against a
// site's published set — cannot be called for one. This runs the same stages
// (SPEC §7, D41) and holds no rule of its own: the context pack is built from
// the domain's own measured passages and its stored report, the page is one
// write call laid out in code, and the whole stage-4 battery reads it.
//
// **A lead's pack is its own pages and its report.** It has no knowledge
// base, no founder's answers and no account, and no research is read for it:
// `CAPS.FREE_C` holds one write call and nothing beside it. A pack short of
// what its type's template asks writes no page, as on a paid site.
//
// **The FREE cap.** One cost context per page, `CAPS.FREE_C`, ledgered
// against the scan that offered the page and rolled up nowhere — spent only
// on an identified lead (`giveaway.ts`). There is no fix call: one call per
// report, ever (issue 826).
//
// **Nothing is stored here.** The page travels back to `deliverFirstPage`,
// which stores it on the scan so every lead on the report is mailed the same
// page, and a retry re-sends it and never re-writes.
import { BATTERY, PACK } from "@/lib/config/constants";
import { withCostContext } from "@/lib/costs";
import { DRAFT_POLICY_VERSION } from "@/lib/generate/cost";
import { bodyWords, lengthRangeFor } from "@/lib/generate/length";
import { packStatements, targetSearches } from "@/lib/generate/pipeline";
import { layoutPage, withClosing } from "@/lib/generate/pipeline/compose";
import { sitePassages, type SourcedFact } from "@/lib/generate/pipeline/grounding";
import { buildPack } from "@/lib/generate/pipeline/pack";
import { NO_RESEARCH } from "@/lib/generate/pipeline/research";
import { completeTables } from "@/lib/generate/pipeline/sources";
import { titleRuleFor } from "@/lib/generate/pipeline/title";
import { writePage } from "@/lib/generate/pipeline/write";
import { pickTitle } from "@/lib/generate/rules/title";
import { runHardRules } from "@/lib/generate/rules";
import { renderOf } from "@/lib/generate/rules/text";
import { TEMPLATES } from "@/lib/generate/templates";
import { contentTypeOf, type ContentType } from "@/lib/opportunities/content-type";
import { pageTypeOf } from "@/lib/opportunities/page-type";
import { readDomainText, type MeasuredText } from "@/lib/measure/text";
import { freePageOpportunity, proposedFreePage } from "@/lib/opportunities/free-page";
import { readStoredReport, type StoredReport } from "@/lib/scan/report";
import type { DraftWriter } from "./ports";
import { leadStore } from "./store";

type WriteResult = Awaited<ReturnType<DraftWriter>>;

const FAILED: WriteResult = { written: false, refused: false };
const REFUSED: WriteResult = { written: false, refused: true };

function log(a: Record<string, string | number | boolean>): void {
  // Outcome and step only — never the page, a passage or an address.
  console.log(JSON.stringify({ event: "lead_page_written", ...a }));
}

async function reportOf(scanId: string): Promise<StoredReport | null> {
  const read = await leadStore().scanReport(scanId);
  if (!read.ok || read.report === null) return null;
  try {
    return readStoredReport(read.report);
  } catch {
    return null;
  }
}

/** The domain's own passages, freshest page first — `readAllFacts`' order,
 *  over the domain's reads rather than a site's. */
function factsOf(pages: readonly MeasuredText[]): SourcedFact[] {
  const out: SourcedFact[] = [];
  const seen = new Set<string>();
  for (const { page, passages } of sitePassages([...pages].reverse())) {
    for (const passage of passages) {
      if (seen.has(passage)) continue;
      seen.add(passage);
      out.push({ fact: { url: page.url, readAt: page.measuredAt, passage }, sourceText: page.text });
      if (out.length >= PACK.facts) return out;
    }
  }
  return out;
}

export const writeLeadPage: DraftWriter = async (a) => {
  const report = await reportOf(a.scanId);
  const pick = report === null ? null : proposedFreePage(report);
  if (report === null || pick === null || report.market.kind === "unmeasured") {
    log({ leadId: a.leadId, outcome: "no_pick" });
    return FAILED;
  }
  const opportunity = freePageOpportunity(report, pick);
  // Stage 1: the page's type, read off its row.
  const decided = contentTypeOf(opportunity);
  if (decided === null) return FAILED;

  const pages = await readDomainText(report.domain, { customerOnly: true });
  const facts = factsOf(pages);
  const grounding = facts[0];
  // §8 hard rule 1 with nothing to stand on: the page cannot pass.
  if (grounding === undefined) {
    log({ leadId: a.leadId, outcome: "rules", failed: "grounding" });
    return REFUSED;
  }

  const profile = report.market.value.profile;
  const businessName = profile.brandTokens[0] ?? null;
  const rivals = report.rivals.kind === "unmeasured" ? [] : report.rivals.value.map((rival) => rival.domain);
  const site = { businessName, domain: report.domain, doNotClaim: [], rivals };

  // Stage 2: the pack. **No confirmed profile, and that is not a gap**
  // (#927): a lead has no account, so there is nobody who could have
  // confirmed anything, and writing from the crawl's uncorrected reading
  // would put words in the mouth of someone who has never seen them.
  const packOf = (type: ContentType) =>
    buildPack({
      type,
      opportunity,
      site,
      category: profile.category,
      byline: businessName,
      voice: null,
      profile: null,
      facts,
      research: NO_RESEARCH,
      report,
      sitePages: [],
      links: [],
      now: new Date(),
    });
  // SPEC §2 (2026-10-04, drafted default): a lead's pack holds no research
  // and no knowledge base, so where it is short of what the decided type's
  // template asks, the page is a Q&A — the type the free scan's own measured
  // questions and the domain's passages can hold. A lead's page is held to
  // what its template asks of the pack, never to what a new page must add:
  // nothing was read to compare it with.
  // Issue 1486: a how-to is built from outside sources, which a lead's pack
  // never holds, so its page is the Q&A. That Q&A is held to every need but
  // those sources — the paid page's, read by research a lead is not bought.
  const lacks = (built: ReturnType<typeof packOf>) => (built.type === "qa" ? built.missing.filter((need) => need !== "outside_sources") : built.missing);
  const first = packOf(decided);
  const pack = lacks(first).length === 0 || decided === "qa" ? first : packOf("qa");
  if (lacks(pack).length > 0) {
    log({ leadId: a.leadId, outcome: "pack_short", type: pack.type, missing: lacks(pack).join(",") });
    return REFUSED;
  }
  const type = pack.type;
  const template = TEMPLATES[type];
  const length = lengthRangeFor(template, { questions: pack.questions.length });
  const pageType = pageTypeOf(opportunity);

  return withCostContext(
    { scanId: a.scanId, cap: "FREE", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none" },
    async (cost): Promise<WriteResult> => {
      // Stage 3: one call.
      const written = await writePage(cost, {
        template,
        pack,
        pageType,
        length: length ?? { floor: 0, target: 0, ceiling: Number.MAX_SAFE_INTEGER },
        free: true,
      });
      if (written.kind === "unmeasured") return stepFailed(a.leadId, "write");

      const passages = [...pack.facts.map((fact) => fact.passage), ...packStatements(pack)];
      const laid = layoutPage(written.value, template, {
        facts: passages,
        promises: [],
        queries: targetSearches(opportunity),
        names: [businessName ?? "", report.domain.split(".")[0] ?? "", ...rivals],
        pickTitle: (proposed, on) => pickTitle(proposed, titleRuleFor(pack, on)).chosen,
      });
      const markdown = withClosing(completeTables(laid.body.bodyMarkdown), laid.closing, `https://${report.domain}/`);

      // Stage 4: the checks, and no fix call. The lead's page follows its
      // type's honesty rule as a paid site's does (SPEC §7, issue 1136); it
      // has no knowledge base, so the fit check decides nothing here.
      const outcome = await runHardRules(cost, {
        markdown,
        title: laid.body.title,
        rendered: renderOf(markdown),
        pageType,
        site,
        // A lead has no published or queued pages; its own measured pages are
        // the set a page must not duplicate.
        comparison: {
          published: [],
          queued: [],
          measured: pages
            .slice(0, BATTERY.MEASURED_PAGES_MAX)
            .map((page) => ({ ref: page.url, title: page.url, rendered: page.text })),
        },
        grounded: grounding.fact,
        sourceText: grounding.sourceText,
        brief: { facts: passages, queries: targetSearches(opportunity) },
        blocks: { template, sections: laid.sections, length, faq: laid.faq, domain: report.domain },
        demoPhrases: pages.flatMap((page) => [...(page.examples ?? []), ...(page.menus ?? [])]),
      });

      if (!outcome.passed) {
        log({ leadId: a.leadId, outcome: "rules", failed: outcome.failed.map((f) => f.rule).join(",") });
        return REFUSED;
      }
      log({ leadId: a.leadId, outcome: "passed", type, words: bodyWords(markdown), costCents: Math.round(cost.spentCents()) });
      return { written: true, title: laid.body.title, markdown };
    }
  );
};

function stepFailed(leadId: string, step: string): WriteResult {
  log({ leadId, outcome: "step_failed", step });
  return FAILED;
}
