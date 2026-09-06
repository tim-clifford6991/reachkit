// tests/generate/fixtures.ts — the shapes the BUILD §8 suites share.
// Not a suite of its own: vitest collects `*.test.ts`.
//
// Every value here is built from the type its own module declares, so a
// shape that changes fails to compile here rather than drifting quietly
// into a suite that keeps passing.
import "./env";
import type { CostContext } from "../../src/lib/costs";
import type { Opportunity } from "../../src/lib/opportunities";
import type { StoredReport } from "../../src/lib/scan/report";
import { assembleReport } from "../../src/lib/scan/store";
import { measured } from "../../src/lib/measure/measured";
import type {
  ComparisonSet,
  GroundedFact,
  SiteRuleInputs,
} from "../../src/lib/generate/rules/types";
import type {
  DraftInsert,
  DraftPatch,
  DraftRow,
  GenerateStore,
  SiteFacts,
  StoredPage,
} from "../../src/lib/generate/store";
import { fullSections } from "../scan/report/fixtures";

export const AT = new Date("2026-09-05T10:00:00.000Z");
export const SITE_ID = "22222222-2222-4222-8222-222222222222";
export const SCAN_ID = "11111111-1111-4111-8111-111111111111";

export function report(over: Parameters<typeof fullSections>[0] = {}): StoredReport {
  return assembleReport(fullSections(over));
}

export function opportunity(over: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    siteId: SITE_ID,
    scanId: SCAN_ID,
    type: "answer_page",
    family: "write",
    targetQuery: "best project management software",
    targetRef: "best-project-management-software",
    title: "What's the best project management software?",
    volume: measured(1900, AT),
    evidence: {
      family: "write",
      query: "best project management software",
      volume: measured(1900, AT),
      rival: {
        domain: "rival.example",
        url: measured("https://rival.example/best", AT),
        position: measured(3, AT),
      },
    },
    acceptance: { form: "top20", query: "best project management software" },
    fitBand: "winnable",
    effort: 0.5,
    status: "open",
    createdAt: AT,
    ...over,
  };
}

export const GROUNDED: GroundedFact = {
  url: "https://example.com/pricing",
  readAt: AT,
  passage: "Teams on the starter plan get 25 seats and unlimited projects for a flat monthly fee.",
};

/** The page the grounded passage was taken from, as the measurement read
 *  it. The passage occurs in it word for word, which is what the grounding
 *  rule checks. */
export const SOURCE_TEXT =
  "Pricing. Teams on the starter plan get 25 seats and unlimited projects for a flat monthly fee. " +
  "Larger teams talk to us.";

export function siteInputs(over: Partial<SiteRuleInputs> = {}): SiteRuleInputs {
  return {
    businessName: "Acme",
    domain: "example.com",
    doNotClaim: [],
    rivals: [],
    report: report(),
    opportunities: [opportunity()],
    ...over,
  };
}

export function emptyComparison(over: Partial<ComparisonSet> = {}): ComparisonSet {
  return { published: [], measured: [], queued: [], ...over };
}

/** A draft body that passes every deterministic rule: the brand is not
 *  named in the opening, the grounded passage is stated and sourced, there
 *  is no quotation, no rival figure, no embedded markup and no numeral the
 *  register holds. */
export const CLEAN_MARKDOWN = [
  "## Which tool should a small team pick?",
  "",
  "The answer depends on how many people need a seat and how much of the work",
  "already lives in one place. Start by counting the people who will open it",
  "every day, then check what the plan you are looking at actually includes.",
  "",
  "Teams on the starter plan get 25 seats and unlimited projects for a flat",
  "monthly fee, per [the published pricing page](https://example.com/pricing).",
  "",
  "That number is the one worth checking first, because a seat limit is the",
  "constraint teams notice last and feel most.",
].join("\n");

// ── A `CostContext` that refuses the vendor ─────────────────────────────

/** `recordFetch` throws: everything in this engine that spends must go
 *  through `llm()`, and a module that called `recordFetch` directly would
 *  be caught here rather than merely unexercised. */
export function fakeCost(over: Partial<CostContext> = {}): CostContext {
  return {
    cap: "DRAFT",
    async recordFetch() {
      throw new Error("the generation engine must reach a model through llm(), never recordFetch");
    },
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
    ...over,
  };
}

// ── An in-memory `GenerateStore` ────────────────────────────────────────

export interface MemoryStore extends GenerateStore {
  rows: Map<string, DraftRow>;
  patches: Array<{ draftId: string; patch: DraftPatch }>;
  site: SiteFacts | null;
  storedReport: StoredReport | null;
  published: StoredPage[];
  seed(row: Partial<DraftRow> & { id: string }): DraftRow;
}

export function memoryStore(over: Partial<MemoryStore> = {}): MemoryStore {
  const rows = new Map<string, DraftRow>();
  let nextId = 0;

  const store: MemoryStore = {
    rows,
    patches: [],
    site: {
      id: SITE_ID,
      domain: "example.com",
      category: "project management software",
      voiceText: null,
      doNotClaim: [],
      rivals: [],
    },
    storedReport: report(),
    published: [],

    seed(row) {
      const full: DraftRow = {
        site_id: SITE_ID,
        opportunity_id: opportunity().id,
        state: "in_review",
        title: null,
        body_md: null,
        meta: null,
        grounded_fact: null,
        attribution: null,
        hard_rule_attempts: 0,
        rule_failures: null,
        claim_check: null,
        cost_cents: 0,
        scheduled_for: null,
        veto_deadline: null,
        created_at: AT.toISOString(),
        ...row,
      };
      rows.set(full.id, full);
      return full;
    },

    async siteFacts() {
      return store.site;
    },
    async latestReport() {
      return store.storedReport;
    },
    async insertDraft(row: DraftInsert) {
      nextId++;
      const id = `draft-${nextId}`;
      store.seed({
        id,
        site_id: row.site_id,
        opportunity_id: row.opportunity_id,
        state: row.state,
        title: row.title,
        body_md: row.body_md,
        grounded_fact: row.grounded_fact,
        attribution: row.attribution,
        scheduled_for: row.scheduled_for,
        cost_cents: row.cost_cents,
      });
      return id;
    },
    async patchDraft(draftId, patch) {
      store.patches.push({ draftId, patch });
      const existing = rows.get(draftId);
      if (existing !== undefined) rows.set(draftId, { ...existing, ...patch } as DraftRow);
    },
    async draftById(draftId) {
      return rows.get(draftId) ?? null;
    },
    async publishedPages() {
      return store.published;
    },
    async queuedPages(_siteId, exceptDraftId) {
      return [...rows.values()]
        .filter((row) => row.id !== exceptDraftId && row.state !== "published")
        .map((row) => ({ ref: row.id, title: row.title ?? "", markdown: row.body_md ?? "" }));
    },
    async draftsShortOfHandOff(_siteId, limit) {
      return [...rows.values()].slice(0, limit);
    },
    async countShortOfHandOff() {
      return rows.size;
    },
    ...over,
  };
  return store;
}
