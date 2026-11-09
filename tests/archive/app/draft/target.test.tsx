/** @vitest-environment jsdom */
// tests/app/draft/target.test.tsx — SPEC §7, board `AppDraft`
//
// *Why this page* and the page's day, through the real chain: the `drafts`
// row, the account's own `readDraftRow`, the engine's `explainChoice` over
// the real opportunity store, `assembleDraft`, and the screen rendered.
//
// **Only stored facts.** A search nobody measured is its written line, never
// a 0; a `fix_page` draft has no search and says so; a mail that never left
// is not a step of the page's day.
// The bindings `env` parses at module load, applied as a side effect before
// any module under test is evaluated (`tests/generate/env.ts` states why a
// call here would be too late: ESM hoists every import above it).
import "../../generate/env";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The save seam, as the other draft suites hold it: this file renders
// statically and never saves.
vi.mock("@/app/(account)/app/draft/[draftId]/save", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(account)/app/draft/[draftId]/save")>();
  return { ...actual, draftStore: { save: () => Promise.resolve() } };
});

/** The `drafts` rows this suite puts in, read through the same minimal
 *  builder `pipeline-grounding.test.tsx` uses: `readDraftRow` filters on
 *  `(id, site_id)`, and the record read behind it asks for rows nobody
 *  seeds here. */
const rows = new Map<string, Record<string, unknown>[]>();

vi.mock("@/lib/db", () => {
  const builder = (table: string) => {
    const eq: { column: string; value: unknown }[] = [];
    const self: Record<string, unknown> = {
      select: () => self,
      order: () => self,
      limit: () => self,
      in: () => self,
      not: () => self,
      is: () => self,
      eq: (column: string, value: unknown) => {
        eq.push({ column, value });
        return self;
      },
      then: (resolve: (r: unknown) => unknown) => {
        const kept = (rows.get(table) ?? []).filter((row) => eq.every((f) => row[f.column] === f.value));
        return Promise.resolve(resolve({ data: kept, error: null }));
      },
    };
    return self;
  };
  return { dbAdmin: () => ({ from: (table: string) => builder(table) }) };
});

import { copy } from "@/lib/presentation/copy";
import { measured, unmeasured } from "@/lib/measure/measured";
import { setOpportunityStore } from "@/lib/opportunities/store";
import type { Evidence, PlanReason, TargetFacts } from "@/lib/opportunities/types";
import { readDraftRow } from "@/app/(account)/app/draft/[draftId]/store";
import { assembleDraft } from "@/app/(account)/app/draft/[draftId]/model";
import { DraftScreen } from "@/app/(account)/app/draft/[draftId]/DraftScreen";
import { memoryStore, newMemoryState } from "../../opportunities/memory-store";

const SITE_ID = "22222222-2222-4222-8222-222222222867";
const SCAN_ID = "11111111-1111-4111-8111-111111111867";
const DRAFT_ID = "44444444-4444-4444-8444-444444444867";
const OPPORTUNITY_ID = "55555555-5555-4555-8555-555555555867";
const AT = new Date("2026-09-14T06:00:00.000Z");
const SITE = { siteId: SITE_ID, timeZone: "America/New_York", mode: "autopilot" as const, domain: "example.com" };
const SEARCH = "seo content brief template for startups";

const ENGINES: TargetFacts["engines"] = [
  { engine: "ai_overview", standing: "names_others" },
  { engine: "ai_mode", standing: "no_answer" },
  { engine: "chatgpt", standing: "names_you" },
];

function writeEvidence(target?: TargetFacts): Evidence {
  return {
    family: "write",
    query: SEARCH,
    volume: measured(40, AT),
    rival: {
      domain: "briefkit.io",
      url: measured("https://briefkit.io/templates", AT),
      position: measured(3, AT),
    },
    ...(target === undefined ? {} : { target }),
  };
}

/** One opportunity in the engine's own store, and one draft written from
 *  it. Everything between them is the product's. */
function seed(a: {
  evidence: Evidence;
  type?: string;
  fitBand?: string | null;
  opportunityId?: string | null;
  planReason?: PlanReason;
  told?: unknown;
}): void {
  const state = newMemoryState({
    rows: [
      {
        id: OPPORTUNITY_ID,
        site_id: SITE_ID,
        scan_id: SCAN_ID,
        type: a.type ?? "answer_page",
        family: a.evidence.family,
        target_query: a.evidence.family === "fix" ? null : a.evidence.query,
        target_ref: "seo-content-brief-template-for-startups",
        proposed_slug: null,
        title: null,
        volume: 40,
        evidence: a.evidence,
        acceptance: { form: "top20", query: SEARCH },
        fit_band: a.fitBand === undefined ? "winnable" : a.fitBand,
        effort: 0.5,
        status: "queued",
        cluster_key: null,
        absorbed_queries: [],
        ready: true,
        unready_reason: null,
        plan_reason: a.planReason ?? null,
        created_at: AT.toISOString(),
      },
    ],
  });
  setOpportunityStore(memoryStore(state));

  rows.set("drafts", [
    {
      id: DRAFT_ID,
      site_id: SITE_ID,
      opportunity_id: a.opportunityId === undefined ? OPPORTUNITY_ID : a.opportunityId,
      state: "in_review",
      title: "How a startup should brief its SEO content",
      body_md: "## A brief\n\nOne paragraph of the page as it would publish.",
      meta: { description: "A brief." },
      grounded_fact: null,
      claim_check: null,
      rule_failures: null,
      veto_deadline: new Date("2026-09-15T06:00:00.000Z").toISOString(),
      created_at: AT.toISOString(),
      told: a.told ?? null,
    },
  ]);
}

async function screen(): Promise<Element> {
  const facts = await readDraftRow({ draftId: DRAFT_ID, site: SITE });
  if (facts === null) throw new Error("the draft did not read back");
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <DraftScreen view={assembleDraft(facts)} generatedLabel="written by ReachKit" />
  );
  return container;
}

async function block(): Promise<Element> {
  const found = (await screen()).querySelector('[data-testid="draft-why"]');
  if (found === null) throw new Error("the draft screen drew no target block");
  return found;
}

beforeEach(() => {
  rows.clear();
});

afterEach(() => {
  setOpportunityStore(null);
  vi.restoreAllMocks();
});

describe("Why this page: the search and who answers it", () => {
  it("states the search, how often it is searched and who answers it, and no difficulty, band or engine", async () => {
    seed({
      evidence: writeEvidence({ difficulty: measured(12, AT), ceiling: 36, engines: ENGINES }),
    });
    const why = await block();
    const text = why.textContent ?? "";

    expect(why.querySelector("h2")?.textContent).toBe(copy("draft.why.title"));
    const search = why.querySelector('[data-testid="draft-search"]');
    expect(search?.tagName).toBe("DETAILS");
    expect(search?.querySelector("summary")?.textContent).toBe(copy("draft.search.title"));
    const terms = [...why.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(terms).toEqual([copy("draft.search.query"), copy("draft.search.volume"), copy("draft.search.rival")]);
    const values = [...why.querySelectorAll("dd")].map((dd) => dd.textContent);
    expect(values).toEqual([SEARCH, "40", "briefkit.io"]);

    // The board removed the jargon: no difficulty, no ceiling, no band, no engines.
    expect(text).not.toContain(copy("calendar.why.difficulty"));
    expect(text).not.toContain("36");
    expect(text).not.toContain(copy("band.winnability.winnable"));
    expect(why.querySelector('[data-testid^="engine-"]')).toBeNull();
  });

  it("says why the week chose it, from the stored plan reason", async () => {
    seed({
      evidence: writeEvidence(),
      planReason: { points: 5, parts: [{ part: "fit", n: 3 }, { part: "ai_gap", n: 2 }], rule: null },
    });
    expect((await block()).textContent).toContain(copy("calendar.week.why.ai-gap"));
  });

  it("a search nobody measured is its written line, never a 0", async () => {
    seed({ evidence: { ...(writeEvidence() as Extract<Evidence, { family: "write" }>), volume: unmeasured<number>("undeterminable", AT) } });
    const values = [...(await block()).querySelectorAll("dd")].map((dd) => dd.textContent);

    expect(values[1]).toBe(copy("unmeasured.undeterminable", { what: SEARCH }));
  });

  it("a written page is a new page", async () => {
    seed({ evidence: writeEvidence() });
    expect((await screen()).querySelector('[data-testid="draft-kind"]')?.textContent).toBe(copy("calendar.card.new-page"));
  });

  it("a fix_page draft has no search, says so, and is an update", async () => {
    seed({
      evidence: { family: "fix", issues: [], pageUrl: "https://example.com/pricing" },
      type: "fix_page",
      fitBand: null,
    });
    const drawn = await screen();
    const why = drawn.querySelector('[data-testid="draft-why"]');

    expect(why?.textContent).toContain(copy("draft.target.fix"));
    expect(why?.querySelector('[data-testid="draft-search"]')).toBeNull();
    expect(drawn.querySelector('[data-testid="draft-kind"]')?.textContent).toBe(copy("calendar.card.update"));
  });

  it("a draft whose opportunity cannot be read says so in one sentence, and names no kind", async () => {
    seed({ evidence: writeEvidence(), opportunityId: null });
    const drawn = await screen();

    expect(drawn.querySelector('[data-testid="draft-why"]')?.textContent).toContain(copy("draft.target.unknown"));
    expect(drawn.querySelector('[data-testid="draft-kind"]')).toBeNull();
  });
});

describe("the page's day", () => {
  const SENT = "2026-09-14T06:05:00.000Z";

  it("is written, emailed, goes live and is first read, in that order, when the mail left", async () => {
    seed({ evidence: writeEvidence(), told: { kind: "interval", sentAt: SENT, mailed: true } });
    const day = (await screen()).querySelector('[data-testid="draft-day"]');

    expect([...(day?.querySelectorAll("li") ?? [])].map((li) => li.getAttribute("data-testid"))).toEqual([
      "draft-day-written",
      "draft-day-emailed",
      "draft-day-live",
      "draft-day-reading",
    ]);
    expect(day?.textContent).toContain(copy("draft.day.emailed"));
    // The page goes live on Tuesday 15 September; the next Monday's scan is
    // the first to read it.
    expect(day?.querySelector('[data-testid="draft-day-reading"]')?.textContent).toContain("Sep 21, 2026");
  });

  it("names no mail where the customer had it switched off, or where none is recorded", async () => {
    for (const told of [{ kind: "interval", sentAt: SENT, mailed: false }, { kind: "interval", sentAt: SENT }, null]) {
      seed({ evidence: writeEvidence(), told });
      const day = (await screen()).querySelector('[data-testid="draft-day"]');
      expect(day, JSON.stringify(told)).not.toBeNull();
      expect(day?.querySelector('[data-testid="draft-day-emailed"]'), JSON.stringify(told)).toBeNull();
    }
  });
});
