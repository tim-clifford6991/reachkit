// tests/generate/day-page.test.ts — BUILD §8's timing and its one
// automatic regeneration, at the engine's public entry point.
//
// §8: "the day's page is generated the evening before its publish date from
// the freshest scan. `CAP_DRAFT` enforced before the pipeline runs."
// ADR-070: "one automatic regeneration; a draft that has entered review is
// never regenerated."
//
// §7's supply rule is the other half: `nextForDay` answering `null` is a
// day with no page, never an invented one.
import "./env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPS } from "../../src/lib/config/constants";
import {
  AT,
  CLEAN_MARKDOWN,
  GROUNDED,
  SCAN_ID,
  SITE_ID,
  SOURCE_TEXT,
  NO_OPS,
  OUTLINE_ANSWER,
  draftAnswers,
  draftParts,
  memoryStore,
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
} = vi.hoisted(() => ({
  llmMock: vi.fn(),
  readMeasuredTextMock: vi.fn(),
  nextForDayMock: vi.fn(),
  withCostContextMock: vi.fn(),
  queueForDraftMock: vi.fn(),
  restTopicMock: vi.fn(),
  transitionMock: vi.fn(),
}));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

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

/** Every context this suite opens, so the cap and the roll-up choice can be
 *  asserted rather than assumed. */
const opened: Array<{ scanId: string; cap: string; rollUp?: string }> = [];

const BRIEF = { readerQuestion: "Which tool?", angle: "count seats", mustCover: ["seats"], factIndexes: [0] };
const OUTLINE = OUTLINE_ANSWER;

function measured(value: unknown) {
  return { kind: "measured", value, at: AT };
}

function body(markdown: string) {
  return draftParts(markdown, { title: "A title", slug: "a-title", description: "A description." });
}

/** One pass of the four model steps. The site's do-not-claim list is empty,
 *  so the claim check passes without a call. */
function queueAttempt(markdown: string): void {
  llmMock.mockResolvedValueOnce(measured(BRIEF));
  llmMock.mockResolvedValueOnce(measured(OUTLINE));
  for (const answer of draftAnswers(body(markdown))) llmMock.mockResolvedValueOnce(measured(answer));
  llmMock.mockResolvedValueOnce(measured(NO_OPS));
}

beforeEach(async () => {
  llmMock.mockReset();
  readMeasuredTextMock.mockReset();
  nextForDayMock.mockReset();
  queueForDraftMock.mockReset();
  restTopicMock.mockReset();
  reportIncidentMock.mockReset();
  reportIncidentMock.mockResolvedValue(true);
  transitionMock.mockReset();
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

describe("§8 — CAP_DRAFT, on the scan the day's page is generated from", () => {
  it("opens one context, under CAP_DRAFT, keyed to the freshest scan", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ cap: "DRAFT", scanId: SCAN_ID });
  });

  it("does not roll the draft's spend into the scan's total — the draft's cost is the draft's", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(opened[0]?.rollUp).toBe("none");
  });

  it("CAP_DRAFT is §8's 45¢", () => {
    expect(CAPS.DRAFT_C).toBe(45);
  });
});

describe("§8 — the day's page is for the day after the evening it is generated", () => {
  it("the publish date the caller passes is the date the row is scheduled for", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome.ok).toBe(true);
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    expect(row?.scheduled_for).toBe("2026-09-07");
  });
});

describe("issue 697 — the draft keeps the description the hosted page's head reads", () => {
  it("the description the draft step wrote is stored on the row's meta", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    // `toMatchObject`, not `toEqual`: since #927 the row also records what
    // the page was written from — the passages the brief chose, and the
    // profile items where the site has a profile. What this test is about is
    // the description the hosted page's head reads, and that it is still
    // there and still exact.
    expect(row?.meta).toMatchObject({ description: "A description." });
  });
});

describe("SPEC §7 (2026-09-15, issue 712) — a written draft queues its opportunity", () => {
  it("a page that passed takes its opportunity out of the open set, once", async () => {
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(queueForDraftMock.mock.calls).toEqual([[opportunity().id]]);
  });

  it("a draft the battery stopped twice rests in needs_attention and its topic rests, not queued (#788, D26)", async () => {
    queueAttempt("We tested every tool for months, and this one won.");
    queueAttempt("We tested every tool again, and this one won.");
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "rules" });
    const [row] = [...store.rows.values()];
    expect(row?.state).toBe("needs_attention");
    expect(transitionMock).toHaveBeenCalledWith(
      row?.id,
      "needs_attention",
      { kind: "system", job: "draft/generate" },
      { reason: expect.stringMatching(/^rules:.+/) }
    );
    expect(queueForDraftMock).not.toHaveBeenCalled();
    expect(restTopicMock.mock.calls).toEqual([[opportunity().id, expect.any(Date)]]);
  });

  it("a run that wrote no draft leaves the opportunity open for the next evening", async () => {
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(queueForDraftMock).not.toHaveBeenCalled();
  });
});

describe("ADR-070 — one automatic regeneration, and no more", () => {
  it("a first attempt stopped by a rule is regenerated once", async () => {
    queueAttempt("We tested every tool for months, and this one won.");
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome.ok).toBe(true);
    // #788: the regeneration rewrites the date's one row.
    expect(store.rows.size).toBe(1);
    const row = outcome.ok ? store.rows.get(outcome.draftId) : undefined;
    expect(row).toMatchObject({
      state: "generating",
      body_md: expect.stringContaining("Start by counting the people who will open it"),
      hard_rule_attempts: 1,
    });
    expect(row?.body_md).not.toContain("We tested every tool");
  });

  it("the regeneration is told what stopped the first attempt (#1178), and the first is not", async () => {
    queueAttempt("We tested every tool for months, and this one won.");
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    const drafts = llmMock.mock.calls.map((call) => call[1]).filter((a) => a.site === "generate.draft");
    expect(drafts[0].input.fix).toBeUndefined();
    expect(drafts[1].input.fix).toEqual([
      { rule: "no_invented_test", sentences: ["We tested every tool for months, and this one won."] },
    ]);
  });

  it("a second attempt stopped again comes to rest — never a third", async () => {
    queueAttempt("We tested every tool for months, and this one won.");
    queueAttempt("We tested every tool again, and this one won.");
    queueAttempt(CLEAN_MARKDOWN);
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "rules", attempts: 2 });
    expect(store.rows.size).toBe(1);
  });

  it("a draft stopped twice mails the owner the site, the rule and the sentence that broke it (issue 1187)", async () => {
    queueAttempt("We tested every tool for months, and this one won.");
    queueAttempt("We tested every tool again, and this one won.");
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    const [row] = [...store.rows.values()];
    expect(reportIncidentMock.mock.calls).toEqual([
      [
        {
          occasion: "draft-stopped-twice",
          domain: "example.com",
          draftId: row?.id,
          attempts: 2,
          failed: [{ rule: "no_invented_test", sentences: ["We tested every tool again, and this one won."] }],
        },
      ],
    ]);
  });

  it("a draft stopped once and then written clean alerts nobody", async () => {
    queueAttempt("We tested every tool for months, and this one won.");
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(reportIncidentMock).not.toHaveBeenCalled();
  });

  it("an alert that cannot be sent does not fail the run: the page still rests", async () => {
    reportIncidentMock.mockRejectedValue(new Error("mail down"));
    queueAttempt("We tested every tool for months, and this one won.");
    queueAttempt("We tested every tool again, and this one won.");
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "rules" });
    expect([...store.rows.values()].map((r) => r.state)).toEqual(["needs_attention"]);
  });

  it("a regeneration that cannot run leaves the first stop standing: the row rests, never waits in generating", async () => {
    queueAttempt("We tested every tool for months, and this one won.");
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "rules" });
    expect([...store.rows.values()].map((row) => row.state)).toEqual(["needs_attention"]);
  });

  it("a step that did not run consumes no attempt: it stops at once", async () => {
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    const outcome = await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    expect(outcome).toMatchObject({ ok: false, because: "step_failed", step: "brief" });
    expect(store.rows.size).toBe(0);
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
    for (const url of [
      "https://example.com/pricing",
      "https://example.com/about",
      "https://example.com/features",
      "https://example.com/products/boards",
      FIRST.liveUrl,
    ]) {
      expect(html).toContain(`href="${url}"`);
    }
    expect(html).not.toContain('href="https://example.com/"');
  });

  it("the prompt is told the same pages the stored body links", async () => {
    store.inventory = INVENTORY;
    queueAttempt(CLEAN_MARKDOWN);
    await generateDayPage({ siteId: SITE_ID, publishDate: "2026-09-07" });
    const input = llmMock.mock.calls[2]?.[1].input as { links: Array<{ url: string }> };
    expect(input.links.map((link) => link.url)).toContain("https://example.com/pricing");
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
    // line, which points at the site itself.
    expect(row?.body_md?.endsWith("[Count your seats before you choose a plan.](https://example.com/)")).toBe(true);
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
