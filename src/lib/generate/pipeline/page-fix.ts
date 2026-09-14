// SPEC §9 (#690) — the day's page for a `fix_page`: a page's own title and
// meta description, rewritten, and nothing else of it.
//
// Owner ruling 2026-09-14: a fix is a **metadata-only update**. So there is
// no brief, no outline and no body — one small call writes only the fields
// the page failed, from the page's own words, and the page's content is never
// touched. The draft enters the same `generating → in_review` edge as every
// other page, and the veto window runs on it the same way.
//
// **Its own words, and no others.** The page is read cache-first under the
// crawl's own key (0¢, the document the scan already ledgered); the prompt
// carries that page's current title, description, heading and text, and the
// other pages' titles so a duplicate is rewritten apart from them. The
// customer's do-not-claim list is checked against what was written, as it is
// for every page.
//
// `drafts.meta.fix` is what the update carries: the page, the checks, the
// new values, and the values they replace — so the draft view and the
// delivery read one record and cannot disagree about what changes.
import { z } from "zod";
import { CACHE_WINDOWS_D, SITE_PROFILE } from "@/lib/config/constants";
import { refusalOf, type CostContext, type FetchRefusal } from "@/lib/costs";
import { safeFetch } from "@/lib/egress/safe-fetch";
import { visibleText } from "@/lib/measure/parse";
import {
  isStoredDocument,
  OWN_FETCH_OPTS,
  OWN_FETCH_SOURCE,
  toStoredDocument,
  type StoredDocument,
} from "@/lib/measure/own-fetch";
import type { Opportunity, PageFix } from "@/lib/opportunities/types";
import { readPageFacts } from "@/lib/site-issues/facts";
import { claimCheck } from "../claims/check";
import { recoveryOutcome } from "../claims/recovery";
import { recordedVerdictValue } from "../record";
import { generateStore } from "../store";
import type { GenerateOutcome } from "./index";
import { STEP_CALL_SITES } from "./steps";

const GENERATING = "generating";

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const H1_RE = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i;

const FIX_SCHEMA = z.strictObject({ title: z.string(), description: z.string() });

/** What a `fix_page` draft records in `drafts.meta.fix`. */
export interface PageFixRecord {
  pageUrl: string;
  issues: readonly PageFix[];
  /** The new value for each field this fix changes; `null` for a field it
   *  leaves as it is. */
  title: string | null;
  description: string | null;
  /** What the page carried when it was read. */
  before: { title: string; description: string };
}

function firstText(html: string, re: RegExp): string {
  const match = re.exec(html);
  return match === null ? "" : visibleText(match[1] ?? "").trim();
}

/** The page, cache-first under the crawl's own key. `null` where it could not
 *  be read at all. */
async function readPage(c: CostContext, pageUrl: string): Promise<StoredDocument | null> {
  const result = await c.recordFetch<StoredDocument | FetchRefusal>({
    source: OWN_FETCH_SOURCE,
    cacheKey: pageUrl,
    freshnessDays: CACHE_WINDOWS_D.own,
    costCents: 0,
    run: async () => {
      const outcome = await safeFetch(pageUrl, OWN_FETCH_OPTS);
      return outcome.ok ? toStoredDocument(outcome) : refusalOf(outcome);
    },
  });
  if ("skipped" in result) return null;
  return isStoredDocument(result.payload) ? result.payload : null;
}

function logRun(detail: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({ event: "page_fix_generated", ...detail }));
}

export async function generatePageFix(
  c: CostContext,
  a: {
    siteId: string;
    opportunity: Opportunity;
    scheduledFor: string;
    domain: string;
    doNotClaim: readonly string[];
    voiceText: string | null;
    /** The other crawled pages' titles, so a duplicate is written apart. */
    otherTitles: readonly string[];
  }
): Promise<GenerateOutcome> {
  const evidence = a.opportunity.evidence;
  if (evidence.family !== "fix" || !("issues" in evidence)) {
    return { ok: false, reason: "step_failed", draftId: null, step: "page_read" };
  }
  const { pageUrl, issues } = evidence;

  if (c.capHit()) return { ok: false, reason: "step_failed", draftId: null, step: "page_read" };
  const page = await readPage(c, pageUrl);
  if (page === null) {
    logRun({ siteId: a.siteId, step: "page_read", outcome: "unreadable" });
    return { ok: false, reason: "step_failed", draftId: null, step: "page_read" };
  }

  const before = {
    title: firstText(page.html, TITLE_RE),
    description: readPageFacts(pageUrl, page.html).metaDescription,
  };
  const fixesTitle = issues.includes("page_titles");
  const fixesDescription = issues.includes("meta_descriptions");

  if (c.capHit()) return { ok: false, reason: "step_failed", draftId: null, step: "page_fix" };
  const written = await import("@/lib/llm").then(({ llm }) =>
    llm(c, {
      site: STEP_CALL_SITES.page_fix,
      tier: "nano",
      schema: FIX_SCHEMA,
      input: {
        task:
          "Rewrite this page's HTML title and meta description. Use only facts stated in the page " +
          "text. The title must differ from every title in otherTitles. Keep a field unchanged " +
          "where rewrite says false.",
        voice: a.voiceText,
        domain: a.domain,
        pageUrl,
        rewrite: { title: fixesTitle, description: fixesDescription },
        current: before,
        heading: firstText(page.html, H1_RE),
        text: visibleText(page.html).slice(0, SITE_PROFILE.VOICE_INPUT_MAX_CHARS),
        otherTitles: a.otherTitles,
      },
    })
  );
  if (written.kind === "unmeasured") {
    logRun({ siteId: a.siteId, step: "page_fix", outcome: "step_failed" });
    return { ok: false, reason: "step_failed", draftId: null, step: "page_fix" };
  }

  const record: PageFixRecord = {
    pageUrl,
    issues,
    title: fixesTitle ? written.value.title.trim() : null,
    description: fixesDescription ? written.value.description.trim() : null,
    before,
  };

  const store = generateStore();
  const draftId = await store.insertDraft({
    site_id: a.siteId,
    opportunity_id: a.opportunity.id,
    state: GENERATING,
    title: record.title ?? before.title,
    body_md: "",
    grounded_fact: null,
    attribution: null,
    scheduled_for: a.scheduledFor,
    cost_cents: c.spentCents(),
    meta: { fix: record, ...(record.description === null ? {} : { description: record.description }) },
  });

  const claim = await claimCheck(c, {
    text: [record.title, record.description].filter((v) => v !== null).join("\n"),
    list: a.doNotClaim,
  });
  const passed = claim.state === "passed" && (record.title ?? record.description ?? "") !== "";
  await store.patchDraft(draftId, {
    claim_check: recordedVerdictValue(claim),
    rule_failures: [],
    cost_cents: c.spentCents(),
    hard_rules_passed: passed,
  });

  if (claim.state === "unrun") {
    logRun({ siteId: a.siteId, draftId, step: "claim_check", outcome: claim.reason });
    return { ok: false, reason: "step_failed", draftId, step: "claim_check" };
  }
  if (passed) {
    logRun({ siteId: a.siteId, draftId, outcome: "passed" });
    return { ok: true, draftId, grounded: null };
  }
  logRun({ siteId: a.siteId, draftId, outcome: "rules" });
  return {
    ok: false,
    reason: "rules",
    draftId,
    failed: [{ rule: "do_not_claim" }],
    attempt: 1,
    recovery: recoveryOutcome({ failed: ["do_not_claim"], automaticAttempts: 0, enteredReview: false }),
  };
}
