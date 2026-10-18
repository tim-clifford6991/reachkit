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
import type { ClusterPage } from "../../src/lib/generate/links/select";
import type { SourcedFact } from "../../src/lib/generate/pipeline/grounding";
import type { ContextPack, PackClaim, PackInputs } from "../../src/lib/generate/pipeline/pack";
import type { MarketFact } from "../../src/lib/generate/pipeline/research";
import type { PageParts } from "../../src/lib/generate/pipeline/write";
import type { PackNeed } from "../../src/lib/generate/templates";
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
  /** Issue 1144: pages written for other sites, as their Markdown. */
  elsewhere: string[];
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
    elsewhere: [],
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
    async pagesElsewhere() {
      return store.elsewhere;
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

// ── The context pack and the writer's answer (SPEC §7, D41) ─────────────

/** The customer's passages as the pipeline is handed them. */
export const FACTS: SourcedFact[] = [{ fact: GROUNDED, sourceText: SOURCE_TEXT }];

/** Two claims off public pages, which `pageParts` cites: a Q&A is built
 *  from at least two (issue 1486). */
export const OUTSIDE_CLAIMS: PackClaim[] = [
  { url: "https://support.vendor.example/seats", title: "Seats and billing", readAt: AT.toISOString(), passage: "Every member who signs in counts as a seat on the plan.", kind: "primary" },
  { url: "https://guide.example.org/team-seats", title: "Choosing a team plan", readAt: AT.toISOString(), passage: "Guests who only view boards are usually free of charge.", kind: "top_result" },
];

/** A Q&A page's pack that is short of nothing: the suites whose subject is
 *  what happens after the pack say what theirs lacks. */
export function pack(over: Partial<ContextPack> = {}): ContextPack {
  return {
    version: 1,
    type: "qa",
    builtAt: AT.toISOString(),
    target: { question: "which plan fits a small team", searches: ["which plan fits a small team"] },
    business: {
      name: "Acme",
      domain: "example.com",
      category: "project management software",
      byline: null,
      voice: null,
      market: null,
      rivals: [],
    },
    profile: null,
    neverClaim: [],
    facts: [{ passage: GROUNDED.passage, url: GROUNDED.url, readAt: AT.toISOString() }],
    claims: OUTSIDE_CLAIMS,
    products: [],
    pages: [],
    links: [],
    questions: [],
    measurements: null,
    live: null,
    adds: { claims: [{ claim: GROUNDED.passage, business: true }], short: false },
    missing: [],
    ...over,
  };
}

/** What `packStandIn` says a built pack lacks. A suite about a short pack
 *  names a need here, or sets `short` for a new page that adds too little. */
export const packAnswer: { missing: PackNeed[]; short: boolean; missingFor?: (targetQuery: string | null) => PackNeed[] } = { missing: [], short: false };

/**
 * The `pipeline/pack` module for the suites whose subject is what happens
 * around the pack: the pack is built from what the run read, as a Q&A page's
 * (an update stays one), and is short of exactly what `packAnswer` says.
 * What a pack must hold is `pipeline/pack.test.ts`.
 */
export function packStandIn<T extends object>(actual: T): T {
  const real = actual as unknown as { buildPack: (a: PackInputs) => ContextPack };
  return {
    ...actual,
    buildPack: (a: PackInputs): ContextPack => {
      const built = real.buildPack({ ...a, type: a.type === "update" ? "update" : "qa" });
      // As the real pack counts it: an update is held to no bar of its own.
      const short = packAnswer.short && built.type !== "update";
      const missing = packAnswer.missingFor?.(a.opportunity.targetQuery) ?? packAnswer.missing;
      return { ...built, missing: [...missing], adds: { claims: built.adds.claims, short } };
    },
  };
}

/** The `pipeline/research` module with no search bought: only the pages of
 *  `OUTSIDE_CLAIMS` are read. */
export function researchStandIn<T extends object>(actual: T): T {
  const facts: MarketFact[] = OUTSIDE_CLAIMS.map((claim) => ({ ...claim, readAt: new Date(claim.readAt) }));
  return { ...actual, researchMarket: async () => ({ facts, products: [] }) };
}

/** A short answer inside 40–60 words that names nobody. */
export const CLEAN_ANSWER =
  "The right tool for a small team is the one whose plan covers every person who opens it each day. " +
  "Count those people first, then read what the plan includes, because a seat limit is the constraint " +
  "teams notice last and feel most once the work has moved in.";

const VERBS = "count read check weigh list match note watch ask map sort name mark trace track".split(" ");
const NOUNS = "people plan seats limit cost needs work growth team budget terms renewal export support rollout".split(" ");
const TAILS = ["first", "early", "together", "openly", "again"];

/**
 * `count` sentences from `at`, five words each on average and every one
 * naming `topic` — so no run of five words is shared by two pages on
 * different topics, and the near-duplicate check reads them as the different
 * pages they are. They alternate two words and eight, because a page whose
 * sentences are all one length is stopped by the prose check (issue 1390).
 */
export function prose(topic: string, at: number, count: number): string {
  const verb = (i: number): string => `${VERBS[i % 15]!.charAt(0).toUpperCase()}${VERBS[i % 15]!.slice(1)}`;
  return Array.from({ length: count }, (_, offset) => {
    const i = at + offset;
    // Every sentence opens on its verb: a page whose sentences all open
    // with one word is stopped for that too.
    if (i % 2 === 0) return `${verb(i)} ${topic}.`;
    return `${verb(i)} the ${NOUNS[Math.floor(i / 15) % 15]} ${TAILS[i % 5]} for ${topic} ${NOUNS[i % 13]} ${TAILS[(i * 3 + 1) % 5]}.`;
  }).join(" ");
}

/**
 * The writer's answer: a Q&A page in its template's parts, long enough for
 * its floor. `first` is the body of the first section — where a suite puts
 * the text it is about — and the last section links the business's own page.
 */
export function pageParts(first: string = CLEAN_MARKDOWN, over: Partial<PageParts> = {}, topic = "seats"): PageParts {
  const t = topic.charAt(0).toUpperCase() + topic.slice(1);
  // Five questions of their own: stage 4 stops a Q&A whose headings are one
  // question asked again (D61).
  const asks = ["who needs a login on day one?", "when does the monthly bill change?", "can outside guests join without paying?", "what happens after somebody leaves the company?", "do admins count toward the plan limit?"];
  const heading = (index: number): string => `${t}: ${asks[index - 1]}`;
  return {
    // A title the check passes for `opportunity()`'s search and for the
    // pack's own — a statement that leads with either and carries the
    // grounded fact's number — and a description inside its 120–155
    // characters.
    titles: ["Project management software plan that fits a small team of 25"],
    slug: "which-tool-small-team",
    description:
      "A small team picks project management software by seat count: count who needs a login, then compare what each plan costs for that many seats.",
    answer: CLEAN_ANSWER,
    takeaways: [prose(topic, 0, 1), prose(topic, 1, 1), prose(topic, 2, 1)],
    sections: [
      { key: "question", heading: "Which tool should a small team pick?", body: `${first}\n\n${prose(topic, 3, 22)}` },
      ...[1, 2, 3, 4, 5].map((index) => ({ key: "question", heading: heading(index), body: prose(topic, index * 28, 28) })),
      {
        key: "business",
        heading: `${t}: how is it handled here?`,
        body: `${prose(topic, 170, 6)} It is on [the published page](${GROUNDED.url}) for anyone to read. [The vendor's seat help](${OUTSIDE_CLAIMS[0]!.url}) counts each member who signs in, and [a guide to team plans](${OUTSIDE_CLAIMS[1]!.url}) leaves viewers free.`,
      },
    ],
    closing: "Count your seats before you choose a plan.",
    faq: [],
    updated: "",
    ...over,
  };
}

/** A journey's page from the one body those suites hold, on its own topic. */
export function partsFromPage(
  page: { title: string; question?: string; slug: string; description: string; bodyMarkdown: string },
  topic: string
): PageParts {
  const parts = pageParts(page.bodyMarkdown, {}, topic);
  return {
    ...parts,
    titles: [page.title],
    slug: page.slug,
    description: page.description,
    // Ten five-word sentences: 50 words, inside the box's 40–60.
    answer: prose(topic, 200, 10),
    // The body opens on the page's own question, which is its first section's.
    // A title is a statement where its search is one (issue 1389), so such
    // a page names its question beside it.
    sections: parts.sections.map((section, index) => (index === 0 ? { ...section, heading: page.question ?? page.title } : section)),
    closing: prose(topic, 210, 1),
  };
}
