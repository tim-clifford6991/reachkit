// tests/generate/fixtures.ts — the shapes the BUILD §8 suites share.
// Not a suite of its own: vitest collects `*.test.ts`.
//
// Every value here is built from the type its own module declares, so a
// shape that changes fails to compile here rather than drifting quietly
// into a suite that keeps passing.
import "./env";
import type { KnownPage } from "@/lib/known-content/types";
import type { CostContext } from "../../src/lib/costs";
import type { Opportunity } from "../../src/lib/opportunities";
import type { StoredReport } from "../../src/lib/scan/report";
import { assembleReport } from "../../src/lib/scan/store";
import { measured, unmeasured } from "../../src/lib/measure/measured";
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
import type { ClusterPage } from "../../src/lib/generate/links/select";
import type { InventoryRow } from "../../src/lib/site-profile/types";
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
    // Stored, so a suite about the pipeline's shape runs a page whose type
    // asks nothing of it; the suites about honesty by page type set their own.
    pageType: "answer",
    effort: 0.5,
    status: "open",
    clusterKey: null,
    absorbedQueries: [],
    ready: false,
    unreadyReason: "not_assessed",
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

// ── The draft writer, without its floor and its critic ──────────────────

/** `writeDraft` (issue 1138) stood in for by the draft step alone, for the
 *  suites whose subject is what happens around the writing: the same calls
 *  in the same order, on the writer tier, with no length floor and no
 *  critic — those are `pipeline/write.test.ts`. A frame answered with
 *  `held: true` is a page still short of its floor. */
export async function draftOnly(c: unknown, inputs: unknown, a: Record<string, unknown>): Promise<unknown> {
  const { draft } = await import("../../src/lib/generate/pipeline/steps");
  // `opportunity` and `tidy` are the writer's own; the draft step ignores them.
  const wrote = await draft(c as never, inputs as never, { ...a, tier: "writer" } as never);
  if (wrote.kind === "unmeasured") return { kind: "failed" };
  const { held, ...parts } = wrote.value as typeof wrote.value & { held?: boolean };
  const length = { words: 0, floor: null, ceiling: null, rewritten: 0 };
  return held === true ? { kind: "short", parts, length } : { kind: "written", parts, length, critic: null };
}

// ── A `CostContext` that refuses the vendor ─────────────────────────────

/** `recordFetch` throws: everything in this engine that spends must go
 *  through `llm()`, and a module that called `recordFetch` directly would
 *  be caught here rather than merely unexercised. */
// ── What the page adds, as a stated answer ──────────────────────────────

/** The list `listAdds` (issue 1143) answers with in the suites whose subject
 *  is what happens around it: three claims, one about the business, so a
 *  page passes the bar. A test that needs a page short of it empties
 *  `addsAnswer.claims`, or sets it `null` for a listing that did not run. The
 *  listing itself, its code check and the bar are `pipeline/adds.test.ts`. */
export const ENOUGH_ADDS = Object.freeze([
  { claim: "The fixed price is quoted before any work starts.", business: true },
  { claim: "A team of five pays for the second seat onward.", business: false },
  { claim: "Ask every vendor for a full export in an open format.", business: false },
]);
export const addsAnswer: { claims: readonly { claim: string; business: boolean }[] | null } = {
  claims: ENOUGH_ADDS,
};

/** The `pipeline/adds` module with `listAdds` stood in for by `addsAnswer`. */
export function addsStandIn<T extends object>(actual: T): T {
  return {
    ...actual,
    listAdds: async () =>
      addsAnswer.claims === null ? unmeasured("undeterminable", AT) : measured([...addsAnswer.claims], AT),
  };
}

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
  inventory: InventoryRow[];
  /** #928: the pages this site already has, as `known_content` holds them. */
  known: KnownPage[];
  cluster: Map<string, ClusterPage[]>;
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
    inventory: [],
    known: [],
    cluster: new Map(),

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
        meta: row.meta ?? null,
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
    async draftOnDate(siteId, date) {
      return [...rows.values()].some((row) => row.site_id === siteId && row.scheduled_for === date);
    },
    async restartedDrafts(siteIds) {
      // The row as the double holds it carries no move log; a test marks a
      // restart by the `transitions` it seeds, as the table would hold it.
      return [...rows.values()]
        .filter((row) => siteIds.includes(row.site_id) && row.state === "generating")
        .filter((row) => {
          const moves = (row as unknown as { transitions?: { from: string; to: string }[] }).transitions ?? [];
          const last = moves[moves.length - 1];
          return last?.from === "needs_attention" && last.to === "generating";
        })
        .map((row) => ({ draftId: row.id, siteId: row.site_id }));
    },
    async siteInventory() {
      return store.inventory;
    },
    // #928: what the site already has. A suite that seeds none is a site
    // whose index is empty — no repeats to find and no known pages to link.
    async knownPages() {
      return store.known;
    },
    async clusterPages(_siteId, clusterKey) {
      return store.cluster.get(clusterKey) ?? [];
    },
    ...over,
  };
  return store;
}

// ── The model steps' answers since issue 1137 ───────────────────────────

/** The outline step's answer: six questions over the whole block set, so it
 *  satisfies every type's required blocks. */
export const OUTLINE_ANSWER = {
  sections: [
    { role: "answer", heading: "Which tool should a small team pick?" },
    { role: "detail", heading: "What decides the choice?" },
    { role: "comparison", heading: "How do the plans compare?" },
    { role: "steps", heading: "How does a team check a plan?" },
    { role: "evidence", heading: "What does the starter plan include?" },
    { role: "business", heading: "How is the seat limit handled here?" },
  ],
};
export const OUTLINE_HEADINGS = OUTLINE_ANSWER.sections.map((section) => section.heading);

/** A short answer inside 40–60 words that names nobody. */
export const CLEAN_ANSWER =
  "The right tool for a small team is the one whose plan covers every person who opens it each day. " +
  "Count those people first, then read what the plan includes, because a seat limit is the constraint " +
  "teams notice last and feel most once the work has moved in.";

const FILLER_SECTIONS = [
  "The choice turns on how many people need a seat. A plan that fits the team today can stop fitting after one hire.",
  "The plans differ in who they are built for. The table sets the two side by side.\n\n| Plan | Built for |\n| --- | --- |\n| Starter | A small team |\n| Larger | A growing team |",
  "A team checks a plan in order. Each step takes a few minutes.\n\n1. Count the people who open the tool daily.\n2. Read the plan's seat limit.\n3. Compare the two.",
  "The starter plan is stated on the pricing page. Teams on the starter plan get 25 seats and unlimited projects for a flat monthly fee, per [the published pricing page](https://example.com/pricing).",
  "The seat limit is published openly. It is on [the published pricing page](https://example.com/pricing) for anyone to read before choosing.",
];

/** The draft step's answer: the page in parts. `first` is the body of the
 *  first section — where a suite puts the text it is about. */
export function draftParts(first: string = CLEAN_MARKDOWN, over: Record<string, unknown> = {}) {
  return {
    title: "Which tool should a small team pick?",
    slug: "which-tool-small-team",
    description: "How to choose by seat count.",
    answer: CLEAN_ANSWER,
    takeaways: [
      "Count the people who open the tool every day.",
      "Read what the plan includes before choosing.",
      "A seat limit is felt last and most.",
    ],
    sections: [first, ...FILLER_SECTIONS],
    closing: "Count your seats before you choose a plan.",
    faq: [
      { question: "Does a small team need a paid plan?", answer: "It depends on how many people need a seat. Count them first." },
      { question: "What is a seat?", answer: "A seat is one person's place in the tool. Each daily user needs one." },
      { question: "When should a team change plan?", answer: "When the people who need a seat outnumber the seats the plan has." },
    ],
    ...over,
  };
}

/** An answerability pass that changes nothing. */
export const NO_OPS = { title: "", description: "", order: [0, 1, 2, 3, 4, 5], openings: [], insertFacts: [] };

/**
 * The outline and the parts for a journey's page, built from the single
 * body those suites already hold. Every sentence of the filler carries the
 * page's own `topic`, so two pages of one site share no run of five words
 * and the near-duplicate gate reads them as the different pages they are.
 */
export function outlineFor(page: { title: string }, topic: string) {
  const roles = OUTLINE_ANSWER.sections.map((section) => section.role);
  return {
    sections: roles.map((role, index) => ({
      role,
      heading: index === 0 ? page.title : `Which ${topic} point ${["one", "two", "three", "four", "five", "six"][index]} matters?`,
    })),
  };
}

export function partsFromPage(
  page: { title: string; slug: string; description: string; bodyMarkdown: string },
  topic: string
) {
  const t = topic.charAt(0).toUpperCase() + topic.slice(1);
  const say = (...tails: string[]): string => tails.map((tail) => `${t}: ${tail}.`).join(" ");
  return {
    title: page.title,
    slug: page.slug,
    description: page.description,
    // Twelve four-word sentences: 48 words, inside the box's 40–60.
    answer: say(
      "count the people", "read the plan", "compare the two", "check the seats", "ask the team", "note the limit",
      "weigh the cost", "list the needs", "match the work", "pick the fit", "watch the growth", "revisit each year"
    ),
    takeaways: [say("count the people"), say("read the plan"), say("compare the two")],
    sections: [
      page.bodyMarkdown,
      say("people decide it", "seats decide it"),
      `${say("plans differ here")}\n\n| ${t} plan | ${t} fit |\n| --- | --- |\n| ${t} starter | ${t} small team |`,
      `${say("steps come next")}\n\n1. ${t}: count.\n2. ${t}: read.\n3. ${t}: compare.`,
      say("facts stand here", "sources stand here"),
      say("limits stay open", "plans stay published"),
    ],
    closing: say("count your seats"),
    faq: ["first", "second", "third"].map((nth) => ({ question: `${t}: the ${nth} question?`, answer: say("the answer") })),
  };
}

/**
 * The draft step's answers in the order it asks: the page's frame, then the
 * section bodies three to a call (`DRAFT_SECTIONS_PER_CALL`).
 */
export function draftAnswers(parts: ReturnType<typeof draftParts> = draftParts()): unknown[] {
  const { sections, ...frame } = parts;
  const batches: unknown[] = [];
  for (let at = 0; at < sections.length; at += 3) batches.push({ sections: sections.slice(at, at + 3) });
  return [frame, ...batches];
}

/** One draft call's answer for a suite that reads the request: the frame,
 *  or the bodies of the sections `write` names. */
export function draftAnswerFor(parts: { sections: string[] }, asked: { write?: readonly number[] }): unknown {
  if (asked.write !== undefined) return { sections: asked.write.map((index) => parts.sections[index] ?? "") };
  return Object.fromEntries(Object.entries(parts).filter(([key]) => key !== "sections"));
}
