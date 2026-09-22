// scripts/live-drafts/fixture.ts — the fixture business the live run writes
// for, and the two database seams the run replaces.
//
// **Nothing here is a customer-facing string and nothing here ships.** This
// module is reached only by `./proof.ts`, which is reached only by
// `npm run proof:live-drafts`. No file under `src/` imports it.
//
// # The business
//
// It is the one `main` already carries, not a new one: `tests/generate/
// fixtures.ts` writes for **Acme** at **example.com**, and the stored report
// that fixture hands the rules is `tests/scan/report/fixtures.ts`'s
// `fullSections()` — a user-onboarding SaaS whose market question is "best
// user onboarding software", whose rivals are appcues.com and userpilot.com,
// and whose verdict, volumes and counts are the figures the private-figure
// rule registers. That report is imported rather than retyped, so the
// figures the battery holds against a draft are the fixture's own.
//
// Two things the report fixture does not carry had to be written here,
// because a live draft cannot be produced without them, and both are named
// in the pull request so the owner can correct them:
//
//   * **the customer's own page text** (`PAGES`). Hard rule 1 grounds every
//     draft in a passage read word for word off the customer's own measured
//     pages; the report fixture stores a page's *shape* (headings, numerals,
//     characters) and never its words. Four pages are written below.
//   * **two further target searches** (`TARGETS`). The fixture market holds
//     one search; #321 asks for three drafts for three different searches,
//     so two more questions from the same market are written below.
//
// # The two seams the run replaces
//
// `generateDraft` reads the database in exactly two places, and this module
// answers both:
//
//   * `readMeasuredText` — the pages a draft is grounded in and compared
//     against. `./measured-text.ts` is aliased over `@/lib/measure/text` by
//     the runner and serves `PAGES` from here.
//   * `generateStore()` — the draft rows and the near-duplicate sets.
//     `memoryStore()` below is handed to the product's own
//     `setGenerateStore()` seam, the one `tests/generate/**` already uses.
//
// Everything between those two seams — every prompt, every model call, every
// rule, the claim check and the cost arithmetic — is the product's own code,
// unmodified.
import { assembleReport } from "@/lib/scan/store";
import { measured } from "@/lib/measure/measured";
import type { Opportunity } from "@/lib/opportunities";
import type { MeasuredText } from "@/lib/measure/text";
import type { ClusterPage, LinkTarget } from "@/lib/generate/links/select";
import { knownLinkTargets, siteLinkTargets } from "@/lib/generate/links/select";
import { KNOWN_CONTENT } from "@/lib/config/constants";
import { inventoryPages } from "@/lib/known-content/refresh";
import { pageScore } from "@/lib/known-content/match";
import type { KnownPage } from "@/lib/known-content/types";
import type { KnownPageBrief } from "@/lib/generate/voice/inputs";
import type { SiteRuleInputs } from "@/lib/generate/rules/types";
import type { PromptProfile } from "@/lib/generate/voice/profile-block";
import type {
  DraftInsert,
  DraftPatch,
  DraftRow,
  GenerateStore,
  RestartedDraft,
  SiteFacts,
  StoredPage,
} from "@/lib/generate/store";
import type { InventoryRow } from "@/lib/site-profile/types";
import { fullSections } from "../../tests/scan/report/fixtures";

export const SITE_ID = "22222222-2222-4222-8222-222222222222";
export const SCAN_ID = "11111111-1111-4111-8111-111111111111";
export const DOMAIN = "example.com";
export const BUSINESS_NAME = "Acme";
export const CATEGORY = "user onboarding software";

/** When the fixture pages were read. The grounded fact carries it, and the
 *  draft view prints it; it is fixed so two runs ground identically. */
export const READ_AT = new Date("2026-09-05T10:00:00.000Z");

// ── The customer's own pages ────────────────────────────────────────────
//
// Written here (see the header). Plain visible text, as `readMeasuredText`
// returns it — the extractor's output, not markup. Sentences are what the
// grounding read chooses among, so each page is written as sentences a page
// of a real product site would carry.

export const PAGES: readonly MeasuredText[] = Object.freeze([
  {
    url: "https://example.com/",
    measuredAt: READ_AT,
    text: [
      "User onboarding software for product teams.",
      "Acme builds product tours, onboarding checklists and in-app guides for web applications.",
      "A tour is assembled in the visual editor and published to a live application without an engineering ticket.",
      "Teams who publish a checklist in their first week see new users reach their first success sooner.",
      "The editor runs on top of the application it guides, so what is built is what a new user meets.",
    ].join(" "),
  },
  {
    url: "https://example.com/pricing",
    measuredAt: READ_AT,
    text: [
      "Pricing.",
      "Every plan carries a 14 day trial and no card is asked for to start one.",
      "The team plan includes unlimited product tours, onboarding checklists and in-app guides for one application.",
      "Usage is counted by monthly active users rather than by seats, so a whole product team can log in.",
      "A plan can be changed or cancelled from the account screen at any point in a billing month.",
    ].join(" "),
  },
  {
    url: "https://example.com/product/checklists",
    measuredAt: READ_AT,
    text: [
      "Onboarding checklists.",
      "A checklist shows a new user the steps that lead to their first success, and marks each one off as it is done.",
      "Steps are matched to events the application already sends, so a step completes when the work is done rather than when it is clicked.",
      "A checklist can be shown to one audience and hidden from another without a release.",
      "Progress is kept per user, so somebody who leaves halfway through returns to the step they stopped on.",
    ].join(" "),
  },
  {
    url: "https://example.com/about",
    measuredAt: READ_AT,
    text: [
      "About Acme.",
      "The company was started by two support engineers who answered the same first-week questions every day.",
      "The product is built for the team that owns activation, which is usually product rather than engineering.",
      "Support answers within one working day and every plan reaches the same people.",
    ].join(" "),
  },
]);

/** The crawled inventory the link selector picks cross-links from. */
export const INVENTORY: readonly InventoryRow[] = Object.freeze([
  {
    url: "https://example.com/",
    title: "Acme — user onboarding software",
    h1: "User onboarding software for product teams",
    purpose: "other",
  },
  { url: "https://example.com/pricing", title: "Pricing", h1: "Pricing", purpose: "pricing" },
  { url: "https://example.com/about", title: "About", h1: "About Acme", purpose: "about" },
  {
    url: "https://example.com/product/checklists",
    title: "Onboarding checklists",
    h1: "Onboarding checklists",
    purpose: "product",
  },
]);

/** The stored voice, carried to the prompt verbatim and nowhere else. */
export const VOICE_TEXT =
  "Plain sentences, second person, no exclamation marks. Say what a thing does before saying who makes it.";

/** The customer's do-not-claim list — the list the claim check is run
 *  against. It is non-empty on purpose: an empty list passes at zero cost
 *  without reaching the model, and this run exists to exercise the check. */
export const DO_NOT_CLAIM: readonly string[] = Object.freeze([
  "Acme is the market leader in user onboarding.",
  "Onboarding can be set up in five minutes.",
  "Acme increases activation by a guaranteed amount.",
]);

/** The confirmed business profile, as `promptProfile()` bounds it. Its
 *  members are the report fixture's own profile where it has one. */
export const PROFILE: PromptProfile = Object.freeze({
  job: "get new users to their first success",
  products: ["product tours", "onboarding checklists", "in-app guides"],
  audience: ["product teams", "saas"],
  promises: ["A tour is published without an engineering ticket."],
  vocabulary: ["onboarding", "product tours"],
});

// ── The three targets ───────────────────────────────────────────────────

export interface Target {
  /** `opportunities.id` for the row, fixed so a run is repeatable. */
  id: string;
  search: string;
  slug: string;
  title: string;
  type: Opportunity["type"];
  volume: number;
  /** The rival holding the search today, as the evidence records it. */
  rival: { domain: string; url: string; position: number };
  /** The site-local date the page would publish on. */
  scheduledFor: string;
}

/** Three searches in the fixture's own market, of three different types, so
 *  three different skeletons are exercised. The first is the fixture
 *  market's own selected search; the other two are written here (header). */
export const TARGETS: readonly Target[] = Object.freeze([
  {
    id: "33333333-3333-4333-8333-333333333331",
    search: "best user onboarding software",
    slug: "best-user-onboarding-software",
    title: "What's the best user onboarding software?",
    type: "listed_page",
    volume: 1900,
    rival: { domain: "appcues.com", url: "https://appcues.com/", position: 1 },
    scheduledFor: "2026-09-23",
  },
  {
    id: "33333333-3333-4333-8333-333333333332",
    search: "what is user onboarding software",
    slug: "what-is-user-onboarding-software",
    title: "What is user onboarding software?",
    type: "keyword_page",
    volume: 720,
    rival: { domain: "userpilot.com", url: "https://userpilot.com/blog/", position: 2 },
    scheduledFor: "2026-09-24",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    search: "how to measure user onboarding",
    slug: "how-to-measure-user-onboarding",
    title: "How do you measure user onboarding?",
    type: "answer_page",
    volume: 480,
    rival: { domain: "userpilot.com", url: "https://userpilot.com/blog/measure/", position: 3 },
    scheduledFor: "2026-09-25",
  },
]);

export function opportunityFor(target: Target): Opportunity {
  return {
    id: target.id,
    siteId: SITE_ID,
    scanId: SCAN_ID,
    type: target.type,
    family: "write",
    targetQuery: target.search,
    targetRef: target.slug,
    title: target.title,
    volume: measured(target.volume, READ_AT),
    evidence: {
      family: "write",
      query: target.search,
      volume: measured(target.volume, READ_AT),
      rival: {
        domain: target.rival.domain,
        url: measured(target.rival.url, READ_AT),
        position: measured(target.rival.position, READ_AT),
      },
    },
    acceptance: { form: "top20", query: target.search },
    fitBand: "winnable",
    effort: 0.5,
    status: "open",
    clusterKey: null,
    absorbedQueries: [],
    ready: true,
    unreadyReason: null,
    createdAt: READ_AT,
  };
}

/** Every site-scoped input the battery reads. The report is the fixture's
 *  own, so the private-figure register holds the fixture's own figures. */
export function siteRuleInputs(): SiteRuleInputs {
  return {
    businessName: BUSINESS_NAME,
    domain: DOMAIN,
    doNotClaim: [...DO_NOT_CLAIM],
    rivals: ["appcues.com", "userpilot.com"],
    report: assembleReport(fullSections()),
    opportunities: TARGETS.map(opportunityFor),
  };
}

/** Everything this site already has, as the index holds it (#928). The
 *  fixture site has published nothing of ours and has no WordPress, so its
 *  known content is the crawl's own reading of it — built by the product's
 *  own `inventoryPages`, not written out here. */
export const KNOWN_PAGES: readonly KnownPage[] = Object.freeze(inventoryPages([...INVENTORY]));

/** The customer's own pages this page links to: the inventory's, then the
 *  known index's, in the order and by the selectors
 *  `src/lib/generate/index.ts` uses when it fills a day. The cluster's list
 *  is empty here because the fixture site has published nothing. */
export function linksFor(target: Target): readonly LinkTarget[] {
  const chosen = siteLinkTargets({ domain: DOMAIN, inventory: INVENTORY, query: target.search });
  return [
    ...chosen,
    ...knownLinkTargets(KNOWN_PAGES, { domain: DOMAIN, query: target.search, already: chosen }),
  ];
}

/** The pages nearest this one, as the prompt states them (#928) — the
 *  ranking `src/lib/generate/index.ts`'s own `nearestKnown` applies, using
 *  the same exported score and the same pinned bound. Mirrored rather than
 *  imported because that function is private to the day-page caller, which
 *  this run does not use: it opens a real cost context against Postgres. */
export function knownFor(target: Target): readonly KnownPageBrief[] {
  return [...KNOWN_PAGES]
    .map((page) => ({ page, score: pageScore({ query: target.search }, page) }))
    .filter((scored) => scored.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, KNOWN_CONTENT.PROMPT_PAGES_MAX)
    .map(({ page }) => ({ title: page.title, url: page.url }));
}

// ── The in-memory draft store ───────────────────────────────────────────

/** One store for the whole run, so the second and third drafts are compared
 *  against the first the way three days of one site's calendar would be. */
export interface MemoryStore extends GenerateStore {
  rows: Map<string, DraftRow>;
}

export function memoryStore(): MemoryStore {
  const rows = new Map<string, DraftRow>();
  let next = 0;

  const facts: SiteFacts = {
    id: SITE_ID,
    domain: DOMAIN,
    category: CATEGORY,
    voiceText: VOICE_TEXT,
    doNotClaim: [...DO_NOT_CLAIM],
    rivals: ["appcues.com", "userpilot.com"],
  };

  const store: MemoryStore = {
    rows,
    async siteFacts() {
      return facts;
    },
    async latestReport() {
      return assembleReport(fullSections());
    },
    async insertDraft(row: DraftInsert) {
      next += 1;
      const id = `draft-${next}`;
      rows.set(id, {
        id,
        site_id: row.site_id,
        opportunity_id: row.opportunity_id,
        state: row.state,
        title: row.title,
        body_md: row.body_md,
        meta: row.meta ?? null,
        grounded_fact: row.grounded_fact,
        attribution: row.attribution,
        hard_rule_attempts: 0,
        rule_failures: null,
        claim_check: null,
        cost_cents: row.cost_cents,
        scheduled_for: row.scheduled_for,
        veto_deadline: null,
        created_at: READ_AT.toISOString(),
      });
      return id;
    },
    async patchDraft(draftId: string, patch: DraftPatch) {
      const existing = rows.get(draftId);
      if (existing !== undefined) rows.set(draftId, { ...existing, ...patch } as DraftRow);
    },
    async draftById(draftId: string) {
      return rows.get(draftId) ?? null;
    },
    async publishedPages(): Promise<StoredPage[]> {
      // Nothing publishes in this run (owner ruling 2026-09-22), so the
      // site has no live page and the published set is empty.
      return [];
    },
    async queuedPages(siteId: string, exceptDraftId: string | null): Promise<StoredPage[]> {
      return [...rows.values()]
        .filter((row) => row.site_id === siteId && row.id !== exceptDraftId && row.state !== "published")
        .map((row) => ({ ref: row.id, title: row.title ?? "", markdown: row.body_md ?? "" }));
    },
    async draftsShortOfHandOff(_siteId: string, limit: number) {
      return [...rows.values()].slice(0, limit);
    },
    async countShortOfHandOff() {
      return rows.size;
    },
    async siteInventory(): Promise<readonly InventoryRow[]> {
      return INVENTORY;
    },
    async knownPages(): Promise<readonly KnownPage[]> {
      return KNOWN_PAGES;
    },
    async clusterPages(): Promise<ClusterPage[]> {
      return [];
    },
    async draftOnDate(siteId: string, date: string) {
      return [...rows.values()].some((row) => row.site_id === siteId && row.scheduled_for === date);
    },
    async restartedDrafts(): Promise<readonly RestartedDraft[]> {
      return [];
    },
  };
  return store;
}
