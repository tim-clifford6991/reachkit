// SPEC §2 · §8 (issue 787) — the lead's first page, written.
//
// The draft writer port's real implementation. A lead has no site, so §8's
// `generateDraft` — which writes a `drafts` row and compares against a
// site's published set — cannot be called for one. This composes the same
// steps it runs, in the same order, and holds no rule of its own: the facts
// are the domain's own measured passages, then brief → outline → draft →
// answerability, then the whole hard-rule battery over the finished text.
//
// **The FREE cap.** One cost context per page, `CAPS.FREE_C`, ledgered
// against the scan that offered the page and rolled up nowhere — the page
// costs about 6.5¢ and is spent only on an identified lead (`giveaway.ts`).
//
// **Nothing is stored here.** The page travels back to `deliverFirstPage`,
// which stores it on the scan so every lead on the report is mailed the same
// page, and a retry re-sends it and never re-writes. There is no
// regeneration: one call per report, ever (issue 826).
import { BATTERY, BRIEF_MAX_FACTS } from "@/lib/config/constants";
import { withCostContext } from "@/lib/costs";
import { DRAFT_POLICY_VERSION } from "@/lib/generate/cost";
import { runHardRules } from "@/lib/generate/rules";
import { renderOf } from "@/lib/generate/rules/text";
import { applyAnswerability } from "@/lib/generate/pipeline/answerability";
import { orderedPassages } from "@/lib/generate/pipeline/grounding";
import { SKELETONS } from "@/lib/generate/pipeline/skeletons";
import { answerability, brief, briefProjection, draft, outline, selectedFactIndexes } from "@/lib/generate/pipeline/steps";
import { buildPromptInputs } from "@/lib/generate/voice/inputs";
import { readDomainText, type MeasuredText } from "@/lib/measure/text";
import { bestFreePage, freePageOpportunity } from "@/lib/opportunities/free-page";
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

/** Up to `BRIEF_MAX_FACTS` passages, freshest page first — `readFacts`'
 *  order, over the domain's reads rather than a site's. */
function factsOf(pages: readonly MeasuredText[]): { url: string; readAt: Date; passage: string; sourceText: string }[] {
  const out: { url: string; readAt: Date; passage: string; sourceText: string }[] = [];
  const seen = new Set<string>();
  for (const page of [...pages].reverse()) {
    for (const passage of orderedPassages(page.text)) {
      if (seen.has(passage)) continue;
      seen.add(passage);
      out.push({ url: page.url, readAt: page.measuredAt, passage, sourceText: page.text });
      if (out.length >= BRIEF_MAX_FACTS) return out;
    }
  }
  return out;
}

export const writeLeadPage: DraftWriter = async (a) => {
  const report = await reportOf(a.scanId);
  const pick = report === null ? null : bestFreePage(report);
  if (report === null || pick === null || report.market.kind === "unmeasured") {
    log({ leadId: a.leadId, outcome: "no_pick" });
    return FAILED;
  }
  const opportunity = freePageOpportunity(report, pick);
  const skeleton = SKELETONS[opportunity.type];
  if (skeleton === null) return FAILED;

  const pages = await readDomainText(report.domain);
  const facts = factsOf(pages);
  // §8 hard rule 1 with nothing to stand on: the page cannot pass.
  if (facts.length === 0) {
    log({ leadId: a.leadId, outcome: "rules", failed: "grounding" });
    return REFUSED;
  }

  const profile = report.market.value.profile;
  const businessName = profile.brandTokens[0] ?? null;

  return withCostContext(
    { scanId: a.scanId, cap: "FREE", policyVersion: DRAFT_POLICY_VERSION, rollUp: "none" },
    async (cost): Promise<WriteResult> => {
      const briefResult = await brief(
        cost,
        briefProjection({ opportunity, facts: facts.map((f) => f.passage), doNotClaim: [], voice: null })
      );
      if (briefResult.kind === "unmeasured") return stepFailed(a.leadId, "brief");
      const selected = selectedFactIndexes(briefResult.value, facts.length).map((index) => facts[index]!);
      const grounding = selected[0];
      if (grounding === undefined) {
        log({ leadId: a.leadId, outcome: "rules", failed: "grounding" });
        return REFUSED;
      }
      const passages = selected.map((fact) => fact.passage);
      const grounded = { url: grounding.url, readAt: grounding.readAt, passage: grounding.passage };

      const inputs = buildPromptInputs({
        businessName,
        domain: report.domain,
        category: profile.category,
        voiceText: null,
        opportunity,
        grounded,
        links: [],
      });

      const outlineResult = await outline(cost, inputs, { brief: briefResult.value, skeleton });
      if (outlineResult.kind === "unmeasured") return stepFailed(a.leadId, "outline");
      const draftResult = await draft(cost, inputs, {
        brief: briefResult.value,
        outline: outlineResult.value,
        facts: selected.map((fact) => ({ url: fact.url, passage: fact.passage })),
      });
      if (draftResult.kind === "unmeasured") return stepFailed(a.leadId, "draft");
      const ops = await answerability(cost, inputs, { body: draftResult.value, facts: passages });
      if (ops.kind === "unmeasured") return stepFailed(a.leadId, "answerability");

      const body = applyAnswerability(draftResult.value, ops.value, passages);
      const outcome = await runHardRules(cost, {
        markdown: body.bodyMarkdown,
        rendered: renderOf(body.bodyMarkdown),
        site: {
          businessName,
          domain: report.domain,
          doNotClaim: [],
          rivals: report.rivals.kind === "unmeasured" ? [] : report.rivals.value.map((rival) => rival.domain),
          report,
          opportunities: [opportunity],
        },
        // A lead has no published or queued pages; its own measured pages are
        // the set a page must not duplicate.
        comparison: {
          published: [],
          queued: [],
          measured: pages
            .slice(0, BATTERY.MEASURED_PAGES_MAX)
            .map((page) => ({ ref: page.url, title: page.url, rendered: page.text })),
        },
        grounded,
        sourceText: grounding.sourceText,
        brief: {
          facts: passages,
          headings: outlineResult.value.sections.map((section) => section.heading),
          queries: opportunity.targetQuery === null ? [] : [opportunity.targetQuery],
        },
      });

      if (outcome.claim.state === "unrun") return stepFailed(a.leadId, "claim_check");
      if (!outcome.passed) {
        log({ leadId: a.leadId, outcome: "rules", failed: outcome.failed.map((f) => f.rule).join(",") });
        return REFUSED;
      }
      log({ leadId: a.leadId, outcome: "passed", costCents: Math.round(cost.spentCents()) });
      return { written: true, title: body.title, markdown: body.bodyMarkdown };
    }
  );
};

function stepFailed(leadId: string, step: string): WriteResult {
  log({ leadId, outcome: "step_failed", step });
  return FAILED;
}
