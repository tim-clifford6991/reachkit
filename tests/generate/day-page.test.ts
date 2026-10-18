// tests/generate/day-page.test.ts — the day's page, at the engine's public
// entry point.
//
// §8: "the day's page is generated the evening before its publish date from
// the freshest scan. `CAP_DRAFT` enforced before the pipeline runs."
// SPEC §7 (D41): one call writes the page, a page a check stops takes one fix
// call, and one that still fails rests where the customer can act on it.
//
// §7's supply rule is the other half: `nextForDay` answering `null` is a
// day with no page, never an invented one.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AT,
  CLEAN_MARKDOWN,
  GROUNDED,
  SCAN_ID,
  SITE_ID,
  SOURCE_TEXT,
  memoryStore,
  packAnswer,
  pageParts,
  opportunity,
  type MemoryStore,
} from "./fixtures";

const {
  llmMock,
  readMeasuredTextMock,
  nextForDayMock,
  withCostContextMock,
  queueForDraftMock,
  restTopicMock,
  transitionMock,
  updateInsteadMock,
} = vi.hoisted(() => ({
  updateInsteadMock: vi.fn(),
  llmMock: vi.fn(),
  readMeasuredTextMock: vi.fn(),
  nextForDayMock: vi.fn(),
  withCostContextMock: vi.fn(),
  queueForDraftMock: vi.fn(),
  restTopicMock: vi.fn(),
  transitionMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));
// What a pack must hold is `pipeline/pack.test.ts`; here the pack is short of
// what a case says it is, and no public page is read.
vi.mock("@/lib/generate/pipeline/pack", async (importOriginal) => {
  const { packStandIn } = await import("./fixtures");
  return packStandIn(await importOriginal<object>());
});
vi.mock("@/lib/generate/pipeline/research", async (importOriginal) => {
  const { researchStandIn } = await import("./fixtures");
  return researchStandIn(await importOriginal<object>());
});

// #927: `writePage` reads the confirmed business profile and the passages
// the customer switched off. This suite is about the day's decision, not
// about that read, so the seam answers "nothing confirmed" — the state a
// site whose crawl has not run is in, and the one that keeps every
// assertion below about what it was about before.
vi.mock("@/lib/generate/voice/confirmed", () => ({
  confirmedForWriting: async () => ({ profile: null, factsOff: [] }),
  refusedPassages: async () => [],
}));
vi.mock("@/lib/measure/text", () => ({ readMeasuredText: readMeasuredTextMock }));
vi.mock("@/lib/generate/pipeline/report-facts", () => ({ readReportPage: async () => null }));
vi.mock("@/lib/opportunities", () => ({
  nextForDay: nextForDayMock,
  queueForDraft: queueForDraftMock,
  restTopic: restTopicMock,
  updateInstead: updateInsteadMock,
  opportunityById: async () => null,
  sitePagesFor: async () => [],
  assessFixPages: async () => ({ done: 0, ready: 0 }),
  assessReadiness: async () => ({ ready: 1, unready: 0 }),
}));
vi.mock("@/lib/costs", () => ({ withCostContext: withCostContextMock }));
// §9's mover, at its door: the move a stopped page makes is asserted here,
// and the machine's own table and guards are tested where they live.
vi.mock("@/lib/publish/machine", () => ({ transition: transitionMock }));
// Issue 737: a page is written from the stored inventory, never a new crawl.
const crawlMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/site-profile/crawl", () => ({ crawlSite: crawlMock }));
// Issue 1187: the owner's alert, at its door. What the mail says is the
// template's own test.
const reportIncidentMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mail/ops", () => ({ reportIncident: reportIncidentMock }));

let generateDayPage: typeof import("../../src/lib/generate").generateDayPage;
let setGenerateStore: typeof import("../../src/lib/generate/store").setGenerateStore;
let DraftDateTaken: typeof import("../../src/lib/generate/store").DraftDateTaken;
let store: MemoryStore;

describe("no near-identical page across customers (SPEC §7, D13; issue 1144)", () => {
  /** The page as this site's row holds it, read off a run nothing stops. */
  async function writtenBody(markdown: string): Promise<string> {
    queueAttempt(markdown);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-06" });
    const body = outcome.ok ? store.rows.get(outcome.draftId)?.body_md : null;
    store.rows.clear();
    llmMock.mockClear();
    queueForDraftMock.mockClear();
    return body ?? "";
  }

  it("a page that matches one written for another site takes its fix call, told what the two share, then is held without naming that page", async () => {
    store.elsewhere = [await writtenBody(CLEAN_MARKDOWN)];
    queueAttempt(CLEAN_MARKDOWN);
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });

    expect(outcome).toMatchObject({ ok: false, because: "step_failed", step: "elsewhere" });
    expect(llmMock.mock.calls.map((call) => call[1].site)).toEqual(["generate.write", "generate.fix"]);
    expect(JSON.stringify(llmMock.mock.calls[1]?.[1].input.apart)).toContain("a seat limit is the constraint teams notice last");

    expect(store.rows.size).toBe(1);
    const [row] = [...store.rows.values()];
    expect(row).toMatchObject({ state: "needs_attention", hard_rules_passed: false, rule_failures: [] });
    // A number on the row, and nothing that says which page or whose.
    expect((row?.meta as { elsewhere: unknown }).elsewhere).toEqual({ similarity: 1 });
    expect(transitionMock).toHaveBeenCalledWith(
      row?.id,
      "needs_attention",
      { kind: "system", job: "draft/generate" },
      { reason: "step_failed:elsewhere" }
    );
    expect(queueForDraftMock).not.toHaveBeenCalled();
  });

  it("the rewrite that reads differently goes on to review", async () => {
    store.elsewhere = [await writtenBody(CLEAN_MARKDOWN)];
    queueAttempt(CLEAN_MARKDOWN);
    queueAttempt(OWN_MARKDOWN, "headcount");
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });

    expect(outcome).toMatchObject({ ok: true });
    const [row] = [...store.rows.values()];
    expect(row).toMatchObject({ hard_rules_passed: true });
    expect(row?.meta).not.toHaveProperty("elsewhere");
  });

});

/** The clean page's subject and its one fact, in other words. */
const OWN_MARKDOWN = [
  "## Which tool should a small team pick?",
  "",
  "Begin with headcount. A tool that fits four people can pinch at fourteen,",
  "so write down who needs to log in before comparing anything else on the list.",
  "",
  "Teams on the starter plan get 25 seats and unlimited projects for a flat",
  "monthly fee, per [the published pricing page](https://example.com/pricing).",
  "",
  "Hold each option against that figure, and rule out the ones that would",
  "make a growing team pay again within the year.",
].join("\n");

/** Every context this suite opens, so the cap and the roll-up choice can be
 *  asserted rather than assumed. */
const opened: Array<{ scanId: string; cap: string; rollUp?: string }> = [];

function measured(value: unknown) {
  return { kind: "measured", value, at: AT };
}

/** One model call's answer: the page, with `markdown` as its first section. */
function queueAttempt(markdown: string, topic = "seats"): void {
  llmMock.mockResolvedValueOnce(
    measured(pageParts(markdown, { slug: "a-title" }, topic))
  );
}

const STOPPED = "We tested every tool for months, and this one won.";
const STOPPED_AGAIN = "We tested every tool again, and this one won.";

beforeEach(async () => {
  llmMock.mockReset();
  readMeasuredTextMock.mockReset();
  nextForDayMock.mockReset();
  queueForDraftMock.mockReset();
  restTopicMock.mockReset();
  reportIncidentMock.mockReset();
  reportIncidentMock.mockResolvedValue(true);
  transitionMock.mockReset();
  updateInsteadMock.mockReset();
  updateInsteadMock.mockResolvedValue(null);
  packAnswer.missing = [];
  packAnswer.short = false;
  transitionMock.mockImplementation(async (draftId: string, to: string) => {
    const row = store.rows.get(draftId);
    if (row !== undefined) store.rows.set(draftId, { ...row, state: to });
    return { ok: true, state: to };
  });
  withCostContextMock.mockReset();
  opened.length = 0;

  readMeasuredTextMock.mockResolvedValue([
    { url: GROUNDED.url, text: SOURCE_TEXT, measuredAt: GROUNDED.readAt },
  ]);
  nextForDayMock.mockResolvedValue(opportunity());
  withCostContextMock.mockImplementation(
    async (ctx: { scanId: string; cap: string; rollUp?: string }, run: (c: unknown) => Promise<unknown>) => {
      opened.push(ctx);
      return run({
        cap: ctx.cap,
        recordFetch: () => {
          throw new Error("the generation engine must reach a model through llm()");
        },
        capHit: () => false,
        spentCents: () => 0,
        degraded: () => false,
      });
    }
  );

  ({ generateDayPage } = await import("../../src/lib/generate"));
  ({ setGenerateStore, DraftDateTaken } = await import("../../src/lib/generate/store"));
  store = memoryStore();
  setGenerateStore(store);
});

afterEach(() => {
  setGenerateStore(null);
});

describe("§8 — the day's page, under CAP_DRAFT, for the date it was asked for", () => {
  it("opens one context under CAP_DRAFT, keyed to the freshest scan, whose spend is the draft's own", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(opened).toEqual([expect.objectContaining({ cap: "DRAFT", scanId: SCAN_ID, rollUp: "none" })]);
  });

  it("the row is scheduled for the date the caller passed, and keeps the description the hosted page's head reads (issue 697)", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    expect(row?.scheduled_for).toBe("2026-09-07");
    expect(row?.meta).toMatchObject({ description: pageParts().description, contentType: "qa" });
  });
});

describe("SPEC §7 (2026-09-15, issue 712) — a written draft queues its opportunity", () => {
  it("a page that passed takes its opportunity out of the open set, once", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(queueForDraftMock.mock.calls).toEqual([[opportunity().id]]);
  });

  it("a page the checks stop takes its one fix call and, still stopped, rests in needs_attention with its topic (#788, D26)", async () => {
    queueAttempt(STOPPED);
    queueAttempt(STOPPED_AGAIN);
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "rules", attempts: 2 });
    // One write, one fix — never a third call.
    expect(llmMock.mock.calls.map((call) => call[1].site)).toEqual(["generate.write", "generate.fix"]);
    expect(store.rows.size).toBe(1);
    const [row] = [...store.rows.values()];
    expect(row?.state).toBe("needs_attention");
    expect(transitionMock).toHaveBeenCalledWith(
      row?.id,
      "needs_attention",
      { kind: "system", job: "draft/generate" },
      { reason: expect.stringMatching(/^rules:.*no_invented_test/) }
    );
    expect(queueForDraftMock).not.toHaveBeenCalled();
    expect(restTopicMock.mock.calls).toEqual([[opportunity().id, expect.any(Date)]]);
    // Issue 1187: the owner is mailed the site, the rule and the sentence.
    expect(reportIncidentMock.mock.calls).toEqual([
      [
        {
          occasion: "draft-stopped-twice",
          domain: "example.com",
          draftId: row?.id,
          attempts: 2,
          failed: [{ rule: "no_invented_test", sentences: [STOPPED_AGAIN] }],
        },
      ],
    ]);
  });

  it("an alert that cannot be sent does not fail the run: the page still rests", async () => {
    reportIncidentMock.mockRejectedValue(new Error("mail down"));
    queueAttempt(STOPPED);
    queueAttempt(STOPPED_AGAIN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "rules" });
    expect([...store.rows.values()].map((r) => r.state)).toEqual(["needs_attention"]);
  });

  it("a page its fix call clears goes on, on the date's one row, and alerts nobody", async () => {
    queueAttempt(STOPPED);
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome.ok).toBe(true);
    expect(store.rows.size).toBe(1);
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    expect(row).toMatchObject({ state: "generating", hard_rules_passed: true });
    expect(row?.body_md).toContain("Start by counting the people who will open it");
    expect(row?.body_md).not.toContain("We tested every tool");
    // The fix call was told what stopped the page (#1178); the write was not.
    expect(llmMock.mock.calls[0]?.[1].input.fix).toBeUndefined();
    expect(llmMock.mock.calls[1]?.[1].input.fix).toEqual([{ rule: "no_invented_test", sentences: [STOPPED] }]);
    expect(reportIncidentMock).not.toHaveBeenCalled();
  });

  it("a fix call that cannot run leaves the stop standing: the row rests, never waits in generating", async () => {
    queueAttempt(STOPPED);
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "rules" });
    expect([...store.rows.values()].map((row) => row.state)).toEqual(["needs_attention"]);
  });

  it("a writer that did not answer is asked once more (#813), writes no row and leaves the opportunity open", async () => {
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "step_failed", step: "write" });
    expect(llmMock).toHaveBeenCalledTimes(2);
    expect(store.rows.size).toBe(0);
    expect(queueForDraftMock).not.toHaveBeenCalled();
  });
});

describe("a short pack writes nothing (SPEC §7, D41 stage 2)", () => {
  it("the page stops naming what is missing, with no model call, and rests where the customer can see it", async () => {
    packAnswer.missing = ["buyer_questions", "facts_on_topic"];
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "step_failed", step: "pack:buyer_questions,facts_on_topic" });
    expect(llmMock).not.toHaveBeenCalled();
    const [row] = [...store.rows.values()];
    expect(row).toMatchObject({ state: "needs_attention", hard_rules_passed: false, body_md: null });
    expect(transitionMock).toHaveBeenCalledWith(
      row?.id,
      "needs_attention",
      { kind: "system", job: "draft/generate" },
      { reason: "step_failed:pack:buyer_questions,facts_on_topic" }
    );
    expect(restTopicMock.mock.calls).toEqual([[opportunity().id, expect.any(Date)]]);
  });

  it("the day goes to the next topic, and the stopped row gives up its date to it (D26)", async () => {
    const next = opportunity({ id: "44444444-4444-4444-8444-444444444444", targetQuery: "project management software plan" });
    nextForDayMock.mockResolvedValueOnce(opportunity()).mockResolvedValueOnce(next);
    // Short for the first topic only.
    packAnswer.missing = ["buyer_questions"];
    transitionMock.mockImplementation(async (draftId: string, to: string) => {
      const row = store.rows.get(draftId);
      if (row !== undefined) store.rows.set(draftId, { ...row, state: to });
      packAnswer.missing = [];
      return { ok: true, state: to };
    });
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome.ok).toBe(true);
    const rows = [...store.rows.values()];
    expect(rows.map((row) => [row.opportunity_id, row.state, row.scheduled_for])).toEqual([
      [opportunity().id, "needs_attention", null],
      [next.id, "generating", "2026-09-07"],
    ]);
    expect(queueForDraftMock.mock.calls).toEqual([[next.id]]);
  });
});

describe("issue 886 — the same evening tick delivered twice", () => {
  it("the second delivery stops on the date's own row, before the cost context and before a model call", async () => {
    store.seed({ id: "draft-today", scheduled_for: "2026-09-07", state: "in_review" });
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toEqual({ ok: false, because: "already_drafted" });
    expect(opened).toHaveLength(0);
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("delivered twice end to end, the site holds one draft and the model was asked once", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    const first = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(first.ok).toBe(true);
    const asked = llmMock.mock.calls.length;

    const second = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(second).toEqual({ ok: false, because: "already_drafted" });
    expect(store.rows.size).toBe(1);
    expect(llmMock.mock.calls.length).toBe(asked);
    expect(opened).toHaveLength(1);
  });

  it("two deliveries that both read no row leave one draft: the loser meets the index", async () => {
    // The window the read alone leaves open — both ask before either
    // writes. `drafts_one_per_site_per_date` is what decides them, and the
    // double refuses the second insert the way the index does.
    queueAttempt(CLEAN_MARKDOWN);
    queueAttempt(CLEAN_MARKDOWN);
    const write = store.insertDraft;
    store.draftOnDate = async () => false;
    store.insertDraft = async (row) => {
      const held = [...store.rows.values()].some(
        (kept) => kept.site_id === row.site_id && kept.scheduled_for === row.scheduled_for
      );
      if (held) throw new DraftDateTaken(row.site_id, row.scheduled_for);
      return write(row);
    };

    const first = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    const second = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, because: "already_drafted" });
    expect(store.rows.size).toBe(1);
    // The loser wrote no row, so it moves nothing: the opportunity is
    // queued once, by the run whose page was kept.
    expect(queueForDraftMock.mock.calls).toEqual([[opportunity().id]]);
  });

  it("a genuinely new tick — the next date — still writes its own draft", async () => {
    store.seed({ id: "draft-yesterday", scheduled_for: "2026-09-07", state: "in_review" });
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-08" });
    expect(outcome.ok).toBe(true);
    expect(store.rows.size).toBe(2);
  });
});

describe("§7 — supply is the cap: the calendar is never padded", () => {
  it("no opportunity is a day with no page, and nothing is written", async () => {
    nextForDayMock.mockResolvedValue(null);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toEqual({ ok: false, because: "no_opportunity" });
    expect(store.rows.size).toBe(0);
    expect(opened).toHaveLength(0);
  });

  it("a site with no stored report has no measured page to ground on, and spends nothing finding out", async () => {
    store.storedReport = null;
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toEqual({ ok: false, because: "no_scan" });
    expect(opened).toHaveLength(0);
  });

  it("a site the store does not hold is not a site", async () => {
    store.site = null;
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toEqual({ ok: false, because: "no_site" });
  });
});

describe("§7 (2026-09-12) — the page links into the customer's own site and to its cluster", () => {
  const INVENTORY = [
    { url: "https://example.com/", title: "Acme", h1: "Acme", purpose: "other" as const },
    { url: "https://example.com/pricing", title: "Pricing", h1: "Plans for every team", purpose: "pricing" as const },
    { url: "https://example.com/about", title: "About", h1: "Who we are", purpose: "about" as const },
    { url: "https://example.com/features", title: "Features", h1: "Everything in one place", purpose: "features" as const },
    { url: "https://example.com/products/boards", title: "Boards", h1: "Project boards", purpose: "product" as const },
  ];
  const FIRST = {
    liveUrl: "https://content.example.com/how-many-seats",
    title: "How many seats does a team need?",
    publishedAt: AT,
  };

  async function publishedHtml(): Promise<string> {
    const { renderMarkdownHtml } = await import("../../src/lib/publish/render/markdown");
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome.ok).toBe(true);
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    return renderMarkdownHtml(row?.body_md ?? "");
  }

  it("the second page of a cluster links the inventory's real pages and the first page", async () => {
    store.inventory = INVENTORY;
    store.cluster.set("seats", [FIRST]);
    nextForDayMock.mockResolvedValue(opportunity({ clusterKey: "seats" }));
    queueAttempt(CLEAN_MARKDOWN);

    const html = await publishedHtml();
    expect(html).toContain(`href="${FIRST.liveUrl}"`);
    // Issue 1391: three of the site's own pages at the least, the page a
    // reader acts on among them, and never the home page.
    const own = INVENTORY.filter((row) => html.includes(`href="${row.url}"`));
    expect(own.length).toBeGreaterThanOrEqual(3);
    expect(own.some((row) => row.purpose === "product")).toBe(true);
    expect(html).not.toContain('href="https://example.com/"');
  });

  it("the prompt is told the same pages the stored body links", async () => {
    store.inventory = INVENTORY;
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    const input = llmMock.mock.calls[0]?.[1].input as { pack: { links: Array<{ url: string }> } };
    expect(input.pack.links.map((link) => link.url)).toContain("https://example.com/pricing");
  });

  it("a site with no pricing page publishes with no pricing link, even where the model wrote one", async () => {
    store.inventory = INVENTORY.filter((row) => row.purpose !== "pricing");
    queueAttempt(`${CLEAN_MARKDOWN}\n\nCompare [the plans](https://example.com/plans).`);

    const html = await publishedHtml();
    // The grounded source is the one page the fixture's fact was read from,
    // and it stays sourced; no other pricing-shaped address is written.
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((href) => href !== GROUNDED.url);
    expect(hrefs.filter((href) => /pric|plans/.test(href ?? ""))).toEqual([]);
    expect(html).toContain('href="https://example.com/about"');
  });

  it("an opportunity outside any cluster, on a site with no profile, links nothing new", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    // No page was chosen, so none is appended: the page ends on its closing
    // line, then the outside pages it cites (issue 1486).
    const [body, sources] = (row?.body_md ?? "").split("\n\n## Sources\n\n");
    expect(body?.endsWith("[Count your seats before you choose a plan.](https://example.com/)")).toBe(true);
    expect(sources?.split("\n").filter(Boolean)).toHaveLength(2);
  });
});

describe("issue 1248 — the page is written for the site's market in force", () => {
  const CURRENT = {
    category: "seat-based project software",
    buyer: "small agencies",
    job: "plan client work",
    synonyms: [],
    differentiators: [],
    notOurMarket: ["time tracking"],
    categoryReason: "",
    rivals: [{ domain: "rival.example", name: "Rival", basis: "ranks" as const, reason: "" }],
  };
  /** What the one write call was handed about the market: its pack's. */
  const written = () =>
    (llmMock.mock.calls[0]![1].input as { pack: { business: { category: string; market: { from: string; category: string } } } }).pack.business;

  it("the writer's pack carries sites.market, and the row records it", async () => {
    const before = store.site;
    store.site = {
      ...before!,
      market: { current: CURRENT, adoptedAt: null, pending: null, categoryOverridden: false, rivalsOverridden: false },
    };
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    store.site = before;

    expect(written().category).toBe(CURRENT.category);
    expect(written().market).toMatchObject({ from: "site", category: CURRENT.category });
    const meta = (outcome.ok ? store.rows.get(outcome.draftId)?.meta : null) as { market?: unknown } | null;
    expect(meta?.market).toMatchObject({ from: "site", category: CURRENT.category, buyer: "small agencies", notOurMarket: ["time tracking"] });
  });

  it("a site with no stored market is written for its report's category, as before", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(written().market.from).toBe("report");
    const meta = (outcome.ok ? store.rows.get(outcome.draftId)?.meta : null) as { market?: { from: string } } | null;
    expect(meta?.market?.from).toBe("report");
  });
});

describe("issue 737 — the first draft, for a paid site with a free-scan cache", () => {
  it("is written from the stored inventory and never starts a crawl", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    expect((await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" })).ok).toBe(true);
    expect(crawlMock).not.toHaveBeenCalled();
  });

  it("a date that already holds a draft is refused before anything is read or spent", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    llmMock.mockReset();
    nextForDayMock.mockClear();
    const again = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(again).toEqual({ ok: false, because: "already_drafted" });
    expect(nextForDayMock).not.toHaveBeenCalled();
    expect(llmMock).not.toHaveBeenCalled();
    expect(store.rows.size).toBe(1);
  });
});

describe("a new page adds what the web does not say (SPEC §7, D12; issue 1143)", () => {
  it("a page whose pack adds too little waits for the founder and is not written", async () => {
    packAnswer.short = true;
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });

    expect(outcome).toMatchObject({ ok: false, because: "step_failed", step: "adds" });
    expect(llmMock).not.toHaveBeenCalled();
    const [row] = [...store.rows.values()];
    expect(row).toMatchObject({ state: "needs_attention", hard_rules_passed: false, meta: { adds: { short: true } } });
    expect(transitionMock).toHaveBeenCalledWith(
      row?.id,
      "needs_attention",
      { kind: "system", job: "draft/generate" },
      { reason: "step_failed:adds" }
    );
    expect(queueForDraftMock).not.toHaveBeenCalled();
  });

  it("where the site has a close page it can update, the day becomes an update of it on the same row", async () => {
    const planned = opportunity();
    const update = opportunity({
      id: planned.id,
      type: "refresh_page",
      family: "improve",
      targetRef: "https://example.com/blog/crm-for-small-teams",
      title: null,
    });
    updateInsteadMock.mockResolvedValueOnce(update);
    packAnswer.short = true;
    // The update's page: the live page's sections, each under its own heading.
    const parts = pageParts();
    llmMock.mockResolvedValueOnce(
      measured({
        ...parts,
        sections: parts.sections.map((section) => ({ ...section, key: "live" })),
        faq: ["first", "second", "third"].map((nth) => ({ question: `What is the ${nth} thing to ask?`, answer: "Count the seats." })),
      })
    );
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });

    // An update is held to no bar of what it adds.
    expect(outcome).toMatchObject({ ok: true });
    expect(updateInsteadMock).toHaveBeenCalledTimes(1);
    expect(store.rows.size).toBe(1);
    const [row] = [...store.rows.values()];
    expect(row).toMatchObject({ hard_rules_passed: true, meta: { contentType: "update", adds: { short: false } } });
    expect(queueForDraftMock).toHaveBeenCalledWith(planned.id);
  });
});
